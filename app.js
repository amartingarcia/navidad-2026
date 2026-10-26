/* NPGingo · frontend. Datos y login en Supabase (api.js); aquí solo vistas y reglas de presentación. */
(function () {
  'use strict';

  var N = window.NPG, API = window.NPGAPI;
  var DOMINIO = '@npgingo.local';
  var LINEAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8]]; // solo cuentan filas horizontales
  var $app = document.getElementById('app');
  var $modal = document.getElementById('modal');
  var $toast = document.getElementById('toast');
  var adminTab = 'sorteo';
  var imgPendiente = null;
  var msgPass = '';          // contraseña inicial a incluir en el mensaje de WhatsApp (no se guarda)
  var L = { token: '', nombre: null, estado: '', error: '', ocupado: false }; // pantalla de entrada

  // Estado de juego cargado desde el servidor.
  var S = { cargado: false, me: null, players: [], retos: {}, cartones: {}, jurado: [], photos: [], reacciones: {}, ganadores: { linea: null, bingo: null }, enlaces: {}, firma: '' };

  /* ---------- utilidades ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hora(ts) { return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $toast.classList.remove('on'); }, 3200);
  }
  function msgError(e) {
    if (!e) return 'Algo ha fallado.';
    if (e.status === undefined) return 'Sin conexión con el servidor. Reintenta en un momento.';
    return e.message || 'Algo ha fallado.';
  }
  function urlBg(img) { return 'background-image:url(&quot;' + img + '&quot;)'; }
  function enlace(token) { return location.origin + location.pathname + '#/entrar/' + token; }

  /* ---------- carga de datos ---------- */
  function cargarTodo() {
    var ses = API.sesion();
    return Promise.all([
      API.get('jugadores', 'select=id,nombre,es_admin,cambio_pass&order=nombre'),
      API.get('retos', 'select=id,icono,titulo,franja,tipo,fijo,pista,desde'),
      API.get('cartones', 'select=jugador_id,celdas'),
      API.get('jurado', 'select=jugador_id'),
      API.get('fotos', 'select=id,jugador_id,reto,fila,ruta,estado,creada,valorada_por&order=creada.asc'),
      API.get('reacciones', 'select=foto_id,jugador_id,emoji'),
      API.get('ganadores', 'select=tipo,foto_id'),
      API.get('enlaces', 'select=jugador_id,token')
    ]).then(function (r) {
      var jugadores = r[0], fotos = r[4];
      var yoFila = jugadores.filter(function (j) { return j.id === ses.user_id; })[0];
      if (!yoFila) throw new Error('Tu usuario no tiene ficha de jugador. Avisa al admin.');
      return API.urls(fotos.map(function (f) { return f.ruta; })).then(function (urls) {
        var nuevo = {
          cargado: true,
          me: { id: yoFila.id, name: yoFila.nombre, admin: yoFila.es_admin, cambio: yoFila.cambio_pass },
          players: jugadores.map(function (j) { return { id: j.id, name: j.nombre, admin: j.es_admin, cambio: j.cambio_pass }; }),
          retos: {}, cartones: {}, jurado: r[3].map(function (x) { return x.jugador_id; }), photos: [], reacciones: {},
          ganadores: { linea: null, bingo: null }, enlaces: {}
        };
        r[1].forEach(function (x) { nuevo.retos[x.id] = x; });
        r[2].forEach(function (x) { nuevo.cartones[x.jugador_id] = x.celdas; });
        var nombre = {};
        nuevo.players.forEach(function (p) { nombre[p.id] = p.name; });
        nuevo.photos = fotos.map(function (f) {
          return { id: f.id, playerId: f.jugador_id, retoId: f.reto, fila: f.fila, ruta: f.ruta, status: f.estado,
            ts: Date.parse(f.creada), img: urls[f.ruta] ? urls[f.ruta].url : '', por: f.valorada_por ? nombre[f.valorada_por] : '' };
        });
        r[5].forEach(function (x) {
          var m = nuevo.reacciones[x.foto_id] || (nuevo.reacciones[x.foto_id] = {});
          (m[x.emoji] || (m[x.emoji] = [])).push(x.jugador_id);
        });
        r[6].forEach(function (g) {
          var f = nuevo.photos.filter(function (x) { return x.id === g.foto_id; })[0];
          if (f) nuevo.ganadores[g.tipo] = f.playerId;
        });
        r[7].forEach(function (x) { nuevo.enlaces[x.jugador_id] = x.token; });
        // Huella de lo que se ve (sin las URLs firmadas, que cambian): evita repintar si nada ha cambiado.
        nuevo.firma = JSON.stringify([nuevo.me, nuevo.players, nuevo.cartones, nuevo.jurado, nuevo.reacciones, nuevo.ganadores,
          nuevo.photos.map(function (f) { return [f.id, f.status, f.por]; })]);
        var cambio = nuevo.firma !== S.firma;
        S = nuevo;
        return cambio;
      });
    });
  }

  /* ---------- lógica del juego ---------- */
  function reto(id) {
    return S.retos[String(id)] || { id: String(id), icono: '❔', titulo: 'Reto', franja: '', tipo: 'individual', pista: '' };
  }
  function esCanto(id) { return id === 'linea' || id === 'bingo'; }
  function carton(pid) { return S.cartones[pid] || null; }
  function estadoReto(pid, rid) {
    var orden = { ok: 3, pend: 2, ko: 1 }, mejor = null;
    S.photos.forEach(function (f) {
      if (f.playerId !== pid || f.retoId !== rid) return;
      if (!mejor || orden[f.status] > orden[mejor.status] || (orden[f.status] === orden[mejor.status] && f.ts > mejor.ts)) mejor = f;
    });
    return mejor;
  }
  function lineasCompletas(pid) {
    var c = carton(pid);
    if (!c) return [];
    return LINEAS.filter(function (l) {
      return l.every(function (i) { var f = estadoReto(pid, c[i]); return f && f.status === 'ok'; });
    });
  }
  function sellos(pid) {
    var c = carton(pid);
    return c ? c.filter(function (rid) { var f = estadoReto(pid, rid); return f && f.status === 'ok'; }).length : 0;
  }
  function jugador(id) { return S.players.filter(function (p) { return p.id === id; })[0] || { id: id, name: '?' }; }
  function yo() { return S.me; }
  function soyAdmin() { return !!S.me && S.me.admin; }
  function esJurado(pid) { var p = jugador(pid); return S.jurado.indexOf(pid) !== -1 || !!p.admin; }
  function soyJurado() { return !!S.me && esJurado(S.me.id); }
  function numero(pid) { return S.players.map(function (p) { return p.id; }).indexOf(pid) + 1; }
  function pendientes(excluirPid) {
    return S.photos.filter(function (f) { return f.status === 'pend' && f.playerId !== excluirPid; })
      .sort(function (a, b) { return a.ts - b.ts; });
  }
  // Hora mínima de valoración: la comprueba el servidor; aquí solo se avisa en pantalla.
  function desdeTs(r) { return r && r.desde ? Date.parse(r.desde) : null; }
  function desdeTxt(r) {
    var t = new Date(desdeTs(r)), dia = new Date(N.EVENTO.fecha + 'T00:00:00');
    var otro = t.toDateString() !== dia.toDateString();
    return 'las ' + hora(t) + (otro ? ' del ' + t.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '') : '');
  }
  function valorable(f) { var t = desdeTs(reto(f.retoId)); return t === null || Date.now() >= t; }
  function dias() { return Math.ceil((new Date(N.EVENTO.fecha + 'T00:00:00') - new Date()) / 86400000); }

  function listaPendientes(excluirPid) {
    var pend = pendientes(excluirPid).sort(function (a, b) { return (valorable(b) ? 1 : 0) - (valorable(a) ? 1 : 0); });
    if (!pend.length) return '<div class="vacio">No hay fotos por validar. Descansa un rato.</div>';
    return '<div class="muro">' + pend.map(function (f) {
      var r = reto(f.retoId), pid = f.playerId, rev = '', libre = valorable(f);
      if (r.tipo === 'canto') {
        var c = carton(pid) || [], ids = r.id === 'linea' ? LINEAS[f.fila || 0].map(function (i) { return c[i]; }) : c;
        rev = '<p class="rev-tit">Revisa ' + (r.id === 'linea' ? 'las 3 fotos de la fila' : 'las 9 fotos del cartón') + '. Toca una para verla grande.</p><div class="rev">' +
          ids.map(function (rid) {
            var g = estadoReto(pid, rid);
            return g ? '<button class="rev-foto" data-acc="ver" data-fid="' + esc(g.id) + '"><img src="' + esc(g.img) + '" alt=""><span>' + esc(reto(rid).titulo) + '</span></button>' : '';
          }).join('') + '</div>';
      }
      return '<figure class="foto-card"><img src="' + esc(f.img) + '" alt="' + esc(r.titulo) + '">' +
        '<figcaption><b>' + esc(jugador(f.playerId).name) + '</b> · ' + esc(r.titulo) + '<br><small>' + esc(r.pista) + '</small>' + rev + '</figcaption>' +
        (libre
          ? '<div class="acc"><button class="btn mini" data-acc="aprobar" data-id="' + esc(f.id) + '">Validar</button>' +
            '<button class="btn mini fantasma" data-acc="rechazar" data-id="' + esc(f.id) + '">Rechazar</button></div>'
          : '<p class="bloqueo">🔒 Se puede valorar desde ' + desdeTxt(r) + '</p>') + '</figure>';
    }).join('') + '</div>';
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
    }).join('') + '<a href="#/salir"><span aria-hidden="true">🚪</span>Salir</a></div></nav>';
  }

  /* ----- pantallas de entrada: solo el logo y lo imprescindible ----- */
  function errorL() { return L.error ? '<p class="error" role="alert">' + esc(L.error) + '</p>' : ''; }
  function entrada(cuerpo) {
    return '<main class="entrada">' + logo() + '<p class="lema">No preguntes, gilipollas · Bingo de Navidad</p>' + cuerpo + '</main>';
  }
  function vPortada() {
    return entrada('<section class="panel"><button class="btn oro ancho" data-acc="verAcceso">Entrar como administrador</button></section>');
  }
  function vAcceso() {
    return entrada('<form class="panel" data-form="admin"><h2>Administrador</h2>' +
      '<label class="campo"><span>Email</span><input name="e" type="email" autocomplete="username" value="' + esc(L.email || '') + '" required></label>' +
      '<label class="campo"><span>Contraseña</span><input name="a" type="password" autocomplete="current-password" required></label>' + errorL() +
      '<button class="btn oro ancho" type="submit"' + (L.ocupado ? ' disabled' : '') + '>' + (L.ocupado ? 'Entrando…' : 'Entrar') + '</button>' +
      '<button class="btn fantasma ancho" type="button" data-acc="volver" style="margin-top:10px">Volver</button></form>');
  }
  function vToken(tok) {
    if (L.token !== tok || L.cargando) return entrada('<section class="panel"><p>Comprobando tu enlace…</p></section>');
    if (!L.nombre) {
      return entrada('<section class="panel"><h2>Este enlace no vale</h2><p>' + (L.error ? esc(L.error) : 'Puede que esté mal copiado o que el admin lo haya cambiado. Pídele uno nuevo.') + '</p></section>');
    }
    return entrada('<form class="panel" data-form="login" data-token="' + esc(tok) + '"><h2>Hola, ' + esc(L.nombre) + '</h2>' +
      (L.estado === 'primera' ? '<p>Si es tu primera vez, entra con la contraseña inicial que te ha pasado el admin. Después tendrás que elegir la tuya.</p>' : '') +
      '<label class="campo"><span>Contraseña</span><input name="a" type="password" autocomplete="current-password" required></label>' + errorL() +
      '<button class="btn oro ancho" type="submit"' + (L.ocupado ? ' disabled' : '') + '>' + (L.ocupado ? 'Entrando…' : 'Entrar') + '</button></form>');
  }
  function vClave() {
    return entrada('<form class="panel" data-form="clave"><h2>Hola, ' + esc(S.me.name) + '</h2>' +
      '<p>Elige tu contraseña. Tiene que ser distinta de la inicial y tener al menos 4 caracteres.</p>' +
      '<label class="campo"><span>Contraseña nueva</span><input name="a" type="password" minlength="4" autocomplete="new-password" required></label>' +
      '<label class="campo"><span>Repite la contraseña</span><input name="b" type="password" minlength="4" autocomplete="new-password" required></label>' + errorL() +
      '<button class="btn oro ancho" type="submit"' + (L.ocupado ? ' disabled' : '') + '>' + (L.ocupado ? 'Guardando…' : 'Guardar y entrar') + '</button>' +
      '<button class="btn fantasma ancho" type="button" data-acc="salirYa" style="margin-top:10px">Salir</button></form>');
  }
  function vCargando() { return entrada('<section class="panel"><p>Cargando…</p></section>'); }

  /* ----- juego ----- */
  function banner() {
    var g = S.ganadores, t = '';
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
    if (!c) {
      return h + '<section class="panel"><h2>Tu cartón está en camino</h2><p>' + (p.admin
        ? 'Aún no has repartido los cartones. Hazlo desde Admin.'
        : 'El admin todavía no ha repartido los cartones. Vuelve en un rato.') + '</p></section>';
    }
    h += '<article class="ticket"><div class="ticket-top"><div><h2>Cartón de ' + esc(p.name) + '</h2><small>Quedada de Navidad · 26 dic 2026</small></div>' +
      '<div class="serie" aria-label="Número de cartón">Nº ' + String(numero(p.id)).padStart(3, '0') + '</div></div><div class="perf"></div>' +
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
      h += '<button class="' + cls + '" data-acc="reto" data-id="' + esc(rid) + '" aria-label="' + esc(r.titulo + etiqueta) + '">' +
        (f && f.img ? '<span class="foto" style="' + urlBg(f.img) + '"></span>' : '') +
        '<span class="ico" aria-hidden="true">' + r.icono + '</span><span class="tit">' + esc(r.titulo) + '</span>' + sello + '</button>';
      if (i % 3 === 2) h += '</div>';
    });
    h += '</div></article><div class="acciones">';
    function botonCanto(tipo, texto) {
      var f = estadoReto(p.id, tipo);
      if (f && f.status === 'pend') return '<button class="btn oro" disabled>' + texto[1] + '</button>';
      return '<button class="btn oro" data-acc="reto" data-id="' + tipo + '">' + (f && f.status === 'ko' ? texto[2] : texto[0]) + '</button>';
    }
    if (n === 9 && !S.ganadores.bingo) {
      h += botonCanto('bingo', ['¡Cantar bingo con foto!', 'Bingo enviado. El jurado lo está mirando', 'Repetir la foto del bingo']);
    } else if (lineas.length && !S.ganadores.linea) {
      h += botonCanto('linea', ['¡Cantar línea con foto!', 'Línea enviada. El jurado la está mirando', 'Repetir la foto de la línea']);
    }
    h += '</div>';
    return h;
  }

  function barraReacciones(f) {
    var yoId = yo().id, rs = S.reacciones[f.id] || {};
    return '<div class="reacciones" role="group" aria-label="Reacciones">' + N.REACCIONES.map(function (e) {
      var quienes = rs[e] || [], mia = quienes.indexOf(yoId) !== -1;
      return '<button class="reac" data-acc="reaccion" data-id="' + esc(f.id) + '" data-e="' + e + '" aria-pressed="' + mia + '" aria-label="' + e + ', ' + quienes.length + '">' +
        '<span aria-hidden="true">' + e + '</span>' + (quienes.length ? '<b>' + quienes.length + '</b>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function vMuro() {
    var oks = S.photos.filter(function (f) { return f.status === 'ok'; }).sort(function (a, b) { return b.ts - a.ts; });
    if (!oks.length) return '<div class="vacio">Aún no hay fotos validadas. La primera la sube alguien con valor.</div>';
    return '<div class="muro">' + oks.map(function (f) {
      var r = reto(f.retoId);
      return '<figure class="foto-card"><img src="' + esc(f.img) + '" alt="' + esc(r.titulo) + '" loading="lazy">' +
        '<figcaption><b>' + esc(jugador(f.playerId).name) + '</b> · ' + esc(r.titulo) + ' · ' + hora(f.ts) + (f.por ? '<br><small>Validada por ' + esc(f.por) + '</small>' : '') + '</figcaption>' + barraReacciones(f) + '</figure>';
    }).join('') + '</div>';
  }

  function vJurado() {
    return '<section class="panel"><h2>Eres del jurado</h2><p>Sois 3: dos jugadores sorteados y el admin. Valida las fotos de tus colegas, también las de línea y bingo. Las tuyas las valida otra persona del jurado. Si dudas, rechaza y que la repitan.</p></section>' +
      listaPendientes(yo().id);
  }

  function vAdmin() {
    var tabs = [['sorteo', 'Jurado y cartones'], ['enlaces', 'Enlaces']];
    var h = '<div class="segmento" role="group" aria-label="Secciones del admin">' + tabs.map(function (t) {
      return '<button data-acc="tab" data-tab="' + t[0] + '" aria-pressed="' + (adminTab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    if (adminTab === 'sorteo') {
      var adm = S.players.filter(function (p) { return p.admin; })[0];
      var sorteados = S.jurado.filter(function (id) { return !jugador(id).admin; });
      var repartidos = Object.keys(S.cartones).length;
      h += '<section class="panel"><h3>Jurado de la quedada</h3><p>Dos jugadores al azar, más tú como admin (sois 3 en total). Los tres validan las fotos de los demás, incluidas las de línea y bingo, nunca las suyas. Los elegidos ven un banner en su cartón.</p>' +
        (sorteados.length ? sorteados.map(function (id) {
          return '<div class="fila"><div><b>' + esc(jugador(id).name) + '</b><small>Jugador sorteado</small></div><span class="etq ok">En el jurado</span></div>';
        }).join('') : '<div class="fila"><div><b>Sin sortear</b><small>Todavía no hay jugadores en el jurado</small></div><span class="etq pend">Pendiente</span></div>') +
        '<div class="fila"><div><b>' + esc(adm ? adm.name : 'Admin') + '</b><small>Admin, siempre en el jurado</small></div><span class="etq ok">En el jurado</span></div>' +
        '<button class="btn oro ancho" style="margin-top:12px" data-acc="sortear">' + (sorteados.length ? 'Sortear de nuevo' : 'Sortear jurado') + '</button></section>' +
        '<section class="panel"><h3>Cartones</h3><p>Cada jugador tiene un único cartón fijo: la casilla central es el manteo y las otras 8 salen al azar del pool. Se reparten una sola vez.</p>' +
        '<div class="fila"><div><b>' + repartidos + ' de ' + S.players.length + '</b><small>cartones repartidos</small></div><span class="etq ' + (repartidos ? 'ok' : 'pend') + '">' + (repartidos ? 'Repartidos' : 'Pendiente') + '</span></div>' +
        (repartidos
          ? '<button class="btn fantasma ancho" style="margin-top:12px" data-acc="rehacer">Rehacer cartones (borra el progreso)</button>'
          : '<button class="btn oro ancho" style="margin-top:12px" data-acc="repartir">Repartir cartones</button>') + '</section>';
    }

    if (adminTab === 'enlaces') {
      h += '<section class="panel"><h3>Enlaces personales</h3><p>Cada jugador entra con el suyo. Envíaselo por WhatsApp desde aquí. La contraseña inicial no se guarda en la web: si quieres que vaya en el mensaje, escríbela abajo (solo se usa en este momento).</p>' +
        '<label class="campo"><span>Contraseña inicial (opcional, para el mensaje)</span><input data-msgpass type="text" autocomplete="off" value="' + esc(msgPass) + '"></label>' +
        S.players.filter(function (p) { return !p.admin && S.enlaces[p.id]; }).map(function (p) {
          return '<div class="fila"><div><b>' + esc(p.name) + '</b><small>' + (p.cambio ? 'Aún no ha puesto su contraseña' : 'Ya tiene su contraseña') + '</small></div>' +
            '<div class="btns"><button class="btn mini" data-acc="wa" data-id="' + esc(p.id) + '">WhatsApp</button>' +
            '<button class="btn mini fantasma" data-acc="copiar" data-id="' + esc(p.id) + '">Copiar</button>' +
            '<button class="btn mini fantasma" data-acc="resetear" data-id="' + esc(p.id) + '">Resetear</button></div></div>';
        }).join('') + '</section>';
    }
    return h;
  }

  /* ---------- router ---------- */
  function ruta() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    return { nombre: h[0] || '', arg: h[1] || '' };
  }
  function resolverToken(tok) {
    L = { token: tok, nombre: null, estado: 'primera', error: '', ocupado: false, cargando: true };
    API.rpcAnonimo('nombre_por_token', { p_token: tok }).then(function (n) {
      L.nombre = n || null; L.cargando = false; render();
    }, function (e) {
      L.error = msgError(e); L.cargando = false; render();
    });
  }
  function render(conservarScroll) {
    var r = ruta(), ses = API.sesion();
    if (r.nombre === 'salir') { salir(); return; }

    // Enlace personal: siempre muestra el acceso de esa persona, aunque haya otra sesión abierta.
    if (r.nombre === 'entrar' && r.arg) {
      nieve(true);
      if (L.token !== r.arg) resolverToken(r.arg);
      $app.innerHTML = vToken(r.arg);
      return;
    }
    if (!ses) {
      if (r.nombre !== 'acceso' && !(r.nombre === 'entrar')) { location.hash = '#/entrar'; return; }
      nieve(true);
      $app.innerHTML = r.nombre === 'acceso' ? vAcceso() : vPortada();
      return;
    }
    if (!S.cargado) { nieve(false); $app.innerHTML = vCargando(); return; }
    if (S.me.cambio) { nieve(true); $app.innerHTML = vClave(); return; }
    if (['', 'entrar', 'acceso', 'clave'].indexOf(r.nombre) !== -1) { location.hash = '#/carton'; return; }

    nieve(false);
    var nombre = r.nombre;
    if (nombre === 'admin' && !soyAdmin()) nombre = 'carton';
    if (nombre === 'jurado' && !soyJurado()) nombre = 'carton';
    var vistas = { carton: vCarton, muro: vMuro, admin: vAdmin, jurado: vJurado };
    $app.innerHTML = cabecera() + (vistas[nombre] || vCarton)() + nav(nombre);
    if (!conservarScroll) window.scrollTo(0, 0);
  }

  /* ---------- sesión ---------- */
  var poll = 0, subiendo = false;
  function traducir(e) {
    var m = e && e.message || '';
    if (e && e.status === undefined) return msgError(e);
    if (/different from the old/i.test(m)) return 'Tiene que ser distinta de la contraseña actual.';
    if (/at least|weak|pwned|easy to guess/i.test(m)) return 'Esa contraseña no es válida: prueba con otra más larga o menos típica.';
    if (/row-level security/i.test(m)) return 'No puedes hacer eso ahora mismo.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un minuto.';
    return m || 'Algo ha fallado.';
  }
  function arrancar() {
    L.ocupado = false; L.error = '';
    return cargarTodo().then(function () {
      var r = ruta();
      if (S.me.cambio) location.hash = '#/clave';
      else if (['', 'entrar', 'acceso', 'clave'].indexOf(r.nombre) !== -1) location.hash = '#/carton';
      clearInterval(poll); poll = setInterval(refrescar, 12000);
      render();
    }).catch(function (e) {
      toast(traducir(e)); return API.salir().then(function () { render(); });
    });
  }
  function refrescar() {
    if (document.hidden || !API.sesion() || !S.cargado || $modal.open || subiendo) return;
    cargarTodo().then(function (cambio) {
      var a = document.activeElement;
      if (cambio && !(a && $app.contains(a) && /INPUT|TEXTAREA/.test(a.tagName))) render(true);
    }).catch(function () { if (!API.sesion()) render(); });
  }
  function salir() {
    clearInterval(poll);
    return API.salir().then(function () {
      S = { cargado: false, me: null, players: [], retos: {}, cartones: {}, jurado: [], photos: [], reacciones: {}, ganadores: { linea: null, bingo: null }, enlaces: {}, firma: '' };
      L = { token: '', nombre: null, estado: '', error: '', ocupado: false };
      msgPass = '';
      location.hash = '#/entrar'; render();
    });
  }

  /* ---------- acciones ---------- */
  function abrirReto(id) {
    var p = yo(), r = reto(id), f = estadoReto(p.id, id);
    imgPendiente = null;
    var h = '<div class="modal-in"><span class="etq">' + esc(r.franja) + ' · ' + (r.tipo === 'jurado' ? 'lo decide el jurado' : r.tipo) + '</span>' +
      '<h3>' + r.icono + ' ' + esc(r.titulo) + '</h3><p class="pista">' + esc(r.pista) + '</p>' +
      (r.desde ? '<p class="pista"><b>El jurado lo valora desde ' + desdeTxt(r) + '.</b> Puedes subir la foto antes.</p>' : '');
    if (f && f.status !== 'ko') {
      h += '<img class="vista" src="' + esc(f.img) + '" alt="Tu foto"><p class="pista"><b>' + (f.status === 'ok' ? 'Validada por el jurado.' : 'Enviada. Esperando al jurado.') + '</b></p>' +
        '<div class="fila-btn"><button class="btn fantasma" data-acc="cerrar">Cerrar</button></div>';
    } else {
      if (f && f.status === 'ko') h += '<p class="pista"><b>El jurado la ha rechazado.</b> Sube otra.</p>';
      h += '<img class="vista" id="vista" alt="" hidden>' +
        '<div class="origen"><label class="btn oro">📷 Hacer foto<input class="archivo" type="file" accept="image/*" capture="environment"></label>' +
        '<label class="btn fantasma">🖼️ Fototeca<input class="archivo" type="file" accept="image/*"></label></div>' +
        '<div class="fila-btn"><button class="btn fantasma" data-acc="cerrar">Cancelar</button>' +
        '<button class="btn" id="enviar" data-acc="enviar" data-id="' + esc(id) + '" disabled>Enviar foto</button></div>';
    }
    $modal.innerHTML = h + '</div>';
    if (!$modal.open) $modal.showModal();
  }
  // Reduce la foto a 1280 px y JPEG: pesa unos cientos de KB y cabe de sobra en el límite del bucket (2 MB).
  function comprimir(file, cb) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var max = 1280, k = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { if (b) cb(b); else toast('Esa imagen no se puede procesar. Prueba con otra.'); }, 'image/jpeg', 0.75);
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('Esa imagen no se puede leer. Prueba con otra.'); };
    img.src = url;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function recargar(mensaje) {
    return cargarTodo().then(function () { render(true); if (mensaje) toast(mensaje); });
  }
  function valorar(id, ok) {
    var f = S.photos.filter(function (x) { return x.id === id; })[0];
    if (f && !valorable(f)) { toast('Todavía no se puede valorar. Espera a ' + desdeTxt(reto(f.retoId)) + '.'); return; }
    API.rpc('valorar', { p_foto: id, p_ok: ok })
      .then(function () { return recargar(ok ? 'Foto validada.' : 'Foto rechazada.'); })
      .catch(function (e) { toast(traducir(e)); recargar().catch(function () {}); });
  }
  function textoWa(p) {
    var t = 'Hola ' + p.name + '! Este es tu enlace personal para NPGingo, el bingo de la quedada de Navidad (26 dic): ' + enlace(S.enlaces[p.id]);
    return t + (msgPass ? '\nContraseña inicial: ' + msgPass + '. Al entrar te pedirá cambiarla.' : '\nAl entrar te pedirá la contraseña inicial y que elijas la tuya.');
  }

  var acciones = {
    verAcceso: function () { L.error = ''; location.hash = '#/acceso'; },
    volver: function () { L.error = ''; location.hash = '#/entrar'; },
    salirYa: function () { salir(); },
    reto: function (d) { abrirReto(d.id); },
    cerrar: function () { $modal.close(); },
    enviar: function (d) {
      var p = yo(), id = d.id;
      if (!imgPendiente || subiendo) return;
      subiendo = true;
      var btn = document.getElementById('enviar'); btn.disabled = true; btn.textContent = 'Enviando…';
      var fila = id === 'linea' ? Math.max(0, LINEAS.indexOf(lineasCompletas(p.id)[0])) : null;
      var viejas = S.photos.filter(function (f) { return f.playerId === p.id && f.retoId === id && f.status === 'ko'; });
      var ruta = p.id + '/' + uuid() + '.jpg';
      var paso = viejas.length ? API.del('fotos', 'jugador_id=eq.' + p.id + '&reto=eq.' + encodeURIComponent(id) + '&estado=eq.ko') : Promise.resolve();
      paso.then(function () { return API.subir(ruta, imgPendiente.blob); })
        .then(function () { return API.post('fotos', { jugador_id: p.id, reto: id, fila: fila, ruta: ruta }); })
        .then(function () { viejas.forEach(function (v) { API.borrarObjeto(v.ruta); }); return cargarTodo(); })
        .then(function () { subiendo = false; $modal.close(); render(true); toast('Foto enviada. Ahora toca esperar al jurado.'); })
        .catch(function (e) { subiendo = false; toast(traducir(e)); btn.disabled = false; btn.textContent = 'Enviar foto'; });
    },
    aprobar: function (d) { valorar(d.id, true); },
    rechazar: function (d) { valorar(d.id, false); },
    ver: function (d) {
      var f = S.photos.filter(function (x) { return x.id === d.fid; })[0];
      if (!f) return;
      $modal.innerHTML = '<div class="modal-in"><h3>' + reto(f.retoId).icono + ' ' + esc(reto(f.retoId).titulo) + '</h3><p class="pista">' + esc(jugador(f.playerId).name) + '</p>' +
        '<img class="vista" src="' + esc(f.img) + '" alt="Foto del reto"><div class="fila-btn"><button class="btn fantasma" data-acc="cerrar">Cerrar</button></div></div>';
      if (!$modal.open) $modal.showModal();
    },
    reaccion: function (d) {
      var p = yo(), rs = S.reacciones[d.id] || (S.reacciones[d.id] = {}), lista = rs[d.e] || (rs[d.e] = []);
      var i = lista.indexOf(p.id), quitar = i !== -1;
      if (quitar) lista.splice(i, 1); else lista.push(p.id);
      render(true);
      var op = quitar
        ? API.del('reacciones', 'foto_id=eq.' + encodeURIComponent(d.id) + '&jugador_id=eq.' + p.id + '&emoji=eq.' + encodeURIComponent(d.e))
        : API.post('reacciones', { foto_id: d.id, jugador_id: p.id, emoji: d.e });
      op.catch(function (e) { toast(traducir(e)); return recargar(); }).catch(function () {});
    },
    tab: function (d) { adminTab = d.tab; render(); },
    sortear: function () {
      API.rpc('sortear_jurado').then(function () { return recargar('Jurado sorteado.'); }).catch(function (e) { toast(traducir(e)); });
    },
    repartir: function () {
      API.rpc('repartir_cartones', { p_forzar: false }).then(function (n) { return recargar('Cartones repartidos: ' + n + '.'); }).catch(function (e) { toast(traducir(e)); });
    },
    rehacer: function () {
      if (!confirm('Esto borra los cartones actuales y deja a todos sin sellos. ¿Seguro?')) return;
      API.rpc('repartir_cartones', { p_forzar: true }).then(function (n) { return recargar('Cartones rehechos: ' + n + '.'); }).catch(function (e) { toast(traducir(e)); });
    },
    wa: function (d) {
      var p = jugador(d.id);
      if (!S.enlaces[p.id]) return;
      window.open('https://wa.me/?text=' + encodeURIComponent(textoWa(p)), '_blank', 'noopener');
    },
    copiar: function (d) {
      var p = jugador(d.id), url = S.enlaces[p.id] ? enlace(S.enlaces[p.id]) : '';
      if (!url) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast('Enlace de ' + p.name + ' copiado.'); }, function () { toast(url); });
      } else { toast(url); }
    },
    resetear: function (d) {
      var p = jugador(d.id);
      if (!confirm('Esto devuelve la contraseña de ' + p.name + ' a la inicial y le obliga a elegir otra. ¿Seguro?')) return;
      API.rpc('resetear_pass', { p_jugador: p.id }).then(function () { return recargar('Contraseña de ' + p.name + ' reseteada.'); }).catch(function (e) { toast(traducir(e)); });
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-acc]');
    if (!el || el.disabled) return;
    var fn = acciones[el.dataset.acc];
    if (fn) { if (el.tagName === 'BUTTON') e.preventDefault(); fn(el.dataset); }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.classList.contains('archivo') || !e.target.files[0]) return;
    comprimir(e.target.files[0], function (blob) {
      if (imgPendiente) URL.revokeObjectURL(imgPendiente.url);
      imgPendiente = { blob: blob, url: URL.createObjectURL(blob) };
      var v = document.getElementById('vista');
      v.src = imgPendiente.url; v.hidden = false;
      document.getElementById('enviar').disabled = false;
    });
  });
  document.addEventListener('input', function (e) {
    if (e.target.hasAttribute('data-msgpass')) msgPass = e.target.value;
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    var tipo = f.dataset.form, d = new FormData(f);
    if (L.ocupado) return;
    if (tipo === 'login' || tipo === 'admin') {
      var email = tipo === 'login' ? f.dataset.token + DOMINIO : String(d.get('e')).trim();
      if (tipo === 'admin') L.email = email;
      L.ocupado = true; L.error = ''; render();
      API.login(email, String(d.get('a'))).then(arrancar).catch(function (err) {
        L.ocupado = false;
        L.error = err.status === 400 ? (tipo === 'login' ? 'Contraseña incorrecta.' : 'Email o contraseña incorrectos.') : traducir(err);
        render();
      });
    } else if (tipo === 'clave') {
      var a = String(d.get('a')), b = String(d.get('b'));
      if (a !== b) { L.error = 'Las contraseñas no coinciden.'; render(); return; }
      if (a.length < 4) { L.error = 'Mínimo 4 caracteres.'; render(); return; }
      L.ocupado = true; L.error = ''; render();
      API.cambiarPass(a).then(function () { return API.rpc('pass_cambiada'); })
        .then(function () { return cargarTodo(); })
        .then(function () { L.ocupado = false; location.hash = '#/carton'; render(); })
        .catch(function (err) { L.ocupado = false; L.error = traducir(err); render(); });
    }
  });
  window.addEventListener('hashchange', function () { render(); refrescar(); }); // al cambiar de sección se piden datos frescos
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refrescar(); });

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

  /* ---------- arranque ---------- */
  if (!location.hash) location.hash = '#/entrar';
  render();
  API.restaurar().then(function (ses) {
    if (ses) return arrancar();
    render();
  }).catch(function (e) { toast(traducir(e)); render(); });
  medirN();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirN);
  if (document.fonts && document.fonts.load) document.fonts.load('400 100px "Bagel Fat One"').then(medirN, medirN);
})();
