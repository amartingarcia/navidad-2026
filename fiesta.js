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
  var FRASES = ['¡hip!', '¡otra ronda!', '¡yo no he sido!', '¡feliz navidá!', 'jo, jo… ¡hip!', '¿dónde está el Jäger?', '¡estoy fino!', '¡no preguntéis!'];
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
  var santaEl = null, santaTimer = 0;
  function santa() {
    if (reducir) return;
    if (!santaEl) {
      santaEl = el('div', 'santa', '', '<span class="dice"></span><span class="cuerpo">' + SANTA + '</span>');
      santaEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(santaEl);
      santaEl.addEventListener('animationend', function (e) {
        if (e.animationName === 'paseo' || e.animationName === 'paseo-izq') santaEl.className = '';
      });
    }
    clearTimeout(santaTimer);
    santaTimer = setTimeout(function pasear() {
      var ocupado = document.hidden || document.getElementById('gordo') || (document.getElementById('modal') && document.getElementById('modal').open);
      if (!ocupado) {
        santaEl.querySelector('.dice').textContent = FRASES[Math.floor(Math.random() * FRASES.length)];
        santaEl.className = '';
        void santaEl.offsetWidth; // reinicia la animación
        santaEl.className = Math.random() < .5 ? 'paseando' : 'paseando izq';
      }
      santaTimer = setTimeout(pasear, 40000 + Math.random() * 30000);
    }, 7000);
  }

  /* ---------- premio gordo ---------- */
  var TAGS = ['¡Y sin preguntar, gilipollas!', '¡Eres un crack!', '¡Una ronda para el campeón!', '¡Aparta, que llega!', '¡Esto es NPG!'];
  var cola = [], abierto = false, confeti = null;

  function sirena() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ac = new AC(), o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = 'sawtooth'; g.gain.value = .045;
      for (var i = 0; i < 6; i++) { o.frequency.setValueAtTime(i % 2 ? 640 : 880, t + i * .32); }
      g.gain.setValueAtTime(.045, t + 1.8); g.gain.linearRampToValueAtTime(0, t + 2);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 2.05);
      setTimeout(function () { try { ac.close(); } catch (e) { /* nada */ } }, 2500);
    } catch (e) { /* el navegador no deja sonar sin tocar antes: da igual */ }
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

  window.NPGFIESTA = { disco: disco, aplicar: aplicar, santa: santa, gordo: mostrar };
})();
