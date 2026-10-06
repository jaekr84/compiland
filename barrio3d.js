// barrio3d.js — el barrio de Desapariciones Misteriosas en 3D (Three.js).
// Dibuja el mismo mundo que barrio.js (mismo mapa, misma gente, mismos choques) con modelos, luz de sol y sombras suaves,
// en vista de tres cuartos desde arriba. barrio.js lo carga si el navegador puede; si no, queda el barrio en 2D.
// Todo se arma con formas simples (cajas redondeadas, cápsulas, esferas): no hay archivos de modelos para bajar.
// En 3D, un casillero del mapa mide 1. El "abajo" del mapa (y creciente) es +Z, hacia la cámara.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function crear(lienzo, M) {
  const T = M.T;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const escena = new THREE.Scene();
  const CIELO_DIA = new THREE.Color('#cfe8d8'), CIELO_NOCHE = new THREE.Color('#0d1226');
  escena.background = CIELO_DIA.clone();
  escena.fog = new THREE.Fog(CIELO_DIA.clone(), 26, 52);
  const camara = new THREE.PerspectiveCamera(30, 1.6, .5, 140);

  // ======================= luces =======================
  const cielo = new THREE.HemisphereLight('#fff4e0', '#6f8f58', 1.5);
  const sol = new THREE.DirectionalLight('#ffeccc', 2.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
  sol.shadow.bias = -.0005; sol.shadow.normalBias = .03; sol.shadow.radius = 5;
  const relleno = new THREE.AmbientLight('#ffffff', .18);
  escena.add(cielo, sol, sol.target, relleno);
  // de noche: algunas luces de farol (las más cercanas) y la linterna del detective
  const lucesFarol = [];
  for (let i = 0; i < 7; i++) { const l = new THREE.PointLight('#ffc977', 0, 4.2, 2); escena.add(l); lucesFarol.push(l); }
  const linterna = new THREE.SpotLight('#fff1c8', 0, 7, .5, .75, 2);
  escena.add(linterna, linterna.target);

  // ======================= materiales y texturas =======================
  const mats = new Map();
  const mat = (color, o = {}) => {
    const k = color + JSON.stringify(o);
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .82, metalness: 0 }, o)));
    return mats.get(k);
  };
  function textura(w, h, pintar, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    pintar(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (rep) t.repeat.set(rep[0], rep[1]);
    return t;
  }
  const r = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const ruido = (c, w, h, n, colores, tam) => {
    for (let i = 0; i < n; i++) { c.fillStyle = colores[i % colores.length]; c.fillRect(r() * w, r() * h, tam * (.5 + r()), tam * (.5 + r())); }
  };
  // pasto: verde con matitas
  const TX_PASTO = textura(256, 256, (c, w, h) => {
    c.fillStyle = '#74b95f'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = i % 2 ? 'rgba(60,130,60,.18)' : 'rgba(170,220,120,.16)'; c.beginPath(); c.ellipse(r() * w, r() * h, 20 + r() * 30, 12 + r() * 20, r() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 1400; i++) {
      c.strokeStyle = ['#5ea54f', '#86c86b', '#6cb15a', '#94d377'][i % 4]; c.lineWidth = 1.2;
      const x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - .5) * 3, y - 3 - r() * 4); c.stroke();
    }
  });
  // baldosas de piedra de la plaza, como de templo: cada una un poco distinta, con junta
  const TX_PLAZA = textura(512, 512, (c, w, h) => {
    c.fillStyle = '#b59a74'; c.fillRect(0, 0, w, h);
    const n = 4, L = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const t = .88 + r() * .14;
      c.fillStyle = 'rgb(' + Math.round(232 * t) + ',' + Math.round(208 * t) + ',' + Math.round(170 * t) + ')';
      c.beginPath(); c.roundRect(i * L + 5, j * L + 5, L - 10, L - 10, 10); c.fill();
      const g = c.createLinearGradient(i * L, j * L, i * L + L, j * L + L);
      g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(90,60,30,.12)');
      c.fillStyle = g; c.beginPath(); c.roundRect(i * L + 5, j * L + 5, L - 10, L - 10, 10); c.fill();
      c.strokeStyle = 'rgba(120,90,60,.22)'; c.lineWidth = 1.5;
      if (r() < .35) { c.beginPath(); const x = i * L + 20 + r() * (L - 40), y = j * L + 20; c.moveTo(x, y); c.lineTo(x + 10, y + 25); c.lineTo(x + 2, y + 50); c.stroke(); }
    }
    ruido(c, w, h, 2500, ['rgba(90,60,30,.06)', 'rgba(255,255,255,.06)'], 2);
  });
  const TX_VEREDA = textura(256, 256, (c, w, h) => {
    c.fillStyle = '#a9afba'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const t = .95 + r() * .06;
      c.fillStyle = 'rgb(' + Math.round(214 * t) + ',' + Math.round(219 * t) + ',' + Math.round(226 * t) + ')';
      c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    }
    ruido(c, w, h, 1500, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.08)'], 2);
  });
  const TX_ASFALTO = textura(256, 256, (c, w, h) => {
    c.fillStyle = '#4c5262'; c.fillRect(0, 0, w, h);
    ruido(c, w, h, 5000, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.07)', 'rgba(120,130,150,.1)'], 2);
  });
  const TX_CEMENTO = textura(256, 256, (c, w, h) => {
    c.fillStyle = '#9ea4ae'; c.fillRect(0, 0, w, h);
    ruido(c, w, h, 3000, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.08)'], 3);
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
  });
  const TX_CINTA = textura(256, 32, (c, w, h) => {
    c.fillStyle = '#ffd23f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b1f2a'; for (let x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, h); c.lineTo(x + 32, 0); c.lineTo(x + 16, 0); c.fill(); }
  });

  // ======================= piezas =======================
  function malla(geo, material, x = 0, y = 0, z = 0, sombra = true) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true;
    return m;
  }
  const caja = (w, h, d, material, x, y, z, radio = .04) => malla(new RoundedBoxGeometry(w, h, d, 2, Math.min(radio, w / 2, h / 2, d / 2) * .999), material, x, y, z);
  const losa = (x, z, w, d, material, y = .005) => { const m = malla(new THREE.PlaneGeometry(w, d), material, x + w / 2, y, z + d / 2, false); m.rotation.x = -Math.PI / 2; return m; };
  function cartel(texto, colorTexto) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '700 46px "Space Grotesk", system-ui, sans-serif';
    const w = Math.ceil(g.measureText(texto).width + 50);
    c.width = w; c.height = 76;
    g.fillStyle = '#1b1f2a'; g.beginPath(); g.roundRect(0, 0, w, 76, 20); g.fill();
    g.strokeStyle = colorTexto; g.lineWidth = 4; g.beginPath(); g.roundRect(5, 5, w - 10, 66, 16); g.stroke();
    g.font = '700 46px "Space Grotesk", system-ui, sans-serif';
    g.fillStyle = colorTexto; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, w / 2, 40);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const alto = .3, ancho = alto * w / 76;
    return malla(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: t, roughness: .6, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .25 }), 0, 0, 0, false);
  }

  // ======================= el suelo =======================
  const W = M.W, H = M.H;
  const pastoMat = new THREE.MeshStandardMaterial({ map: TX_PASTO, roughness: 1 });
  TX_PASTO.repeat.set((W + 60) / 3, (H + 60) / 3);
  const pasto = malla(new THREE.PlaneGeometry(W + 60, H + 60), pastoMat, W / 2, 0, H / 2, false);
  pasto.rotation.x = -Math.PI / 2; escena.add(pasto);

  // calles y veredas (las veredas se cortan donde cruza la calle)
  M.CALLES.forEach(([x, y, w, h]) => {
    const t = TX_ASFALTO.clone(); t.needsUpdate = true; t.repeat.set(w / 2, h / 2);
    escena.add(losa(x - (w === W ? 30 : 0), y - (h === H ? 30 : 0), w + (w === W ? 60 : 0), h + (h === H ? 60 : 0),
      new THREE.MeshStandardMaterial({ map: t, roughness: .95 }), .01));
  });
  const TROZOS_VEREDA = [[-30, 10, 47, 1], [19, 10, 47, 1], [-30, 13, 47, 1], [19, 13, 47, 1], [16, -30, 1, 40], [16, 14, 1, 42], [19, -30, 1, 40], [19, 14, 1, 42]];
  TROZOS_VEREDA.forEach(([x, z, w, d]) => {
    const t = TX_VEREDA.clone(); t.needsUpdate = true; t.repeat.set(w, d);
    const m = caja(w, .1, d, new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), x + w / 2, .05, z + d / 2, .02);
    m.castShadow = false; escena.add(m);
  });
  // líneas amarillas, sendas peatonales
  const lineaMat = mat('#ffd23f', { roughness: .6 }), blanco = mat('#f4f5f7', { roughness: .6 });
  for (let x = -30; x < W + 30; x += 1.4) if (x < 16.4 || x > 19.4) escena.add(losa(x, 11.97, .7, .07, lineaMat, .02));
  for (let z = -30; z < H + 30; z += 1.4) if (z < 10.4 || z > 13.4) escena.add(losa(17.97, z, .07, .7, lineaMat, .02));
  for (let i = 0; i < 5; i++) {
    escena.add(losa(15.1, 11.1 + i * .38, .55, .2, blanco, .02)); escena.add(losa(20.35, 11.1 + i * .38, .55, .2, blanco, .02));
    escena.add(losa(17.1 + i * .38, 9.45, .2, .55, blanco, .02)); escena.add(losa(17.1 + i * .38, 14.1, .2, .55, blanco, .02));
  }
  // la plaza: baldosas de piedra, un poco más alta que el pasto
  {
    const [x, y, w, h] = M.PLAZA, t = TX_PLAZA.clone(); t.needsUpdate = true; t.repeat.set((w - .3) / 2.4, (h - .3) / 2.4);
    const m = caja(w - .3, .08, h - .3, new THREE.MeshStandardMaterial({ map: t, roughness: .85 }), x + w / 2, .04, y + h / 2, .05);
    m.castShadow = false; escena.add(m);
    // canteros con flores
    [[3.4, 16.9, 1.2, .9], [12.2, 16.9, 1.2, .9], [3.4, 19.9, 1.2, .9], [12.2, 19.9, 1.2, .9]].forEach(([cx, cz, cw, cd]) => {
      escena.add(caja(cw, .22, cd, mat('#c9b08a'), cx + cw / 2, .11, cz + cd / 2, .05));
      escena.add(caja(cw - .14, .06, cd - .14, mat('#5a3f2a'), cx + cw / 2, .22, cz + cd / 2, .02));
      for (let i = 0; i < 10; i++) {
        const fx = cx + .15 + r() * (cw - .3), fz = cz + .15 + r() * (cd - .3);
        escena.add(malla(new THREE.SphereGeometry(.08, 10, 8), mat('#3f8f3f'), fx, .3, fz));
        escena.add(malla(new THREE.SphereGeometry(.05, 10, 8), mat(['#ff6fa8', '#ffd23f', '#ffffff', '#ff8a3d'][i % 4], { roughness: .5 }), fx, .38, fz));
      }
    });
  }
  // el callejón de la guarida
  escena.add(losa(2.1, 2, 2.85, 7, new THREE.MeshStandardMaterial({ map: TX_CEMENTO, roughness: .95 }), .012));
  escena.add(losa(3.2, 6.9, .8, .4, mat('#5f8fbf', { roughness: .1, metalness: .1, transparent: true, opacity: .55 }), .02));
  // patio adelante de cada edificio
  M.EDIFICIOS.forEach(b => { const m = caja(b.w + .4, .05, .7, mat('#ddd3c2'), b.x + b.w / 2, .025, b.y + b.h + .25, .02); m.castShadow = false; escena.add(m); });

  // ======================= edificios =======================
  const mezclar = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  const vidrios = [];                                         // de noche se prenden
  const sirenas = [], camaritas = [];
  M.EDIFICIOS.forEach(b => {
    const g = new THREE.Group(), x0 = b.x, z0 = b.y, w = b.w, d = b.h;
    const alto = d >= 5 ? 1.75 : 1.5, frente = z0 + d;
    const pared = mat(b.pared), base = mat(mezclar(b.pared, '#6b5a48', .35).getStyle());
    g.add(caja(w, alto, d - .15, pared, x0 + w / 2, alto / 2, z0 + .075 + (d - .15) / 2, .06));
    g.add(caja(w + .04, .2, d - .11, base, x0 + w / 2, .1, z0 + .075 + (d - .15) / 2, .03));
    // techo a dos aguas, con alero
    const rh = Math.min(1.1, d * .26), D = d + .3;
    const forma = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rh)]);
    const geo = new THREE.ExtrudeGeometry(forma, { depth: w + .3, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 });
    geo.rotateY(Math.PI / 2);
    const techo = malla(geo, mat(b.techo, { roughness: .7 }), x0 - .15, alto, z0 + d / 2);
    g.add(techo);
    // tejas: franjas un poco más oscuras sobre la caída de adelante
    const pend = Math.atan2(rh, D / 2);
    for (let i = 1; i < 5; i++) {
      const f = i / 5, tz = z0 + d / 2 + D / 2 * f, ty = alto + rh * (1 - f);
      const teja = malla(new THREE.BoxGeometry(w + .32, .025, .05), mat(mezclar(b.techo, '#000000', .25).getStyle()), x0 + w / 2, ty + .03, tz, false);
      teja.rotation.x = pend; g.add(teja);
    }
    g.add(caja(w + .36, .09, .14, mat(mezclar(b.techo, '#ffffff', .25).getStyle()), x0 + w / 2, alto + rh + .02, z0 + d / 2, .03));
    // ventanas, puerta y cartel en el frente
    const vidrio = new THREE.MeshStandardMaterial({ color: '#9fd6f5', roughness: .15, metalness: .2, emissive: '#ffcf6a', emissiveIntensity: 0 });
    vidrios.push(vidrio);
    const n = Math.max(2, Math.round(w)), px = x0 + w / 2;
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + .5) * w / n;
      if (Math.abs(cx - px) < .55) continue;
      g.add(caja(.62, .52, .05, mat('#ffffff'), cx, alto * .56, frente + .01, .03));
      g.add(caja(.5, .4, .06, vidrio, cx, alto * .56, frente + .02, .02));
      g.add(caja(.6, .06, .14, mat('#ffffff'), cx, alto * .56 - .27, frente + .06, .02));
    }
    g.add(caja(.52, .92, .08, mat(mezclar(b.techo, '#1a1a22', .35).getStyle()), px, .46, frente + .02, .04));
    g.add(malla(new THREE.SphereGeometry(.035, 10, 8), mat('#ffd23f', { metalness: .6, roughness: .3 }), px + .15, .45, frente + .08));
    g.add(caja(.7, .06, .3, base, px, .03, frente + .14, .02));
    if (b.cartel) {
      const c = cartel(b.cartel, b.acento);
      c.position.set(px, alto - .24, frente + .07); g.add(c);
    }
    if (b.toldo) {                                           // toldo a rayas
      const t = textura(256, 64, (c, tw, th) => { for (let i = 0; i < 8; i++) { c.fillStyle = b.toldo[i % 2]; c.fillRect(i * tw / 8, 0, tw / 8, th); } }, [Math.max(1, w / 1.6), 1]);
      const toldo = malla(new THREE.PlaneGeometry(w * .92, .36), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: .7 }), px, alto * .68, frente + .2);
      toldo.rotation.x = -.95; g.add(toldo);
    }
    if (b.chimenea) g.add(caja(.32, .7, .32, mat('#9a6b52'), x0 + w - .6, alto + rh * .55, z0 + d / 2 - .4, .04));
    if (b.sirena) {
      const s = malla(new THREE.CylinderGeometry(.12, .14, .16, 16), new THREE.MeshStandardMaterial({ color: '#ff4d6d', emissive: '#ff4d6d', emissiveIntensity: 1.2 }), px, alto + rh + .14, z0 + d / 2);
      sirenas.push(s); g.add(s);
    }
    if (b.reloj) {
      g.add(caja(.8, .7, .5, pared, px, alto + rh + .25, z0 + d / 2 + .1, .05));
      g.add(caja(.9, .1, .6, mat(b.techo), px, alto + rh + .62, z0 + d / 2 + .1, .03));
      const t = textura(128, 128, c => {
        c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill();
        c.strokeStyle = '#2a2f3a'; c.lineWidth = 8; c.stroke();
        c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 26); c.moveTo(64, 64); c.lineTo(92, 74); c.stroke();
      });
      g.add(malla(new THREE.CircleGeometry(.26, 32), new THREE.MeshStandardMaterial({ map: t, roughness: .5 }), px, alto + rh + .27, z0 + d / 2 + .36, false));
    }
    if (b.camara) {
      g.add(malla(new THREE.CylinderGeometry(.03, .03, .7, 8), mat('#2a2f3a'), x0 + w - .2, alto + .3, frente - .2));
      g.add(caja(.32, .16, .2, mat('#e7ebf1'), x0 + w - .3, alto + .66, frente - .1, .04));
      const luz = malla(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshStandardMaterial({ color: '#ff4d6d', emissive: '#ff4d6d', emissiveIntensity: 2 }), x0 + w - .44, alto + .66, frente + .01);
      camaritas.push(luz); g.add(luz);
    }
    escena.add(g);
  });

  // ======================= árboles, faroles, bancos, autos =======================
  {
    const vivos = M.ARBOLES.filter(a => !a.borrar);
    const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .11, .7, 8), mat('#7a5236'), vivos.length);
    const copa = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ roughness: .9 }), vivos.length * 4);
    tronco.castShadow = copa.castShadow = true; tronco.receiveShadow = copa.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const VERDES = [['#2f7f45', '#3f9a55', '#5bb66a'], ['#2b7540', '#37904f', '#56b064'], ['#3b8a3d', '#4aa04a', '#79c765']];
    vivos.forEach((a, i) => {
      const x = a.x / T, z = a.y / T, k = a.k;
      m4.compose(p.set(x, .35 * k, z), q.identity(), s.set(k, k, k)); tronco.setMatrixAt(i, m4);
      const v = VERDES[Math.floor(a.tono * 3) % 3];
      [[-.24, .92, .05, .42, 0], [.24, .95, -.04, .42, 0], [0, 1.18, 0, .5, 1], [-.1, 1.42, .06, .3, 2]].forEach(([dx, dy, dz, rr, c], j) => {
        q.setFromEuler(new THREE.Euler(a.tono * 3, a.tono * 5 + j, 0));
        m4.compose(p.set(x + dx * k, dy * k, z + dz * k), q, s.set(rr * k, rr * k * .92, rr * k));
        copa.setMatrixAt(i * 4 + j, m4); copa.setColorAt(i * 4 + j, col.set(v[c]));
      });
    });
    escena.add(tronco, copa);
  }
  const farolCabeza = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffcf7a', emissiveIntensity: .15, roughness: .4 });
  {
    const n = M.FAROLES.length;
    const hierro = mat('#2e4a3c', { metalness: .35, roughness: .45 });
    const base = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .12, .2, 12), hierro, n);
    const poste = new THREE.InstancedMesh(new THREE.CylinderGeometry(.045, .06, 1.45, 10), hierro, n);
    const foco = new THREE.InstancedMesh(new THREE.CylinderGeometry(.11, .08, .24, 8), farolCabeza, n);
    const gorro = new THREE.InstancedMesh(new THREE.ConeGeometry(.17, .14, 8), hierro, n);
    base.castShadow = poste.castShadow = gorro.castShadow = true;
    const m4 = new THREE.Matrix4();
    M.FAROLES.forEach((f, i) => {
      const x = f.x / T, z = f.y / T;
      base.setMatrixAt(i, m4.makeTranslation(x, .2, z)); poste.setMatrixAt(i, m4.makeTranslation(x, .9, z));
      foco.setMatrixAt(i, m4.makeTranslation(x, 1.72, z)); gorro.setMatrixAt(i, m4.makeTranslation(x, 1.9, z));
    });
    escena.add(base, poste, foco, gorro);
  }
  M.BANCOS.forEach(([x, z, w, d]) => {
    const g = new THREE.Group(), madera = mat('#a86e48'), oscura = mat('#8a5a3b'), hierro = mat('#2f3542', { metalness: .4 });
    for (let i = 0; i < 3; i++) g.add(caja(w, .05, .12, madera, x + w / 2, .32, z + .18 + i * .14, .02));
    for (let i = 0; i < 2; i++) g.add(caja(w, .1, .05, oscura, x + w / 2, .45 + i * .14, z + .05, .02));
    [x + .15, x + w - .15].forEach(lx => { g.add(caja(.06, .32, .44, hierro, lx, .16, z + .3, .02)); g.add(caja(.06, .36, .06, hierro, lx, .48, z + .05, .02)); });
    escena.add(g);
  });
  M.AUTOS.forEach(a => {
    const g = new THREE.Group(), w = a.w / T, d = a.h / T, cx = a.x / T + w / 2, cz = a.y / T + d / 2;
    const largo = a.vertical ? d : w, ancho = a.vertical ? w : d;
    g.add(caja(largo, .34, ancho, mat(a.color, { roughness: .35, metalness: .15 }), 0, .32, 0, .14));
    g.add(caja(largo * .55, .3, ancho * .86, mat('#2a3a52', { roughness: .1, metalness: .3 }), -largo * .05, .6, 0, .12));
    g.add(caja(largo * .5, .05, ancho * .8, mat(a.color, { roughness: .35 }), -largo * .05, .76, 0, .03));
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
      const rueda = malla(new THREE.CylinderGeometry(.15, .15, .1, 18), mat('#1b1f2a'), sx * largo * .32, .15, sz * ancho * .48);
      rueda.rotation.x = Math.PI / 2; g.add(rueda);
    });
    [-1, 1].forEach(sz => g.add(malla(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff7d0', emissive: '#fff1b8', emissiveIntensity: .6 }), largo / 2, .36, sz * ancho * .3)));
    g.position.set(cx, 0, cz);
    if (a.vertical) g.rotation.y = Math.PI / 2;
    escena.add(g);
  });

  // ======================= la fuente =======================
  const agua = new THREE.MeshStandardMaterial({ color: '#4fb4e6', roughness: .08, metalness: .1, transparent: true, opacity: .85, emissive: '#1a5f8a', emissiveIntensity: .25 });
  const ondas = [];
  {
    const fx = M.FUENTE.x / T, fz = M.FUENTE.y / T, fr = M.FUENTE.r / T, piedra = mat('#d6cbb6', { roughness: .9 });
    escena.add(malla(new THREE.CylinderGeometry(fr, fr + .06, .42, 40), piedra, fx, .21, fz));
    escena.add(malla(new THREE.CylinderGeometry(fr - .14, fr - .14, .1, 40), agua, fx, .36, fz, false));
    const borde = malla(new THREE.TorusGeometry(fr - .06, .08, 10, 40), piedra, fx, .43, fz); borde.rotation.x = Math.PI / 2; escena.add(borde);
    escena.add(malla(new THREE.CylinderGeometry(.16, .22, .8, 20), piedra, fx, .7, fz));
    escena.add(malla(new THREE.CylinderGeometry(.5, .28, .16, 28), piedra, fx, 1.1, fz));
    escena.add(malla(new THREE.CylinderGeometry(.42, .42, .04, 28), agua, fx, 1.17, fz, false));
    const chorro = malla(new THREE.SphereGeometry(.09, 12, 10), agua, fx, 1.32, fz, false); chorro.name = 'chorro'; escena.add(chorro);
    for (let i = 0; i < 3; i++) {
      const o = malla(new THREE.TorusGeometry(1, .015, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5 }), fx, .42, fz, false);
      o.rotation.x = Math.PI / 2; ondas.push(o); escena.add(o);
    }
  }

  // ======================= la guarida =======================
  {
    const c = M.CONTENEDOR, x = c.x / T, z = c.y / T, w = c.w / T, d = c.h / T;
    escena.add(caja(w, .9, d, mat('#2f7a4a', { roughness: .6, metalness: .2 }), x + w / 2, .45, z + d / 2, .06));
    const tapa = caja(w + .08, .1, d + .08, mat('#3e9a5e', { roughness: .6, metalness: .2 }), x + w / 2, .95, z + d / 2, .04);
    tapa.rotation.x = -.08; escena.add(tapa);
    for (let i = 0; i < 2; i++) escena.add(malla(new THREE.SphereGeometry(.26 - i * .06, 14, 10), mat('#23272f', { roughness: .4 }), x + w + .25 + i * .32, .22 - i * .04, z + d - .1 + i * .1));
    const caja2 = caja(.5, .06, .5, mat('#e9c27a'), x - .3, .05, z + d - .1, .02); caja2.rotation.y = .3; escena.add(caja2);
  }
  const cinta = new THREE.Group();
  {
    const c = M.CINTA, x = c.x / T, z = c.y / T, w = c.w / T;
    [x + .1, x + w - .1].forEach(px => cinta.add(malla(new THREE.CylinderGeometry(.04, .05, .7, 8), mat('#2f3542'), px, .35, z + .1)));
    const t = TX_CINTA.clone(); t.needsUpdate = true; t.repeat.set(w * 2, 1);
    cinta.add(malla(new THREE.PlaneGeometry(w - .2, .14), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: .6 }), x + w / 2, .55, z + .1));
    escena.add(cinta);
  }

  // ======================= huellas =======================
  const huellas = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), new THREE.MeshStandardMaterial({ color: '#3a3240', transparent: true, opacity: .55, roughness: 1 }), M.HUELLAS.length * 5);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const plano = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    M.HUELLAS.forEach((h, i) => {
      const x = h.x / T, z = h.y / T, ang = h.ang + Math.PI / 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const dedo = (dx, dy, rr, j) => {
        const wx = x + (dx * ca - dy * sa) / T, wz = z + (dx * sa + dy * ca) / T;
        q.copy(plano); m4.compose(p.set(wx, .09, wz), q, s.set(rr / T, rr / T, 1)); huellas.setMatrixAt(i * 5 + j, m4);
      };
      dedo(0, 2, 5.5, 0); [[-5, -6], [-2, -9], [2, -9], [5, -6]].forEach(([dx, dy], j) => dedo(dx, dy, 2.2, j + 1));
    });
  }
  huellas.count = 0; escena.add(huellas);

  // ======================= la gente =======================
  const PIEL_OSC = c => mezclar(c, '#000000', .25).getStyle();
  function persona(lk) {
    const g = new THREE.Group(), cuerpo = new THREE.Group();
    g.add(cuerpo);
    const piel = mat(lk.piel, { roughness: .6 }), ropa = mat(lk.ropa, { roughness: .75 }), pantalon = mat(lk.pantalon, { roughness: .8 });
    const zapato = mat('#2a2420', { roughness: .5 });
    // piernas (con su articulación en la cadera) y zapatos grandes
    const pierna = lado => {
      const p = new THREE.Group(); p.position.set(lado * .075, .46, 0);
      p.add(malla(new THREE.CapsuleGeometry(.05, .3, 4, 10), pantalon, 0, -.2, 0));
      p.add(caja(.12, .09, .22, zapato, 0, -.43, .04, .04));
      cuerpo.add(p); return p;
    };
    const pi = pierna(-1), pd = pierna(1);
    // tronco
    if (lk.pollera) cuerpo.add(malla(new THREE.CylinderGeometry(.13, .22, .4, 18), ropa, 0, .52, 0));
    const torso = malla(new THREE.CapsuleGeometry(.13, .2, 6, 14), ropa, 0, .7, 0);
    torso.scale.set(1.12, 1, .82); cuerpo.add(torso);
    if (lk.sombrero === 'fedora') {                            // el piloto del detective
      cuerpo.add(malla(new THREE.CylinderGeometry(.15, .21, .34, 18), ropa, 0, .48, 0));
      const cinto = malla(new THREE.TorusGeometry(.145, .02, 8, 20), mat('#5b4128'), 0, .64, 0); cinto.rotation.x = Math.PI / 2; cuerpo.add(cinto);
      [-1, 1].forEach(l => { const solapa = caja(.07, .2, .02, mat(PIEL_OSC(lk.ropa)), l * .05, .82, .11, .01); solapa.rotation.z = l * .3; cuerpo.add(solapa); });
    }
    if (lk.delantal) cuerpo.add(caja(.22, .3, .03, mat(lk.delantal), 0, .62, .12, .02));
    if (lk.rayas) for (let i = 0; i < 3; i++) { const a = malla(new THREE.TorusGeometry(.143, .018, 6, 22), mat('#3a3f4b'), 0, .6 + i * .1, 0); a.rotation.x = Math.PI / 2; a.scale.set(1.12, .82, 1); cuerpo.add(a); }
    // brazos con manos
    const brazo = lado => {
      const b = new THREE.Group(); b.position.set(lado * .18, .85, 0); b.rotation.z = lado * .12;
      b.add(malla(new THREE.CapsuleGeometry(.042, .26, 4, 10), ropa, 0, -.16, 0));
      b.add(malla(new THREE.SphereGeometry(.055, 12, 10), piel, 0, -.34, 0));
      cuerpo.add(b); return b;
    };
    const bi = brazo(-1), bd = brazo(1);
    if (lk.bolsa) bd.add(malla(new THREE.SphereGeometry(.12, 14, 10), mat('#b48a5a'), .02, -.45, .02));
    // cabeza
    const cabeza = new THREE.Group(); cabeza.position.set(0, 1.03, 0); cuerpo.add(cabeza);
    cuerpo.add(malla(new THREE.CylinderGeometry(.045, .05, .08, 10), piel, 0, .9, 0));
    const craneo = malla(new THREE.SphereGeometry(.17, 24, 18), piel); craneo.scale.set(1, 1.07, .98); cabeza.add(craneo);
    [-1, 1].forEach(l => cabeza.add(malla(new THREE.SphereGeometry(.04, 10, 8), piel, l * .165, -.01, 0)));
    cabeza.add(malla(new THREE.SphereGeometry(.035, 10, 8), mat(PIEL_OSC(lk.piel), { roughness: .6 }), 0, -.02, .17));
    // ojos grandes con brillo, cejas
    const ojos = [];
    [-1, 1].forEach(l => {
      const blanco = malla(new THREE.SphereGeometry(.042, 14, 10), mat('#ffffff', { roughness: .3 }), l * .065, .03, .14, false);
      blanco.scale.set(1, 1.15, .6); cabeza.add(blanco);
      const pupila = malla(new THREE.SphereGeometry(.024, 12, 8), mat('#1d2230', { roughness: .2 }), l * .065, .028, .165, false);
      cabeza.add(pupila); ojos.push(blanco, pupila);
      const ceja = caja(.06, .014, .02, mat(lk.pelo || '#3b2a1e'), l * .066, .1, .155, .006); ceja.rotation.z = -l * .12; cabeza.add(ceja);
    });
    const boca = malla(new THREE.TorusGeometry(.035, .008, 6, 12, Math.PI), mat('#7a3b2e'), 0, -.075, .155, false);
    boca.rotation.z = Math.PI; cabeza.add(boca);
    if (lk.bigote) [-1, 1].forEach(l => { const b = malla(new THREE.SphereGeometry(.04, 10, 8), mat(lk.bigote), l * .035, -.05, .16, false); b.scale.set(1.3, .5, .6); b.rotation.z = l * .3; cabeza.add(b); });
    if (lk.lentes) [-1, 1].forEach(l => cabeza.add(malla(new THREE.TorusGeometry(.048, .008, 6, 16), mat('#2a2f3a', { metalness: .5 }), l * .065, .03, .175, false)));
    if (lk.antifaz) { const a = caja(.3, .075, .06, mat('#1a1a22'), 0, .035, .15, .03); cabeza.add(a); }
    // pelo
    if (lk.pelo && lk.sombrero !== 'capucha') {
      const pelo = mat(lk.pelo, { roughness: .9 });
      if (lk.sombrero === 'pelado') [-1, 1].forEach(l => { const m = malla(new THREE.SphereGeometry(.06, 10, 8), pelo, l * .15, .02, -.04); m.scale.set(.7, 1, 1.3); cabeza.add(m); });
      else {
        const casco = malla(new THREE.SphereGeometry(.182, 24, 14, 0, Math.PI * 2, 0, 1.45), pelo, 0, .02, -.01);
        casco.rotation.x = -.5; cabeza.add(casco);
      }
      if (lk.trenza) for (let i = 0; i < 3; i++) cabeza.add(malla(new THREE.SphereGeometry(.055 - i * .008, 10, 8), pelo, 0, -.06 - i * .08, -.17));
      if (lk.sombrero === 'rodete') cabeza.add(malla(new THREE.SphereGeometry(.08, 12, 10), pelo, 0, .2, -.06));
    }
    // sombreros
    const sc = lk.sombreroColor && mat(lk.sombreroColor, { roughness: .7 });
    if (lk.sombrero === 'fedora') {
      cabeza.add(malla(new THREE.CylinderGeometry(.29, .29, .025, 28), sc, 0, .13, 0));
      cabeza.add(malla(new THREE.CylinderGeometry(.15, .17, .17, 20), sc, 0, .23, 0));
      cabeza.add(malla(new THREE.CylinderGeometry(.172, .172, .04, 20), mat('#2a1d14'), 0, .17, 0));
    } else if (lk.sombrero === 'chef') {
      const b = mat('#ffffff', { roughness: .8 });
      cabeza.add(malla(new THREE.CylinderGeometry(.15, .15, .14, 20), b, 0, .18, 0));
      [[-.08, .3, 0], [.08, .3, 0], [0, .33, .06], [0, .33, -.06], [0, .38, 0]].forEach(([x, y, z]) => cabeza.add(malla(new THREE.SphereGeometry(.1, 14, 10), b, x, y, z)));
    } else if (lk.sombrero === 'gorra' || lk.sombrero === 'policia') {
      const domo = malla(new THREE.SphereGeometry(.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), sc, 0, .06, 0); cabeza.add(domo);
      if (lk.sombrero === 'policia') {
        cabeza.add(malla(new THREE.CylinderGeometry(.19, .18, .1, 22), sc, 0, .14, 0));
        cabeza.add(malla(new THREE.SphereGeometry(.035, 10, 8), mat('#ffd23f', { metalness: .6, roughness: .3 }), 0, .14, .185));
      }
      const visera = caja(.24, .025, .16, sc, 0, .06, .2, .012); visera.rotation.x = .2; cabeza.add(visera);
    } else if (lk.sombrero === 'galera') {
      cabeza.add(malla(new THREE.CylinderGeometry(.26, .26, .025, 28), sc, 0, .14, 0));
      cabeza.add(malla(new THREE.CylinderGeometry(.14, .14, .3, 22), sc, 0, .3, 0));
      cabeza.add(malla(new THREE.CylinderGeometry(.143, .143, .05, 22), mat('#ff4d8d'), 0, .19, 0));
      const pluma = malla(new THREE.SphereGeometry(.05, 10, 8), mat('#ffd23f'), .1, .4, 0); pluma.scale.set(.6, 2.4, .6); pluma.rotation.z = -.4; cabeza.add(pluma);
    } else if (lk.sombrero === 'capucha') {
      const capucha = malla(new THREE.SphereGeometry(.21, 22, 16), sc, 0, .02, -.04); capucha.scale.set(1, 1.05, 1); cabeza.add(capucha);
      craneo.position.z = .03; ojos.forEach(o => { o.position.z += .03; });
    }
    if (lk.chico) g.scale.setScalar(.78);
    return { g, cuerpo, pi, pd, bi, bd, cabeza };
  }
  // anima caminar o estar parado
  function animar(p, fase, anda, t, mira) {
    const a = anda ? Math.sin(fase) : 0;
    p.pi.rotation.x = a * .6; p.pd.rotation.x = -a * .6;
    p.bi.rotation.x = -a * .5; p.bd.rotation.x = a * .5;
    p.cuerpo.position.y = anda ? Math.abs(Math.cos(fase)) * .035 : Math.sin(t * 1.8 + mira) * .006;
    p.cabeza.rotation.y = anda ? 0 : Math.sin(t * .6 + mira * 3) * .12;
  }
  const ANG = [0, -Math.PI / 2, Math.PI / 2, Math.PI];       // abajo, izquierda, derecha, arriba
  function girar(g, dir, dt) {
    const meta = ANG[dir] || 0;
    let d = meta - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 12);
  }

  // El Mordisco: una sombra con orejas, antifaz y ojos que brillan; y el mapache (con su familia)
  function sombraMordisco() {
    const g = new THREE.Group(), negro = mat('#0b0c12', { roughness: .4 });
    const cuerpo = malla(new THREE.CapsuleGeometry(.26, .38, 6, 16), negro, 0, .5, 0); cuerpo.scale.set(1, 1, .85); g.add(cuerpo);
    g.add(malla(new THREE.SphereGeometry(.26, 20, 16), negro, 0, 1.0, 0));
    [-1, 1].forEach(l => { const o = malla(new THREE.ConeGeometry(.08, .2, 12), negro, l * .15, 1.22, 0); o.rotation.z = -l * .3; g.add(o); });
    g.add(caja(.42, .1, .1, mat('#262a36'), 0, 1.02, .2, .04));
    const brillo = new THREE.MeshStandardMaterial({ color: '#ffc53d', emissive: '#ffc53d', emissiveIntensity: 3 });
    [-1, 1].forEach(l => { const o = malla(new THREE.SphereGeometry(.045, 12, 8), brillo, l * .09, 1.02, .24, false); o.scale.set(1.3, .7, .5); g.add(o); });
    const cola = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.15, .4, -.15), new THREE.Vector3(.5, .45, -.3), new THREE.Vector3(.6, .9, -.25)]), 20, .07, 8), negro);
    cola.castShadow = true; g.add(cola);
    const luz = new THREE.PointLight('#ffc53d', 1.2, 2.5, 2); luz.position.set(0, 1.05, .5); g.add(luz);
    return g;
  }
  function mapache(k = 1) {
    const g = new THREE.Group(), gris = mat('#8d8f99', { roughness: .85 }), claro = mat('#c4c6ce', { roughness: .85 }), oscuro = mat('#24262d', { roughness: .7 });
    const cuerpo = malla(new THREE.CapsuleGeometry(.2, .2, 6, 14), gris, 0, .36, 0); cuerpo.scale.set(1.1, 1, .9); g.add(cuerpo);
    g.add(malla(new THREE.SphereGeometry(.13, 14, 10), claro, 0, .36, .13));
    const cab = malla(new THREE.SphereGeometry(.2, 20, 16), claro, 0, .74, 0); cab.scale.set(1.15, .95, 1); g.add(cab);
    const hocico = malla(new THREE.SphereGeometry(.09, 12, 10), mat('#f1f1f4'), 0, .69, .17); hocico.scale.set(1, .8, 1.1); g.add(hocico);
    g.add(malla(new THREE.SphereGeometry(.035, 10, 8), oscuro, 0, .71, .27));
    g.add(caja(.4, .1, .1, oscuro, 0, .77, .15, .045));
    [-1, 1].forEach(l => {
      g.add(malla(new THREE.SphereGeometry(.03, 10, 8), mat('#ffffff', { roughness: .2 }), l * .08, .78, .2, false));
      g.add(malla(new THREE.SphereGeometry(.016, 8, 6), oscuro, l * .08, .78, .225, false));
      const oreja = malla(new THREE.ConeGeometry(.07, .14, 12), gris, l * .15, .93, -.02); oreja.rotation.z = -l * .35; g.add(oreja);
      g.add(malla(new THREE.CapsuleGeometry(.045, .12, 4, 8), gris, l * .1, .1, .05));
    });
    for (let i = 0; i < 6; i++) {
      const t = i / 5, seg = malla(new THREE.SphereGeometry(.09 - t * .02, 12, 10), i % 2 ? oscuro : gris, .12 + t * .25, .25 + t * .45, -.22 - Math.sin(t * 2) * .1);
      g.add(seg);
    }
    g.scale.setScalar(k);
    return g;
  }

  const gente = new Map();
  M.NPCS.forEach(n => { const p = persona(M.LOOK[n.look]); escena.add(p.g); gente.set(n.id, p); });
  const detective = persona(M.LOOK.detective); escena.add(detective.g);
  const mordisco = sombraMordisco(); escena.add(mordisco);
  const familia = [mapache(1), mapache(.6), mapache(.55)]; familia.forEach(m => escena.add(m));

  // ======================= carteles HTML arriba de la gente =======================
  const capa = M.etiquetas;
  capa.innerHTML = '';
  const etiqueta = clase => { const e = document.createElement('div'); e.className = clase; e.hidden = true; capa.appendChild(e); return e; };
  const globos = new Map();
  const globoDe = id => { if (!globos.has(id)) globos.set(id, etiqueta('b3-globo')); return globos.get(id); };
  const aviso = etiqueta('b3-aviso'), flecha = etiqueta('b3-flecha');
  flecha.innerHTML = '<i></i>';
  const v3 = new THREE.Vector3();
  const aPantalla = (x, y, z) => { v3.set(x, y, z).project(camara); return { x: (v3.x + 1) / 2 * ancho, y: (1 - v3.y) / 2 * alto, z: v3.z }; };

  // ======================= cámara y tamaño =======================
  let ancho = 1, alto = 1, mira = new THREE.Vector3(8.5, 0, 20), primera = true;
  function medir(w, h, dpr) {
    ancho = w; alto = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
  }
  const alturaPiso = (x, z) => {
    if (TROZOS_VEREDA.some(([vx, vz, w, d]) => x >= vx && x <= vx + w && z >= vz && z <= vz + d)) return .1;
    const [px, py, pw, ph] = M.PLAZA;
    return x > px + .15 && x < px + pw - .15 && z > py + .15 && z < py + ph - .15 ? .08 : 0;
  };

  // ======================= cada cuadro =======================
  let noche = 0, primeraLuz = true, antes = performance.now();
  const ray = new THREE.Raycaster(), piso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function render() {
    const ahora = performance.now(), dt = Math.min(.05, (ahora - antes) / 1000); antes = ahora;
    const E = M.estado(), t = E.reloj;
    const yo = M.yo, yx = yo.x / T, yz = yo.y / T;

    // la cámara sigue al detective desde arriba y adelante (más lejos en pantallas angostas)
    const lejos = camara.aspect < 1 ? 1.55 : camara.aspect < 1.3 ? 1.2 : 1;
    const meta = new THREE.Vector3(Math.max(4, Math.min(W - 4, yx)), 0, Math.max(3.5, Math.min(H - 4.2, yz - .2)));
    if (primera) { mira.copy(meta); primera = false; } else mira.lerp(meta, Math.min(1, dt * 5));
    camara.position.set(mira.x, 7.6 * lejos, mira.z + 7.4 * lejos);   // cerca, como en los juegos de gestión en 3D
    camara.lookAt(mira.x, .5, mira.z);
    sol.position.set(mira.x - 9, 18, mira.z + 7); sol.target.position.set(mira.x, 0, mira.z);

    // día y noche
    if (primeraLuz) { noche = E.noche ? 1 : 0; primeraLuz = false; }   // al entrar, ya de noche (o de día); después, de a poco
    noche += ((E.noche ? 1 : 0) - noche) * Math.min(1, dt * 1.5);
    escena.background.copy(CIELO_DIA).lerp(CIELO_NOCHE, noche);
    escena.fog.color.copy(escena.background);
    cielo.intensity = 1.5 - noche * 1.22; cielo.color.set('#fff4e0').lerp(new THREE.Color('#7f95d6'), noche);
    sol.intensity = 2.7 - noche * 2.35; sol.color.set('#ffeccc').lerp(new THREE.Color('#9fb4ff'), noche);
    relleno.intensity = .18 - noche * .15;
    renderer.toneMappingExposure = 1.08 - noche * .12;
    farolCabeza.emissiveIntensity = .15 + noche * 2.5;
    vidrios.forEach(v => { v.emissiveIntensity = noche * .7; });
    if (noche > .02) {
      const cerca = M.FAROLES.map(f => ({ f, d: (f.x / T - yx) ** 2 + (f.y / T - yz) ** 2 })).sort((a, b) => a.d - b.d);
      lucesFarol.forEach((l, i) => { const f = cerca[i].f; l.position.set(f.x / T, 1.65, f.y / T); l.intensity = noche * 3.4; });
    } else lucesFarol.forEach(l => { l.intensity = 0; });
    linterna.intensity = noche * 12;
    linterna.position.set(yx, 2.6, yz + .6);
    linterna.target.position.set(yx + [0, -1.4, 1.4, 0][yo.dir], 0, yz + [1.4, 0, 0, -1.4][yo.dir]);
    sirenas.forEach(s => { const on = Math.floor(t * 3) % 2; s.material.color.set(on ? '#ff4d6d' : '#3db8ff'); s.material.emissive.set(on ? '#ff4d6d' : '#3db8ff'); });
    camaritas.forEach(c => { c.visible = Math.floor(t * 2) % 2 === 0; });

    // la fuente
    ondas.forEach((o, i) => { const f = ((t * .35 + i / 3) % 1); o.scale.setScalar(.25 + f * .95); o.material.opacity = .5 * (1 - f); });
    const chorro = escena.getObjectByName('chorro'); if (chorro) chorro.position.y = 1.32 + Math.sin(t * 6) * .03;

    // lo que cambia con la historia
    cinta.visible = E.cinta;
    huellas.count = E.huellas * 5;
    const cosas = M.cosas();
    const mo = cosas.find(c => c.especial === 'mordisco'), ma = cosas.find(c => c.especial === 'mapache');
    mordisco.visible = !!mo;
    if (mo) { mordisco.position.set(mo.px / T, Math.abs(Math.sin(t * 3)) * .05, mo.py / T); mordisco.rotation.y = Math.sin(t * 1.3) * .3; }
    familia.forEach((m, i) => {
      m.visible = !!ma;
      if (ma) { m.position.set(ma.px / T + [0, .6, -.55][i], Math.abs(Math.sin(t * 4 + i)) * .04, ma.py / T + [0, .25, .3][i]); m.rotation.y = Math.sin(t + i) * .4; }
    });

    // la gente
    M.NPCS.forEach(n => {
      const p = gente.get(n.id), x = n.px / T, z = n.py / T;
      p.g.position.set(x, alturaPiso(x, z), z);
      girar(p.g, n.dir, dt);
      animar(p, 0, false, t, n.fase);
    });
    detective.g.position.set(yx, detective.g.position.y + (alturaPiso(yx, yz) - detective.g.position.y) * Math.min(1, dt * 12), yz);
    girar(detective.g, yo.dir, dt);
    animar(detective, yo.fase, yo.anda, t, 0);

    renderer.render(escena, camara);

    // carteles: "!" en quien tiene el caso que sigue, "✓" en los resueltos, y "hablar" en quien está cerca
    const vistos = new Set();
    const ponerGlobo = (id, x, y, z, txt, clase) => {
      const e = globoDe(id), s = aPantalla(x, y, z);
      if (s.z > 1) { e.hidden = true; return; }
      e.hidden = false; vistos.add(id);
      e.textContent = txt; e.className = 'b3-globo ' + clase;
      e.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
    };
    const alto0 = n => ['chef', 'galera'].includes((M.LOOK[n.look] || {}).sombrero) ? 1.85 : (M.LOOK[n.look] || {}).chico ? 1.3 : 1.62;
    if (!E.ocupado) {
      M.NPCS.forEach(n => {
        if (!n.caso || n === E.cerca) return;
        if (n.caso === E.objetivo) ponerGlobo(n.id, n.px / T, alto0(n), n.py / T, '!', 'oro');
        else if (E.resuelto(n.caso)) ponerGlobo(n.id, n.px / T, alto0(n), n.py / T, '✓', 'lima');
      });
      cosas.forEach(o => {
        if (o.caso !== E.objetivo || o === E.cerca) return;
        ponerGlobo(o.id, o.px / T, o.especial ? 1.75 : 1.5, o.py / T - (o.especial ? 0 : .4), '!', o.especial === 'mordisco' ? 'rojo' : 'oro');
      });
    }
    globos.forEach((e, id) => { if (!vistos.has(id)) e.hidden = true; });
    if (E.cerca && !E.ocupado) {
      const n = E.cerca, s = aPantalla(n.px / T, (n.look ? alto0(n) : 1.5) + .1, n.py / T);
      aviso.hidden = false; aviso.textContent = E.tactil ? 'Tocá para hablar' : 'Espacio: hablar';
      aviso.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
    } else aviso.hidden = true;
    // flecha en el borde si quien tiene el caso que sigue no se ve
    const dest = E.objetivo && (M.NPCS.find(n => n.caso === E.objetivo) || cosas.find(o => o.caso === E.objetivo));
    if (dest && !E.ocupado) {
      const s = aPantalla(dest.px / T, 1, dest.py / T);
      let sx = s.x, sy = s.y;
      if (s.z > 1) { sx = ancho - sx; sy = alto - sy; }
      const fuera = s.z > 1 || sx < 24 || sy < 24 || sx > ancho - 24 || sy > alto - 24;
      flecha.hidden = !fuera;
      if (fuera) {
        const cx = ancho / 2, cy = alto / 2, ang = Math.atan2(sy - cy, sx - cx), tx = Math.cos(ang), ty = Math.sin(ang), m = 34;
        const k = Math.min(Math.abs((ancho / 2 - m) / (tx || 1e-6)), Math.abs((alto / 2 - m) / (ty || 1e-6)));
        flecha.style.transform = 'translate(' + (cx + tx * k).toFixed(1) + 'px,' + (cy + ty * k).toFixed(1) + 'px) rotate(' + ang + 'rad)';
      }
    } else flecha.hidden = true;
  }

  // dónde cae en el piso un toque en la pantalla (en las unidades de barrio.js)
  function pisoEn(clientX, clientY) {
    const r2 = lienzo.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((clientX - r2.left) / r2.width * 2 - 1, -((clientY - r2.top) / r2.height) * 2 + 1), camara);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(piso, p)) return null;
    return { x: p.x * T, y: p.z * T };
  }

  // retrato para el cuadro de diálogo: la cara de quien habla, con un renderer chiquito aparte
  let rRet = null, escRet = null, camRet = null;
  function retrato(cv, id) {
    const q = M.quien(id);
    const c = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    cv.width = 64 * dpr; cv.height = 64 * dpr;
    c.clearRect(0, 0, cv.width, cv.height);
    if (!q.look && !q.especial) { c.font = (34 * dpr) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('📻', cv.width / 2, cv.height / 2 + 2 * dpr); return; }
    if (!rRet) {
      rRet = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      rRet.toneMapping = THREE.ACESFilmicToneMapping;
      escRet = new THREE.Scene();
      escRet.add(new THREE.HemisphereLight('#fff4e0', '#6f6a8a', 2.2));
      const l = new THREE.DirectionalLight('#ffffff', 2); l.position.set(-1, 2, 3); escRet.add(l);
      camRet = new THREE.PerspectiveCamera(26, 1, .1, 20);
    }
    rRet.setPixelRatio(dpr); rRet.setSize(64, 64, false);
    const figura = q.especial === 'mordisco' ? sombraMordisco() : q.especial === 'mapache' ? mapache(1.3) : persona(M.LOOK[q.look]).g;
    escRet.add(figura);
    const cy = q.especial ? 1.0 : (M.LOOK[q.look] || {}).chico ? .83 : 1.06;
    camRet.position.set(.35, cy + .12, 1.35); camRet.lookAt(0, cy + (q.especial ? 0 : .04), 0);
    rRet.render(escRet, camRet);
    c.drawImage(rRet.domElement, 0, 0, cv.width, cv.height);
    escRet.remove(figura);
  }

  return { medir, render, pisoEn, retrato };
}
