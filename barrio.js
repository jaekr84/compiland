// barrio.js — el barrio de Desapariciones Misteriosas, visto desde arriba.
// El detective camina por el barrio, habla con los vecinos y abre los casos (los minijuegos de misterios.html).
// Usa lo que define misterios.html: CASOS, prog, abierto, progreso, guardarProgreso, mordisco, lupas, esc, REVELADO.
// Se arranca con Barrio.mostrar(n) (n: parado frente al vecino del caso n, o 0) y se frena con Barrio.ocultar().

const Barrio = (() => {
  const T = 48;                         // lado de un casillero, en unidades del mundo
  const W = 36, H = 26;                 // el barrio mide 36 × 26 casilleros
  const VEL = 3.6 * T;                  // velocidad del detective (por segundo)
  const RADIO = 13;                     // los pies del detective, para los choques
  const ALCANCE = 1.35 * T;             // distancia para poder hablar con alguien

  // números al azar pero siempre iguales: el barrio se ve igual cada vez que se entra
  function semilla(s) { return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ======================= el mapa =======================
  // calles: la avenida (de este a oeste) y la calle del medio (de norte a sur), con sus veredas
  const CALLES = [[0, 11, W, 2], [17, 0, 2, H]];
  const VEREDAS = [[0, 10, W, 1], [0, 13, W, 1], [16, 0, 1, H], [19, 0, 1, H]];
  const PLAZA = [2, 14, 14, 10];
  const enCalle = (x, y) => (y >= 10 && y <= 13) || (x >= 16 && x <= 19);

  // edificios (en casilleros). caso: el vecino que vive o trabaja ahí
  const EDIFICIOS = [
    { id: 'pizzeria', x: 5, y: 3, w: 6, h: 5, techo: '#d9534f', pared: '#f6e6c8', cartel: 'PIZZERÍA DON TITO', acento: '#ffc53d', toldo: ['#d9534f', '#fff'] },
    { id: 'disfraces', x: 12, y: 3, w: 4, h: 5, techo: '#7d5cff', pared: '#efe8ff', cartel: 'DISFRACES', acento: '#c9b6ff' },
    { id: 'comisaria', x: 20, y: 3, w: 6, h: 5, techo: '#2f4a7a', pared: '#e2e8f1', cartel: 'COMISARÍA', acento: '#3db8ff', sirena: true },
    { id: 'estacion', x: 28, y: 3, w: 6, h: 5, techo: '#5d6675', pared: '#ece5d8', cartel: 'ESTACIÓN', acento: '#ffd23f', reloj: true },
    { id: 'camaras', x: 20, y: 15, w: 3, h: 3, techo: '#2b3242', pared: '#d3dbe6', cartel: 'CÁMARAS', acento: '#3db8ff', camara: true },
    { id: 'rosa', x: 24, y: 15, w: 4, h: 4, techo: '#e07a9b', pared: '#fff1e6', cartel: 'ROSA', acento: '#ff9ec0', chimenea: true },
    { id: 'beto', x: 29, y: 15, w: 4, h: 4, techo: '#5f86c4', pared: '#f2eee4', cartel: 'BETO', acento: '#9cc3ff', chimenea: true },
    { id: 'kiosco', x: 21, y: 20, w: 3, h: 3, techo: '#e8a23a', pared: '#fff4dc', cartel: 'KIOSCO', acento: '#ffd23f', toldo: ['#ffc53d', '#fff'] },
    { id: 'casa', x: 28, y: 20, w: 4, h: 3, techo: '#7aa36b', pared: '#f4efe2', cartel: '', acento: '#b8ff3c', chimenea: true },
  ].map(b => Object.assign(b, { px: b.x * T, py: b.y * T, pw: b.w * T, ph: b.h * T }));

  // la fuente de la plaza, los bancos y el contenedor (la guarida)
  const FUENTE = { x: 8.5 * T, y: 18.5 * T, r: 1.55 * T };
  const BANCOS = [[5.2, 16.2, 1.6, .55], [10.2, 16.2, 1.6, .55], [5.2, 20.6, 1.6, .55], [10.2, 20.6, 1.6, .55]];
  const CONTENEDOR = { x: 2.35 * T, y: 2.7 * T, w: 2.1 * T, h: 1.15 * T };
  const CINTA = { x: 2 * T, y: 8.55 * T, w: 3 * T, h: .4 * T };          // cinta policial: cierra el callejón de la guarida
  const AUTOS = [
    { x: 6.2 * T, y: 11.12 * T, w: 1.7 * T, h: .78 * T, color: '#3db8ff' },
    { x: 26.5 * T, y: 12.1 * T, w: 1.7 * T, h: .78 * T, color: '#ff8a3d' },
    { x: 17.1 * T, y: 19.5 * T, w: .78 * T, h: 1.7 * T, color: '#b8ff3c', vertical: true },
  ];

  // árboles: el borde del barrio, la plaza y algunos huecos entre casas
  const ARBOLES = [];
  (() => {
    const r = semilla(7);
    const poner = (x, y, k = 1) => ARBOLES.push({ x: x * T, y: y * T, k: k * (.85 + r() * .35), tono: r() });
    for (let x = 0; x < W; x++) for (const y of [0, 1, 24, 25])
      if (!enCalle(x, y) && !(y === 1 && x >= 2 && x <= 4)) poner(x + .5 + (r() - .5) * .3, y + .55 + (r() - .5) * .2);
    for (let y = 2; y < 24; y++) for (const x of [0, 1, 34, 35])
      if (!enCalle(x, y)) poner(x + .5 + (r() - .5) * .3, y + .55 + (r() - .5) * .3);
    [[3, 15], [14.6, 15], [3, 23], [14.6, 23], [2.9, 18.6], [14.7, 18.6], [6.5, 23.1], [11, 23.2]].forEach(([x, y]) => poner(x, y, 1.15));
    [[27, 4.2], [27, 7.2], [33, 16], [33, 18.6], [25, 21.3], [33, 21.6], [20.6, 23.3], [26.2, 23.1], [19.9, 21]].forEach(([x, y]) => poner(x, y));
    [[11.6, 2.4], [16.3, 2.6]].forEach(([x, y]) => poner(x, y, .9));
  })();
  ARBOLES.forEach(a => { if (a.x > 16 * T && a.x < 20 * T && a.y > 20 * T) a.borrar = true; });

  // faroles a lo largo de las veredas
  const FAROLES = [];
  for (let x = 4.5; x < W - 2; x += 5) { FAROLES.push({ x: x * T, y: 10.15 * T }); FAROLES.push({ x: (x + 2.5) * T, y: 13.85 * T }); }   // corridos de los frentes de los vecinos
  for (let y = 3; y < H - 2; y += 6) if (y < 9 || y > 14) { FAROLES.push({ x: 16.15 * T, y: y * T }); FAROLES.push({ x: 19.85 * T, y: (y + 3) * T }); }

  // pasto: manchitas al azar para que no sea un color plano
  const PASTO = [];
  (() => { const r = semilla(3); for (let i = 0; i < 900; i++) PASTO.push({ x: r() * W * T, y: r() * H * T, s: 2 + r() * 5, o: r() }); })();

  // las huellas de El Mordisco: van de la plaza hasta la guarida. Se ven más a medida que se resuelven casos.
  const HUELLAS = [];
  (() => {
    const camino = [[9, 15.8], [9.6, 14.5], [10.6, 13.5], [12.2, 12.6], [14, 11.7], [15.4, 10.4], [13, 9.55], [10, 9.6], [6.5, 9.55], [4.4, 9.25], [3.6, 7.9], [3.4, 6.5], [3.4, 4.6]];
    let lado = 1;
    for (let i = 0; i < camino.length - 1; i++) {
      const [x0, y0] = camino[i], [x1, y1] = camino[i + 1], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / .55));
      for (let k = 0; k < n; k++) {
        const t = k / n, ang = Math.atan2(y1 - y0, x1 - x0);
        HUELLAS.push({ x: (x0 + (x1 - x0) * t) * T - Math.sin(ang) * 7 * lado, y: (y0 + (y1 - y0) * t) * T + Math.cos(ang) * 7 * lado, ang });
        lado = -lado;
      }
    }
  })();

  // ======================= la gente =======================
  // look: cómo se dibuja cada persona
  const LOOK = {
    detective: { piel: '#f1c6a3', ropa: '#c9a46a', pantalon: '#4a3a2a', sombrero: 'fedora', sombreroColor: '#5b4128' },
    tito: { piel: '#e9b48e', ropa: '#ffffff', pantalon: '#3a3a44', sombrero: 'chef', bigote: '#3b2a1e', delantal: '#d9534f' },
    guardia: { piel: '#c98b62', ropa: '#3d5a80', pantalon: '#22324a', sombrero: 'gorra', sombreroColor: '#22324a', pelo: '#2a1d14' },
    comisaria: { piel: '#f0c4a0', ropa: '#264b7a', pantalon: '#1b2f4f', sombrero: 'policia', sombreroColor: '#1b2f4f', pelo: '#7a3b1e', trenza: true },
    testigo: { piel: '#f3cfb0', ropa: '#3fa66b', pantalon: '#344055', sombrero: 'capucha', sombreroColor: '#2f8a57' },
    rosa: { piel: '#f5d2bb', ropa: '#e06b98', pantalon: '#e06b98', sombrero: 'rodete', pelo: '#d9d9e0', lentes: true, pollera: true },
    beto: { piel: '#e2a983', ropa: '#8a5a3b', pantalon: '#3d3a36', sombrero: 'pelado', pelo: '#d6d2c8', lentes: true, bigote: '#d6d2c8' },
    madame: { piel: '#f2c9ad', ropa: '#7d5cff', pantalon: '#3b2a7a', sombrero: 'galera', sombreroColor: '#2a1d57', antifaz: true, pollera: true, pelo: '#1a1a22' },
    ruiz: { piel: '#d29b74', ropa: '#3b6ea8', pantalon: '#1b2f4f', sombrero: 'policia', sombreroColor: '#1b2f4f', pelo: '#2a1d14', bolsa: true },
    nico: { piel: '#f0c4a0', ropa: '#ff8a3d', pantalon: '#344055', sombrero: 'gorra', sombreroColor: '#d9534f', pelo: '#5a3a22' },
    sosp1: { piel: '#e9b48e', ropa: '#9aa3b5', pantalon: '#3a3f4b', sombrero: 'pelo', pelo: '#3b2a1e', rayas: true },
    sosp2: { piel: '#c98b62', ropa: '#9aa3b5', pantalon: '#3a3f4b', sombrero: 'pelo', pelo: '#111', rayas: true },
    sosp3: { piel: '#f5d2bb', ropa: '#9aa3b5', pantalon: '#3a3f4b', sombrero: 'gorra', sombreroColor: '#555c6b', rayas: true },
    vecina: { piel: '#c98b62', ropa: '#2ee6c5', pantalon: '#2ee6c5', sombrero: 'pelo', pelo: '#1a1a22', pollera: true, trenza: true },
    nene: { piel: '#f3cfb0', ropa: '#ffd23f', pantalon: '#3d5a80', sombrero: 'gorra', sombreroColor: '#3db8ff', pelo: '#5a3a22', chico: true },
  };

  // dónde está cada caso y quién lo cuenta
  const LUGAR = {
    1: 'Don Tito, en la pizzería', 2: 'el guardia de las cámaras', 3: 'la comisaria Vera, en la comisaría',
    4: 'el testigo de la avenida', 5: 'Rosa y Beto, en sus casas', 6: 'Madame Antifaz, en la tienda de disfraces',
    7: 'el oficial Ruiz, al lado de la comisaría', 8: 'Nico, en el kiosco', 9: 'el contenedor de atrás de la pizzería',
    10: 'El Mordisco, en el callejón',
  };
  const P = (quien, texto) => ({ quien, texto });
  const NPCS = [
    { id: 'tito', caso: 1, x: 8, y: 9.15, look: 'tito', nombre: 'Don Tito',
      intro: [P('tito', '¡Detective! ¡Qué suerte que viniste!'),
              P('tito', 'Corté mi pizza en 8 porciones iguales y fui a buscar la gaseosa. Cuando volví… ¡faltaban 3!'),
              P('tito', 'Y en la caja quedó la marca de una mordida. ¿Me ayudás a reconstruir la escena?')] },
    { id: 'guardia', caso: 2, x: 21.5, y: 18.65, look: 'guardia', nombre: 'Guardia Paz',
      intro: [P('guardia', 'Las cámaras del barrio sacaron una foto por segundo toda la noche.'),
              P('guardia', 'En cada foto se ve algo al que le falta un pedazo. ¡Hay que revisarlas antes de que se borren!')] },
    { id: 'comisaria', caso: 3, x: 22.2, y: 9.15, look: 'comisaria', nombre: 'Comisaria Vera',
      intro: [P('comisaria', 'Detuvimos a tres sospechosos. Los tres dicen: “yo sólo me comí un cuarto”.'),
              P('comisaria', 'Pero algunos cortaron en partes de distinto tamaño… y así no vale. ¿Quién miente?')] },
    { id: 'testigo', caso: 4, x: 26, y: 10.45, look: 'testigo', nombre: 'Lucho, el testigo',
      intro: [P('testigo', '¡Yo lo vi! Corría por esta avenida, de la plaza a la estación.'),
              P('testigo', 'Estaba justo a 3/4 del camino. ¿Podés marcar el lugar exacto antes de que se escape?')] },
    { id: 'rosa', caso: 5, x: 26, y: 19.55, look: 'rosa', nombre: 'Rosa',
      intro: [P('rosa', '¡Detective! ¡A mí me robaron 1/3 de mi chocolate!'),
              P('beto', '¡Y a mí 1/4 del mío! Mi caso es más grave, investigá el mío primero.'),
              P('rosa', '¡Mentira! A mí me sacaron más. Detective, ¿a quién le robaron más?')] },
    { id: 'beto', caso: 5, x: 31, y: 19.55, look: 'beto', nombre: 'Beto',
      intro: [P('beto', '¡Por fin llega la policía! Me robaron 1/4 de mi chocolate.'),
              P('rosa', '¡Y a mí 1/3 del mío! Es más que lo tuyo, Beto.'),
              P('beto', '¡Eso no es así! Detective, ¿a quién le robaron más?')] },
    { id: 'madame', caso: 6, x: 14, y: 9.15, look: 'madame', nombre: 'Madame Antifaz',
      intro: [P('madame', 'Anoche alguien entró a mi tienda… ¡y se llevó un antifaz!'),
              P('madame', 'Ahora El Mordisco se disfraza: se llevó 1/2 torta, pero lo anotó como 2/4 para confundirnos.'),
              P('madame', 'Hay que descubrir qué fracciones son la misma aunque se vean distintas. ¡Desenmascaralo!')] },
    { id: 'ruiz', caso: 7, x: 25.2, y: 9.2, look: 'ruiz', nombre: 'Oficial Ruiz',
      intro: [P('ruiz', 'Encontramos esta bolsa con porciones sueltas de todo lo que se robó.'),
              P('ruiz', 'Hay que devolverle a cada vecino exactamente lo que le falta: ni más, ni menos.')] },
    { id: 'nico', caso: 8, x: 22.5, y: 23.4, look: 'nico', nombre: 'Nico, el kiosquero',
      intro: [P('nico', 'En un escondite aparecieron 12 de mis caramelos.'),
              P('nico', '¡Pero El Mordisco se llevó 2/3 de todo lo que había! ¿Cuántos caramelos se llevó?')] },
    // gente del barrio: no tienen caso, pero dan una mano
    { id: 'sosp1', x: 23.4, y: 9.25, look: 'sosp1', nombre: 'Sospechoso 1', lineas: [P('sosp1', '¡Yo sólo me comí un cuarto! Te lo juro.')] },
    { id: 'sosp2', x: 24.15, y: 9.35, look: 'sosp2', nombre: 'Sospechoso 2', lineas: [P('sosp2', 'Corté la torta en 4 pedazos y me comí uno. ¿Qué tiene de malo?')] },
    { id: 'sosp3', x: 20.7, y: 9.3, look: 'sosp3', nombre: 'Sospechoso 3', lineas: [P('sosp3', 'Yo no fui. ¡Yo como pizza entera, no de a pedacitos!')] },
    { id: 'vecina', x: 12.6, y: 21.9, look: 'vecina', nombre: 'Marta',
      lineas: [P('vecina', 'Dicen que El Mordisco siempre se lleva partes iguales. ¡Qué ladrón más prolijo!'),
               P('vecina', 'Si te perdés, mirá el cartel de arriba: te dice a quién tenés que ir a ver.')] },
    { id: 'nene', x: 6.6, y: 17.4, look: 'nene', nombre: 'Tomi',
      lineas: [P('nene', '¡Anoche vi algo con una cola rayada corriendo por los techos!'),
               P('nene', 'Mi mamá dice que fue un gato. Yo creo que no…')] },
  ];
  NPCS.forEach(n => { n.px = n.x * T; n.py = n.y * T; n.dir = 0; n.fase = Math.random() * 6; });
  const NARRADOR = { nombre: 'Radio policial' };
  const quien = id => NPCS.find(n => n.id === id) || (id === 'mordisco' ? { nombre: 'El Mordisco', especial: 'mordisco' }
    : id === 'mapache' ? { nombre: 'El Mordisco', especial: 'mapache' } : NARRADOR);

  // la guarida y El Mordisco no son gente común: se arman según cómo va la historia
  const resueltos = () => { let n = 0; for (let i = 1; i <= 9; i++) if (prog(i).lupas > 0) n++; return n; };
  const esNoche = () => abierto(10) && !prog(10).lupas;       // cuando todo lleva a la guarida: de noche, para el final
  const atrapado = () => prog(10).lupas > 0;
  const cintaPuesta = () => !abierto(9);
  function cosas() {                                          // lo que se puede revisar, además de la gente
    const l = [{ id: 'contenedor', caso: 9, px: CONTENEDOR.x + CONTENEDOR.w / 2, py: CONTENEDOR.y + CONTENEDOR.h + 10, nombre: 'El contenedor',
      intro: [P('narrador', 'Un contenedor que huele a pizza… ¡Es la guarida de El Mordisco!'),
              P('narrador', 'Adentro hay porciones de muchas pizzas. El inventario dice “5/4 de pizza”. ¿Cómo puede haber más de una pizza entera?')] }];
    if (esNoche()) l.push({ id: 'mordisco', caso: 10, px: 3.4 * T, py: 5.6 * T, nombre: 'El Mordisco', especial: 'mordisco',
      intro: [P('mordisco', '…'), P('mordisco', '¡Grrr! ¡No me van a atrapar tan fácil, detective!'),
              P('mordisco', '¡Te voy a confundir con todas las fracciones que conozco!')] });
    if (atrapado()) l.push({ id: 'mapache', caso: 10, px: 3.4 * T, py: 5.8 * T, nombre: 'El Mordisco', especial: 'mapache',
      lineas: [P('mapache', 'Perdón por todo, detective. Teníamos mucha hambre…'),
               P('mapache', 'Ahora Don Tito nos guarda las porciones que sobran. ¡Y las cortamos en partes iguales para compartir!')] });
    return l;
  }

  // ======================= estado =======================
  const yo = { x: 8.5 * T, y: 22 * T, dir: 3, fase: 0, anda: false };
  let lienzo, ctx, noche, nctx, dpr = 1, zoom = 1, vistaW = 0, vistaH = 0, camX = 0, camY = 0;
  let activo = false, raf = 0, antes = 0, reloj = 0;
  const teclas = new Set();
  let palanca = null, destino = null, trabado = 0;            // control táctil: palanca virtual o tocar el piso
  let dialogo = null, popup = false, libreta = false;
  let cerca = null;                                          // con quién se puede hablar ahora
  let armado = false;
  let r3d = null, lienzo3d = null;                            // el barrio en 3D (barrio3d.js), si el navegador puede
  const pantalla = () => (r3d ? lienzo3d : lienzo);

  // ======================= dibujo =======================
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function sombra(c, x, y, rx, ry, a = .22) { c.fillStyle = 'rgba(14,24,18,' + a + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); }
  const mezcla = (a, b, t) => {                              // mezcla dos colores #rrggbb
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  };

  function suelo(c) {
    // pasto con luz suave
    const g = c.createLinearGradient(0, 0, 0, H * T);
    g.addColorStop(0, '#6cc070'); g.addColorStop(1, '#58ad62');
    c.fillStyle = g; c.fillRect(0, 0, W * T, H * T);
    for (const p of PASTO) {
      if (p.x < camX - 10 || p.x > camX + vistaW + 10 || p.y < camY - 10 || p.y > camY + vistaH + 10) continue;
      c.fillStyle = p.o > .5 ? 'rgba(40,110,55,.22)' : 'rgba(190,240,150,.18)';
      c.beginPath(); c.ellipse(p.x, p.y, p.s, p.s * .45, 0, 0, 7); c.fill();
    }
    // plaza: baldosas
    const [px, py, pw, ph] = PLAZA.map(v => v * T);
    c.fillStyle = '#e4d7bd'; rr(c, px + 6, py + 6, pw - 12, ph - 12, 22); c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(150,125,90,.18)'; c.lineWidth = 1.5;
    for (let x = px; x < px + pw; x += 24) { c.beginPath(); c.moveTo(x, py); c.lineTo(x, py + ph); c.stroke(); }
    for (let y = py; y < py + ph; y += 24) { c.beginPath(); c.moveTo(px, y); c.lineTo(px + pw, y); c.stroke(); }
    c.restore();
    // canteros con flores
    const r = semilla(11);
    [[3.4, 16.9, 1.2, .9], [12.2, 16.9, 1.2, .9], [3.4, 19.9, 1.2, .9], [12.2, 19.9, 1.2, .9]].forEach(([x, y, w, h]) => {
      c.fillStyle = '#4f9a57'; rr(c, x * T, y * T, w * T, h * T, 14); c.fill();
      for (let i = 0; i < 9; i++) {
        c.fillStyle = ['#ff6fa8', '#ffd23f', '#ffffff', '#ff8a3d'][i % 4];
        c.beginPath(); c.arc((x + .15 + r() * (w - .3)) * T, (y + .15 + r() * (h - .3)) * T, 3.5, 0, 7); c.fill();
      }
    });
    // veredas
    c.fillStyle = '#c9cfd8';
    VEREDAS.forEach(([x, y, w, h]) => c.fillRect(x * T, y * T, w * T, h * T));
    c.strokeStyle = 'rgba(80,90,110,.16)'; c.lineWidth = 1.5;
    VEREDAS.forEach(([x, y, w, h]) => {
      if (w > h) for (let i = x * T; i < (x + w) * T; i += T / 2) { c.beginPath(); c.moveTo(i, y * T); c.lineTo(i, (y + h) * T); c.stroke(); }
      else for (let i = y * T; i < (y + h) * T; i += T / 2) { c.beginPath(); c.moveTo(x * T, i); c.lineTo((x + w) * T, i); c.stroke(); }
    });
    // asfalto
    c.fillStyle = '#4b5263';
    CALLES.forEach(([x, y, w, h]) => c.fillRect(x * T, y * T, w * T, h * T));
    // cordones
    c.fillStyle = '#e7ebf1';
    c.fillRect(0, 11 * T - 2, W * T, 3); c.fillRect(0, 13 * T - 1, W * T, 3);
    c.fillRect(17 * T - 2, 0, 3, H * T); c.fillRect(19 * T - 1, 0, 3, H * T);
    // líneas del medio
    c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.setLineDash([18, 16]);
    c.beginPath(); c.moveTo(0, 12 * T); c.lineTo(16.6 * T, 12 * T); c.moveTo(19.4 * T, 12 * T); c.lineTo(W * T, 12 * T); c.stroke();
    c.beginPath(); c.moveTo(18 * T, 0); c.lineTo(18 * T, 10.6 * T); c.moveTo(18 * T, 13.4 * T); c.lineTo(18 * T, H * T); c.stroke();
    c.setLineDash([]);
    // senda peatonal en la esquina
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 5; i++) {
      c.fillRect(15.1 * T, 11.1 * T + i * 18, 26, 9); c.fillRect(19.95 * T, 11.1 * T + i * 18, 26, 9);
      c.fillRect(17.1 * T + i * 18, 9.15 * T, 9, 26); c.fillRect(17.1 * T + i * 18, 13.95 * T, 9, 26);
    }
    // el callejón de la guarida: piso de cemento y charcos
    c.fillStyle = '#9aa1ad'; rr(c, 2 * T + 4, 2 * T, 3 * T - 8, 7 * T, 10); c.fill();
    c.fillStyle = 'rgba(80,140,200,.35)'; c.beginPath(); c.ellipse(3.6 * T, 7.2 * T, 22, 9, .2, 0, 7); c.fill();
    // frentes de los edificios: un poco de vereda propia
    c.fillStyle = 'rgba(255,255,255,.18)';
    EDIFICIOS.forEach(b => { rr(c, b.px - 6, b.py + b.ph - 4, b.pw + 12, 22, 8); c.fill(); });
  }

  function huellas(c) {
    const cuantas = atrapado() ? 0 : Math.round(HUELLAS.length * Math.min(1, resueltos() / 9));
    for (let i = 0; i < cuantas; i++) {
      const h = HUELLAS[i];
      c.save(); c.translate(h.x, h.y); c.rotate(h.ang + Math.PI / 2);
      c.fillStyle = 'rgba(40,36,48,.42)';
      c.beginPath(); c.ellipse(0, 2, 5, 6, 0, 0, 7); c.fill();
      [[-5, -6], [-2, -9], [2, -9], [5, -6]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); });
      c.restore();
    }
  }

  function edificio(c, b) {
    const { px: x, py: y, pw: w, ph: h } = b;
    const techoH = h * .56, pY = y + techoH, pH = h - techoH;
    // sombra
    c.fillStyle = 'rgba(14,30,20,.2)'; rr(c, x + 10, y + 14, w, h, 12); c.fill();
    // pared
    let g = c.createLinearGradient(0, pY, 0, y + h);
    g.addColorStop(0, b.pared); g.addColorStop(1, mezcla(b.pared, '#7d6f5c', .25));
    c.fillStyle = g; rr(c, x, pY - 8, w, pH + 8, [0, 0, 10, 10]); c.fill();
    c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x, y + h - 8, w, 8);
    // ventanas y puerta
    const n = Math.max(2, Math.round(w / T)), puertaX = x + w / 2;
    for (let i = 0; i < n; i++) {
      const cx = x + (i + .5) * w / n;
      if (Math.abs(cx - puertaX) < T * .55) continue;
      const vx = cx - 13, vy = pY + pH * .18;
      c.fillStyle = '#fff'; rr(c, vx - 3, vy - 3, 32, 25, 6); c.fill();
      g = c.createLinearGradient(vx, vy, vx + 26, vy + 19);
      g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#6fb3e6');
      c.fillStyle = g; rr(c, vx, vy, 26, 19, 4); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(vx + 4, vy + 15); c.lineTo(vx + 12, vy + 3); c.lineTo(vx + 16, vy + 3); c.lineTo(vx + 8, vy + 15); c.fill();
    }
    c.fillStyle = mezcla(b.techo, '#1a1a22', .35); rr(c, puertaX - 13, y + h - 34, 26, 34, [8, 8, 0, 0]); c.fill();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(puertaX + 7, y + h - 16, 2.2, 0, 7); c.fill();
    // toldo a rayas
    if (b.toldo) {
      const ty = pY - 2, n2 = Math.round(w / 16);
      for (let i = 0; i < n2; i++) {
        c.fillStyle = b.toldo[i % 2];
        c.beginPath(); c.moveTo(x + i * w / n2, ty); c.lineTo(x + (i + 1) * w / n2, ty); c.lineTo(x + (i + 1) * w / n2, ty + 10);
        c.arc(x + (i + .5) * w / n2, ty + 10, w / n2 / 2, 0, Math.PI); c.closePath(); c.fill();
      }
    }
    // techo con tejas, alero y cumbrera
    g = c.createLinearGradient(0, y, 0, pY);
    g.addColorStop(0, mezcla(b.techo, '#ffffff', .22)); g.addColorStop(1, b.techo);
    c.fillStyle = g; rr(c, x - 7, y - 4, w + 14, techoH + 4, 12); c.fill();
    c.save(); rr(c, x - 7, y - 4, w + 14, techoH + 4, 12); c.clip();
    c.strokeStyle = 'rgba(0,0,0,.1)'; c.lineWidth = 2;
    for (let ty = y + 8; ty < pY; ty += 11) { c.beginPath(); c.moveTo(x - 7, ty); c.lineTo(x + w + 7, ty); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 7, y + techoH * .32, w + 14, 4);
    c.restore();
    c.fillStyle = mezcla(b.techo, '#000000', .3); rr(c, x - 7, pY - 8, w + 14, 8, [0, 0, 6, 6]); c.fill();
    if (b.chimenea) { c.fillStyle = '#9a6b52'; rr(c, x + w - 34, y - 14, 16, 26, 3); c.fill(); c.fillStyle = '#6e4a38'; c.fillRect(x + w - 36, y - 16, 20, 6); }
    if (b.sirena) {                                         // la luz de la comisaría
      const on = Math.floor(reloj * 3) % 2;
      c.fillStyle = on ? '#ff4d6d' : '#3db8ff'; c.beginPath(); c.arc(x + w / 2, y + 8, 7, 0, 7); c.fill();
      c.fillStyle = on ? 'rgba(255,77,109,.25)' : 'rgba(61,184,255,.25)'; c.beginPath(); c.arc(x + w / 2, y + 8, 18, 0, 7); c.fill();
    }
    if (b.reloj) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x + w / 2, y + techoH * .55, 15, 0, 7); c.fill();
      c.strokeStyle = '#2a2f3a'; c.lineWidth = 3; c.stroke();
      c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + w / 2, y + techoH * .55); c.lineTo(x + w / 2, y + techoH * .55 - 10);
      c.moveTo(x + w / 2, y + techoH * .55); c.lineTo(x + w / 2 + 7, y + techoH * .55 + 2); c.stroke();
    }
    if (b.camara) {
      c.fillStyle = '#2a2f3a'; c.fillRect(x + w - 10, y - 18, 4, 26);
      c.fillStyle = '#e7ebf1'; rr(c, x + w - 26, y - 26, 22, 12, 4); c.fill();
      c.fillStyle = Math.floor(reloj * 2) % 2 ? '#ff4d6d' : '#5a1a24'; c.beginPath(); c.arc(x + w - 22, y - 20, 2.5, 0, 7); c.fill();
    }
    // cartel
    if (b.cartel) {
      c.font = '700 12px "Space Grotesk", system-ui, sans-serif';
      const tw = c.measureText(b.cartel).width + 18, cx = x + w / 2, cy = pY - 2;
      c.fillStyle = '#1b1f2a'; rr(c, cx - tw / 2, cy - 11, tw, 22, 7); c.fill();
      c.fillStyle = b.acento; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.cartel, cx, cy + 1);
    }
  }

  function arbol(c, a) {
    const k = a.k, x = a.x, y = a.y;
    sombra(c, x + 6, y + 2, 22 * k, 9 * k);
    c.fillStyle = '#7a5236'; rr(c, x - 4 * k, y - 16 * k, 8 * k, 18 * k, 3); c.fill();
    const base = a.tono > .6 ? ['#2f8a4a', '#3fa35a', '#62c374'] : a.tono > .3 ? ['#2b7d45', '#389a55', '#5bbd6c'] : ['#3a8f3f', '#4aa84d', '#7ccf6a'];
    const cy = y - 34 * k;
    c.fillStyle = base[0];
    c.beginPath(); c.arc(x - 12 * k, cy + 6 * k, 15 * k, 0, 7); c.arc(x + 12 * k, cy + 6 * k, 15 * k, 0, 7); c.fill();
    c.fillStyle = base[1]; c.beginPath(); c.arc(x, cy - 2 * k, 20 * k, 0, 7); c.fill();
    c.fillStyle = base[2]; c.beginPath(); c.arc(x - 6 * k, cy - 8 * k, 9 * k, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x - 9 * k, cy - 11 * k, 4 * k, 0, 7); c.fill();
  }

  function farol(c, f) {
    sombra(c, f.x + 3, f.y + 2, 8, 3);
    c.fillStyle = '#2f3542'; rr(c, f.x - 2.5, f.y - 46, 5, 48, 2); c.fill();
    c.fillStyle = '#2f3542'; rr(c, f.x - 8, f.y - 52, 16, 9, 4); c.fill();
    c.fillStyle = esNoche() ? '#fff1b8' : '#f5f0dc'; rr(c, f.x - 6, f.y - 46, 12, 5, 2); c.fill();
  }

  function fuente(c) {
    const { x, y, r } = FUENTE;
    sombra(c, x + 6, y + 8, r + 4, r * .55);
    c.fillStyle = '#b9b2a4'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = '#d8d1c3'; c.beginPath(); c.arc(x, y - 3, r - 4, 0, 7); c.fill();
    const g = c.createRadialGradient(x - 10, y - 14, 4, x, y, r - 10);
    g.addColorStop(0, '#8fe0ff'); g.addColorStop(1, '#3a9bd8');
    c.fillStyle = g; c.beginPath(); c.arc(x, y - 3, r - 12, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const rr2 = ((reloj * 18 + i * 22) % 44) + 6;
      c.globalAlpha = 1 - rr2 / 50; c.beginPath(); c.arc(x, y - 3, rr2, 0, 7); c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#d8d1c3'; c.beginPath(); c.arc(x, y - 8, 9, 0, 7); c.fill();
    c.fillStyle = '#bff0ff'; c.beginPath(); c.arc(x, y - 16 - Math.sin(reloj * 6) * 2, 5, 0, 7); c.fill();
  }

  function banco(c, [x, y, w, h]) {
    x *= T; y *= T; w *= T; h *= T;
    sombra(c, x + w / 2 + 4, y + h + 2, w / 2, 5, .18);
    c.fillStyle = '#8a5a3b'; rr(c, x, y, w, h * .45, 4); c.fill();
    c.fillStyle = '#a86e48'; rr(c, x, y + h * .5, w, h * .5, 4); c.fill();
    c.fillStyle = '#3a3f4b'; c.fillRect(x + 6, y + h, 4, 6); c.fillRect(x + w - 10, y + h, 4, 6);
  }

  function auto(c, a) {
    sombra(c, a.x + a.w / 2 + 4, a.y + a.h / 2 + 6, a.w / 2 + 2, a.h / 2, .25);
    c.fillStyle = a.color; rr(c, a.x, a.y, a.w, a.h, 14); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, a.x + 4, a.y + 3, a.w - 8, a.h * .35, 10); c.fill();
    c.fillStyle = '#1e2a3a';
    if (a.vertical) { rr(c, a.x + 6, a.y + a.h * .22, a.w - 12, a.h * .2, 6); c.fill(); rr(c, a.x + 6, a.y + a.h * .62, a.w - 12, a.h * .16, 6); c.fill(); }
    else { rr(c, a.x + a.w * .22, a.y + 6, a.w * .2, a.h - 12, 6); c.fill(); rr(c, a.x + a.w * .62, a.y + 6, a.w * .16, a.h - 12, 6); c.fill(); }
  }

  function contenedor(c) {
    const { x, y, w, h } = CONTENEDOR;
    sombra(c, x + w / 2 + 6, y + h + 4, w / 2 + 4, 8, .25);
    c.fillStyle = '#2f7a4a'; rr(c, x, y + 10, w, h - 10, 6); c.fill();
    c.fillStyle = '#3e9a5e'; rr(c, x - 4, y, w + 8, 16, 6); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < 5; i++) c.fillRect(x + i * w / 5, y + 18, 3, h - 22);
    // bolsas y una caja de pizza
    c.fillStyle = '#2a2f3a'; c.beginPath(); c.arc(x + w + 14, y + h - 6, 12, 0, 7); c.arc(x + w + 30, y + h - 2, 9, 0, 7); c.fill();
    c.fillStyle = '#e9c27a'; c.save(); c.translate(x - 16, y + h - 6); c.rotate(-.2); rr(c, -14, -10, 28, 20, 3); c.fill(); c.restore();
  }

  function cinta(c) {
    const { x, y, w } = CINTA;
    c.fillStyle = '#2f3542'; c.fillRect(x + 4, y - 18, 5, 26); c.fillRect(x + w - 9, y - 18, 5, 26);
    c.save(); c.beginPath(); c.rect(x + 6, y - 14, w - 12, 12); c.clip();
    c.fillStyle = '#ffd23f'; c.fillRect(x + 6, y - 14, w - 12, 12);
    c.fillStyle = '#1b1f2a';
    for (let i = -20; i < w; i += 16) { c.beginPath(); c.moveTo(x + i, y - 2); c.lineTo(x + i + 8, y - 2); c.lineTo(x + i + 16, y - 14); c.lineTo(x + i + 8, y - 14); c.fill(); }
    c.restore();
  }

  // ---------- la gente ----------
  // dir: 0 abajo, 1 izquierda, 2 derecha, 3 arriba. Los pies quedan en (x, y).
  function persona(c, x, y, lk, dir, fase, anda) {
    const k = lk.chico ? .78 : 1;
    c.save(); c.translate(x, y); c.scale(k, k);
    const paso = anda ? Math.sin(fase) : 0, bote = anda ? Math.abs(Math.cos(fase)) * 2 : Math.sin(fase * .5) * .6;
    sombra(c, 0, 0, 13, 5, .28);
    c.translate(0, -bote);
    // piernas
    c.fillStyle = lk.pantalon;
    if (dir === 1 || dir === 2) { rr(c, -4 + paso * 3, -11, 7, 11, 3); c.fill(); rr(c, -3 - paso * 3, -11, 7, 11, 3); c.fill(); }
    else { rr(c, -8, -11 + Math.max(0, paso) * 2, 7, 11 - Math.max(0, paso) * 2, 3); c.fill(); rr(c, 1, -11 + Math.max(0, -paso) * 2, 7, 11 - Math.max(0, -paso) * 2, 3); c.fill(); }
    // cuerpo
    const g = c.createLinearGradient(-12, 0, 12, 0);
    g.addColorStop(0, mezcla(lk.ropa, '#000000', .18)); g.addColorStop(.5, lk.ropa); g.addColorStop(1, mezcla(lk.ropa, '#000000', .22));
    c.fillStyle = g;
    if (lk.pollera) { c.beginPath(); c.moveTo(-9, -30); c.lineTo(9, -30); c.lineTo(13, -9); c.lineTo(-13, -9); c.closePath(); c.fill(); }
    else { rr(c, -11, -30, 22, 21, 8); c.fill(); }
    if (lk.rayas) { c.fillStyle = 'rgba(30,30,40,.45)'; for (let i = 0; i < 3; i++) c.fillRect(-11, -26 + i * 6, 22, 2.5); }
    if (lk.delantal && dir !== 3) { c.fillStyle = lk.delantal; rr(c, -7, -24, 14, 15, 4); c.fill(); }
    if (lk.sombrero === 'fedora' && dir !== 3) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-1, -29, 2, 19); c.fillStyle = '#5b4128'; c.fillRect(-11, -17, 22, 3); }
    // brazos
    c.fillStyle = mezcla(lk.ropa, '#000000', .1);
    if (dir === 1 || dir === 2) { rr(c, -3 - paso * 4, -28, 6, 15, 3); c.fill(); }
    else { rr(c, -15, -28 + paso * 2, 5, 15, 3); c.fill(); rr(c, 10, -28 - paso * 2, 5, 15, 3); c.fill(); }
    if (lk.bolsa) { c.fillStyle = '#b48a5a'; c.beginPath(); c.ellipse(dir === 1 ? -15 : 15, -12, 7, 8, 0, 0, 7); c.fill(); c.fillStyle = '#8a6a44'; c.fillRect(dir === 1 ? -17 : 13, -21, 4, 4); }
    // cabeza
    const hy = -42;
    if (lk.sombrero === 'capucha') { c.fillStyle = lk.sombreroColor; c.beginPath(); c.arc(0, hy, 16, 0, 7); c.fill(); }
    c.fillStyle = lk.piel; c.beginPath(); c.arc(0, hy, 13, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(-4, hy - 5, 5, 0, 7); c.fill();
    // pelo (lo que se ve debajo del sombrero)
    if (lk.pelo && lk.sombrero !== 'capucha') {
      c.fillStyle = lk.pelo;
      if (lk.sombrero === 'pelado') { c.beginPath(); c.arc(-11, hy + 1, 4, 0, 7); c.arc(11, hy + 1, 4, 0, 7); c.fill(); if (dir === 3) { c.beginPath(); c.arc(0, hy + 4, 10, 0, Math.PI); c.fill(); } }
      else if (dir === 3) { c.beginPath(); c.arc(0, hy, 13.5, 0, 7); c.fill(); }
      else { c.beginPath(); c.arc(0, hy - 2, 13.5, Math.PI * 1.05, Math.PI * 1.95); c.fill(); }
      if (lk.trenza) { c.beginPath(); c.arc(dir === 2 ? -10 : 10, hy + 6, 4.5, 0, 7); c.arc(dir === 2 ? -11 : 11, hy + 12, 3.5, 0, 7); c.fill(); }
    }
    // cara
    if (dir !== 3) {
      const ox = dir === 1 ? -4 : dir === 2 ? 4 : 0;
      c.fillStyle = '#222634';
      const parpadeo = (Math.floor((reloj + fase) * 10) % 37) === 0;
      const ojo = (ex) => { c.beginPath(); c.ellipse(ex, hy + 1, 2, parpadeo ? .4 : 2.6, 0, 0, 7); c.fill(); };
      if (dir === 0) { ojo(-4.5); ojo(4.5); } else ojo(ox + (dir === 1 ? -2 : 2));
      c.fillStyle = 'rgba(255,120,120,.35)';
      if (dir === 0) { c.beginPath(); c.arc(-8, hy + 6, 2.6, 0, 7); c.arc(8, hy + 6, 2.6, 0, 7); c.fill(); }
      if (lk.antifaz) { c.fillStyle = '#1a1a22'; rr(c, -11 + ox, hy - 3, 22, 8, 4); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-4.5 + ox, hy + 1, 1.3, 0, 7); c.arc(4.5 + ox, hy + 1, 1.3, 0, 7); c.fill(); }
      if (lk.lentes) { c.strokeStyle = '#2a2f3a'; c.lineWidth = 1.4; c.beginPath(); c.arc(-4.5 + ox, hy + 1, 3.8, 0, 7); c.moveTo(8.3 + ox, hy + 1); c.arc(4.5 + ox, hy + 1, 3.8, 0, 7); c.stroke(); }
      if (lk.bigote) { c.fillStyle = lk.bigote; c.beginPath(); c.ellipse(-3 + ox, hy + 6, 4, 2, .2, 0, 7); c.ellipse(3 + ox, hy + 6, 4, 2, -.2, 0, 7); c.fill(); }
    }
    // sombreros
    const sc = lk.sombreroColor;
    if (lk.sombrero === 'fedora') {
      c.fillStyle = sc; c.beginPath(); c.ellipse(0, hy - 8, 18, 5.5, 0, 0, 7); c.fill();
      rr(c, -10, hy - 21, 20, 14, [8, 8, 2, 2]); c.fill();
      c.fillStyle = '#2a1d14'; c.fillRect(-10, hy - 11, 20, 3);
    } else if (lk.sombrero === 'chef') {
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-6, hy - 16, 7, 0, 7); c.arc(6, hy - 16, 7, 0, 7); c.arc(0, hy - 21, 8, 0, 7); c.fill();
      rr(c, -10, hy - 15, 20, 8, 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.1)'; c.lineWidth = 1; c.stroke();
    } else if (lk.sombrero === 'gorra' || lk.sombrero === 'policia') {
      c.fillStyle = sc; c.beginPath(); c.arc(0, hy - 4, 13.5, Math.PI, 0); c.fill();
      if (dir !== 3) { c.beginPath(); c.ellipse(dir === 1 ? -9 : dir === 2 ? 9 : 0, hy - 4, dir === 0 ? 13 : 9, 4, 0, 0, Math.PI); c.fill(); }
      if (lk.sombrero === 'policia') { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(dir === 1 ? -4 : dir === 2 ? 4 : 0, hy - 11, 3, 0, 7); c.fill(); }
    } else if (lk.sombrero === 'rodete') {
      c.fillStyle = lk.pelo; c.beginPath(); c.arc(0, hy - 14, 7, 0, 7); c.fill();
    } else if (lk.sombrero === 'galera') {
      c.fillStyle = sc; c.beginPath(); c.ellipse(0, hy - 10, 16, 4.5, 0, 0, 7); c.fill(); rr(c, -9, hy - 30, 18, 21, 3); c.fill();
      c.fillStyle = '#ff4d8d'; c.fillRect(-9, hy - 15, 18, 4);
      c.fillStyle = '#ffd23f'; c.beginPath(); c.ellipse(8, hy - 30, 3, 9, .5, 0, 7); c.fill();
    }
    c.restore();
  }

  // El Mordisco, sin saber todavía quién es: una sombra con orejas y ojos que brillan
  function sombraMordisco(c, x, y) {
    const b = Math.sin(reloj * 3) * 2;
    sombra(c, x, y, 18, 6, .35);
    c.save(); c.translate(x, y - b);
    c.fillStyle = '#07080c';
    c.beginPath(); c.moveTo(-18, 0); c.quadraticCurveTo(-22, -30, -10, -38); c.lineTo(-15, -56); c.lineTo(-3, -44);
    c.quadraticCurveTo(0, -46, 3, -44); c.lineTo(15, -56); c.lineTo(10, -38); c.quadraticCurveTo(22, -30, 18, 0); c.closePath(); c.fill();
    c.fillStyle = '#1e2230'; rr(c, -14, -36, 28, 9, 5); c.fill();
    const parpa = Math.floor(reloj * 4) % 17 === 0;
    c.fillStyle = '#ffc53d'; c.shadowColor = '#ffc53d'; c.shadowBlur = 12;
    c.beginPath(); c.ellipse(-6, -32, 3.5, parpa ? .5 : 2.6, 0, 0, 7); c.ellipse(6, -32, 3.5, parpa ? .5 : 2.6, 0, 0, 7); c.fill();
    c.shadowBlur = 0;
    // cola que se asoma
    c.strokeStyle = '#07080c'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(14, -6); c.quadraticCurveTo(32 + Math.sin(reloj * 4) * 4, -8, 30, -26); c.stroke();
    c.restore();
  }
  // y cuando ya se sabe: un mapache (con su familia)
  function mapache(c, x, y, k = 1) {
    c.save(); c.translate(x, y); c.scale(k, k);
    sombra(c, 0, 0, 16, 6, .3);
    const b = Math.abs(Math.sin(reloj * 4 + k * 3)) * 2;
    c.translate(0, -b);
    c.strokeStyle = '#8d8f99'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(10, -8); c.quadraticCurveTo(28, -8, 26, -26); c.stroke();
    c.strokeStyle = '#2a2c33'; c.lineWidth = 4;
    [[20, -9], [26, -14], [27, -21]].forEach(([a, d]) => { c.beginPath(); c.moveTo(a - 3, d - 2); c.lineTo(a + 3, d + 2); c.stroke(); });
    c.fillStyle = '#8d8f99'; c.beginPath(); c.ellipse(0, -12, 14, 12, 0, 0, 7); c.fill();
    c.fillStyle = '#a3a5ae'; c.beginPath(); c.arc(0, -30, 13, 0, 7); c.fill();
    c.fillStyle = '#6f717b'; c.beginPath(); c.moveTo(-12, -36); c.lineTo(-9, -48); c.lineTo(-3, -40); c.moveTo(12, -36); c.lineTo(9, -48); c.lineTo(3, -40); c.fill();
    c.fillStyle = '#1e2027'; rr(c, -12, -34, 24, 8, 4); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-5, -30, 2.4, 0, 7); c.arc(5, -30, 2.4, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(-5, -30, 1.2, 0, 7); c.arc(5, -30, 1.2, 0, 7); c.fill();
    c.fillStyle = '#f4f4f6'; c.beginPath(); c.ellipse(0, -24, 6, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(0, -25, 2, 0, 7); c.fill();
    c.restore();
  }

  // globito arriba de alguien: "!" si tiene el caso que sigue, "✓" si ya se resolvió
  function globo(c, x, y, txt, color, alto = 0) {
    const b = Math.sin(reloj * 5) * 2.5 - alto;
    c.fillStyle = color; c.beginPath(); c.arc(x, y - 72 + b, 11, 0, 7); c.fill();
    c.beginPath(); c.moveTo(x - 4, y - 63 + b); c.lineTo(x + 4, y - 63 + b); c.lineTo(x, y - 57 + b); c.fill();
    c.fillStyle = '#12151d'; c.font = '800 14px "Space Grotesk", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, x, y - 71 + b);
  }
  function aviso(c, x, y) {                                 // "Espacio" arriba de con quién se puede hablar
    const txt = tactil() ? 'Tocá para hablar' : 'Espacio: hablar';
    c.font = '600 11px Inter, system-ui, sans-serif';
    const w = c.measureText(txt).width + 16;
    c.fillStyle = 'rgba(18,21,29,.88)'; rr(c, x - w / 2, y - 98, w, 20, 10); c.fill();
    c.fillStyle = '#ffc53d'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y - 87.5);
  }

  function dibujar() {
    if (r3d) return r3d.render();
    const c = ctx;
    c.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);
    suelo(c);
    huellas(c);
    // todo lo que tiene altura se ordena por dónde apoya: lo de más abajo tapa a lo de más arriba
    const cosasAltas = [];
    EDIFICIOS.forEach(b => cosasAltas.push({ y: b.py + b.ph, f: () => edificio(c, b) }));
    ARBOLES.forEach(a => { if (!a.borrar && visible(a.x, a.y, 70)) cosasAltas.push({ y: a.y, f: () => arbol(c, a) }); });
    FAROLES.forEach(f => { if (visible(f.x, f.y, 60)) cosasAltas.push({ y: f.y, f: () => farol(c, f) }); });
    BANCOS.forEach(b => cosasAltas.push({ y: (b[1] + b[3]) * T, f: () => banco(c, b) }));
    AUTOS.forEach(a => cosasAltas.push({ y: a.y + a.h, f: () => auto(c, a) }));
    cosasAltas.push({ y: FUENTE.y + FUENTE.r * .5, f: () => fuente(c) });
    cosasAltas.push({ y: CONTENEDOR.y + CONTENEDOR.h, f: () => contenedor(c) });
    if (cintaPuesta()) cosasAltas.push({ y: CINTA.y + CINTA.h, f: () => cinta(c) });
    const obj = objetivo();
    NPCS.forEach(n => {
      if (!visible(n.px, n.py, 90)) return;
      cosasAltas.push({ y: n.py, f: () => {
        persona(c, n.px, n.py, LOOK[n.look], n.dir, n.fase + reloj * 2, false);
        const alto = ['chef', 'galera'].includes(LOOK[n.look].sombrero) ? 14 : 0;   // los sombreros altos
        if (n === cerca && !dialogo && !popup) return;                                // ahí va el cartel de "hablar"
        if (n.caso && n.caso === obj) globo(c, n.px, n.py, '!', '#ffc53d', alto);
        else if (n.caso && prog(n.caso).lupas) globo(c, n.px, n.py, '✓', '#b8ff3c', alto);
      } });
    });
    cosas().forEach(o => {
      if (o.especial === 'mordisco') cosasAltas.push({ y: o.py, f: () => { sombraMordisco(c, o.px, o.py); globo(c, o.px, o.py + 6, '!', '#ff4d6d'); } });
      else if (o.especial === 'mapache') cosasAltas.push({ y: o.py, f: () => { mapache(c, o.px, o.py); mapache(c, o.px + 28, o.py + 10, .6); mapache(c, o.px - 26, o.py + 12, .55); } });
      else if (o.caso === obj) cosasAltas.push({ y: o.py + 40, f: () => globo(c, o.px, o.py - 2, '!', '#ffc53d') });
    });
    cosasAltas.push({ y: yo.y, f: () => persona(c, yo.x, yo.y, LOOK.detective, yo.dir, yo.fase, yo.anda) });
    cosasAltas.sort((a, b) => a.y - b.y).forEach(o => o.f());
    if (cerca && !dialogo && !popup) aviso(c, cerca.px, cerca.py);
    // de noche: oscuro, con la luz de los faroles y la linterna del detective
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (esNoche()) {
      nctx.globalCompositeOperation = 'source-over';
      nctx.clearRect(0, 0, noche.width, noche.height);
      nctx.fillStyle = 'rgba(8,12,34,.74)'; nctx.fillRect(0, 0, noche.width, noche.height);
      nctx.globalCompositeOperation = 'destination-out';
      const luz = (wx, wy, r, a) => {
        const sx = (wx - camX) * zoom * dpr, sy = (wy - camY) * zoom * dpr, sr = r * zoom * dpr;
        const g = nctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
        nctx.fillStyle = g; nctx.beginPath(); nctx.arc(sx, sy, sr, 0, 7); nctx.fill();
      };
      FAROLES.forEach(f => { if (visible(f.x, f.y, 140)) luz(f.x, f.y - 30, 120, .9); });
      luz(yo.x, yo.y - 20, 150, 1);
      luz(3.4 * T, 5 * T, 60, .5);
      c.drawImage(noche, 0, 0);
      // el brillo cálido de los faroles
      c.globalCompositeOperation = 'lighter';
      FAROLES.forEach(f => {
        if (!visible(f.x, f.y, 140)) return;
        const sx = (f.x - camX) * zoom * dpr, sy = (f.y - 44 - camY) * zoom * dpr, sr = 46 * zoom * dpr;
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, sr);
        g.addColorStop(0, 'rgba(255,214,120,.35)'); g.addColorStop(1, 'rgba(255,214,120,0)');
        c.fillStyle = g; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
      });
      c.globalCompositeOperation = 'source-over';
    }
    flecha(c, obj);
  }
  const visible = (x, y, m) => x > camX - m && x < camX + vistaW + m && y > camY - m && y < camY + vistaH + m * 1.6;

  // si quien tiene el caso que sigue no está en pantalla, una flecha en el borde apunta hacia él
  function flecha(c, obj) {
    const d = destinoCaso(obj);
    if (!d || dialogo || popup) return;
    const sx = (d.x - camX) * zoom, sy = (d.y - 30 - camY) * zoom, sw = vistaW * zoom, sh = vistaH * zoom;
    if (sx > 20 && sx < sw - 20 && sy > 20 && sy < sh - 20) return;
    const cx = sw / 2, cy = sh / 2, ang = Math.atan2(sy - cy, sx - cx);
    const m = 34, tx = Math.cos(ang), ty = Math.sin(ang);
    const t = Math.min(Math.abs((sw / 2 - m) / (tx || 1e-6)), Math.abs((sh / 2 - m) / (ty || 1e-6)));
    const ax = cx + tx * t, ay = cy + ty * t;
    c.save(); c.scale(dpr, dpr); c.translate(ax, ay); c.rotate(ang);
    c.globalAlpha = .75 + Math.sin(reloj * 5) * .25;
    c.fillStyle = 'rgba(18,21,29,.85)'; c.beginPath(); c.arc(0, 0, 18, 0, 7); c.fill();
    c.fillStyle = '#ffc53d'; c.beginPath(); c.moveTo(11, 0); c.lineTo(-5, -9); c.lineTo(-1, 0); c.lineTo(-5, 9); c.closePath(); c.fill();
    c.restore();
  }

  // ======================= el caso que sigue =======================
  function objetivo() {
    for (let n = 1; n <= 10; n++) if (abierto(n) && CASOS[n].listo && !prog(n).lupas) return n;
    return 0;
  }
  function destinoCaso(n) {
    if (!n) return null;
    const p = NPCS.find(x => x.caso === n) || cosas().find(x => x.caso === n);
    return p ? { x: p.px, y: p.py } : null;
  }
  function pintarObjetivo() {
    const n = objetivo(), el = document.getElementById('bObjetivo');
    const lugar = LUGAR[n] || '';
    el.innerHTML = n
      ? '<b>' + (n === 10 ? 'Caso final' : 'Caso ' + String(n).padStart(2, '0')) + '</b> ' + esc(lugar.charAt(0).toUpperCase() + lugar.slice(1))
      : atrapado() ? '<b>¡Caso cerrado!</b> Volvé a cualquier caso para ganar más lupas' : '';
    el.hidden = !el.innerHTML;
    document.getElementById('bLibretaCuenta').textContent = resueltos() + '/9';
  }

  // ======================= movimiento y choques =======================
  function solidos() {
    const s = [];
    EDIFICIOS.forEach(b => s.push({ x: b.px, y: b.py + 6, w: b.pw, h: b.ph - 6 }));
    BANCOS.forEach(([x, y, w, h]) => s.push({ x: x * T, y: y * T, w: w * T, h: h * T }));
    AUTOS.forEach(a => s.push(a));
    s.push(CONTENEDOR);
    if (cintaPuesta()) s.push(CINTA);
    return s;
  }
  function libre(x, y, ss) {
    if (x < RADIO + 4 || y < T * 1.4 || x > W * T - RADIO - 4 || y > H * T - T * .4) return false;
    for (const r of ss) {
      const cx = Math.max(r.x, Math.min(x, r.x + r.w)), cy = Math.max(r.y, Math.min(y, r.y + r.h));
      if ((x - cx) ** 2 + (y - cy) ** 2 < RADIO * RADIO) return false;
    }
    if ((x - FUENTE.x) ** 2 + ((y - FUENTE.y) * 1.2) ** 2 < (FUENTE.r + RADIO - 4) ** 2) return false;
    for (const a of ARBOLES) if (!a.borrar && Math.abs(a.x - x) < 30 && Math.abs(a.y - y) < 30 && (a.x - x) ** 2 + ((a.y - y) * 1.6) ** 2 < (RADIO + 9) ** 2) return false;
    for (const f of FAROLES) if (Math.abs(f.x - x) < 16 && Math.abs(f.y - y) < 12) return false;
    for (const n of NPCS) if ((n.px - x) ** 2 + ((n.py - y) * 1.5) ** 2 < (RADIO + 10) ** 2) return false;
    for (const o of cosas()) if (o.especial && (o.px - x) ** 2 + ((o.py - y) * 1.5) ** 2 < (RADIO + 14) ** 2) return false;
    return true;
  }

  function mover(dt) {
    let vx = 0, vy = 0;
    if (!dialogo && !popup && !libreta) {
      if (teclas.has('ArrowLeft') || teclas.has('a')) vx -= 1;
      if (teclas.has('ArrowRight') || teclas.has('d')) vx += 1;
      if (teclas.has('ArrowUp') || teclas.has('w')) vy -= 1;
      if (teclas.has('ArrowDown') || teclas.has('s')) vy += 1;
      if (palanca) { vx = palanca.x; vy = palanca.y; }
      if (vx || vy) destino = null;
      else if (destino) {
        const dx = destino.x - yo.x, dy = destino.y - yo.y, d = Math.hypot(dx, dy);
        if (destino.con && Math.hypot(destino.con.px - yo.x, destino.con.py - yo.y) < ALCANCE) { const o = destino.con; destino = null; mirarA(o); hablar(o); }
        else if (d < 6) destino = null;
        else { vx = dx / d; vy = dy / d; }
      }
    }
    const largo = Math.hypot(vx, vy);
    yo.anda = largo > .15;
    if (!yo.anda) { yo.fase = 0; return; }
    if (largo > 1) { vx /= largo; vy /= largo; }
    const ss = solidos(), ax = yo.x, ay = yo.y;
    const nx = yo.x + vx * VEL * dt, ny = yo.y + vy * VEL * dt;
    if (libre(nx, yo.y, ss)) yo.x = nx;
    if (libre(yo.x, ny, ss)) yo.y = ny;
    yo.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : (vy < 0 ? 3 : 0);
    yo.fase += dt * 11;
    if (destino) { if (Math.hypot(yo.x - ax, yo.y - ay) < .5) { trabado += dt; if (trabado > .3) destino = null; } else trabado = 0; }
  }
  function mirarA(o) {
    const dx = o.px - yo.x, dy = o.py - yo.y;
    yo.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    if (o.look) o.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 1) : (dy < 0 ? 0 : 3);
  }
  function buscarCerca() {
    let mejor = null, md = ALCANCE;
    for (const o of NPCS.concat(cosas())) {
      const d = Math.hypot(o.px - yo.x, o.py - yo.y);
      if (d < md) { md = d; mejor = o; }
    }
    cerca = mejor;
  }

  // ======================= diálogos =======================
  // páginas: [{ quien, texto }]; opciones: [{ txt, f }] en la última
  function decir(paginas, alTerminar) {
    dialogo = { paginas, i: 0, letras: 0, alTerminar };
    document.getElementById('bDialogo').hidden = false;
    pintarPagina();
  }
  function pintarPagina() {
    const p = dialogo.paginas[dialogo.i], q = quien(p.quien);
    const el = document.getElementById('bDialogo');
    el.querySelector('.quien').textContent = q.nombre;
    el.classList.toggle('narrador', q === NARRADOR);
    el.classList.toggle('malo', q.especial === 'mordisco');
    retrato(el.querySelector('canvas'), p.quien);
    dialogo.letras = 0;
    el.querySelector('.texto').textContent = '';
  }
  function retrato(cv, id) {
    if (r3d) return r3d.retrato(cv, id);
    const c = cv.getContext('2d'), r = window.devicePixelRatio || 1;
    cv.width = 64 * r; cv.height = 64 * r;
    c.setTransform(r, 0, 0, r, 0, 0); c.clearRect(0, 0, 64, 64);
    const q = quien(id);
    if (q === NARRADOR) { c.font = '34px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('📻', 32, 34); return; }
    c.save(); c.translate(32, 100); c.scale(1.65, 1.65);
    if (q.especial === 'mordisco') sombraMordisco(c, 0, -2);
    else if (q.especial === 'mapache') mapache(c, 0, -6);
    else persona(c, 0, 0, LOOK[q.look], 0, 0, false);
    c.restore();
  }
  function avanzarDialogo() {
    if (!dialogo) return;
    const p = dialogo.paginas[dialogo.i];
    if (dialogo.letras < p.texto.length) { dialogo.letras = p.texto.length; return; }   // primero, completar el texto
    if (dialogo.i < dialogo.paginas.length - 1) { dialogo.i++; pintarPagina(); return; }
    const fin = dialogo.alTerminar;
    cerrarDialogo();
    if (fin) fin();
  }
  function cerrarDialogo() {
    dialogo = null;
    document.getElementById('bDialogo').hidden = true;
    NPCS.forEach(n => { n.dir = 0; });
  }
  function escribir(dt) {
    if (!dialogo) return;
    const p = dialogo.paginas[dialogo.i], antes2 = Math.floor(dialogo.letras);
    dialogo.letras = Math.min(p.texto.length, dialogo.letras + dt * 48);
    const ahora = Math.floor(dialogo.letras);
    if (ahora !== antes2) {
      document.querySelector('#bDialogo .texto').textContent = p.texto.slice(0, ahora);
      if (ahora % 3 === 0 && /\S/.test(p.texto[ahora - 1] || '')) bip(quien(p.quien).especial === 'mordisco' ? 160 : 520 + (p.quien.length % 5) * 40, .025, 'triangle', .018);
    }
    document.querySelector('#bDialogo .sigue').hidden = dialogo.letras < p.texto.length;
  }

  // ======================= hablar con alguien =======================
  function hablar(o) {
    if (!o) return;
    mirarA(o);
    if (!o.caso) return decir(o.lineas);
    const n = o.caso;
    if (!abierto(n)) {
      const n0 = n - 1;
      return decir([P(o.id === 'contenedor' ? 'narrador' : o.id, o.id === 'contenedor'
          ? 'Una cinta policial cierra el callejón. Todavía no se puede pasar.'
          : 'Hola, detective. Ahora estoy un poco ocupado…'),
        P('narrador', 'Para abrir este caso, primero resolvé el caso ' + String(n0).padStart(2, '0') + ': hablá con ' + LUGAR[n0] + '.')]);
    }
    const p = prog(n);
    const intro = p.lupas && o.especial === 'mapache'
      ? o.lineas.concat([P('narrador', 'Ya tenés ' + p.lupas + ' de 3 lupas en el caso final. ¿Querés volver a enfrentarlo para ganar más?')])
      : p.lupas
      ? [P(o.id === 'contenedor' ? 'narrador' : o.id, o.id === 'contenedor' ? 'La guarida sigue acá. ¿Revisamos el inventario otra vez?' : '¡Detective! Gracias otra vez por resolver mi caso.'),
         P('narrador', 'Ya tenés ' + p.lupas + ' de 3 lupas en este caso. ¿Querés investigarlo de nuevo para ganar más?')]
      : o.intro;
    decir(intro, () => expediente(n));
  }

  // el expediente del caso: qué se aprende, cómo se juega y el botón para empezar
  function expediente(n) {
    const c = CASOS[n], p = prog(n), fin = n === 10;
    const el = document.getElementById('bExpediente');
    el.style.setProperty('--c', c.color);
    el.innerHTML =
      '<article class="expediente">' +
        '<span class="solapa">EXPEDIENTE ' + (fin ? 'FINAL' : String(n).padStart(2, '0')) + '</span>' +
        (p.lupas ? '<span class="sello">' + (fin ? 'ATRAPADO' : 'RESUELTO') + '</span>' : '') +
        '<div class="exp-cab"><div class="escena">' + c.dibujo() + '</div>' +
        '<div><div class="tema">' + esc(c.tema) + '</div><h2>' + esc(c.titulo) + '</h2>' +
        '<div class="aprende"><b>Lo que vas a aprender</b><p>' + esc(c.aprende) + '</p></div></div></div>' +
        '<h3>Cómo se investiga</h3>' +
        '<ol class="pasos">' + c.pasos.map((t, i) => '<li><span>' + (i + 1) + '</span>' + esc(t) + '</li>').join('') + '</ol>' +
        '<div class="metas">' + c.metas.map((t, i) => '<div class="meta' + (p.lupas > i ? ' ok' : '') + '">' + lupas(i + 1) + '<span>' + esc(t) + '</span></div>').join('') + '</div>' +
        '<div class="jugar-fila"><button class="boton" id="bInvestigar">Investigar ▶</button>' +
        '<button class="ghost" id="bAhoraNo">Ahora no</button>' +
        (p.mejor ? '<span class="mejor">Tu mejor: <b>' + p.mejor + '</b> pts</span>' : '') + '</div>' +
      '</article>';
    el.hidden = false; popup = true;
    el.scrollTop = 0;
    document.getElementById('bInvestigar').addEventListener('click', () => investigar(n));
    document.getElementById('bAhoraNo').addEventListener('click', cerrarExpediente);
    document.getElementById('bInvestigar').focus();
  }
  function cerrarExpediente() {
    popup = false;
    document.getElementById('bExpediente').hidden = true;
    pantalla().focus({ preventScroll: true });
  }
  function investigar(n) {
    cerrarExpediente();
    try {
      sessionStorage.setItem('misterios.pos', JSON.stringify({ x: yo.x, y: yo.y, dir: yo.dir }));
      sessionStorage.setItem('misterios.jugando', JSON.stringify({ n, lupas: prog(n).lupas }));
    } catch (e) {}
    location.hash = 'jugar-' + n;
  }

  // al volver de un caso: si es la primera vez que se resuelve, el vecino da la pista
  function alVolver(n) {
    let j = null;
    try { j = JSON.parse(sessionStorage.getItem('misterios.jugando')); sessionStorage.removeItem('misterios.jugando'); } catch (e) {}
    const o = NPCS.find(x => x.caso === n) || cosas().find(x => x.caso === n);
    if (!o) return;
    pararFrente(o);
    if (!j || j.n !== n) return hablar(o);                 // vino de "Caso siguiente →": se arranca la charla
    if (j.lupas || !prog(n).lupas) return;                 // ya estaba resuelto, o todavía no: nada que contar
    const sig = objetivo();
    if (n === 10) {
      return decir([
        P('narrador', '¡Lo atrapaste! Prendemos la linterna y…'),
        P('mapache', '…¡Perdón! ¡Perdón! No me lleven…'),
        P('narrador', '¡Era un mapache! ' + CASOS[10].pista),
        P('mapache', 'Teníamos mucha hambre. Por eso me llevaba siempre partes iguales: para que a mis hijos les toque lo mismo.'),
        P('narrador', '🏆 ¡Caso cerrado, detective! Resolviste todas las Desapariciones Misteriosas.'),
      ], pintarObjetivo);
    }
    const dice = o.id === 'contenedor' ? 'narrador' : o.id;
    decir([
      P(dice, o.id === 'contenedor' ? '¡Inventario completo! La guarida ya no tiene secretos.' : '¡Lo lograste, detective! ¡Mil gracias!'),
      P(dice, (o.id === 'contenedor' ? 'Entre las porciones hay algo más. ' : 'Mirá lo que encontré cerca de donde pasó todo. ') + '«' + CASOS[n].pista + '»'),
      P('narrador', '📒 Pista ' + n + ' anotada en tu libreta.' + (sig ? ' Próximo caso: hablá con ' + LUGAR[sig] + '.' : '')),
    ].concat(n === 9 ? [P('narrador', '🌙 Cae la noche sobre el barrio… Todas las pistas llevan al callejón. El Mordisco va a volver.')] : []),
    pintarObjetivo);
  }
  function pararFrente(o) {
    // se busca un lugar libre frente a la persona (abajo primero)
    const ss = solidos();
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0], [0, 1.5]]) {
      const lejos = o.especial ? 1.25 : .95;
      const x = o.px + dx * T * lejos, y = o.py + dy * T * lejos;
      if (libre(x, y, ss)) { yo.x = x; yo.y = y; break; }
    }
    mirarA(o);
  }

  // ======================= la libreta =======================
  function abrirLibreta() {
    libreta = true;
    let total = 0, html = '';
    for (let n = 1; n <= 10; n++) total += prog(n).lupas;
    let pistas = '';
    for (let n = 1; n <= 9; n++) {
      pistas += prog(n).lupas
        ? '<div class="pista"><i>Pista ' + n + ' · ' + esc(CASOS[n].titulo) + '</i>' + esc(CASOS[n].pista) + '</div>'
        : '<div class="pista oculta"><i>Pista ' + n + '</i>Resolvé el caso ' + n + ' para conseguirla.</div>';
    }
    let casos = '';
    for (let n = 1; n <= 10; n++) {
      const c = CASOS[n], p = prog(n), ok = abierto(n);
      casos += '<div class="lib-caso' + (ok ? '' : ' cerrado') + '" style="--c:' + c.color + '">' +
        '<span class="num">' + (n === 10 ? 'FINAL' : String(n).padStart(2, '0')) + '</span>' +
        '<span class="nom"><b>' + (ok ? esc(c.titulo) : '???') + '</b><small>' + (ok ? esc(c.tema) : 'Todavía clasificado') + '</small></span>' +
        lupas(p.lupas) +
        (ok ? '<button class="ghost" data-ir="' + n + '">Ir ▶</button>' : '<span class="candado">🔒</span>') + '</div>';
    }
    html = '<div class="lib-panel"><div class="lib-cab"><h2>📒 Libreta del detective</h2><button class="ghost" id="bCerrarLib">Cerrar ✕</button></div>' +
      '<div class="resumen"><div class="dato"><b>' + resueltos() + '<small>/9</small></b><span>Casos resueltos</span></div>' +
      '<div class="dato oro"><b>' + total + '<small>/30</small></b><span>Lupas</span></div></div>' +
      '<div class="lib-grid"><div class="buscado"><h3>SE BUSCA</h3><div class="foto">' + mordisco(prog(6).lupas > 0) + '</div>' +
      '<b>EL MORDISCO</b><small>' + (atrapado() ? '¡Atrapado! Era: ' + esc(REVELADO.toLowerCase()) : 'Identidad: desconocida') + '</small></div>' +
      '<div><h3 class="lib-tit">Pistas</h3><div class="pistas">' + pistas + '</div></div></div>' +
      '<h3 class="lib-tit">Casos</h3><div class="lib-casos">' + casos + '</div></div>';
    const el = document.getElementById('bLibreta');
    el.innerHTML = html; el.hidden = false;
    document.getElementById('bCerrarLib').addEventListener('click', cerrarLibreta);
    el.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => {
      cerrarLibreta();
      const n = +b.dataset.ir, o = NPCS.find(x => x.caso === n) || cosas().find(x => x.caso === n);
      if (o) { pararFrente(o); hablar(o); }
    }));
    document.getElementById('bCerrarLib').focus();
  }
  function cerrarLibreta() {
    libreta = false;
    document.getElementById('bLibreta').hidden = true;
    pantalla().focus({ preventScroll: true });
  }

  // ======================= controles =======================
  const tactil = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function accion() {
    if (libreta) return;
    if (popup) return;
    if (dialogo) return avanzarDialogo();
    if (cerca) hablar(cerca);
  }
  function teclaAbajo(e) {
    if (!activo) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (popup) {
      if (k === 'Escape') { e.preventDefault(); cerrarExpediente(); }
      return;                                              // Enter lo maneja el botón con foco
    }
    if (libreta) { if (k === 'Escape' || k === 'l') { e.preventDefault(); cerrarLibreta(); } return; }
    if (k === ' ' || k === 'Enter' || k === 'e') { e.preventDefault(); if (!e.repeat) accion(); return; }
    if (k === 'l' && !dialogo) { e.preventDefault(); abrirLibreta(); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) { e.preventDefault(); teclas.add(k); }
  }
  function teclaArriba(e) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; teclas.delete(k); }

  function armarPalanca() {
    const base = document.getElementById('bPalanca'), bola = base.querySelector('i');
    let id = null;
    const mover2 = e => {
      const r = base.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width / 2 - 10, d = Math.hypot(dx, dy);
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      bola.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      palanca = d > 8 ? { x: dx / max, y: dy / max } : null;
    };
    base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(id); mover2(e); });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) mover2(e); });
    const soltar = () => { id = null; palanca = null; bola.style.transform = ''; };
    base.addEventListener('pointerup', soltar); base.addEventListener('pointercancel', soltar);
    document.getElementById('bAccion').addEventListener('click', accion);
  }
  // tocar el mapa: caminar hasta ahí, o ir a hablar con quien se tocó
  function tocarMapa(e) {
    if (dialogo) return avanzarDialogo();
    if (popup || libreta) return;
    let wx, wy;
    if (r3d) { const p = r3d.pisoEn(e.clientX, e.clientY); if (!p) return; wx = p.x; wy = p.y; }
    else { const r = lienzo.getBoundingClientRect(); wx = camX + (e.clientX - r.left) / zoom; wy = camY + (e.clientY - r.top) / zoom; }
    const o = NPCS.concat(cosas()).find(x => Math.abs(x.px - wx) < 26 && wy < x.py + 14 && wy > x.py - (r3d ? 80 : 62));
    if (o) {
      if (Math.hypot(o.px - yo.x, o.py - yo.y) < ALCANCE) return hablar(o);
      destino = { x: o.px, y: o.py + T * .8, con: o }; trabado = 0; return;
    }
    destino = { x: wx, y: wy }; trabado = 0;
  }

  // ======================= el ciclo =======================
  function medir() {
    const caja = document.getElementById('mundo');
    const w = caja.clientWidth;
    const h = Math.round(Math.max(380, Math.min(window.innerHeight * (w < 600 ? .78 : .74), w * (w < 600 ? 1.45 : .64))));   // en el celu, más alto que ancho
    dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.style.height = h + 'px';
    if (r3d) { lienzo3d.style.height = h + 'px'; r3d.medir(w, h, dpr); }
    lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
    noche.width = lienzo.width; noche.height = lienzo.height;
    const casilleros = Math.max(8.5, Math.min(16, w / 64));     // en pantallas chicas se ve más de cerca
    zoom = w / (T * casilleros);
    vistaW = w / zoom; vistaH = h / zoom;
  }
  function cuadro(t) {
    raf = 0;
    if (!activo) return;
    const dt = Math.min(.05, (t - antes) / 1000 || 0); antes = t; reloj += dt;
    mover(dt);
    buscarCerca();
    escribir(dt);
    camX = Math.max(0, Math.min(W * T - vistaW, yo.x - vistaW / 2));
    camY = Math.max(0, Math.min(H * T - vistaH, yo.y - 20 - vistaH / 2));
    if (vistaW > W * T) camX = (W * T - vistaW) / 2;
    dibujar();
    raf = requestAnimationFrame(cuadro);
  }

  function armar() {
    if (armado) return;
    armado = true;
    lienzo = document.getElementById('mapa'); ctx = lienzo.getContext('2d');
    noche = document.createElement('canvas'); nctx = noche.getContext('2d');
    window.addEventListener('keydown', teclaAbajo);
    window.addEventListener('keyup', teclaArriba);
    window.addEventListener('blur', () => teclas.clear());
    window.addEventListener('resize', () => { if (activo) medir(); });
    lienzo.addEventListener('pointerdown', tocarMapa);
    document.getElementById('bDialogo').addEventListener('click', avanzarDialogo);
    document.getElementById('bLibretaBtn').addEventListener('click', abrirLibreta);
    document.getElementById('bLibreta').addEventListener('click', e => { if (e.target.id === 'bLibreta') cerrarLibreta(); });
    armarPalanca();
    cargar3D();
  }

  // el barrio en 3D: Three.js y barrio3d.js se bajan aparte. Mientras tanto (o si no se puede) queda el 2D.
  const MUNDO = {
    T, W, H, EDIFICIOS, ARBOLES, FAROLES, BANCOS, AUTOS, FUENTE, CONTENEDOR, CINTA, PLAZA, CALLES, VEREDAS, HUELLAS, NPCS, LOOK, yo, cosas, quien,
    etiquetas: null,
    estado: () => ({
      noche: esNoche(), cinta: cintaPuesta(), objetivo: objetivo(), reloj, tactil: tactil(),
      huellas: atrapado() ? 0 : Math.round(HUELLAS.length * Math.min(1, resueltos() / 9)),
      cerca: dialogo || popup ? null : cerca, ocupado: !!(dialogo || popup), resuelto: n => prog(n).lupas > 0,
    }),
  };
  async function cargar3D() {
    lienzo.style.visibility = 'hidden';                      // que no se vea el 2D un instante antes del 3D
    const plan2D = setTimeout(() => { lienzo.style.visibility = ''; }, 6000);
    try {
      const mod = await import('./barrio3d.js?v=1');
      lienzo3d = document.createElement('canvas');
      lienzo3d.id = 'mapa3d'; lienzo3d.tabIndex = 0; lienzo3d.className = 'mapa3d';
      lienzo3d.setAttribute('aria-label', lienzo.getAttribute('aria-label'));
      lienzo.before(lienzo3d);
      MUNDO.etiquetas = document.getElementById('bEtiquetas');
      r3d = mod.crear(lienzo3d, MUNDO);
      lienzo3d.addEventListener('pointerdown', tocarMapa);
      lienzo.hidden = true;
      clearTimeout(plan2D);
      medir();
      if (dialogo) pintarPagina();                            // el retrato, ahora en 3D
      if (activo) lienzo3d.focus({ preventScroll: true });
    } catch (e) {
      console.warn('El barrio queda en 2D:', e);
      if (lienzo3d) lienzo3d.remove();
      r3d = null; lienzo.hidden = false; lienzo.style.visibility = '';
      clearTimeout(plan2D);
    }
  }

  return {
    // n: 0 = donde quedó; 1–10 = frente a quien tiene ese caso
    mostrar(n) {
      armar();
      activo = true;
      teclas.clear(); destino = null; palanca = null;
      cerrarDialogo(); popup = false; libreta = false;
      document.getElementById('bExpediente').hidden = true;
      document.getElementById('bLibreta').hidden = true;
      medir();
      try {
        const p = JSON.parse(sessionStorage.getItem('misterios.pos'));
        if (p) { yo.x = p.x; yo.y = p.y; yo.dir = p.dir; }
      } catch (e) {}
      pintarObjetivo();
      if (n) alVolver(n);
      else if (!progreso.intro) {                           // la primera vez: la radio cuenta qué pasa
        progreso.intro = true; guardarProgreso();
        decir([
          P('narrador', 'Atención, detective: algo se está comiendo el barrio. De a pedacitos.'),
          P('narrador', 'Media pizza. Un cuarto de torta. Tres octavos de chocolate… y el único rastro es la marca de una mordida.'),
          P('narrador', 'Le dicen El Mordisco. Recorré el barrio, hablá con los vecinos y resolvé los casos para descubrir quién es.'),
          P('narrador', tactil()
            ? 'Caminá con la palanca (o tocando el piso) y tocá a los vecinos para hablar. Empezá por Don Tito: tiene un ! arriba.'
            : 'Caminá con las flechas (o W A S D) y hablá con Espacio. Empezá por Don Tito, en la pizzería: tiene un ! arriba.'),
        ]);
      }
      pantalla().focus({ preventScroll: true });
      antes = performance.now();
      if (!raf) raf = requestAnimationFrame(cuadro);
    },
    ocultar() {
      activo = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      try { sessionStorage.setItem('misterios.pos', JSON.stringify({ x: yo.x, y: yo.y, dir: yo.dir })); } catch (e) {}
    },
  };
})();
