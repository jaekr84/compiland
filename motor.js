// motor.js — lo que comparten los juegos con niveles del sitio (Factor X, Desapariciones Misteriosas):
// la partida (cuenta regresiva, reloj, puntos, combo, errores, teclado de números), la pantalla final,
// el sonido y el envío de puntos al ranking general.
//
// Uso: la página tiene <section class="juego" id="juego" hidden></section>, carga este archivo y motor.css,
// define sus minijuegos en MINIJUEGOS[n] = m => { ... } y llama a Motor.iniciar({...}) (ver abajo).
// Después, Motor.jugar(n) arranca el nivel n y Motor.limpiar() lo corta.

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const corazones = n => '♥'.repeat(Math.max(0, n)) || '—';
const azar = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const mezclar = a => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
const MINIJUEGOS = {};

// ---------- sesión y servidor (el mismo que usa todo el sitio) ----------
const sesion = (() => { try { return JSON.parse(localStorage.getItem('aprender.sesion')); } catch (e) { return null; } })();
// ?api=http://localhost:8787 usa el servidor local. Sólo se acepta la propia computadora.
const API = (() => {
  const q = new URLSearchParams(location.search).get('api');
  return q && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(q) ? q
    : 'https://br-fancy-cherry-auqw065l-clase.compute.c-10.us-east-1.aws.neon.tech';
})();

// ---------- sonido ----------
let sonido = true, audio;
function bip(frec, dur = .09, tipo = 'sine', vol = .07) {
  if (!sonido) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = tipo; o.frequency.value = frec;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
  } catch (e) {}
}

// ---------- la partida ----------
// partida.gen cambia en cada partida: así un cuadro o una espera de la partida anterior no sigue corriendo.
const partida = { activa: false, gen: 0, timers: [], onTecla: null, onElegir: null };
const multi = () => Math.min(4, 1 + Math.floor(partida.racha / 5));
function hud() {
  $('hAciertos').textContent = partida.aciertos;
  $('hPuntos').textContent = partida.puntos;
  $('hMulti').textContent = '×' + multi();
  $('hCombo').classList.toggle('on', multi() > 1);
}

// Cada minijuego recibe `motor` (m) y lo usa para el reloj, los puntos, los errores, la entrada de números, etc.
const motor = {
  get escenario() { return $('escenario'); },
  espera(fn, ms) { partida.timers.push(setTimeout(fn, ms)); },
  cuadro(fn) {
    const g = partida.gen;
    requestAnimationFrame(t => { if (partida.activa && partida.gen === g) fn(t); });
  },
  // cuenta regresiva de `dur` ms con la barra de arriba; t.sumar(-3000) quita tiempo, t.parar() lo frena
  temporizador(dur, { alAcabar = () => motor.fin(), cadaCuadro } = {}) {
    const t = { fin: performance.now() + dur, resta: () => t.fin - performance.now(), sumar(ms) { t.fin += ms; }, parar() { t.parado = true; } };
    const tick = () => {
      if (t.parado) return;
      const r = t.resta();
      motor.reloj(r / dur, Math.ceil(r / 1000));
      if (cadaCuadro) cadaCuadro(r);
      if (r <= 0) return alAcabar();
      motor.cuadro(tick);
    };
    tick();
    return t;
  },
  // para los juegos sin reloj: la primera casilla del HUD muestra otra cosa (vidas, ronda…)
  marcador(valor, etiqueta) {
    $('tiempo').hidden = true;
    $('hTiempo').textContent = valor;
    if (etiqueta) $('hTiempoLbl').textContent = etiqueta;
  },
  bono(pts) { partida.puntos += pts; hud(); },
  // barra de tiempo: frac de 1 a 0, y los segundos que quedan
  reloj(frac, seg) {
    $('tiempoBarra').style.transform = 'scaleX(' + Math.max(0, frac) + ')';
    $('tiempo').classList.toggle('apuro', seg <= 5);
    $('hTiempo').textContent = Math.max(0, seg);
  },
  acierto(base = 10) {
    partida.aciertos++; partida.racha++;
    partida.mejorRacha = Math.max(partida.mejorRacha, partida.racha);
    const pts = base * multi();
    partida.puntos += pts; hud();
    bip(620 + Math.min(partida.racha, 12) * 45);
    return pts;
  },
  // suave: sin sacudir la pantalla
  error(suave) {
    partida.errores++; partida.racha = 0; hud();
    bip(150, .2, 'square', suave ? .025 : .045);
    if (suave) return;
    const e = $('escenario'); e.classList.remove('sacude'); void e.offsetWidth; e.classList.add('sacude');
  },
  // ¿lo que escribió es la respuesta c? 'ok', 'mal' (ya no puede ser) o null (todavía falta escribir)
  comprobar(v, c) {
    c = String(c);
    return v === c ? 'ok' : c.startsWith(v) ? null : 'mal';
  },
  // entrada de números: teclado en pantalla + teclado de la compu.
  // alCambiar(valor) devuelve 'ok' o 'mal' para vaciar la entrada (con un destello), o nada para seguir escribiendo.
  entrada(caja, alCambiar) {
    caja.innerHTML = '<div class="entrada"><div class="visor" aria-live="polite"><span></span></div><div class="numpad">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => '<button data-d="' + d + '">' + d + '</button>').join('') +
      '<button data-d="⌫" class="borrar" aria-label="Borrar">⌫</button></div></div>';
    const visor = caja.querySelector('.visor'), txt = visor.querySelector('span');
    let v = '';
    const tipear = d => {
      if (!partida.activa) return;
      if (d === '⌫') v = v.slice(0, -1);
      else if (v.length < 3) v += d;
      txt.textContent = v;
      const r = v ? alCambiar(v) : null;
      if (r === 'ok' || r === 'mal') {
        v = '';
        visor.classList.remove('ok', 'mal'); void visor.offsetWidth; visor.classList.add(r);
        motor.espera(() => { if (!v) txt.textContent = ''; }, 160);
      }
    };
    caja.querySelector('.numpad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) tipear(b.dataset.d); });
    partida.onTecla = e => {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); tipear(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); tipear('⌫'); }
    };
    return { vaciar() { v = ''; txt.textContent = ''; } };
  },
  // "+20" que sube desde un elemento
  flota(texto, el) {
    const r = el.getBoundingClientRect(), base = $('escenario').getBoundingClientRect();
    const f = document.createElement('span');
    f.className = 'flota'; f.textContent = texto;
    f.style.left = (r.left - base.left + r.width / 2) + 'px'; f.style.top = (r.top - base.top - 10) + 'px';
    $('escenario').appendChild(f);
    setTimeout(() => f.remove(), 800);
  },
  // 4 respuestas para n × k: la correcta y 3 parecidas (las de al lado en la tabla, ±1, ±2…)
  opciones(n, k) {
    const c = n * k, set = new Set();
    mezclar([n * (k + 1), n * (k - 1), c + 1, c - 1, c + 2, c - 2, c + 10, (n + 1) * k, (n - 1) * k])
      .forEach(v => { if (v > 0 && v !== c && set.size < 3) set.add(v); });
    while (set.size < 3) { const v = 1 + Math.floor(Math.random() * (c + 10)); if (v !== c) set.add(v); }
    return mezclar([c, ...set]);
  },
  fin() { Motor.terminar(); },
};

// ---------- Motor: arrancar, terminar y la pantalla final ----------
// config:
//   app        id del juego en el servidor ('tablas', 'misterios')
//   clave      prefijo de lo que se guarda en el navegador ('factorx', 'misterios')
//   niveles    n → { nombre, tipo, color, metas[3], estrellas(partida) → 0..3, marcador?, segundos? }
//   ultimo     número del último nivel (el final)
//   prog(n)    → { premio: 0..3, mejor }        guardar(n, premio, mejor)
//   abierto(n) → si se puede jugar
//   nombre(n)  → 'Tabla del 3', 'Caso 03'…      (se usa arriba del título y en "siguiente")
//   rutaNivel(n) → hash de la pantalla del nivel ('tabla-3')
//   premio     { icono: html de uno ganado, uno: 'estrella', varios: 'estrellas', nuevo: '⭐ Nueva estrella' }
//   textos     { dominado(n), desbloqueado(n) } (opcionales)
const Motor = {
  cfg: null,
  iniciar(cfg) {
    Motor.cfg = cfg;
    $('juego').innerHTML =
      '<div class="j-cab">' +
        '<button class="ghost" id="jSalir" title="Salir (Esc)">✕ Salir</button>' +
        '<div><div class="tipo" id="jTipo"></div><h2 id="jTitulo"></h2></div>' +
        '<button class="ghost" id="sonidoBtn" aria-pressed="true" title="Sonido">🔊</button>' +
        '<div class="hud">' +
          '<div><b id="hTiempo">30</b><span id="hTiempoLbl">Tiempo</span></div>' +
          '<div><b id="hAciertos">0</b><span>Aciertos</span></div>' +
          '<div class="combo" id="hCombo"><b id="hMulti">×1</b><span>Combo</span></div>' +
          '<div><b id="hPuntos">0</b><span>Puntos</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="tiempo" id="tiempo"><i id="tiempoBarra"></i></div>' +
      '<div class="escenario" id="escenario"></div>' +
      '<div class="resultado" id="resultado" hidden>' +
        '<div class="r-estrellas" id="rEstrellas"></div>' +
        '<h3 id="rTitulo"></h3><p id="rSub"></p>' +
        '<div class="r-datos">' +
          '<div><b id="rAciertos"></b><span>Aciertos</span></div>' +
          '<div><b id="rPrecision"></b><span>Precisión</span></div>' +
          '<div><b id="rRacha"></b><span>Mejor racha</span></div>' +
          '<div><b id="rPuntos"></b><span>Puntos</span></div>' +
        '</div>' +
        '<div class="r-insignias" id="rInsignias"></div>' +
        '<div class="r-botones">' +
          '<button class="boton" id="rOtra">Otra vez ↻</button>' +
          '<button class="ghost" id="rSiguiente" hidden></button>' +
          '<button class="ghost" id="rVolver">Volver</button>' +
        '</div>' +
        '<p class="r-servidor" id="rServidor"></p>' +
      '</div>';

    try { sonido = localStorage.getItem((cfg.clave || cfg.app) + '.sonido') !== '0'; } catch (e) {}
    const pintarSonido = () => {
      $('sonidoBtn').textContent = sonido ? '🔊' : '🔇';
      $('sonidoBtn').setAttribute('aria-pressed', String(sonido));
    };
    pintarSonido();
    $('sonidoBtn').addEventListener('click', () => {
      sonido = !sonido; pintarSonido();
      try { localStorage.setItem((cfg.clave || cfg.app) + '.sonido', sonido ? '1' : '0'); } catch (e) {}
    });
    const volver = () => { location.hash = cfg.rutaNivel(partida.n); };
    $('rOtra').addEventListener('click', () => Motor.jugar(partida.n));
    $('rVolver').addEventListener('click', volver);
    $('jSalir').addEventListener('click', volver);
    $('rSiguiente').addEventListener('click', () => { location.hash = cfg.rutaNivel(partida.n + 1); });
    $('escenario').addEventListener('click', e => {
      const b = e.target.closest('.opcion');
      if (b && partida.onElegir) partida.onElegir(b);
    });
    document.addEventListener('keydown', e => {
      if ($('juego').hidden) return;
      if (e.key === 'Escape') return volver();
      if (partida.onTecla) partida.onTecla(e);
    });
  },

  limpiar() {
    partida.activa = false; partida.gen++; partida.onTecla = null; partida.onElegir = null;
    partida.timers.forEach(clearTimeout); partida.timers = [];
  },

  jugar(n) {
    const cfg = Motor.cfg, j = cfg.niveles[n];
    Motor.limpiar();
    $('juego').style.setProperty('--c', j.color);
    $('jTipo').textContent = n === cfg.ultimo ? j.tipo : cfg.nombre(n) + ' · ' + j.tipo;
    $('jTitulo').textContent = j.nombre;
    $('rVolver').textContent = 'Volver';
    Object.assign(partida, { n, puntos: 0, aciertos: 0, errores: 0, racha: 0, mejorRacha: 0, mensaje: '',
      gano: false, perdidas: 0, tableros: 0, sobra: 0 });
    $('resultado').hidden = true; $('escenario').hidden = false; $('tiempo').hidden = false;
    $('hTiempoLbl').textContent = 'Tiempo';
    $('escenario').className = 'escenario';
    hud(); motor.reloj(1, j.segundos || 30);
    if (j.marcador) motor.marcador(...j.marcador);
    let k = 3;
    const paso = () => {
      if (k === 0) {
        partida.activa = true; partida.t0 = performance.now();
        $('escenario').innerHTML = ''; $('escenario').classList.add('j' + n);
        MINIJUEGOS[n](motor); return;
      }
      $('escenario').innerHTML = '<div class="cuenta" aria-live="polite">' + k + '</div>';
      bip(k === 1 ? 660 : 440, .12); k--;
      motor.espera(paso, 650);
    };
    paso();
  },

  terminar() {
    if (!partida.activa) return;
    const cfg = Motor.cfg, pr = cfg.premio;
    const ms = performance.now() - partida.t0;
    Motor.limpiar();
    const n = partida.n, j = cfg.niveles[n], antes = cfg.prog(n);
    const total = partida.aciertos + partida.errores;
    partida.precision = total ? Math.round(partida.aciertos * 100 / total) : 0;
    partida.ms = ms;
    const est = j.estrellas(partida);
    const hay = n < cfg.ultimo;
    const siguienteAntes = hay && cfg.abierto(n + 1);
    const record = partida.puntos > antes.mejor;
    cfg.guardar(n, Math.max(antes.premio, est), Math.max(antes.mejor, partida.puntos));
    const desbloqueo = hay && !siguienteAntes && cfg.abierto(n + 1);
    const textos = cfg.textos || {};

    $('escenario').hidden = true; $('tiempo').hidden = true; $('resultado').hidden = false;
    $('rEstrellas').innerHTML = ('<b>' + pr.icono + '</b>').repeat(est) + pr.icono.repeat(3 - est);
    $('rEstrellas').setAttribute('aria-label', est + ' de 3 ' + pr.varios);
    $('rTitulo').textContent = (j.titulos || cfg.titulos)[est];
    $('rSub').textContent = (partida.mensaje ? partida.mensaje + ' ' : '') +
      (est < 3 ? 'Para ' + (est + 1) + ' ' + (est ? pr.varios : pr.uno) + ': ' + j.metas[est].toLowerCase() + '.'
               : textos.dominado ? textos.dominado(n) : '');
    $('rAciertos').textContent = partida.aciertos;
    $('rPrecision').textContent = partida.precision + '%';
    $('rRacha').textContent = partida.mejorRacha;
    $('rPuntos').textContent = partida.puntos;
    $('rInsignias').innerHTML =
      (record && partida.puntos ? '<span class="insignia">🏆 Nuevo récord</span>' : '') +
      (est > antes.premio && antes.premio ? '<span class="insignia">' + pr.nuevo + '</span>' : '') +
      (desbloqueo ? '<span class="insignia lima">🔓 ' + (textos.desbloqueado ? textos.desbloqueado(n + 1) : cfg.nombre(n + 1) + ' desbloqueado') + '</span>' : '');
    const sig = hay && cfg.abierto(n + 1);
    $('rSiguiente').hidden = !sig;
    $('rSiguiente').textContent = cfg.nombre(n + 1) + ' →';
    bip(est ? 880 : 300, .25, 'triangle', .06);

    $('rServidor').textContent = '';
    Motor.enviar(partida.puntos, ms).then(e => {
      $('rServidor').textContent = {
        ok: '✓ Puntos sumados al ranking general',
        invitado: 'Jugás como invitado: entrá con tu apodo para sumar al ranking',
        sesion: 'Tu sesión venció: volvé a entrar para sumar al ranking',
        error: 'No se pudieron guardar los puntos en el ranking (¿hay internet?)',
      }[e] || '';
    });
  },

  enviar(puntos, ms) {
    if (!sesion || !sesion.token) return Promise.resolve('invitado');
    if (!puntos) return Promise.resolve('cero');
    return fetch(API + '/resultado', { method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token: sesion.token, r: { app: Motor.cfg.app, m: 'p', p: Math.min(5000, puntos), ms: Math.round(ms), lg: 'es' } }) })
      .then(r => r.json()).then(r => r.ok ? 'ok' : r.error === 'sesion' ? 'sesion' : 'error')
      .catch(() => 'error');
  },
};
