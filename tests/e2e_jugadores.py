import sys
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mock import Mock, install, jpeg
from playwright.sync_api import sync_playwright
HOST='tivngljbtzadvqtyqokn.supabase.co'; BASE='http://localhost:8081/index.html'
m=Mock(); res=[]
def check(n,c): res.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
adm=m.uid_by_name('Adrián'); amos=m.uid_by_name('Amós'); chuchi=m.uid_by_name('Chuchi')
m.rpc('repartir_cartones',{},adm)
m.cartones[amos]=['1','3','4','5','2','7','8','9','6']
m.jurado=[adm,chuchi]
m.jug[chuchi]['cambio_pass']=False; m.users[chuchi]['pass']='ChuchiPass-1'
def user(b,hashpart):
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda c: errs.append(c.text) if c.type=='error' and 'ERR_TUNNEL' not in c.text and 'status of 400' not in c.text else None)
    install(pg,m,HOST); pg.goto(BASE+hashpart); pg.wait_for_timeout(500); return pg,errs
def subir(pg,rid):
    pg.click(f'button[data-acc=reto][data-id="{rid}"]'); pg.wait_for_timeout(200)
    pg.locator('.archivo').nth(1).set_input_files({'name':'a.jpg','mimeType':'image/jpeg','buffer':jpeg()}); pg.wait_for_timeout(500)
    pg.click('#enviar'); pg.wait_for_timeout(900)
with sync_playwright() as p:
    b=p.chromium.launch()
    A,eA=user(b,'#/entrar/tok1')
    check('token muestra nombre', 'Hola, Amós' in A.inner_text('#app'))
    A.fill('input[name=a]','mala'); A.click('button[type=submit]'); A.wait_for_timeout(400)
    check('pass mala', 'incorrecta' in A.inner_text('#app'))
    A.fill('input[name=a]','inicial-demo'); A.click('button[type=submit]'); A.wait_for_timeout(900)
    check('forzado a cambiar pass', 'Elige tu contraseña' in A.inner_text('#app') and 'Nº' not in A.inner_text('#app'))
    A.goto(BASE+'#/muro'); A.wait_for_timeout(600)
    check('forzado persiste aunque cambie ruta', 'Elige tu contraseña' in A.inner_text('#app'))
    A.fill('input[name=a]','corta'); A.fill('input[name=b]','corta'); A.evaluate("document.querySelector('form').noValidate=true"); A.click('button[type=submit]'); A.wait_for_timeout(300)
    check('pass corta rechazada', 'Mínimo 8' in A.inner_text('#app'))
    A.fill('input[name=a]','MiClave-2026'); A.fill('input[name=b]','OtraClave-1'); A.click('button[type=submit]'); A.wait_for_timeout(300)
    check('no coinciden', 'no coinciden' in A.inner_text('#app'))
    A.fill('input[name=a]','MiClave-2026'); A.fill('input[name=b]','MiClave-2026'); A.click('button[type=submit]'); A.wait_for_timeout(1000)
    check('entra al carton tras cambiar', 'Cartón de Amós' in A.inner_text('#app') and m.jug[amos]['cambio_pass'] is False)
    A.reload(); A.wait_for_timeout(900)
    check('sesion persiste tras recargar', 'Cartón de Amós' in A.inner_text('#app'))
    check('no es jurado ni admin (sin pestañas)', 'Jurado' not in A.inner_text('nav') and 'Admin' not in A.inner_text('nav'))
    subir(A,'1')
    check('foto subida en revision', 'En revisión' in A.inner_text('button[data-id="1"]') and len(m.storage)==1 and list(m.storage)[0].startswith(amos+'/'))

    C,eC=user(b,'#/entrar/tok3')
    C.fill('input[name=a]','ChuchiPass-1'); C.click('button[type=submit]'); C.wait_for_timeout(1000)
    check('jurado ve banner', 'Te ha tocado jurado' in C.inner_text('#app'))
    C.goto(BASE+'#/jurado'); C.wait_for_timeout(700)
    check('jurado ve la foto pendiente de Amós', 'Amós' in C.inner_text('#app') and C.locator('button:has-text("Validar")').count()==1)
    C.click('button:has-text("Validar")'); C.wait_for_timeout(900)
    check('validada', [f for f in m.fotos if f['reto']=='1'][0]['estado']=='ok')
    C.goto(BASE+'#/muro'); C.wait_for_timeout(700)
    C.click('button.reac[data-e="🔥"]'); C.wait_for_timeout(500)
    check('reaccion guardada', len(m.reac)==1 and m.reac[0]['emoji']=='🔥')
    C.reload(); C.wait_for_timeout(900); C.goto(BASE+'#/muro'); C.wait_for_timeout(600)
    check('reaccion persiste (aria-pressed)', C.locator('button.reac[data-e="🔥"]').get_attribute('aria-pressed')=='true')
    C.click('button.reac[data-e="🔥"]'); C.wait_for_timeout(500)
    check('reaccion quitada', len(m.reac)==0)

    # Amós ve su OK al refrescar (poll o recarga)
    A.reload(); A.wait_for_timeout(900)
    check('Amós ve su sello OK', 'OK' in A.inner_text('button[data-id="1"]'))
    # fila 0 completa -> linea
    for r in ('3','4'):
        A.goto(BASE+'#/carton'); A.wait_for_timeout(300); subir(A,r)
    C.goto(BASE+'#/jurado'); C.wait_for_timeout(700)
    C.locator('button:has-text("Validar")').first.click(); C.wait_for_timeout(800); C.locator('button:has-text("Validar")').first.click(); C.wait_for_timeout(800)
    A.reload(); A.wait_for_timeout(900)
    check('boton cantar linea', 'Cantar línea' in A.inner_text('#app'))
    A.click('button:has-text("Cantar línea")'); A.wait_for_timeout(200)
    A.locator('.archivo').nth(1).set_input_files({'name':'l.jpg','mimeType':'image/jpeg','buffer':jpeg()}); A.wait_for_timeout(500); A.click('#enviar'); A.wait_for_timeout(900)
    check('linea enviada con fila 0', any(f['reto']=='linea' and f['fila']==0 for f in m.fotos))
    C.goto(BASE+'#/jurado'); C.wait_for_timeout(700)
    check('jurado ve las 3 fotos de la fila', C.locator('.rev-foto').count()==3)
    C.click('button:has-text("Validar")'); C.wait_for_timeout(900)
    check('ganador linea', 'linea' in m.gan)
    A.reload(); A.wait_for_timeout(900)
    check('banner ganador de la linea', 'Línea:' in A.inner_text('.aviso') and 'Amós' in A.inner_text('.aviso'))
    # reto con hora minima
    A.goto(BASE+'#/carton'); A.wait_for_timeout(300); subir(A,'6')
    C.reload(); C.wait_for_timeout(1200)
    check('pibon bloqueado en jurado', 'Se puede valorar desde' in C.inner_text('#app') and C.locator('button:has-text("Validar")').count()==0)
    # privacidad: un jugador sin ser jurado no recibe fotos pendientes ajenas
    D,eD=user(b,'#/entrar/tok4'); m.jug[m.uid_by_name('Dani Ligero')]['cambio_pass']=False
    D.fill('input[name=a]','inicial-demo'); D.click('button[type=submit]'); D.wait_for_timeout(1000)
    D.evaluate("localStorage.getItem('npgingo.sesion')")
    pend=[f for f in m.fotos if f['estado']=='pend']
    check('hay pendientes en servidor', len(pend)>=1)
    D.goto(BASE+'#/jurado'); D.wait_for_timeout(500)
    check('no jurado no ve pestaña ni ruta jurado', 'Jurado' not in D.inner_text('nav') and 'Cartón de Dani' in D.inner_text('#app'))
    for e in (eA,eC,eD):
        check('sin errores JS/CSP', not e); 
        if e: print(e)
    b.close()
print('FAILED:',[n for n,ok in res if not ok])
