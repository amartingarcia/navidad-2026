/* NPGingo · fiesta: modo discoteca, Papá Noel borracho y pantalla de premio gordo. Solo presentación, sin datos. */
(function () {
  'use strict';

  var N = window.NPG;
  var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var discoAntes = null;

  /* ---------- modo discoteca ---------- */
  // Del 26 dic a las 18:00 hasta el 27 dic a las 08:00. Para ver cómo queda: añade ?disco a la dirección (?disco=0 lo apaga).
  function disco() {
    var q = /[?&]disco(?:=([^&]*))?/.exec(location.search);
    if (q) return q[1] !== '0';
    var ahora = Date.now();
    return ahora >= Date.parse(N.EVENTO.discoDesde) && ahora < Date.parse(N.EVENTO.discoHasta);
  }
  function el(tag, id, cls, html) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }
  function montarDisco() {
    if (document.getElementById('luces')) return;
    var luces = el('div', 'luces', '', '<i></i><i></i><i></i><i></i>');
    luces.setAttribute('aria-hidden', 'true');
    var bola = el('div', 'bola', '', '<span class="hilo"></span><span class="esfera"><span class="facetas"></span><span class="brillo"></span></span>');
    bola.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(luces, document.body.firstChild);
    document.body.appendChild(bola);
  }
  // Enciende o apaga el modo y devuelve si ha cambiado desde la última vez (para repintar la nevada).
  function aplicar() {
    var on = disco();
    montarDisco();
    document.body.classList.toggle('disco', on);
    var cambio = discoAntes !== null && discoAntes !== on;
    discoAntes = on;
    return cambio;
  }

  /* ---------- Papá Noel borracho ---------- */
  var FRASES = ['¡Sujétame el cubata!', '¿Y mi Jäger?', '¿Quieres sentirla en el pecho?', '¡hip!', '¡otra ronda!', '¡yo no he sido!', '¡feliz navidá!', '¡estoy fino!', 'jo, jo… ¡hip!', '¡esto no es sidra!'];
  var SANTA = '<svg viewBox="0 0 74 104" width="64" height="90" focusable="false">' +
    '<rect x="19" y="87" width="14" height="13" rx="4" fill="#2b1a14"/><rect x="40" y="87" width="14" height="13" rx="4" fill="#2b1a14"/>' +
    '<path d="M15 47 Q36 37 57 47 L61 90 Q36 96 11 90 Z" fill="#D4283C"/>' +
    '<rect x="11" y="85" width="50" height="8" rx="4" fill="#F4F7FB"/>' +
    '<rect x="13" y="65" width="46" height="7" fill="#13233B"/><rect x="31" y="63.5" width="10" height="10" rx="2" fill="#F4B93E"/>' +
    '<path d="M57 50 Q72 50 68 66" stroke="#D4283C" stroke-width="9" fill="none" stroke-linecap="round"/>' +
    '<circle cx="68" cy="67" r="4.6" fill="#f1c9a5"/>' +
    '<rect x="64" y="47" width="9" height="21" rx="2.5" fill="#1E6B4A"/><rect x="66.2" y="38" width="4.6" height="10" fill="#1E6B4A"/><rect x="66" y="35.5" width="5" height="3.6" rx="1" fill="#16543a"/><rect x="64.8" y="55" width="7.4" height="7" rx="1" fill="#F4B93E"/>' +
    '<circle cx="36" cy="30" r="14" fill="#f1c9a5"/>' +
    '<circle cx="27" cy="34" r="3.6" fill="#f08a8a" opacity=".85"/><circle cx="45" cy="34" r="3.6" fill="#f08a8a" opacity=".85"/>' +
    '<path d="M22 33 Q36 60 50 33 Q50 45 36 54 Q22 45 22 33Z" fill="#F4F7FB"/>' +
    '<circle cx="31" cy="39" r="4.4" fill="#F4F7FB"/><circle cx="41" cy="39" r="4.4" fill="#F4F7FB"/>' +
    '<ellipse cx="36" cy="46" rx="3.2" ry="2.3" fill="#7a1f2b"/>' +
    '<circle cx="36" cy="33" r="4.4" fill="#e0505a"/>' +
    '<path d="M26 27 q3 -3 6 0 M40 27 q3 -3 6 0" stroke="#13233B" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
    '<path d="M21 24 Q22 5 44 5 Q56 7 58 20 Q40 13 21 24 Z" fill="#D4283C"/>' +
    '<rect x="19" y="19.5" width="36" height="8" rx="4" fill="#F4F7FB"/><circle cx="58" cy="20" r="5.4" fill="#F4F7FB"/></svg>';
  // Mamá Noel va de fiesta y avisa de los peligros del grupo: añade o cambia nombres a tu gusto.
  var FRASES_MAMA = ['¡Cuidado con Sergio!', '¡Cuidado con Puli!', '¡Cuidado con Goria!', '¿Me invitas a un Jäger?', '¡Hoy no duermo sola!', '¿Quién me invita?', '¡Sujétame el cubata, guapo!', '¿Bailamos?', '¡Yo con el de la barra!', '¡Mi marido no se entera!', '¡Qué calor hace aquí!', '¡Ese gorro te sienta de lujo!', '¡hip!', '¡otra ronda!'];
  var MAMA = '<svg viewBox="0 0 74 104" width="64" height="90" focusable="false">' +
    '<ellipse cx="26" cy="99" rx="8" ry="4" fill="#2b1a14"/><ellipse cx="47" cy="99" rx="8" ry="4" fill="#2b1a14"/>' +
    '<path d="M24 47 Q36 41 48 47 L62 91 Q36 99 10 91 Z" fill="#D4283C"/>' +
    '<path d="M10 88 Q36 97 62 88 L63 94 Q36 102 9 94 Z" fill="#F4F7FB"/>' +
    '<rect x="25" y="60" width="22" height="5" fill="#13233B"/><rect x="33" y="58.6" width="6" height="7.8" rx="1.5" fill="#F4B93E"/>' +
    '<path d="M48 51 Q64 49 64 62" stroke="#D4283C" stroke-width="8" fill="none" stroke-linecap="round"/>' +
    '<circle cx="65" cy="63" r="4.4" fill="#f1c9a5"/>' +
    '<path d="M66 62 L66 54 M62 54 L70 54" stroke="#dce7f5" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M58.5 38 L73.5 38 L66 51.5 Z" fill="#7fe7ff" stroke="#dce7f5" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<circle cx="68.5" cy="41.5" r="2.2" fill="#1E6B4A"/>' +
    '<ellipse cx="36" cy="29" rx="17" ry="16" fill="#c8662b"/><circle cx="52" cy="35" r="5" fill="#c8662b"/><circle cx="20" cy="35" r="5" fill="#c8662b"/>' +
    '<circle cx="36" cy="31" r="13" fill="#f1c9a5"/>' +
    '<circle cx="28" cy="35" r="3.4" fill="#f08a8a" opacity=".85"/><circle cx="44" cy="35" r="3.4" fill="#f08a8a" opacity=".85"/>' +
    '<path d="M27 28 q3 -3 6 0 M39 28 q3 -3 6 0" stroke="#13233B" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M26 25.5 l-2 -2 M44.5 25.5 l2 -2" stroke="#13233B" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M31.5 38.5 Q36 43 40.5 38.5 Q36 41 31.5 38.5 Z" fill="#c0283c" stroke="#c0283c" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M21 23 Q22 5 44 5 Q56 7 58 20 Q40 13 21 23 Z" fill="#D4283C"/>' +
    '<rect x="19" y="18.5" width="36" height="8" rx="4" fill="#F4F7FB"/><circle cx="58" cy="19" r="5.4" fill="#F4F7FB"/></svg>';
  var cicloTimer = 0;
  function frase(mama) { var l = mama ? FRASES_MAMA : FRASES; return l[Math.floor(Math.random() * l.length)]; }
  // mama: true/false para forzarlo; sin indicar, una de cada tres o cuatro es Mamá Noel.
  function nuevoSanta(retardo, mama) {
    setTimeout(function () {
      if (document.querySelectorAll('.santa').length >= 5) return;
      var dur = 13 + Math.random() * 9, esc = .8 + Math.random() * .45, esMama = mama === undefined ? Math.random() < .4 : mama;
      var sa = el('div', '', 'santa paseando' + (esMama ? ' mama' : '') + (Math.random() < .5 ? '' : ' izq'), '<span class="dice"></span><span class="cuerpo">' + (esMama ? MAMA : SANTA) + '</span>');
      sa.style.setProperty('--dur', dur.toFixed(1) + 's');
      sa.style.setProperty('--esc', esc.toFixed(2));
      sa.style.bottom = 'calc(' + Math.round(78 + Math.random() * 46) + 'px + env(safe-area-inset-bottom))';
      sa.querySelector('.dice').textContent = frase(esMama);
      sa.setAttribute('aria-hidden', 'true');
      sa.addEventListener('animationend', function (e) { if (e.animationName === 'paseo' || e.animationName === 'paseo-izq') { clearTimeout(sa.eructoT); sa.remove(); } });
      document.body.appendChild(sa);
      if (!esMama) sa.eructoT = setTimeout(eructo, dur * 1000 * .3); // justo cuando le sale el bocadillo (se cancela si lo explotan)
    }, retardo);
  }
  // Cada cierto rato salen entre 1 y 3 Papás Noel (más y más seguidos en modo discoteca).
  function santa() {
    if (reducir) return;
    clearTimeout(cicloTimer);
    cicloTimer = setTimeout(function ciclo() {
      var modal = document.getElementById('modal');
      if (!document.hidden && !document.getElementById('gordo') && !(modal && modal.open)) {
        var n = (disco() ? 2 : 1) + Math.floor(Math.random() * 3);
        for (var i = 0; i < n; i++) nuevoSanta(i * (1500 + Math.random() * 3500));
      }
      cicloTimer = setTimeout(ciclo, (disco() ? 12000 : 20000) + Math.random() * 14000);
    }, 3000);
  }

  /* ---------- sonido (siempre activo; no hay botón para silenciarlo) ---------- */
  var ac = null;
  // El navegador solo deja sonar después de que la persona haya tocado la pantalla alguna vez.
  function puedeSonar() { return !navigator.userActivation || navigator.userActivation.hasBeenActive; }
  function contexto() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ac) ac = new AC();
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  // iOS/Safari: el audio se «desbloquea» con el primer toque, así que se prepara en cuanto la persona toca algo.
  function desbloquear() {
    var c = contexto();
    if (!c) return;
    try { var s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) { /* da igual */ }
    cargarSonidos();
  }
  // Sonidos reales en sonidos/*.mp3 (el eructo es de BigSoundBank, CC0; el gemido, de Pixabay/freesound_community). Se descargan y decodifican tras el primer toque;
  // si falta un archivo, ese sonido simplemente no suena.
  var SONIDOS = { eructo: { buf: null, cargando: false, vol: .8 }, gemido: { buf: null, cargando: false, vol: .8 } };
  var ultimoEructo = 0;
  function cargarSonidos() {
    var c = ac;
    if (!c || !window.fetch) return;
    Object.keys(SONIDOS).forEach(function (n) {
      var d = SONIDOS[n];
      if (d.buf || d.cargando) return;
      d.cargando = true;
      fetch('sonidos/' + n + '.mp3').then(function (r) { if (!r.ok) throw new Error('falta'); return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (ok, ko) { c.decodeAudioData(b, ok, ko); }); })
        .then(function (b) { d.buf = b; }, function () { /* sin archivo: sin sonido */ });
    });
  }
  // Nunca suenan dos a la vez: el automático se salta si ya hay uno sonando y el de una explosión corta el anterior.
  var sonando = null;
  function sonar(nombre, forzar) {
    if (!forzar && (!puedeSonar() || sonando || Date.now() - ultimoEructo < 2500)) return;
    var c = contexto(), d = SONIDOS[nombre];
    if (!c || !d) return;
    if (!d.buf) { cargarSonidos(); return; }
    ultimoEructo = Date.now();
    try {
      if (sonando) { try { sonando.stop(); } catch (e) { /* ya parado */ } }
      var s = c.createBufferSource(), g = c.createGain();
      s.buffer = d.buf; g.gain.value = d.vol;
      s.connect(g); g.connect(c.destination);
      s.onended = function () { if (sonando === s) sonando = null; };
      sonando = s; s.start(0);
    } catch (e) { sonando = null; }
  }
  function eructo(forzar) { sonar('eructo', forzar); }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function f() { desbloquear(); document.removeEventListener(ev, f, true); }, true);
  });
  // Tocar a un Papá Noel lo hace explotar entre tacos.
  var TACOS = ['¡Hijo de puta!', '¡Cabrón!', '¡Guarro!'];
  var GEMIDOS = ['¡Ay!', '¡Ooh!', '¡Aaah!'];
  var PIEZAS = ['🎅', '🥃', '🍾', '⭐', '🍺', '🧦', '🎄', '💥'];
  var PIEZAS_MAMA = ['💋', '❤️', '🍸', '💄', '👠', '🎀', '⭐', '💥'];
  function explotar(x, y, mama) {
    var dichos = mama ? GEMIDOS : TACOS, trozos = mama ? PIEZAS_MAMA : PIEZAS;
    var caja = el('div', '', 'pum', '<span class="boom" aria-hidden="true">' + (mama ? '💖' : '💥') + '</span><span class="taco' + (mama ? ' gime' : '') + '" role="status">' + dichos[Math.floor(Math.random() * dichos.length)] + '</span>');
    caja.style.left = x + 'px'; caja.style.top = y + 'px';
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * 6.283, r = 70 + Math.random() * 110, p = el('span', '', 'trozo', trozos[i % trozos.length]);
      p.style.setProperty('--dx', Math.round(Math.cos(a) * r) + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(a) * r - 40) + 'px');
      p.style.setProperty('--rot', Math.round((Math.random() - .5) * 720) + 'deg');
      caja.appendChild(p);
    }
    document.body.appendChild(caja);
    setTimeout(function () { caja.remove(); }, 1900);
    sonar(mama ? 'gemido' : 'eructo', true);
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* sin vibración */ }
  }
  document.addEventListener('click', function (e) {
    var sa = e.target.closest && e.target.closest('.santa');
    if (!sa) return;
    clearTimeout(sa.eructoT);
    var r = sa.getBoundingClientRect(), mama = sa.classList.contains('mama');
    sa.remove();
    explotar(r.left + r.width / 2, r.top + r.height / 2, mama);
  });

  /* ---------- premio gordo ---------- */
  var TAGS = ['¡Y sin preguntar, gilipollas!', '¡Eres un crack!', '¡Una ronda para el campeón!', '¡Aparta, que llega!', '¡Esto es NPG!'];
  var cola = [], abierto = false, confeti = null;

  function sirena() {
    if (!puedeSonar()) return;
    var c = contexto();
    if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
      o.type = 'sawtooth'; g.gain.value = .045;
      for (var i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 640 : 880, t + i * .32);
      g.gain.setValueAtTime(.045, t + 1.8); g.gain.linearRampToValueAtTime(0, t + 2);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 2.05);
    } catch (e) { /* da igual */ }
  }

  function lanzarConfeti(cv) {
    var x = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), w = window.innerWidth, h = window.innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    var col = ['#F4B93E', '#D4283C', '#3ee0ff', '#ff3ea5', '#7dff3e', '#F4F7FB'], ps = [], i;
    for (i = 0; i < 170; i++) {
      ps.push({ x: Math.random() * w, y: -20 - Math.random() * h * .8, vx: (Math.random() - .5) * 2.4, vy: 2 + Math.random() * 3.5,
        a: Math.random() * 6.28, va: (Math.random() - .5) * .3, s: 5 + Math.random() * 7, c: col[i % col.length] });
    }
    var fin = Date.now() + 9000, parar = false;
    (function pintar() {
      if (parar) return;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
      ps.forEach(function (p) {
        p.x += p.vx + Math.sin(p.a) * .6; p.y += p.vy; p.a += p.va;
        if (p.y > h + 20 && Date.now() < fin - 3000) { p.y = -20; p.x = Math.random() * w; }
        x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
      });
      requestAnimationFrame(pintar);
    })();
    return function () { parar = true; };
  }

  function cerrar() {
    var g = document.getElementById('gordo');
    if (!g) return;
    if (confeti) { confeti(); confeti = null; }
    g.remove(); abierto = false;
    if (cola.length) setTimeout(function () { mostrar(cola.shift()); }, 450);
  }
  // d = { titulo: '¡BINGO!', sub: '🏆 Bingo', nombre: 'Amós', premio: 'Una cena' }
  function mostrar(d) {
    if (abierto) { cola.push(d); return; }
    abierto = true;
    var g = el('div', 'gordo', '',
      '<canvas aria-hidden="true"></canvas><div class="sirena" aria-hidden="true"></div>' +
      '<div class="gordo-in" role="alertdialog" aria-live="assertive" aria-label="Premio">' +
      '<div class="gordo-ico" aria-hidden="true">' + d.icono + '</div>' +
      '<h2>' + d.titulo + '</h2><p class="gordo-sub">' + d.sub + '</p>' +
      '<p class="gordo-nombre">' + d.nombre + '</p>' +
      '<p class="gordo-tag">' + TAGS[Math.floor(Math.random() * TAGS.length)] + '</p>' +
      '<p class="gordo-premio">' + (d.premio ? '🎁 ' + d.premio : 'Premio por determinar') + '</p>' +
      '<p class="gordo-cierra">Toca para cerrar</p></div>');
    g.addEventListener('click', cerrar);
    document.body.appendChild(g);
    if (!reducir) confeti = lanzarConfeti(g.querySelector('canvas'));
    sirena();
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) { /* sin vibración */ }
    setTimeout(function () { if (document.getElementById('gordo') === g) cerrar(); }, 11000);
  }

  window.NPGFIESTA = { disco: disco, aplicar: aplicar, santa: santa, gordo: mostrar, eructo: eructo, nuevo: nuevoSanta };
})();
