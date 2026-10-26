import sys, json, re
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mock import Mock, install, jpeg
from playwright.sync_api import sync_playwright
HOST='tivngljbtzadvqtyqokn.supabase.co'
m=Mock()
res=[]
def check(name,cond):
    res.append((name,bool(cond))); print(('PASS ' if cond else 'FAIL ')+name)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append('PAGE:'+str(e)))
    pg.on('console',lambda c: errs.append('CONSOLE:'+c.text) if c.type=='error' else None)
    install(pg,m,HOST)
    pg.goto('http://localhost:8081/index.html#/entrar'); pg.wait_for_timeout(600)
    txt=pg.inner_text('#app')
    check('portada solo logo + boton admin', 'Entrar como administrador' in txt and 'Cartón' not in txt and pg.locator('#app button').count()==1)
    pg.goto('http://localhost:8081/index.html#/entrar/xxxx'); pg.wait_for_timeout(500)
    check('enlace invalido', 'Este enlace no vale' in pg.inner_text('#app'))
    # admin login
    pg.goto('http://localhost:8081/index.html#/entrar'); pg.click('text=Entrar como administrador'); pg.wait_for_timeout(300)
    pg.fill('input[name=e]','adrianmg231189@gmail.com'); pg.fill('input[name=a]','mala'); pg.click('button[type=submit]'); pg.wait_for_timeout(500)
    check('admin pass mala -> error', 'incorrectos' in pg.inner_text('#app'))
    check('email se conserva tras error', pg.input_value('input[name=e]')=='adrianmg231189@gmail.com')
    pg.fill('input[name=a]','AdminPass-12345'); pg.click('button[type=submit]'); pg.wait_for_timeout(900)
    check('admin entra directo (sin cambio de pass)', pg.url.endswith('#/carton') and 'Aún no has repartido' in pg.inner_text('#app'))
    pg.click('nav >> text=Admin'); pg.wait_for_timeout(300)
    pg.click('text=Repartir cartones'); pg.wait_for_timeout(500)
    check('cartones repartidos 6', len(m.cartones)==6)
    pg.click('text=Sortear jurado'); pg.wait_for_timeout(500)
    check('jurado = 3', len(m.jurado)==3)
    pg.click('button:has-text("Enlaces")'); pg.wait_for_timeout(300)
    check('enlaces: 5 jugadores, admin sin enlace', pg.locator('.fila').count()==5 and 'Adrián' not in pg.inner_text('#app .fila:first-of-type'))
    pg.click('button[data-tab=premios]'); pg.wait_for_timeout(300)
    check('editor de premios: 4 campos', pg.locator('form[data-form=premio]').count()==4)
    pg.locator('form[data-form=premio]').nth(3).locator('input').fill('Una cena para dos'); pg.locator('form[data-form=premio]').nth(3).locator('button').click(); pg.wait_for_timeout(700)
    check('premio del bingo guardado', [p for p in m.premios if p['tipo']=='bingo'][0]['premio']=='Una cena para dos')
    pg.click('button[data-tab=enlaces]'); pg.wait_for_timeout(300)
    pg.fill('input[data-msgpass]','inicial-demo')
    reqs=[]; ctx.on('request',lambda r: reqs.append(r.url))
    pg.locator('button:has-text("WhatsApp")').first.click(); pg.wait_for_timeout(800)
    from urllib.parse import unquote
    wa=[unquote(u) for u in reqs if 'wa.me' in u]
    check('whatsapp abre wa.me con enlace y pass', wa and 'tok0' in wa[0] and 'inicial-demo' in wa[0] and 'localhost:8081/index.html#/entrar/tok0' in wa[0])
    for pp in ctx.pages[1:]: pp.close()
    pg.locator('button:has-text("Resetear")').first.once = None
    pg.on('dialog', lambda d: d.accept())
    pg.locator('button:has-text("Resetear")').first.click(); pg.wait_for_timeout(500)
    check('reset ok', m.jug[[k for k,v in m.enl.items() if v=='tok0'][0]]['cambio_pass'] is True)
    check('contraseña por defecto NO esta en el HTML renderizado sin escribirla', 'inicial-demo' not in open('app.js').read() and 'inicial-demo' not in open('index.html').read())
    pg.click('nav >> text=Salir'); pg.wait_for_timeout(500)
    check('salir -> portada', pg.url.endswith('#/entrar') and 'Entrar como administrador' in pg.inner_text('#app'))
    print('ERRS',errs)
    errs=[e for e in errs if 'ERR_TUNNEL' not in e and 'status of 400' not in e]
    check('sin errores de consola/CSP', not errs)
    b.close()
print('FAILED:',[n for n,ok in res if not ok])
