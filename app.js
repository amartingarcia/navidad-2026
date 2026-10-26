/* NPGingo · PoC sin backend. Todo el estado vive en localStorage del navegador. */
(function () {
  'use strict';

  var N = window.NPG;
  var RETOS = N.RETOS;
  var KEY = 'npgingo.poc.v1';
  var JURADO_JUGADORES = 2; // más el admin: 3 en total
  // Solo cuentan las filas horizontales: ni columnas ni diagonales.
  var LINEAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
  var $app = document.getElementById('app');
  var $modal = document.getElementById('modal');
  var $toast = document.getElementById('toast');
  var state;
  var adminTab = 'sorteo';
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
  function reto(id) { return N.CANTOS[id] || RETOS.filter(function (r) { return r.id === id; })[0]; }
  function idReto(v) { return N.CANTOS[v] ? v : Number(v); }
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
    var s = { session: null, players: jugadores, photos: [], reacciones: {}, offset: 0, ganadores: { linea: null, bingo: null }, jurado: sortear(jugadores) };
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
    // Algunas reacciones de ejemplo en las primeras fotos validadas.
    var vistas = s.photos.filter(function (f) { return f.status === 'ok'; }).slice(0, 4);
    vistas.forEach(function (f, i) {
      s.reacciones[f.id] = { '😂': [2, 3, 4, 5].slice(0, 4 - i), '🔥': i % 2 ? [6] : [6, 7] };
    });
    return s;
  }
  function cargar() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (!s.reacciones) s.reacciones = {};
        if (typeof s.offset !== 'number') s.offset = 0;
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
    var pend = pendientes(excluirPid).sort(function (a, b) { return (valorable(b) ? 1 : 0) - (valorable(a) ? 1 : 0); });
    if (!pend.length) return '<div class="vacio">No hay fotos por validar. Descansa un rato.</div>';
    return '<div class="muro">' + pend.map(function (f) {
      var r = reto(f.retoId), pid = f.playerId, rev = '', libre = valorable(f);
      if (r.tipo === 'canto') {
        var c = carton(pid), ids = r.id === 'linea' ? LINEAS[f.fila || 0].map(function (i) { return c[i]; }) : c;
        rev = '<p class="rev-tit">Revisa ' + (r.id === 'linea' ? 'las 3 fotos de la fila' : 'las 9 fotos del cartón') + '. Toca una para verla grande.</p><div class="rev">' +
          ids.map(function (rid) {
            var g = estadoReto(pid, rid);
            return g ? '<button class="rev-foto" data-acc="ver" data-fid="' + esc(g.id) + '"><img src="' + g.img + '" alt=""><span>' + esc(reto(rid).titulo) + '</span></button>' : '';
          }).join('') + '</div>';
      }
      return '<figure class="foto-card"><img src="' + f.img + '" alt="' + esc(r.titulo) + '">' +
        '<figcaption><b>' + esc(jugador(f.playerId).name) + '</b> · ' + esc(r.titulo) + '<br><small>' + esc(r.pista) + '</small>' + rev + '</figcaption>' +
        (libre
          ? '<div class="acc"><button class="btn mini" data-acc="aprobar" data-id="' + esc(f.id) + '">Validar</button>' +
            '<button class="btn mini fantasma" data-acc="rechazar" data-id="' + esc(f.id) + '">Rechazar</button></div>'
          : '<p class="bloqueo">🔒 Se puede valorar desde ' + desdeTxt(r) + '</p>') + '</figure>';
    }).join('') + '</div>';
  }
  // Reloj: en la PoC el admin puede simular la hora de la quedada para probar las horas mínimas.
  function ahora() { return Date.now() + ((state && state.offset) || 0); }
  function desdeTs(r) {
    if (!r || !r.desde) return null;
    var f = new Date(N.EVENTO.fecha + 'T' + r.desde.hora + ':00');
    f.setDate(f.getDate() + (r.desde.dia || 0));
    return f.getTime();
  }
  function desdeTxt(r) {
    return 'las ' + r.desde.hora + (r.desde.dia ? ' del ' + new Date(desdeTs(r)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '') : '');
  }
  function valorable(f) { var t = desdeTs(reto(f.retoId)); return t === null || ahora() >= t; }
  function nombreJurado() { return yo() ? yo().name : ''; }
  function dias() {
    var d = Math.ceil((new Date(N.EVENTO.fecha + 'T00:00:00') - new Date()) / 86400000);
    return d;
  }

  /* ---------- vistas ---------- */
  // Logo: gorro de Navidad ladeado 45° apoyado en la esquina de la N.
  function logo() {
    return '<h1 class="logo" aria-label="NPGingo"><span class="logo-n" aria-hidden="true">N' +
      '<svg class="gorro" viewBox="0 0 100 100" focusable="false"><path d="M16 80C20 42 38 16 72 13C67 32 71 56 86 80Z" fill="#D4283C"/>' +
      '<path d="M16 80C20 62 24 50 31 38C40 52 60 60 86 80Z" fill="#A81B2D" opacity=".55"/>' +
      '<rect x="8" y="72" width="86" height="22" rx="11" fill="#F4F7FB"/><circle cx="73" cy="13" r="10" fill="#F4F7FB"/></svg></span>' +
      '<span aria-hidden="true">PGingo</span></h1>';
  }
  function cabecera() {
    var d = dias();
    var cuenta = d > 0
      ? '<strong>' + d + '</strong><span>días para el 26 de diciembre</span>'
      : '<strong>¡Hoy!</strong><span>Empieza la ruta</span>';
    return '<header class="cab"><div>' + logo() + '<p class="lema">No preguntes, gilipollas</p></div>' +
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
    var h = '<main class="entrada">' + logo() + '<p class="lema">No preguntes, gilipollas · Bingo de Navidad</p>';
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
      var np = pendientes(p.id).filter(valorable).length;
      h += '<a class="banner-jurado" href="#/jurado"><span class="ico" aria-hidden="true">⚖️</span><span><b>' + (p.admin ? 'Eres del jurado, como admin' : 'Te ha tocado jurado') + '</b><br>' +
        (np ? np + (np === 1 ? ' foto espera' : ' fotos esperan') + ' tu veredicto' : 'No hay fotos que valorar ahora mismo') + '</span></a>';
    }
    h += banner();
    h += '<article class="ticket"><div class="ticket-top"><div><h2>Cartón de ' + esc(p.name) + '</h2><small>Quedada de Navidad · 26 dic 2026</small></div>' +
      '<div class="serie" aria-label="Número de cartón">Nº ' + String(p.id).padStart(3, '0') + '</div></div><div class="perf"></div>' +
      '<div class="progreso"><span>' + n + ' de 9 sellos validados</span><span>Línea = una fila horizontal</span></div><div class="grid">';
    c.forEach(function (rid, i) {
      if (i % 3 === 0) {
        var k = i / 3, hecha = lineas.some(function (l) { return l[0] === i; });
        h += '<div class="hilera' + (hecha ? ' completa' : '') + '" role="group" aria-label="Fila ' + (k + 1) + (hecha ? ', completa' : '') + '"><span class="marca" aria-hidden="true"></span>';
      }
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
      if (i % 3 === 2) h += '</div>';
    });
    h += '</div></article><div class="acciones">';
    function botonCanto(tipo, texto) {
      var f = estadoReto(p.id, tipo);
      if (f && f.status === 'pend') return '<button class="btn oro" disabled>' + texto[1] + '</button>';
      return '<button class="btn oro" data-acc="reto" data-id="' + tipo + '">' + (f && f.status === 'ko' ? texto[2] : texto[0]) + '</button>';
    }
    if (n === 9 && !state.ganadores.bingo) {
      h += botonCanto('bingo', ['¡Cantar bingo con foto!', 'Bingo enviado. El jurado lo está mirando', 'Repetir la foto del bingo']);
    } else if (lineas.length && !state.ganadores.linea) {
      h += botonCanto('linea', ['¡Cantar línea con foto!', 'Línea enviada. El jurado la está mirando', 'Repetir la foto de la línea']);
    }
    h += '</div>';
    return h;
  }

  function barraReacciones(f) {
    var yoId = yo() ? yo().id : null, rs = state.reacciones[f.id] || {};
    return '<div class="reacciones" role="group" aria-label="Reacciones">' + N.REACCIONES.map(function (e) {
      var quienes = rs[e] || [], mia = quienes.indexOf(yoId) !== -1;
      return '<button class="reac" data-acc="reaccion" data-id="' + esc(f.id) + '" data-e="' + e + '" aria-pressed="' + mia + '" aria-label="' + e + ', ' + quienes.length + '">' +
        '<span aria-hidden="true">' + e + '</span>' + (quienes.length ? '<b>' + quienes.length + '</b>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function vMuro() {
    var oks = state.photos.filter(function (f) { return f.status === 'ok'; }).sort(function (a, b) { return b.ts - a.ts; });
    if (!oks.length) return '<div class="vacio">Aún no hay fotos validadas. La primera la sube alguien con valor.</div>';
    return '<div class="muro">' + oks.map(function (f) {
      var r = reto(f.retoId);
      return '<figure class="foto-card"><img src="' + f.img + '" alt="' + esc(r.titulo) + '" loading="lazy">' +
        '<figcaption><b>' + esc(jugador(f.playerId).name) + '</b> · ' + esc(r.titulo) + ' · ' + hora(f.ts) + (f.por ? '<br><small>Validada por ' + esc(f.por) + '</small>' : '') + '</figcaption>' + barraReacciones(f) + '</figure>';
    }).join('') + '</div>';
  }

  function vJurado() {
    var p = yo();
    return '<section class="panel"><h2>Eres del jurado</h2><p>Sois 3: dos jugadores sorteados y el admin. Valida las fotos de tus colegas, también las de línea y bingo. Las tuyas las valida otra persona del jurado. Si dudas, rechaza y que la repitan.</p></section>' +
      listaPendientes(p.id);
  }

  function vAdmin() {
    var tabs = [['sorteo', 'Sorteo'], ['reloj', 'Reloj de prueba'], ['enlaces', 'Enlaces']];
    var h = '<div class="segmento" role="group" aria-label="Secciones del admin">' + tabs.map(function (t) {
      return '<button data-acc="tab" data-tab="' + t[0] + '" aria-pressed="' + (adminTab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    if (adminTab === 'sorteo') {
      h += '<section class="panel"><h3>Jurado de la quedada</h3><p>Dos jugadores al azar, más tú como admin (sois 3 en total). Los tres validan las fotos de los demás, incluidas las de línea y bingo, nunca las suyas. Los elegidos ven un banner en su cartón.</p>' +
        state.jurado.map(function (id) {
          return '<div class="fila"><div><b>' + esc(jugador(id).name) + '</b><small>Jugador sorteado</small></div><span class="etq ok">En el jurado</span></div>';
        }).join('') + '<div class="fila"><div><b>' + esc(admin().name) + '</b><small>Admin, siempre en el jurado</small></div><span class="etq ok">En el jurado</span></div>' +
        '<button class="btn oro ancho" style="margin-top:12px" data-acc="sortear">Sortear de nuevo</button></section>';
    }

    if (adminTab === 'reloj') {
      var t = new Date(ahora()), pad = function (n) { return String(n).padStart(2, '0'); };
      var valor = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + 'T' + pad(t.getHours()) + ':' + pad(t.getMinutes());
      h += '<form class="panel" data-form="reloj"><h3>Reloj de prueba</h3><p>Solo para probar en la PoC: simula la hora de la quedada para ver cuándo se desbloquean los retos con hora mínima. Se quita en la versión real.</p>' +
        '<label class="campo"><span>Fecha y hora simuladas</span><input name="t" type="datetime-local" value="' + valor + '" required></label>' +
        '<div class="acciones"><button class="btn oro" type="submit">Simular esta hora</button><button class="btn fantasma" type="button" data-acc="reloj">Volver a la hora real</button></div></form>' +
        '<section class="panel"><h3>Horas mínimas de valoración</h3>' + RETOS.filter(function (x) { return x.desde; }).map(function (x) {
          return '<div class="fila"><div><b>' + x.icono + ' ' + esc(x.titulo) + '</b></div><span class="etq ' + (ahora() >= desdeTs(x) ? 'ok' : 'pend') + '">' + desdeTxt(x) + '</span></div>';
        }).join('') + '<p style="margin-top:10px;font-size:13px">Horas propuestas en <code>data.js</code>, por fijar con el itinerario final.</p></section>';
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
  function render(conservarScroll) {
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
    if (!conservarScroll) window.scrollTo(0, 0);
  }

  /* ---------- acciones ---------- */
  function abrirReto(id) {
    var p = yo(), r = reto(id), f = estadoReto(p.id, id);
    imgPendiente = null;
    var h = '<div class="modal-in"><span class="etq">' + esc(r.franja) + ' · ' + (r.tipo === 'jurado' ? 'lo decide el jurado' : r.tipo) + '</span>' +
      '<h3>' + r.icono + ' ' + esc(r.titulo) + '</h3><p class="pista">' + esc(r.pista) + '</p>' +
      (r.desde ? '<p class="pista"><b>El jurado lo valora desde ' + desdeTxt(r) + '.</b> Puedes subir la foto antes.</p>' : '');
    if (f && f.status !== 'ko') {
      h += '<img class="vista" src="' + f.img + '" alt="Tu foto"><p class="pista"><b>' + (f.status === 'ok' ? 'Validada por el jurado.' : 'Enviada. Esperando al jurado.') + '</b></p>' +
        '<div class="fila-btn"><button class="btn fantasma" data-acc="cerrar">Cerrar</button></div>';
    } else {
      if (f && f.status === 'ko') h += '<p class="pista"><b>El jurado la ha rechazado.</b> Sube otra.</p>';
      h += '<img class="vista" id="vista" alt="" hidden>' +
        '<div class="origen"><label class="btn oro">📷 Hacer foto<input class="archivo" type="file" accept="image/*" capture="environment"></label>' +
        '<label class="btn fantasma">🖼️ Fototeca<input class="archivo" type="file" accept="image/*"></label></div>' +
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
    reto: function (d) { abrirReto(idReto(d.id)); },
    cerrar: function () { $modal.close(); },
    enviar: function (d) {
      var p = yo();
      if (!imgPendiente) return;
      var nueva = { id: p.id + '-' + d.id + '-' + Date.now(), playerId: p.id, retoId: idReto(d.id), status: 'pend', ts: ahora(), img: imgPendiente };
      if (nueva.retoId === 'linea') nueva.fila = Math.max(0, LINEAS.indexOf(lineasCompletas(p.id)[0])); // fila que se canta
      state.photos.push(nueva);
      guardar(); $modal.close(); render();
      toast('Foto enviada. Ahora toca esperar al jurado.');
    },
    aprobar: function (d) { if (!puedeValorar(d.id)) return; cambiarFoto(d.id, 'ok'); toast('Foto validada.'); },
    rechazar: function (d) { if (!puedeValorar(d.id)) return; cambiarFoto(d.id, 'ko'); toast('Foto rechazada.'); },
    ver: function (d) {
      var f = state.photos.filter(function (x) { return x.id === d.fid; })[0];
      if (!f) return;
      $modal.innerHTML = '<div class="modal-in"><h3>' + reto(f.retoId).icono + ' ' + esc(reto(f.retoId).titulo) + '</h3><p class="pista">' + esc(jugador(f.playerId).name) + '</p>' +
        '<img class="vista" src="' + f.img + '" alt="Foto del reto"><div class="fila-btn"><button class="btn fantasma" data-acc="cerrar">Cerrar</button></div></div>';
      if (!$modal.open) $modal.showModal();
    },
    reloj: function (d) { state.offset = 0; guardar(); render(); toast('Reloj en hora real.'); },
    reaccion: function (d) {
      var p = yo(), rs = state.reacciones[d.id] || (state.reacciones[d.id] = {}), lista = rs[d.e] || (rs[d.e] = []);
      var i = lista.indexOf(p.id);
      if (i === -1) lista.push(p.id); else lista.splice(i, 1);
      guardar(); render(true);
    },
    sortear: function () { state.jurado = sortear(state.players); guardar(); render(); toast('Jurado nuevo sorteado.'); },
    demoJurado: function () { state.session = { role: 'jugador', playerId: state.jurado[0] }; guardar(); location.hash = '#/carton'; render(); },
    tab: function (d) { adminTab = d.tab; render(); },
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
  function puedeValorar(id) {
    var f = state.photos.filter(function (x) { return x.id === id; })[0];
    if (f && !valorable(f)) { toast('Todavía no se puede valorar. Espera a ' + desdeTxt(reto(f.retoId)) + '.'); return false; }
    return true;
  }
  function cambiarFoto(id, estado) {
    var quien = nombreJurado();
    state.photos.forEach(function (f) {
      if (f.id !== id) return;
      f.status = estado; f.por = quien;
      // el primer canto validado de cada tipo se lleva el premio
      if (estado === 'ok' && N.CANTOS[f.retoId] && !state.ganadores[f.retoId]) state.ganadores[f.retoId] = f.playerId;
    });
    guardar(); render();
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-acc]');
    if (!el || el.disabled) return;
    var fn = acciones[el.dataset.acc];
    if (fn) { if (el.tagName === 'BUTTON') e.preventDefault(); fn(el.dataset); }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.classList.contains('archivo') || !e.target.files[0]) return;
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
    } else if (tipo === 'reloj') {
      state.offset = new Date(d.get('t')).getTime() - Date.now();
      guardar(); render(); toast('Reloj simulado.');
    } else if (tipo === 'login') {
      var q = state.players.filter(function (x) { return x.token === f.dataset.token; })[0];
      state.session = { role: 'jugador', playerId: q.id };
      guardar(); location.hash = '#/carton'; render();
    }
  });
  window.addEventListener('hashchange', function () { render(); });

  /* ---------- nevada (solo en la pantalla de entrada) ---------- */
  // Cae nieve y, entre los copos, estrellas de hilo, botellitas verdes y cámaras de fotos.
  var nv = { on: false, parts: [], raf: 0, w: 0, h: 0, dpr: 1, sprites: null };

  // Sprites dibujados a mano (vectoriales, sin logos) en un canvas aparte y reutilizados en cada frame.
  function sprite(ancho, alto, dibujo, dpr) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(ancho * dpr); c.height = Math.ceil(alto * dpr);
    var x = c.getContext('2d');
    x.scale(dpr, dpr); x.lineJoin = 'round'; x.lineCap = 'round';
    dibujo(x, ancho, alto);
    return { c: c, w: ancho, h: alto };
  }
  function rect(x, a, b, w, h, r) {
    x.beginPath();
    if (x.roundRect) x.roundRect(a, b, w, h, r);
    else x.rect(a, b, w, h);
  }
  function crearSprites(dpr) {
    return {
      // Estrella de hilo: solo el contorno, como si fuera alambre dorado.
      estrella: sprite(24, 24, function (x) {
        x.strokeStyle = '#F4B93E'; x.lineWidth = 1.5;
        x.beginPath();
        for (var i = 0; i < 10; i++) {
          var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.8 : 10.5;
          x[i ? 'lineTo' : 'moveTo'](12 + r * Math.cos(a), 12 + r * Math.sin(a));
        }
        x.closePath(); x.stroke();
      }, dpr),
      // Botellita verde con etiqueta naranja (genérica, sin marca).
      botella: sprite(14, 30, function (x) {
        x.fillStyle = '#1E6B4A'; rect(x, 2.5, 11, 9, 17, 2.5); x.fill();          // cuerpo
        x.beginPath(); x.moveTo(5.2, 11.5); x.lineTo(5.6, 4); x.lineTo(8.4, 4); x.lineTo(8.8, 11.5); x.closePath(); x.fill(); // cuello
        x.fillStyle = '#16543a'; rect(x, 5, 1.5, 4, 3.5, 1); x.fill();             // tapón
        x.fillStyle = '#F4B93E'; rect(x, 3.4, 16, 7.2, 7, 1); x.fill();            // etiqueta
        x.fillStyle = 'rgba(255,255,255,.35)'; rect(x, 3.6, 12.5, 1.2, 12, .6); x.fill(); // brillo
      }, dpr),
      // Cámara de fotos: cuerpo claro, objetivo oscuro con aro rojo y botón.
      camara: sprite(28, 22, function (x) {
        x.fillStyle = '#d7dfeb'; rect(x, 1.5, 5, 25, 15, 3); x.fill();
        x.fillStyle = '#b6c2d4'; rect(x, 8, 2, 7, 4, 1.2); x.fill();               // visor
        x.fillStyle = '#D4283C'; x.beginPath(); x.arc(22.5, 8.5, 1.6, 0, 6.2832); x.fill(); // botón
        x.fillStyle = '#13233B'; x.beginPath(); x.arc(14, 13, 5.4, 0, 6.2832); x.fill();
        x.strokeStyle = '#D4283C'; x.lineWidth = 1.2; x.beginPath(); x.arc(14, 13, 5.4, 0, 6.2832); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(12.3, 11.3, 1.3, 0, 6.2832); x.fill();
      }, dpr)
    };
  }
  function ajustarNevada() {
    var cv = document.getElementById('nieve');
    nv.w = window.innerWidth; nv.h = window.innerHeight;
    nv.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(nv.w * nv.dpr); cv.height = Math.round(nv.h * nv.dpr);
    return cv.getContext('2d');
  }
  function particula(tipo, arriba) {
    var esSprite = tipo !== 'copo';
    return {
      tipo: tipo, x: Math.random() * nv.w, y: arriba ? -30 : Math.random() * nv.h,
      r: tipo === 'copo' ? 1 + Math.random() * 3 : 0,
      v: esSprite ? .45 + Math.random() * .7 : .4 + Math.random() * 1.1,
      o: Math.random() * 6, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .03,
      e: .85 + Math.random() * .5
    };
  }
  function nieve(on) {
    var cv = document.getElementById('nieve');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) on = false;
    if (on === nv.on) return;
    nv.on = on;
    if (!on) { cancelAnimationFrame(nv.raf); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
    var ctx = ajustarNevada();
    nv.sprites = crearSprites(nv.dpr);
    nv.parts = [];
    var mezcla = { copo: 70, estrella: 9, botella: 5, camara: 5 };
    Object.keys(mezcla).forEach(function (t) { for (var i = 0; i < mezcla[t]; i++) nv.parts.push(particula(t, false)); });
    window.removeEventListener('resize', nv.onResize);
    nv.onResize = function () { if (nv.on) { ctx = ajustarNevada(); nv.sprites = crearSprites(nv.dpr); } };
    window.addEventListener('resize', nv.onResize);
    (function pintar(t) {
      ctx.setTransform(nv.dpr, 0, 0, nv.dpr, 0, 0);
      ctx.clearRect(0, 0, nv.w, nv.h);
      nv.parts.forEach(function (c) {
        c.y += c.v; c.x += Math.sin(t / 1200 + c.o) * (c.tipo === 'copo' ? .4 : .3);
        if (c.y > nv.h + 30) { var n = particula(c.tipo, true); for (var k in n) c[k] = n[k]; }
        if (c.tipo === 'copo') {
          ctx.fillStyle = 'rgba(244,247,251,.85)';
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.2832); ctx.fill();
        } else {
          var sp = nv.sprites[c.tipo], w = sp.w * c.e, h = sp.h * c.e;
          c.rot += c.vr;
          ctx.save(); ctx.globalAlpha = .9; ctx.translate(c.x, c.y); ctx.rotate(c.rot);
          ctx.drawImage(sp.c, -w / 2, -h / 2, w, h); ctx.restore();
        }
      });
      if (nv.on) nv.raf = requestAnimationFrame(pintar);
    })(0);
  }

  // Mide dónde queda la esquina superior izquierda de la N con la fuente que realmente se está usando
  // (Bagel Fat One, o la de reserva si no carga) y expone esa posición al CSS para apoyar ahí el gorro.
  function medirN() {
    try {
      var el = document.querySelector('.logo'), cv = document.createElement('canvas').getContext('2d');
      cv.font = '400 100px ' + getComputedStyle(el || document.body).fontFamily;
      var m = cv.measureText('N');
      if (!m.fontBoundingBoxAscent) return; // navegador sin soporte: valen los valores por defecto del CSS
      var base = ((100 - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent) / 100; // línea base desde arriba (line-height: 1)
      var r = document.documentElement.style;
      r.setProperty('--n-x', (-m.actualBoundingBoxLeft / 100) + 'em');
      r.setProperty('--n-y', (base - m.actualBoundingBoxAscent / 100) + 'em');
      r.setProperty('--n-alto', (m.actualBoundingBoxAscent / 100) + 'em');
    } catch (e) { /* sin medida: se queda la posición por defecto */ }
  }

  state = cargar();
  if (!location.hash) location.hash = state.session ? '#/carton' : '#/entrar';
  render();
  medirN();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirN);
  if (document.fonts && document.fonts.load) document.fonts.load('400 100px "Bagel Fat One"').then(medirN, medirN);
})();
