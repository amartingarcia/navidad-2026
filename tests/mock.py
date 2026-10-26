"""In-memory stand-in for Supabase (GoTrue + PostgREST + Storage) mirroring supabase/schema.sql rules."""
import json, re, time, uuid, random, base64, io
from urllib.parse import urlparse, parse_qs, unquote

DEFAULT_PASS = 'inicial-demo'
RETOS = {
 '1':('🥃','2 chupitos de Jäger antes de las 18:00','individual',False,None),
 '2':('🪂','Manteo a Maritsu','grupal',True,None),
 '3':('😁','Foto con Jose, de Bar La Plaza, sonriendo','individual',False,None),
 '4':('💋','Pico a un chico','individual',False,None),
 '5':('💋','Pico a una chica','individual',False,None),
 '6':('🔥','Foto al pibón de la noche','jurado',False,'2099-12-27T12:00:00+00:00'),
 '7':('🐴','Montar a borriquito a Angelines','individual',False,None),
 '8':('🏆','Mejor atuendo del día','jurado',False,None),
 '9':('💩','Peor atuendo del día','jurado',False,None),
 '10':('📝','Teléfono en una servilleta','individual',False,None),
 '11':('🎤','Cantar Mané Mané','grupal',False,None),
 '12':('💡','Encender las luces','individual',False,None),
 'linea':('🎯','¡Línea!','canto',False,None),
 'bingo':('🏁','¡Bingo!','canto',False,None),
}
JPEG = None
def jpeg():
    global JPEG
    if JPEG is None:
        from PIL import Image
        b = io.BytesIO(); Image.new('RGB',(40,30),(200,40,60)).save(b,'JPEG'); JPEG = b.getvalue()
    return JPEG

class Mock:
    def __init__(self):
        self.users = {}; self.tokens = {}; self.jug = {}; self.enl = {}
        self.cartones = {}; self.jurado = []; self.fotos = []; self.reac = []; self.gan = {}
        self.storage = {}; self.ajustes = {'pass_defecto': DEFAULT_PASS}; self.log = []
        self.add('adrianmg231189@gmail.com','Adrián',True,'AdminPass-12345')
        for i,n in enumerate(['Andrés','Amós','Casillas','Chuchi','Dani Ligero']):
            self.add(f'tok{i}@npgingo.local',n,False,DEFAULT_PASS)
    def add(self,email,nombre,admin,pw):
        uid = str(uuid.uuid4()); self.users[uid]={'email':email,'pass':pw}
        self.jug[uid]={'id':uid,'nombre':nombre,'es_admin':admin,'cambio_pass':email.endswith('@npgingo.local')}
        if email.endswith('@npgingo.local'): self.enl[uid]=email.split('@')[0]
        return uid
    def uid_by_name(self,n): return [k for k,v in self.jug.items() if v['nombre']==n][0]
    def admin(self,uid): return self.jug[uid]['es_admin']
    def jury(self,uid): return uid in self.jurado
    # --- handlers return (status, body, content_type)
    def handle(self, method, url, headers, body):
        u = urlparse(url); path = u.path; q = parse_qs(u.query)
        auth = headers.get('authorization',''); uid = self.tokens.get(auth.replace('Bearer ','')) if auth.startswith('Bearer ') else None
        self.log.append((method,path))
        try:
            if path=='/auth/v1/token':
                d = json.loads(body)
                if q['grant_type'][0]=='password':
                    for k,v in self.users.items():
                        if v['email']==d['email'] and v['pass']==d['password']: return self.session(k)
                    return 400,{'error_code':'invalid_credentials','msg':'Invalid login credentials'}
                if q['grant_type'][0]=='refresh_token':
                    k = d['refresh_token'].replace('rf-','')
                    return self.session(k) if k in self.users else (400,{'msg':'bad refresh'})
            if path=='/auth/v1/user' and method=='PUT':
                if not uid: return 401,{'msg':'no auth'}
                p = json.loads(body)['password']
                if p==self.users[uid]['pass']: return 422,{'error_code':'same_password','msg':'New password should be different from the old password.'}
                self.users[uid]['pass']=p; return 200,{'id':uid}
            if path=='/auth/v1/logout': return 204,None
            m = re.match(r'/rest/v1/rpc/(\w+)',path)
            if m: return self.rpc(m.group(1),json.loads(body or '{}'),uid)
            m = re.match(r'/rest/v1/(\w+)',path)
            if m: return self.table(method,m.group(1),q,body,uid)
            m = re.match(r'/storage/v1/object/fotos/(.+)',path)
            if m and method=='POST':
                p = unquote(m.group(1))
                if not uid or p.split('/')[0]!=uid: return 403,{'message':'new row violates row-level security policy'}
                self.storage[p]=body; return 200,{'Key':'fotos/'+p}
            if m and method=='DELETE': self.storage.pop(unquote(m.group(1)),None); return 200,{}
            if path=='/storage/v1/object/sign/fotos':
                if not uid: return 401,{'message':'no auth'}
                d = json.loads(body); out=[]
                for p in d['paths']:
                    out.append({'path':p,'signedURL':f'/object/sign/fotos/{p}?token=t'})
                return 200,out
            m = re.match(r'/storage/v1/object/sign/fotos/(.+)',path)
            if m: return 200,'JPEG'
        except AssertionError as e:
            return 403,{'message':str(e)}
        return 404,{'message':'not mocked '+path}
    def session(self,k):
        t = 'tk-'+uuid.uuid4().hex[:8]; self.tokens[t]=k
        return 200,{'access_token':t,'refresh_token':'rf-'+k,'expires_in':3600,'expires_at':int(time.time())+3600,'user':{'id':k}}
    def visible_foto(self,f,uid): return f['jugador_id']==uid or f['estado']=='ok' or self.jury(uid)
    def table(self,method,t,q,body,uid):
        if not uid: return 401,{'message':'permission denied'}
        if method=='GET':
            data = {
              'jugadores': list(self.jug.values()),
              'retos': [{'id':k,'icono':v[0],'titulo':v[1],'franja':'x','tipo':v[2],'fijo':v[3],'pista':'pista '+k,'desde':v[4]} for k,v in RETOS.items()],
              'cartones': [{'jugador_id':k,'celdas':v} for k,v in self.cartones.items()],
              'jurado': [{'jugador_id':k} for k in self.jurado],
              'fotos': [f for f in self.fotos if self.visible_foto(f,uid)],
              'reacciones': self.reac,
              'ganadores': [{'tipo':k,'foto_id':v} for k,v in self.gan.items()],
              'enlaces': [{'jugador_id':k,'token':v} for k,v in self.enl.items()] if self.admin(uid) else [],
            }[t]
            return 200,data
        if method=='POST' and t=='fotos':
            d = json.loads(body); assert d['jugador_id']==uid and d['ruta'].startswith(uid+'/'),'new row violates row-level security policy for table "fotos"'
            c = self.cartones.get(uid,[])
            if d['reto'] in ('linea','bingo'): assert self.puede(uid,d['reto'],d.get('fila')),'new row violates row-level security policy for table "fotos"'
            else: assert d['reto'] in c,'new row violates row-level security policy for table "fotos"'
            if any(f['jugador_id']==uid and f['reto']==d['reto'] and f.get('fila')==d.get('fila') for f in self.fotos): return 409,{'message':'duplicate key value'}
            f={'id':str(uuid.uuid4()),'jugador_id':uid,'reto':d['reto'],'fila':d.get('fila'),'ruta':d['ruta'],'estado':'pend','creada':time.strftime('%Y-%m-%dT%H:%M:%S+00:00',time.gmtime()),'valorada_por':None}
            self.fotos.append(f); return 201,[f]
        if method=='DELETE' and t=='fotos':
            f = {k:v[0].replace('eq.','',1) for k,v in q.items()}
            self.fotos=[x for x in self.fotos if not (x['jugador_id']==uid and x['reto']==f['reto'] and x['estado']==f['estado'] and x['estado']!='ok')]; return 204,None
        if method=='POST' and t=='reacciones':
            d=json.loads(body); assert d['jugador_id']==uid and any(f['id']==d['foto_id'] and f['estado']=='ok' for f in self.fotos),'new row violates row-level security policy for table "reacciones"'
            self.reac.append(d); return 201,[d]
        if method=='DELETE' and t=='reacciones':
            f = {k:v[0].replace('eq.','',1) for k,v in q.items()}
            self.reac=[r for r in self.reac if not (r['foto_id']==f['foto_id'] and r['jugador_id']==uid and r['emoji']==f['emoji'])]; return 204,None
        return 403,{'message':'permission denied for table '+t}
    def puede(self,uid,reto,fila):
        c=self.cartones.get(uid)
        if not c: return False
        ok=lambda r: any(f['jugador_id']==uid and f['reto']==r and f['estado']=='ok' for f in self.fotos)
        if reto=='linea': return fila in (0,1,2) and all(ok(c[fila*3+i]) for i in range(3))
        return all(ok(r) for r in c)
    def rpc(self,n,a,uid):
        if n=='nombre_por_token':
            for k,t in self.enl.items():
                if t==a['p_token']: return 200,self.jug[k]['nombre']
            return 200,None
        assert uid,'permission denied'
        if n=='pass_cambiada':
            assert self.users[uid]['pass']!=self.ajustes['pass_defecto'],'Tienes que elegir una contraseña distinta de la inicial'
            self.jug[uid]['cambio_pass']=False; return 204,None
        if n=='sortear_jurado':
            assert self.admin(uid),'Solo el admin'
            adm=[k for k,v in self.jug.items() if v['es_admin']]; pl=[k for k,v in self.jug.items() if not v['es_admin']]
            self.jurado=adm+random.sample(pl,2); return 200,self.jurado
        if n=='repartir_cartones':
            assert self.admin(uid),'Solo el admin'
            assert not self.cartones or a.get('p_forzar'),'Ya hay cartones repartidos.'
            self.cartones={}
            pool=[k for k,v in RETOS.items() if not v[3] and v[2]!='canto']
            for k in self.jug:
                p=random.sample(pool,8); self.cartones[k]=p[:4]+['2']+p[4:]
            return 200,len(self.cartones)
        if n=='resetear_pass':
            assert self.admin(uid),'Solo el admin'
            self.users[a['p_jugador']]['pass']=self.ajustes['pass_defecto']; self.jug[a['p_jugador']]['cambio_pass']=True; return 204,None
        if n=='valorar':
            assert self.jury(uid) or False,'No eres del jurado'
            f=[x for x in self.fotos if x['id']==a['p_foto']][0]
            assert f['jugador_id']!=uid,'No puedes valorar tus propias fotos'
            assert f['estado']=='pend','Esa foto ya está valorada'
            d=RETOS[f['reto']][4]
            assert not d or time.time()>=time.mktime(time.strptime(d[:19],'%Y-%m-%dT%H:%M:%S')),'Todavía no se puede valorar (desde '+d+')'
            f['estado']='ok' if a['p_ok'] else 'ko'; f['valorada_por']=uid
            if a['p_ok'] and f['reto'] in ('linea','bingo'): self.gan.setdefault(f['reto'],f['id'])
            return 204,None
        return 404,{'message':'no rpc '+n}

def install(page, mock, host):
    def cors(extra=None):
        h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
        if extra: h.update(extra)
        return h
    def route(r):
        req=r.request
        if req.method=='OPTIONS': return r.fulfill(status=204,headers=cors())
        if req.url.split('?')[0].endswith(tuple(['.jpg'])) : pass
        body = req.post_data_buffer if req.method in('POST','PUT','DELETE','PATCH') else None
        if body is not None and re.search(r'/storage/v1/object/fotos/',req.url): pass
        else: body = (req.post_data or '') if body is not None else ''
        st,data = mock.handle(req.method,req.url,{k.lower():v for k,v in req.headers.items()},body)
        if data=='JPEG': return r.fulfill(status=200,body=jpeg(),headers=cors({'content-type':'image/jpeg'}))
        r.fulfill(status=st,body=('' if data is None else json.dumps(data)),headers=cors({'content-type':'application/json'}))
    page.route(f'https://{host}/**',route)
