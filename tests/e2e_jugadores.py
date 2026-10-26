import sys
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mock import Mock, install, jpeg
from playwright.sync_api import sync_playwright
HOST='tivngljbtzadvqtyqokn.supabase.co'; BASE='http://localhost:8081/index.html'
m=Mock(); res=[]
def check(n,c): res.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
adm=m.uid_by_name('Adrián'); amos=m.uid_by_name('Amós'); chuchi=m.uid_by_name('Chuchi'); casi=m.uid_by_name('Casillas')
m.rpc('repartir_cartones',{},adm)
m.cartones[amos]=['1','3','4','5','2','7','8','9','6']
m.jurado=[adm,chuchi,casi]
m.jug[chuchi]['cambio_pass']=False; m.users[chuchi]['pass']='ChuchiPass-1'
def user(b,hashpart):
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda c: errs.append(c.text) if c.type=='error' and 'ERR_TUNNEL' not in c.text and 'status of 400' not in c.text else None)
    install(pg,m,HOST); pg.goto(BASE+hashpart); pg.wait_for_timeout(500); return pg,errs
def subir(pg,rid):
    pg.click(f'button[data-acc=reto][data-id="{rid}"]'); pg.wait_for_timeout(200)
    pg.locator('.archivo').first.set_input_files({'name':'a.jpg','mimeType':'image/jpeg','buffer':jpeg()}); pg.wait_for_timeout(500)
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
    A.fill('input[name=a]','abc'); A.fill('input[name=b]','abc'); A.evaluate("document.querySelector('form').noValidate=true"); A.click('button[type=submit]'); A.wait_for_timeout(300)
    check('pass corta rechazada', 'Mínimo 4' in A.inner_text('#app'))
    A.fill('input[name=a]','MiClave-2026'); A.fill('input[name=b]','OtraClave-1'); A.click('button[type=submit]'); A.wait_for_timeout(300)
    check('no coinciden', 'no coinciden' in A.inner_text('#app'))
    A.fill('input[name=a]','MiClave-2026'); A.fill('input[name=b]','MiClave-2026'); A.click('button[type=submit]'); A.wait_for_timeout(1000)
    check('entra al carton tras cambiar', 'Cartón de Amós' in A.inner_text('#app') and m.jug[amos]['cambio_pass'] is False)
    A.reload(); A.wait_for_timeout(900)
    check('sesion persiste tras recargar', 'Cartón de Amós' in A.inner_text('#app'))
    check('no es jurado ni admin (sin pestañas)', 'Jurado' not in A.inner_text('nav') and 'Admin' not in A.inner_text('nav'))
    subir(A,'1')
    check('foto aceptada al subir', 'OK' in A.inner_text('button[data-id="1"]') and len(m.storage)==1 and list(m.storage)[0].startswith(amos+'/'))
    A.click('button[data-acc=reto][data-id="1"]'); A.wait_for_timeout(200)
    check('modal con un solo selector', A.locator('.archivo').count()==1 and 'Repetir foto' in A.inner_text('#modal'))
    A.locator('.archivo').first.set_input_files({'name':'b.jpg','mimeType':'image/jpeg','buffer':jpeg()}); A.wait_for_timeout(500)
    A.click('#enviar'); A.wait_for_timeout(900)
    check('repetir reto reemplaza la foto', len([f for f in m.fotos if f['reto']=='1'])==1 and len(m.storage)==1)
    for r in ('3','4'):
        A.goto(BASE+'#/carton'); A.wait_for_timeout(300); subir(A,r)

    C,eC=user(b,'#/entrar/tok3')
    C.fill('input[name=a]','ChuchiPass-1'); C.click('button[type=submit]'); C.wait_for_timeout(1000)
    check('jurado ve banner', 'Te ha tocado jurado' in C.inner_text('#app'))
    C.goto(BASE+'#/muro'); C.wait_for_timeout(700)
    C.click('button.reac[data-e="🔥"]'); C.wait_for_timeout(500)
    check('reaccion guardada', len(m.reac)==1 and m.reac[0]['emoji']=='🔥')
    C.reload(); C.wait_for_timeout(900); C.goto(BASE+'#/muro'); C.wait_for_timeout(600)
    check('reaccion persiste (aria-pressed)', C.locator('button.reac[data-e="🔥"]').first.get_attribute('aria-pressed')=='true')
    C.click('button.reac[data-e="🔥"]'); C.wait_for_timeout(500)
    check('reaccion quitada', len(m.reac)==0)

    A.goto(BASE+'#/carton'); A.wait_for_timeout(600)
    check('boton cantar linea', 'Cantar línea' in A.inner_text('#app') and 'Cantar bingo' not in A.inner_text('#app'))
    check('banner premios por determinar', '3' in A.inner_text('.aviso') and 'por determinar' in A.inner_text('.aviso'))
    A.click('button:has-text("Cantar línea")'); A.wait_for_timeout(900)
    check('canto sin foto', len(m.cantos)==1 and m.cantos[0]['tipo']=='linea' and m.cantos[0]['fila']==0 and not any(f['reto'] in ('linea','bingo') for f in m.fotos))
    check('canto pendiente deshabilitado', A.locator('button:disabled:has-text("Línea cantada")').count()==1)
    C.goto(BASE+'#/jurado'); C.wait_for_timeout(700)
    check('jurado ve las 3 fotos de la fila', C.locator('.rev-foto').count()==3)
    C.click('button:has-text("Es válido")'); C.wait_for_timeout(900)
    check('1 voto no basta', m.cantos[0]['estado']=='pend' and not m.gan['linea'])
    check('ya votado', 'Has votado a favor' in C.inner_text('#app'))
    S2,eS=user(b,'#/entrar/tok2'); m.jug[casi]['cambio_pass']=False
    S2.fill('input[name=a]','inicial-demo'); S2.click('button[type=submit]'); S2.wait_for_timeout(1000)
    S2.goto(BASE+'#/jurado'); S2.wait_for_timeout(700)
    S2.click('button:has-text("Es válido")'); S2.wait_for_timeout(900)
    check('2 de 3 => linea concedida', m.cantos[0]['estado']=='ok' and len(m.gan['linea'])==1)
    A.reload(); A.wait_for_timeout(900)
    check('banner ganador de la linea', 'Amós' in A.inner_text('.aviso') and 'quedan 2' in A.inner_text('.aviso') and 'Cantar línea' not in A.inner_text('#app'))
    # reto con hora minima: pendiente para el jurado y bloqueado
    A.goto(BASE+'#/carton'); A.wait_for_timeout(300); subir(A,'6')
    check('pibon queda en revision', 'En revisión' in A.inner_text('button[data-id="6"]'))
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
    for e in (eA,eC,eD,eS):
        check('sin errores JS/CSP', not e); 
        if e: print(e)
    b.close()
print('FAILED:',[n for n,ok in res if not ok])
