/* NPGingo · PoC sin backend. Todo el estado vive en localStorage del navegador. */
(function () {
  'use strict';

  var N = window.NPG;
  var RETOS = N.RETOS;
  var KEY = 'npgingo.poc.v1';
  var JURADO_JUGADORES = 2; // más el admin: 3 en total
  var LINEAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  var $app = document.getElementById('app');
  var $modal = document.getElementById('modal');
  var $toast = document.getElementById('toast');
  var state;
  var adminTab = 'sorteo';
  var juradoTab = 'fotos';
  var imgPendiente = null;

  /* ---------- utilidades ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function mezclar(a, r) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function reto(id) { return RETOS.filter(function (r) { return r.id === id; })[0]; }
  function hora(ts) { return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $toast.classList.remove('on'); }, 2600);
  }
  function placeholder(emoji, color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="' + color +
      '"/><text x="200" y="185" font-size="120" text-anchor="middle">' + emoji + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
  }
  function urlBg(img) { return 'background-image:url(&quot;' + img + '&quot;)'; }

  /* ---------- estado ---------- */
  function token(id) {
    var r = rng(id * 104729 + 7), s = '';
    for (var i = 0; i < 8; i++) s += Math.floor(r() * 36).toString(36);
    return s;
  }
  function semilla() {
    var ahora = Date.now();
    var jugadores = N.JUGADORES.map(function (n, i) {
      var t = token(i + 1);
      return {
        id: i + 1, name: n, admin: n === N.ADMIN, token: t, pass: 'npg-' + t.slice(0, 4), cambiada: i < 8,
        user: n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      };
    });
    var s = { session: null, players: jugadores, photos: [], claims: [], ganadores: { linea: null, bingo: null }, jurado: sortear(jugadores) };
    var colores = ['#1E6B4A', '#D4283C', '#18304F', '#8a5a00', '#5b2a86'];
    function foto(pid, rid, estado, min) {
      s.photos.push({ id: pid + '-' + rid + '-' + min, playerId: pid, retoId: rid, status: estado,
        ts: ahora - min * 60000, img: placeholder(reto(rid).icono, colores[(pid + rid) % colores.length]) });
    }
    // Dani (id 1) arranca con la fila de arriba validada para ver el flujo de "línea".
    var cDani = carton(1);
    [0, 1, 2].forEach(function (i, k) { foto(1, cDani[i], 'ok', 90 - k * 10); });
    jugadores.slice(1, 8).forEach(function (p, k) {
      var c = carton(p.id);
      foto(p.id, c[0], 'ok', 70 - k * 5);
      if (k < 4) foto(p.id, c[1], 'pend', 15 - k * 3);
    });
    return s;
  }
  function cargar() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        s.players.forEach(function (p) { p.admin = p.name === N.ADMIN; });
        var adm = s.players.filter(function (p) { return p.admin; })[0];
        if (s.session && s.session.role === 'admin') s.session = adm ? { role: 'jugador', playerId: adm.id } : null;
        // datos guardados con otro tamaño de jurado, o con el admin sorteado como jugador
        if (!s.jurado || s.jurado.length !== JURADO_JUGADORES || (adm && s.jurado.indexOf(adm.id) !== -1)) {
          s.jurado = sortear(s.players);
          localStorage.setItem(KEY, JSON.stringify(s)); // fija el sorteo para que no cambie al recargar
        }
        return s;
      }
    } catch (e) { /* sin almacenamiento: sigue en memoria */ }
    return semilla();
  }
  // Jurado: 2 jugadores al azar sin contar al admin, que siempre está dentro (3 en total).
  function sortear(jugadores) {
    return mezclar(jugadores.filter(function (p) { return !p.admin; }).map(function (p) { return p.id; }), Math.random).slice(0, JURADO_JUGADORES);
  }
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Memoria llena: no se ha podido guardar la última foto.'); }
  }

  /* ---------- lógica del juego ---------- */
  function carton(pid) {
    var fijo = RETOS.filter(function (r) { return r.fijo; })[0].id;
    var pool = mezclar(RETOS.filter(function (r) { return !r.fijo; }).map(function (r) { return r.id; }), rng(pid * 7919 + 13)).slice(0, 8);
    var celdas = [], k = 0;
    for (var i = 0; i < 9; i++) celdas.push(i === 4 ? fijo : pool[k++]);
    return celdas;
  }
  function estadoReto(pid, rid) {
    var orden = { ok: 3, pend: 2, ko: 1 }, mejor = null;
    state.photos.forEach(function (f) {
      if (f.playerId !== pid || f.retoId !== rid) return;
      if (!mejor || orden[f.status] > orden[mejor.status] || (orden[f.status] === orden[mejor.status] && f.ts > mejor.ts)) mejor = f;
    });
    return mejor;
  }
  function lineasCompletas(pid) {
    var c = carton(pid);
    return LINEAS.filter(function (l) {
      return l.every(function (i) { var f = estadoReto(pid, c[i]); return f && f.status === 'ok'; });
    });
  }
  function sellos(pid) {
    return carton(pid).filter(function (rid) { var f = estadoReto(pid, rid); return f && f.status === 'ok'; }).length;
  }
  function jugador(id) { return state.players.filter(function (p) { return p.id === id; })[0]; }
  function yo() { return state.session && state.session.role === 'jugador' ? jugador(state.session.playerId) : null; }
  function soyAdmin() { var p = yo(); return !!p && !!p.admin; }
  function admin() { return state.players.filter(function (p) { return p.admin; })[0]; }
  function esJurado(pid) { var p = jugador(pid); return state.jurado.indexOf(pid) !== -1 || !!(p && p.admin); }
  function soyJurado() { var p = yo(); return !!p && esJurado(p.id); }
  function pendientes(excluirPid) {
    return state.photos.filter(function (f) { return f.status === 'pend' && f.playerId !== excluirPid; })
      .sort(function (a, b) { return a.ts - b.ts; });
  }
  function listaPendientes(excluirPid) {
    var pend = pendientes(excluirPid);
    if (!pend.length) return '<div class="vacio">No hay fotos por validar. Descansa un rato.</div>';
    return '<div class="muro">' + pend.map(function (f) {
      var r = reto(f.retoId);
      return '<figure class="foto-card"><img src="' + f.img + '" alt="' + esc(r.titulo) + '">' +
        '<figcaption><b>' + esc(jugador(f.playerId).name) + '</b> · ' + esc(r.titulo) + '<br><small>' + esc(r.pista) + '</small></figcaption>' +
        '<div class="acc"><button class="btn mini" data-acc="aprobar" data-id="' + esc(f.id) + '">Validar</button>' +
        '<button class="btn mini fantasma" data-acc="rechazar" data-id="' + esc(f.id) + '">Rechazar</button></div></figure>';
    }).join('') + '</div>';
  }
  function cantosPendientes(excluirPid) {
    return state.claims.filter(function (c) { return c.estado === 'pend' && c.playerId !== excluirPid; });
  }
  function listaCantos(excluirPid) {
    var cs = state.claims.filter(function (c) { return c.playerId !== excluirPid; }).sort(function (a, b) { return b.ts - a.ts; });
    if (!cs.length) return '<div class="vacio">Nadie ha cantado todavía.</div>';
    return cs.map(function (c) {
      var p = jugador(c.playerId), pid = p.id;
      var mini = carton(pid).map(function (rid) { var f = estadoReto(pid, rid); return f ? '<img src="' + f.img + '" alt="' + esc(reto(rid).titulo) + '">' : ''; }).join('');
      return '<section class="panel"><h3>' + (c.tipo === 'bingo' ? 'Bingo' : 'Línea') + ' de ' + esc(p.name) + ' <span class="etq ' + c.estado + '">' +
        { pend: 'Por revisar', ok: 'Válido', ko: 'Anulado' }[c.estado] + '</span></h3><p>Cantado a las ' + hora(c.ts) + (c.por ? ' · Resuelto por ' + esc(c.por) : '') + '</p><div class="miniaturas">' + mini + '</div>' +
        (c.estado === 'pend' ? '<div class="acciones"><button class="btn oro" data-acc="resolver" data-id="' + c.id + '" data-ok="1">Es válido</button>' +
          '<button class="btn fantasma" data-acc="resolver" data-id="' + c.id + '" data-ok="0">Anular</button></div>' : '') + '</section>';
    }).join('');
  }
  function nombreJurado() { return yo() ? yo().name : ''; }
  function dias() {
    var d = Math.ceil((new Date(N.EVENTO.fecha + 'T00:00:00') - new Date()) / 86400000);
    return d;
  }

  /* ---------- vistas ---------- */
  function cabecera() {
    var d = dias();
    var cuenta = d > 0
      ? '<strong>' + d + '</strong><span>días para el 26 de diciembre</span>'
      : '<strong>¡Hoy!</strong><span>Empieza la ruta</span>';
    return '<header class="cab"><div><h1 class="logo">NPGingo</h1><p class="lema">No preguntes, gilipollas</p></div>' +
      '<div class="cuenta">' + cuenta + '</div></header>';
  }
  function nav(ruta) {
    var items = [['carton', '🎟️', 'Cartón'], ['muro', '📸', 'Muro']];
    if (soyJurado()) items.splice(1, 0, ['jurado', '⚖️', 'Jurado']);
    if (soyAdmin()) items.splice(items.length - 1, 0, ['admin', '🛠️', 'Admin']);
    return '<nav class="nav" aria-label="Secciones"><div class="nav-in">' + items.map(function (it) {
      return '<a href="#/' + it[0] + '"' + (ruta === it[0] ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + it[1] + '</span>' + it[2] + '</a>';
    }).join('') + '<a href="#/salir" data-acc="salir"><span aria-hidden="true">🚪</span>Salir</a></div></nav>';
  }

  function vEntrar(tok) {
    var h = '<main class="entrada"><h1 class="logo">NPGingo</h1><p class="lema">No preguntes, gilipollas · Bingo de Navidad</p>';
    var p = tok ? state.players.filter(function (x) { return x.token === tok; })[0] : null;
    if (tok && !p) {
      h += '<section class="panel"><h2>Este enlace no vale</h2><p>Puede que esté mal copiado o que el admin lo haya cambiado. Pídele uno nuevo.</p></section>';
    } else if (p && !p.cambiada) {
      h += '<section class="panel"><h2>Hola, ' + esc(p.name) + '</h2><p>Es tu primera vez. Cambia la contraseña provisional para entrar.</p>' +
        '<div class="dato"><span>Usuario</span><b>' + esc(p.user) + '</b></div>' +
        '<div class="dato"><span>Contraseña provisional</span><b>' + esc(p.pass) + '</b></div></section>' +
        '<form class="panel" data-form="clave" data-token="' + esc(p.token) + '">' +
        '<label class="campo"><span>Contraseña nueva (mínimo 6 caracteres)</span><input name="a" type="password" minlength="6" autocomplete="new-password" required></label>' +
        '<label class="campo"><span>Repite la contraseña</span><input name="b" type="password" minlength="6" autocomplete="new-password" required></label>' +
        '<button class="btn oro ancho" type="submit">Guardar y entrar</button></form>';
    } else if (p) {
      h += '<form class="panel" data-form="login" data-token="' + esc(p.token) + '"><h2>Hola, ' + esc(p.name) + '</h2>' +
        '<label class="campo"><span>Contraseña</span><input name="a" type="password" autocomplete="current-password" required></label>' +
        '<button class="btn oro ancho" type="submit">Entrar</button></form>';
    } else {
      h += '<section class="panel"><h2>Entra con tu enlace</h2><p>El admin te pasa un enlace personal con tu usuario. Ábrelo desde el móvil y listo.</p></section>';
    }
    h += '<section class="panel"><h3>Probar la PoC</h3><p>Sin backend: los datos son de ejemplo y se guardan solo en este navegador.</p>' +
      '<div class="acciones"><button class="btn oro" data-acc="demoJugador">Entrar como Dani (jugador)</button>' +
      '<button class="btn fantasma" data-acc="demoJurado">Entrar como jurado (' + esc(jugador(state.jurado[0]).name) + ')</button>' +
      '<button class="btn fantasma" data-acc="demoAdmin">Entrar como admin (' + esc(admin().name) + ')</button>' +
      '<button class="btn fantasma" data-acc="reiniciar">Reiniciar datos de ejemplo</button></div></section></main>';
    return h;
  }

  function banner() {
    var g = state.ganadores, t = '';
    if (g.linea) t += '<strong>Línea:</strong> ' + esc(jugador(g.linea).name) + ' 🏆 ';
    if (g.bingo) t += '<strong>Bingo:</strong> ' + esc(jugador(g.bingo).name) + ' 🏆';
    if (!t) t = '<strong>Sin línea ni bingo todavía.</strong> Gana quien lo cante primero y el jurado lo valide.';
    return '<div class="aviso">' + t + '</div>';
  }

  function vCarton() {
    var p = yo(), c = carton(p.id), n = sellos(p.id), lineas = lineasCompletas(p.id);
    var h = '';
    if (esJurado(p.id)) {
      var np = pendientes(p.id).length + cantosPendientes(p.id).length;
      h += '<a class="banner-jurado" href="#/jurado"><span class="ico" aria-hidden="true">⚖️</span><span><b>' + (p.admin ? 'Eres del jurado, como admin' : 'Te ha tocado jurado') + '</b><br>' +
        (np ? np + (np === 1 ? ' cosa espera' : ' cosas esperan') + ' tu veredicto' : 'No hay nada por validar ahora mismo') + '</span></a>';
    }
    h += banner();
    h += '<article class="ticket"><div class="ticket-top"><div><h2>Cartón de ' + esc(p.name) + '</h2><small>Quedada de Navidad · 26 dic 2026</small></div>' +
      '<div class="serie" aria-label="Número de cartón">Nº ' + String(p.id).padStart(3, '0') + '</div></div><div class="perf"></div>' +
      '<div class="progreso"><span>' + n + ' de 9 sellos validados</span><span>Pulsa un reto para subir la foto</span></div><div class="grid">';
    c.forEach(function (rid) {
      var r = reto(rid), f = estadoReto(p.id, rid), cls = 'celda';
      if (r.fijo) cls += ' centro';
      if (r.tipo === 'grupal') cls += ' grupal';
      var sello = '', etiqueta = '';
      if (f) {
        cls += ' ' + f.status + ' conFoto';
        sello = '<span class="sello">' + { ok: 'OK', pend: 'En revisión', ko: 'Repite' }[f.status] + '</span>';
        etiqueta = { ok: ', validado', pend: ', pendiente de validar', ko: ', rechazado' }[f.status];
      }
      h += '<button class="' + cls + '" data-acc="reto" data-id="' + rid + '" aria-label="' + esc(r.titulo + etiqueta) + '">' +
        (f ? '<span class="foto" style="' + urlBg(f.img) + '"></span>' : '') +
        '<span class="ico" aria-hidden="true">' + r.icono + '</span><span class="tit">' + esc(r.titulo) + '</span>' + sello + '</button>';
    });
    h += '</div></article><div class="acciones">';
    var pendLinea = state.claims.some(function (x) { return x.playerId === p.id && x.tipo === 'linea' && x.estado === 'pend'; });
    var pendBingo = state.claims.some(function (x) { return x.playerId === p.id && x.tipo === 'bingo' && x.estado === 'pend'; });
    if (n === 9 && !state.ganadores.bingo) {
      h += '<button class="btn oro" data-acc="cantar" data-tipo="bingo"' + (pendBingo ? ' disabled' : '') + '>' +
        (pendBingo ? 'Bingo cantado. El jurado lo está mirando' : '¡Cantar bingo!') + '</button>';
    } else if (lineas.length && !state.ganadores.linea) {
      h += '<button class="btn oro" data-acc="cantar" data-tipo="linea"' + (pendLinea ? ' disabled' : '') + '>' +
        (pendLinea ? 'Línea cantada. El jurado la está mirando' : '¡Cantar línea!') + '</button>';
    }
    h += '</div>';
    return h;
  }

  function vMuro() {
    var oks = state.photos.filter(function (f) { return f.status === 'ok'; }).sort(function (a, b) { return b.ts - a.ts; });
    if (!oks.length) return '<div class="vacio">Aún no hay fotos validadas. La primera la sube alguien con valor.</div>';
    return '<div class="muro">' + oks.map(function (f) {
      var r = reto(f.retoId);
      return '<figure class="foto-card"><img src="' + f.img + '" alt="' + esc(r.titulo) + '" loading="lazy">' +
        '<figcaption><b>' + esc(jugador(f.playerId).name) + '</b> · ' + esc(r.titulo) + ' · ' + hora(f.ts) + (f.por ? '<br><small>Validada por ' + esc(f.por) + '</small>' : '') + '</figcaption></figure>';
    }).join('') + '</div>';
  }

  function vJurado() {
    var p = yo(), pid = p ? p.id : null;
    var nf = pendientes(pid).length, nc = cantosPendientes(pid).length;
    var tabs = [['fotos', 'Fotos' + (nf ? ' (' + nf + ')' : '')], ['cantos', 'Cantos' + (nc ? ' (' + nc + ')' : '')]];
    var h = '<section class="panel"><h2>Eres del jurado</h2><p>Sois 3: dos jugadores sorteados y el admin. Valida las fotos y los cantos de línea y bingo de tus colegas. Lo tuyo lo valida otra persona del jurado. Si dudas, rechaza y que lo repitan.</p></section>' +
      '<div class="segmento" role="group" aria-label="Qué revisar">' + tabs.map(function (t) {
        return '<button data-acc="jtab" data-tab="' + t[0] + '" aria-pressed="' + (juradoTab === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div>';
    return h + (juradoTab === 'cantos' ? listaCantos(pid) : listaPendientes(pid));
  }

  function vAdmin() {
    var tabs = [['sorteo', 'Sorteo'], ['enlaces', 'Enlaces']];
    var h = '<div class="segmento" role="group" aria-label="Secciones del admin">' + tabs.map(function (t) {
      return '<button data-acc="tab" data-tab="' + t[0] + '" aria-pressed="' + (adminTab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    if (adminTab === 'sorteo') {
      h += '<section class="panel"><h3>Jurado de la quedada</h3><p>Dos jugadores al azar, más tú como admin (sois 3 en total). Los tres validan fotos y cantos de los demás, nunca los suyos. Los elegidos ven un banner en su cartón.</p>' +
        state.jurado.map(function (id) {
          return '<div class="fila"><div><b>' + esc(jugador(id).name) + '</b><small>Jugador sorteado</small></div><span class="etq ok">En el jurado</span></div>';
        }).join('') + '<div class="fila"><div><b>' + esc(admin().name) + '</b><small>Admin, siempre en el jurado</small></div><span class="etq ok">En el jurado</span></div>' +
        '<button class="btn oro ancho" style="margin-top:12px" data-acc="sortear">Sortear de nuevo</button></section>';
    }

    if (adminTab === 'enlaces') {
      h += '<section class="panel"><h3>Enlaces personales</h3><p>Cada jugador entra con el suyo. Aquí solo copias el enlace.</p>' +
        state.players.map(function (p) {
          return '<div class="fila"><div><b>' + esc(p.name) + '</b><small>' + esc(p.user) + ' · ' + (p.cambiada ? 'contraseña cambiada' : 'provisional: ' + esc(p.pass)) + '</small></div>' +
            '<button class="btn mini fantasma" data-acc="copiar" data-token="' + esc(p.token) + '">Copiar</button></div>';
        }).join('') + '</section>';
    }
    return h;
  }

  /* ---------- router ---------- */
  function ruta() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    return { nombre: h[0] || '', arg: h[1] || '' };
  }
  function render() {
    var r = ruta(), html;
    if (r.nombre === 'salir') { state.session = null; guardar(); location.hash = '#/entrar'; return; }
    if (r.nombre === 'entrar' || !state.session) {
      nieve(true);
      $app.innerHTML = vEntrar(r.nombre === 'entrar' ? r.arg : '');
      return;
    }
    nieve(false);
    var nombre = r.nombre;
    if (nombre === '' || (nombre === 'admin' && !soyAdmin())) nombre = 'carton';
    if (nombre === 'jurado' && !soyJurado()) nombre = 'carton';
    var vistas = { carton: vCarton, muro: vMuro, admin: vAdmin, jurado: vJurado };
    html = cabecera() + (vistas[nombre] || vCarton)() + nav(nombre);
    $app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ---------- acciones ---------- */
  function abrirReto(id) {
    var p = yo(), r = reto(id), f = estadoReto(p.id, id);
    imgPendiente = null;
    var h = '<div class="modal-in"><span class="etq">' + esc(r.franja) + ' · ' + (r.tipo === 'jurado' ? 'lo decide el jurado' : r.tipo) + '</span>' +
      '<h3>' + r.icono + ' ' + esc(r.titulo) + '</h3><p class="pista">' + esc(r.pista) + '</p>';
    if (f && f.status !== 'ko') {
      h += '<img class="vista" src="' + f.img + '" alt="Tu foto"><p class="pista"><b>' + (f.status === 'ok' ? 'Validada por el jurado.' : 'Enviada. Esperando al jurado.') + '</b></p>' +
        '<div class="fila-btn"><button class="btn fantasma" data-acc="cerrar">Cerrar</button></div>';
    } else {
      if (f && f.status === 'ko') h += '<p class="pista"><b>El jurado la ha rechazado.</b> Sube otra.</p>';
      h += '<img class="vista" id="vista" alt="" hidden>' +
        '<label class="campo"><span>Foto del reto</span><input id="archivo" type="file" accept="image/*" capture="environment"></label>' +
        '<div class="fila-btn"><button class="btn fantasma" data-acc="cerrar">Cancelar</button>' +
        '<button class="btn" id="enviar" data-acc="enviar" data-id="' + id + '" disabled>Enviar foto</button></div>';
    }
    $modal.innerHTML = h + '</div>';
    if (!$modal.open) $modal.showModal();
  }
  function comprimir(file, cb) {
    var lector = new FileReader();
    lector.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 640, k = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = function () { toast('Esa imagen no se puede leer. Prueba con otra.'); };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  }

  var acciones = {
    reto: function (d) { abrirReto(Number(d.id)); },
    cerrar: function () { $modal.close(); },
    enviar: function (d) {
      var p = yo();
      if (!imgPendiente) return;
      state.photos.push({ id: p.id + '-' + d.id + '-' + Date.now(), playerId: p.id, retoId: Number(d.id), status: 'pend', ts: Date.now(), img: imgPendiente });
      guardar(); $modal.close(); render();
      toast('Foto enviada. Ahora toca esperar al jurado.');
    },
    cantar: function (d) {
      var p = yo();
      state.claims.push({ id: 'c' + Date.now(), playerId: p.id, tipo: d.tipo, estado: 'pend', ts: Date.now() });
      guardar(); render();
      toast(d.tipo === 'bingo' ? '¡Bingo cantado!' : '¡Línea cantada!');
    },
    aprobar: function (d) { cambiarFoto(d.id, 'ok'); toast('Foto validada.'); },
    rechazar: function (d) { cambiarFoto(d.id, 'ko'); toast('Foto rechazada.'); },
    sortear: function () { state.jurado = sortear(state.players); guardar(); render(); toast('Jurado nuevo sorteado.'); },
    demoJurado: function () { state.session = { role: 'jugador', playerId: state.jurado[0] }; guardar(); location.hash = '#/carton'; render(); },
    resolver: function (d) {
      var c = state.claims.filter(function (x) { return x.id === d.id; })[0];
      c.por = nombreJurado();
      if (d.ok === '1') {
        c.estado = 'ok';
        if (!state.ganadores[c.tipo]) state.ganadores[c.tipo] = c.playerId;
      } else {
        c.estado = 'ko';
      }
      guardar(); render();
    },
    tab: function (d) { adminTab = d.tab; render(); },
    jtab: function (d) { juradoTab = d.tab; render(); },
    copiar: function (d) {
      var url = location.href.split('#')[0] + '#/entrar/' + d.token;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast('Enlace copiado.'); }, function () { toast(url); });
      } else { toast(url); }
    },
    demoJugador: function () { state.session = { role: 'jugador', playerId: 1 }; guardar(); location.hash = '#/carton'; render(); },
    demoAdmin: function () { state.session = { role: 'jugador', playerId: admin().id }; guardar(); location.hash = '#/carton'; render(); },
    reiniciar: function () { state = semilla(); guardar(); toast('Datos de ejemplo restaurados.'); render(); },
    salir: function () { /* lo resuelve el router */ }
  };
  function cambiarFoto(id, estado) {
    var quien = nombreJurado();
    state.photos.forEach(function (f) { if (f.id === id) { f.status = estado; f.por = quien; } });
    guardar(); render();
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-acc]');
    if (!el || el.disabled) return;
    var fn = acciones[el.dataset.acc];
    if (fn) { if (el.tagName === 'BUTTON') e.preventDefault(); fn(el.dataset); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'archivo' || !e.target.files[0]) return;
    comprimir(e.target.files[0], function (data) {
      imgPendiente = data;
      var v = document.getElementById('vista');
      v.src = data; v.hidden = false;
      document.getElementById('enviar').disabled = false;
    });
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    var tipo = f.dataset.form, d = new FormData(f);
    if (tipo === 'clave') {
      if (d.get('a') !== d.get('b')) { toast('Las contraseñas no coinciden.'); return; }
      var p = state.players.filter(function (x) { return x.token === f.dataset.token; })[0];
      p.cambiada = true;
      state.session = { role: 'jugador', playerId: p.id };
      guardar(); location.hash = '#/carton'; render();
    } else if (tipo === 'login') {
      var q = state.players.filter(function (x) { return x.token === f.dataset.token; })[0];
      state.session = { role: 'jugador', playerId: q.id };
      guardar(); location.hash = '#/carton'; render();
    }
  });
  window.addEventListener('hashchange', render);

  /* ---------- nieve (solo en la pantalla de entrada) ---------- */
  var nv = { on: false, copos: [], raf: 0 };
  function nieve(on) {
    var cv = document.getElementById('nieve');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) on = false;
    if (on === nv.on) return;
    nv.on = on;
    if (!on) { cancelAnimationFrame(nv.raf); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    var ctx = cv.getContext('2d');
    nv.copos = [];
    for (var i = 0; i < 90; i++) nv.copos.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: 1 + Math.random() * 3, v: .4 + Math.random() * 1.1, o: Math.random() * 6 });
    (function pintar(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = 'rgba(244,247,251,.85)';
      nv.copos.forEach(function (c) {
        c.y += c.v; c.x += Math.sin(t / 1200 + c.o) * .4;
        if (c.y > cv.height + 5) { c.y = -5; c.x = Math.random() * cv.width; }
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.2832); ctx.fill();
      });
      if (nv.on) nv.raf = requestAnimationFrame(pintar);
    })(0);
  }

  state = cargar();
  if (!location.hash) location.hash = state.session ? '#/carton' : '#/entrar';
  render();
})();
