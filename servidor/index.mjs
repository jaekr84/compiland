// Servidor del ranking de la clase (Neon Function).
// Guarda jugadores (apodo + PIN protegido), sus resultados y arma el ranking.
// Habla con Postgres por HTTP (sin librerías) para que el paquete quede chiquito.
import { scrypt as _scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);

const DB = process.env.DATABASE_URL;
const SQL_URL = DB ? 'https://' + new URL(DB).hostname + '/sql' : '';
const pool = {
  async query(query, params = []) {
    const r = await fetch(SQL_URL, {
      method: 'POST',
      headers: { 'Neon-Connection-String': DB, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, params }),
    });
    const data = await r.json();
    if (!r.ok) { const e = new Error(data.message || 'sql'); e.code = data.code; throw e; }
    return data;
  },
};

const ZONA = 'America/Argentina/Buenos_Aires';
const MAX_FALLOS = 5, BLOQUEO_MIN = 10;          // 5 PIN mal → 10 minutos bloqueado
const APODO_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,15}$/u;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const error = (codigo, status = 400) => json({ ok: false, error: codigo }, status);

async function hashPin(pin) {
  const sal = randomBytes(16);
  const h = await scrypt(pin, sal, 32);
  return sal.toString('hex') + ':' + h.toString('hex');
}
async function pinOk(pin, guardado) {
  const [salHex, hHex] = guardado.split(':');
  const h = await scrypt(pin, Buffer.from(salHex, 'hex'), 32);
  return timingSafeEqual(h, Buffer.from(hHex, 'hex'));
}
const sha = t => createHash('sha256').update(t).digest('hex');

async function nuevaSesion(jugadorId) {
  const token = randomBytes(24).toString('base64url');
  await pool.query('INSERT INTO sesiones (token_hash, jugador_id) VALUES ($1, $2)', [sha(token), jugadorId]);
  return token;
}
async function jugadorDeToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 64) return null;
  const { rows } = await pool.query(
    'SELECT j.id, j.apodo, j.admin FROM sesiones s JOIN jugadores j ON j.id = s.jugador_id WHERE s.token_hash = $1',
    [sha(token)]);
  return rows[0] || null;
}

// ---------- entrar: crea el apodo si no existe, si existe verifica el PIN ----------
async function entrar(body) {
  const apodo = String(body.apodo || '').trim().replace(/\s+/g, ' ');
  const pin = String(body.pin || '');
  if (!APODO_RE.test(apodo)) return error('apodo_invalido');
  if (!/^\d{4}$/.test(pin)) return error('pin_invalido');

  const { rows } = await pool.query(
    'SELECT id, apodo, pin_hash, fallos, bloqueado_hasta, admin FROM jugadores WHERE lower(apodo) = lower($1)', [apodo]);
  if (!rows.length) {
    if (body.crear !== true) return error('no_existe', 404);
    try {
      const r = await pool.query('INSERT INTO jugadores (apodo, pin_hash) VALUES ($1, $2) RETURNING id, apodo',
        [apodo, await hashPin(pin)]);
      return json({ ok: true, nuevo: true, apodo: r.rows[0].apodo, token: await nuevaSesion(r.rows[0].id) });
    } catch (e) {
      if (e.code === '23505') return error('apodo_ocupado', 409);   // otro lo creó recién
      throw e;
    }
  }
  const j = rows[0];
  if (j.bloqueado_hasta && new Date(j.bloqueado_hasta) > new Date()) return error('bloqueado', 429);
  if (!(await pinOk(pin, j.pin_hash))) {
    const fallos = j.fallos + 1;
    // a los administradores se los bloquea más tiempo: su PIN abre la lista de palabras
    const minutos = j.admin ? 60 : BLOQUEO_MIN;
    if (fallos >= MAX_FALLOS)
      await pool.query(`UPDATE jugadores SET fallos = 0, bloqueado_hasta = now() + interval '${minutos} minutes' WHERE id = $1`, [j.id]);
    else
      await pool.query('UPDATE jugadores SET fallos = $2 WHERE id = $1', [j.id, fallos]);
    if (body.crear === true) return error('apodo_ocupado', 409);   // quería crear uno nuevo con un nombre usado
    return error(fallos >= MAX_FALLOS ? 'bloqueado' : 'pin_mal', 401);
  }
  await pool.query('UPDATE jugadores SET fallos = 0, bloqueado_hasta = NULL WHERE id = $1', [j.id]);
  return json({ ok: true, nuevo: false, apodo: j.apodo, admin: j.admin, token: await nuevaSesion(j.id) });
}

// ---------- guardar un resultado (con límites para descartar lo imposible) ----------
const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
async function resultado(body) {
  const j = await jugadorDeToken(body.token);
  if (!j) return error('sesion', 401);
  const r = body.r || {};
  const app = r.app === undefined ? 'tecla' : r.app;
  if (typeof app !== 'string' || !/^[a-z0-9]{1,16}$/.test(app)) return error('datos');
  if (!entero(r.ms, 0, 3600000)) return error('datos');
  let fila;
  if (app !== 'tecla') {
    // otros juegos del sitio: mandan sus puntos directamente
    if (r.m !== 'p' || !entero(r.p, 0, 5000)) return error('datos');
    fila = ['p', typeof r.lg === 'string' ? r.lg.slice(0, 5) : 'es', null, r.p, null, null, null, r.ms];
  } else if (!['es', 'en', 'ko'].includes(r.lg) || !entero(r.a, 0, 100)) {
    return error('datos');
  } else if (r.m === 'g') {
    if (typeof r.lv !== 'string' || !/^[a-z0-9]{1,12}$/.test(r.lv)) return error('datos');
    if (!entero(r.p, 0, 50000) || !entero(r.wd, 0, 2000)) return error('datos');
    // cada palabra da 10 + 3 por letra: más de 100 por palabra no puede ser
    if (r.p > r.wd * 100) return error('datos');
    // no se pueden escribir más de ~4 palabras por segundo
    if (r.wd > 5 && r.wd > (r.ms / 1000) * 4) return error('datos');
    fila = ['g', r.lg, r.lv, r.p, r.wd, null, r.a, r.ms];
  } else if (r.m === 'l') {
    if (!entero(r.w, 0, 220)) return error('datos');
    fila = ['l', r.lg, null, null, null, r.w, r.a, r.ms];
  } else return error('datos');

  // como mucho un resultado cada 3 segundos
  const { rows } = await pool.query(
    "SELECT 1 FROM resultados WHERE jugador_id = $1 AND t > now() - interval '3 seconds' LIMIT 1", [j.id]);
  if (rows.length) return error('muy_rapido', 429);

  await pool.query(
    `INSERT INTO resultados (jugador_id, tipo, lg, nivel, puntos, palabras, ppm, precision, ms, app)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [j.id, ...fila, app]);
  return json({ ok: true });
}

// ---------- ranking: juego, velocidad y minutos de cada jugador ----------
async function ranking(url) {
  const periodo = url.searchParams.get('p') === 'siempre' ? 'siempre' : 'semana';
  const desde = periodo === 'semana'
    ? `date_trunc('week', now() AT TIME ZONE '${ZONA}') AT TIME ZONE '${ZONA}'`
    : `'-infinity'::timestamptz`;
  const { rows } = await pool.query(`
    WITH r AS (SELECT * FROM resultados WHERE t >= ${desde}),
    juego AS (   -- la suma del mejor puntaje de cada nivel
      SELECT jugador_id, sum(mejor)::int AS juego
      FROM (SELECT jugador_id, lg, nivel, max(puntos) AS mejor FROM r WHERE tipo = 'g' GROUP BY 1,2,3) x
      GROUP BY 1),
    vel AS (     -- mejor velocidad con al menos 90% de precisión
      SELECT jugador_id, max(ppm)::int AS ppm FROM r WHERE tipo = 'l' AND precision >= 90 GROUP BY 1),
    tiempo AS (SELECT jugador_id, sum(ms)::bigint AS ms FROM r GROUP BY 1)
    SELECT j.apodo, coalesce(juego.juego, 0) AS juego, coalesce(vel.ppm, 0) AS ppm,
           round(coalesce(tiempo.ms, 0) / 60000.0)::int AS minutos
    FROM jugadores j
    LEFT JOIN juego ON juego.jugador_id = j.id
    LEFT JOIN vel ON vel.jugador_id = j.id
    LEFT JOIN tiempo ON tiempo.jugador_id = j.id
    ORDER BY j.apodo`);
  return json({ ok: true, periodo, jugadores: rows });
}

// ---------- ranking general: suma los puntos de todos los juegos ----------
// Tecla a Tecla: el juego de palabras da sus puntos (10 + 3 por letra ≈ 5 por tecla).
// Cada lección da lo mismo: 5 puntos por tecla bien apretada × precisión
// (ppm × minutos × 5 = teclas). Así una lección corta no vale lo mismo que una larga.
const PUNTOS = `CASE tipo WHEN 'l' THEN round(ppm * ms * precision / 240000.0)::int ELSE coalesce(puntos, 0) END`;
async function general(url) {
  const periodo = url.searchParams.get('p') === 'siempre' ? 'siempre' : 'semana';
  const desde = periodo === 'semana'
    ? `date_trunc('week', now() AT TIME ZONE '${ZONA}') AT TIME ZONE '${ZONA}'`
    : `'-infinity'::timestamptz`;
  const { rows } = await pool.query(`
    WITH por_app AS (
      SELECT jugador_id, app, sum(${PUNTOS})::int AS pts, count(*)::int AS n
      FROM resultados WHERE t >= ${desde} GROUP BY 1, 2)
    SELECT j.apodo, sum(p.pts)::int AS puntos, sum(p.n)::int AS partidas,
           jsonb_object_agg(p.app, p.pts) AS por_juego
    FROM por_app p JOIN jugadores j ON j.id = p.jugador_id
    GROUP BY j.apodo
    ORDER BY puntos DESC, j.apodo`);
  return json({ ok: true, periodo, jugadores: rows });
}

// ---------- palabras de la clase (las carga la maestra desde maestra.html) ----------
const MAESTRA = process.env.MAESTRA_CLAVE || '';
const MAX_PALABRAS = 500;                          // por idioma
const FORMA = {                                    // sólo letras que se pueden escribir en cada teclado
  es: /^[a-záéíóúüñ]{2,20}$/,
  en: /^[a-z]{2,20}$/,
  ko: /^[가-힣]{1,10}$/,
};
let fallosMaestra = [];                            // clave mal: como mucho 10 intentos cada 10 minutos
function claveOk(clave) {
  const ahora = Date.now();
  fallosMaestra = fallosMaestra.filter(t => ahora - t < 600000);
  if (fallosMaestra.length >= 10) return 'bloqueado';
  if (MAESTRA.length < 12 || typeof clave !== 'string') { fallosMaestra.push(ahora); return false; }
  const ok = timingSafeEqual(createHash('sha256').update(clave).digest(), createHash('sha256').update(MAESTRA).digest());
  if (!ok) fallosMaestra.push(ahora);
  return ok;
}
async function exigirMaestra(body) {
  if (body.token !== undefined) {                  // un jugador marcado como administrador
    const j = await jugadorDeToken(body.token);
    if (!j) return error('sesion', 401);
    return j.admin ? null : error('no_admin', 403);
  }
  const ok = claveOk(body.clave);                  // plan B: la clave de maestra
  if (ok === 'bloqueado') return error('bloqueado', 429);
  return ok ? null : error('clave', 401);
}
async function listarPalabras(lg) {
  const { rows } = await pool.query('SELECT id, palabra FROM palabras_clase WHERE lg = $1 ORDER BY palabra', [lg]);
  return rows;
}
async function palabrasGet(url) {
  const lg = url.searchParams.get('lg');
  if (!FORMA[lg]) return error('datos');
  return json({ ok: true, palabras: (await listarPalabras(lg)).map(r => r.palabra) });
}
async function palabrasEditar(body) {
  const no = await exigirMaestra(body); if (no) return no;
  const lg = body.lg;
  if (!FORMA[lg]) return error('datos');
  const rechazadas = [];
  if (Array.isArray(body.borrar) && body.borrar.length) {
    const ids = body.borrar.filter(n => Number.isInteger(n)).slice(0, 500);
    await pool.query('DELETE FROM palabras_clase WHERE lg = $1 AND id = ANY($2::int[])', [lg, ids]);
  }
  if (Array.isArray(body.agregar) && body.agregar.length) {
    const nuevas = [];
    for (const x of body.agregar.slice(0, 500)) {
      const w = String(x).normalize('NFC').trim().toLocaleLowerCase(lg);
      if (!w) continue;
      (FORMA[lg].test(w) ? nuevas : rechazadas).push(w);
    }
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM palabras_clase WHERE lg = $1', [lg]);
    const lugar = Math.max(0, MAX_PALABRAS - rows[0].n);
    if (nuevas.length > lugar) rechazadas.push(...nuevas.splice(lugar));
    if (nuevas.length)
      await pool.query(`INSERT INTO palabras_clase (lg, palabra) SELECT $1, unnest($2::text[])
                        ON CONFLICT DO NOTHING`, [lg, nuevas]);
  }
  return json({ ok: true, rechazadas, palabras: await listarPalabras(lg), maximo: MAX_PALABRAS });
}
async function maestra(body) {
  const no = await exigirMaestra(body); if (no) return no;
  return json({ ok: true });
}

// ---------- ¿la sesión sigue valiendo? (la portada lo pregunta al abrir) ----------
async function yo(body) {
  const j = await jugadorDeToken(body.token);
  return j ? json({ ok: true, apodo: j.apodo, admin: j.admin }) : error('sesion', 401);
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/ranking') return await ranking(url);
      if (request.method === 'GET' && url.pathname === '/general') return await general(url);
      if (request.method === 'GET' && url.pathname === '/palabras') return await palabrasGet(url);
      if (request.method === 'POST') {
        const texto = await request.text();
        if (texto.length > 20000) return error('datos', 413);
        let body; try { body = JSON.parse(texto); } catch { return error('datos'); }
        if (url.pathname === '/entrar') return await entrar(body);
        if (url.pathname === '/resultado') return await resultado(body);
        if (url.pathname === '/yo') return await yo(body);
        if (url.pathname === '/palabras') return await palabrasEditar(body);
        if (url.pathname === '/maestra') return await maestra(body);
      }
      if (url.pathname === '/') return json({ ok: true, app: 'tecla-a-tecla' });
      return error('no_encontrado', 404);
    } catch (e) {
      console.error(e);
      return error('servidor', 500);
    }
  },
};
