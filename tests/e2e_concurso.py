import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mock
mock.RETOS['32']=('🔥','Pibón de la jornada','individual',False,None)
mock.PREMIUM.add('32'); mock.CONCURSO['32']='2099-12-27T12:00:00+00:00'
from mock import Mock, install, jpeg
from playwright.sync_api import sync_playwright
HOST='tivngljbtzadvqtyqokn.supabase.co'; BASE='http://localhost:8081/index.html'
m=Mock(); res=[]
def check(n,c): res.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n)
m.premios.append({'tipo':'premium','reto':'32','puesto':1,'premio':'Una botella'})
adm=m.uid_by_name('Adrián'); amos=m.uid_by_name('Amós'); chuchi=m.uid_by_name('Chuchi')
m.rpc('repartir_cartones',{},adm)
check('el concurso no entra en los cartones', all('32' not in c for c in m.cartones.values()))
for u,pw in ((amos,'AmosPass-1'),(chuchi,'ChuchiPass-1')):
    m.jug[u]['cambio_pass']=False; m.users[u]['pass']=pw
def user(b,h,pw):
    ctx=b.new_context(viewport={'width':390,'height':800}); ctx.add_init_script("document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('style');s.textContent='#gordo{display:none!important}';document.head.appendChild(s)})")
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    install(pg,m,HOST); pg.goto(BASE+h); pg.wait_for_timeout(500)
    pg.fill('input[name=a]',pw); pg.click('button[type=submit]'); pg.wait_for_timeout(1000)
    pg.evaluate("location.hash='#/premios'"); pg.reload(); pg.wait_for_timeout(1000); return pg,errs
def subir(pg):
    pg.click('button[data-acc=reto][data-id="32"]'); pg.wait_for_timeout(200)
    pg.locator('.archivo').first.set_input_files({'name':'a.jpg','mimeType':'image/jpeg','buffer':jpeg()}); pg.wait_for_timeout(500)
    check('concurso: boton normal, sin jurado', pg.inner_text('#enviar')=='Enviar foto')
    pg.click('#enviar'); pg.wait_for_timeout(900)
with sync_playwright() as p:
    b=p.chromium.launch()
    A,eA=user(b,'#/entrar/tok1','AmosPass-1'); C,eC=user(b,'#/entrar/tok3','ChuchiPass-1')
    check('seccion concurso visible', 'Pibón de la jornada' in A.inner_text('#app') and 'un voto' in A.inner_text('#app'))
    subir(A); subir(C)
    check('fotos aceptadas al instante', all(f['estado']=='ok' for f in m.fotos if f['reto']=='32') and len([f for f in m.fotos if f['reto']=='32'])==2)
    A.reload(); A.wait_for_timeout(1000)
    check('en la galeria hay 2 fotos y solo 1 boton Votar (la propia no se vota)', A.locator('.foto-card').count()==2 and A.locator('button[data-acc=votarConcurso]').count()==1)
    A.click('button[data-acc=votarConcurso]'); A.wait_for_timeout(1200)
    check('voto registrado y marcado', len(m.vc)==1 and 'Tu voto' in A.inner_text('#app'))
    check('podio: en cabeza Chuchi con 1 voto', 'En cabeza: Chuchi (1)' in A.inner_text('.podio'))
    C.reload(); C.wait_for_timeout(1000)
    C.click('button[data-acc=votarConcurso]'); C.wait_for_timeout(1200)
    check('Chuchi vota a Amós: empate 1-1 en cabeza', len(m.vc)==2 and 'Chuchi / Amós' in C.inner_text('.podio') or 'Amós / Chuchi' in C.inner_text('.podio'))
    foto_a=[f for f in m.fotos if f['reto']=='32' and f['jugador_id']==amos][0]
    try: m.rpc('votar_concurso',{'p_foto':foto_a['id']},amos); check('no se puede votar la propia',False)
    except AssertionError: check('no se puede votar la propia',True)
    mock.CONCURSO['32']='2000-01-01T00:00:00+00:00'
    A.reload(); A.wait_for_timeout(1000)
    check('votacion cerrada: sin botones y se anuncia empate', A.locator('button[data-acc=votarConcurso]').count()==0 and 'Votación cerrada' in A.inner_text('#app') and 'Empate' in A.inner_text('.podio'))
    for pg,e in ((A,eA),(C,eC)): check('sin errores JS', not e)
    b.close()
print('FAILED:',[n for n,ok in res if not ok])
