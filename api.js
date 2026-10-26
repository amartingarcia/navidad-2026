/* NPGingo · cliente mínimo de Supabase (Auth, PostgREST y Storage). Sin dependencias ni build.
   Usa solo la clave publishable de config.js: el acceso real lo limitan las RLS del servidor. */
(function () {
  'use strict';

  var C = window.NPG_CONFIG;
  var SKEY = 'npgingo.sesion';
  var ses = null;

  function leer() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch (e) { return null; } }
  function escribir(s) {
    try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) { /* sin almacenamiento */ }
  }
  ses = leer();

  function error(j, status) {
    var e = new Error((j && (j.message || j.msg || j.error_description || j.error)) || ('Error ' + status));
    e.status = status;
    e.code = j && (j.error_code || j.code);
    return e;
  }

  // Petición cruda. `auth:false` la manda solo con la clave publishable (rol anónimo).
  function req(method, path, o) {
    o = o || {};
    var h = { apikey: C.SUPABASE_KEY };
    if (o.auth !== false && ses) h.Authorization = 'Bearer ' + ses.access_token;
    if (o.json !== undefined) h['Content-Type'] = 'application/json';
    if (o.type) h['Content-Type'] = o.type;
    if (o.prefer) h.Prefer = o.prefer;
    return fetch(C.SUPABASE_URL + path, {
      method: method, headers: h, body: o.json !== undefined ? JSON.stringify(o.json) : o.body
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { /* respuesta sin JSON */ }
        if (!r.ok) throw error(j, r.status);
        return j;
      });
    });
  }

  function guardar(j) {
    ses = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      user_id: (j.user && j.user.id) || (ses && ses.user_id)
    };
    escribir(ses);
    return ses;
  }

  var refrescando = null;
  function refrescar() {
    if (!ses) return Promise.reject(error({ message: 'Sin sesión' }, 401));
    if (!refrescando) {
      refrescando = req('POST', '/auth/v1/token?grant_type=refresh_token', { auth: false, json: { refresh_token: ses.refresh_token } })
        .then(guardar)
        .catch(function (e) { if (e.status === 400 || e.status === 401) { ses = null; escribir(null); } throw e; })
        .then(function (s) { refrescando = null; return s; }, function (e) { refrescando = null; throw e; });
    }
    return refrescando;
  }
  // Renueva el token un minuto antes de que caduque y reintenta una vez si el servidor dice 401.
  function auth(method, path, o) {
    var antes = ses && ses.expires_at - Math.floor(Date.now() / 1000) < 60 ? refrescar() : Promise.resolve();
    return antes.then(function () { return req(method, path, o); }).catch(function (e) {
      if (e.status !== 401 || !ses) throw e;
      return refrescar().then(function () { return req(method, path, o); });
    });
  }

  var URLS = {}; // ruta de storage -> { url, hasta }

  window.NPGAPI = {
    sesion: function () { return ses; },

    login: function (email, pass) {
      return req('POST', '/auth/v1/token?grant_type=password', { auth: false, json: { email: email, password: pass } }).then(guardar);
    },
    // Con la sesión guardada en el navegador: devuelve la sesión vigente o null.
    restaurar: function () {
      if (!ses) return Promise.resolve(null);
      var viva = ses.expires_at - Math.floor(Date.now() / 1000) > 60;
      return (viva ? Promise.resolve(ses) : refrescar()).catch(function (e) {
        if (e.status) return null;  // el servidor la rechaza: sesión caducada
        throw e;                    // sin red: se conserva para reintentar
      });
    },
    salir: function () {
      var p = ses ? req('POST', '/auth/v1/logout', {}).catch(function () { /* da igual */ }) : Promise.resolve();
      ses = null; escribir(null); URLS = {};
      return p;
    },
    cambiarPass: function (nueva) { return auth('PUT', '/auth/v1/user', { json: { password: nueva } }); },

    get: function (tabla, consulta) { return auth('GET', '/rest/v1/' + tabla + '?' + consulta); },
    post: function (tabla, cuerpo) { return auth('POST', '/rest/v1/' + tabla, { json: cuerpo, prefer: 'return=representation' }); },
    del: function (tabla, consulta) { return auth('DELETE', '/rest/v1/' + tabla + '?' + consulta); },
    rpc: function (nombre, args) { return auth('POST', '/rest/v1/rpc/' + nombre, { json: args || {} }); },
    rpcAnonimo: function (nombre, args) { return req('POST', '/rest/v1/rpc/' + nombre, { auth: false, json: args || {} }); },

    subir: function (ruta, blob) { return auth('POST', '/storage/v1/object/fotos/' + ruta, { body: blob, type: 'image/jpeg' }); },
    borrarObjeto: function (ruta) { return auth('DELETE', '/storage/v1/object/fotos/' + ruta).catch(function () { /* mejor esfuerzo */ }); },
    // URLs firmadas (1 h) en lote, con caché: solo pide las que faltan o caducan en menos de 5 min.
    urls: function (rutas) {
      var ahora = Date.now(), faltan = rutas.filter(function (r) { return !URLS[r] || URLS[r].hasta - ahora < 300000; });
      if (!faltan.length) return Promise.resolve(URLS);
      return auth('POST', '/storage/v1/object/sign/fotos', { json: { expiresIn: 3600, paths: faltan } }).then(function (lista) {
        (lista || []).forEach(function (x) {
          if (x && x.signedURL && !x.error) URLS[x.path] = { url: C.SUPABASE_URL + '/storage/v1' + x.signedURL, hasta: ahora + 3600000 };
        });
        return URLS;
      });
    }
  };
})();
