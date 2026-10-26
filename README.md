# NPGingo

Bingo de retos con fotos para la quedada de Navidad de NPG (26 dic 2026, Jaraíz de la Vera).

Frontend estático (HTML, CSS y JS sin build) sobre Supabase (Auth, Postgres con RLS y Storage). Se despliega en Vercel desde `main`.

## Acceso

- **Portada pública:** solo el logo y «Entrar como administrador».
- **Admin:** email y contraseña propios (usuario creado con `supabase/seed-users.sh`). Es también jugador y siempre está en el jurado.
- **Jugadores:** enlace personal `…/#/entrar/<token>` + contraseña inicial. En el primer acceso la app obliga a elegir una nueva (el servidor rechaza dejarla igual).
- Panel *Admin → Enlaces*: botón de WhatsApp por jugador (abre el chat con el enlace escrito), copiar enlace y resetear contraseña.
- Registro público desactivado en Supabase: solo entran los usuarios creados por el admin.

## Reglas del juego

- Cartón 3x3 fijo por jugador: casilla central «Manteo a Maritsu» y 8 retos al azar del pool (`supabase/schema.sql`, tabla `retos`).
- Solo cuentan las **filas horizontales**. Línea y bingo se cantan con foto, como cualquier reto.
- Jurado: 2 jugadores al azar + el admin. Valida el primero que decide; nunca valida sus propias fotos. Para una línea ve las 3 fotos de la fila y para un bingo las 9.
- Cada reto puede tener una hora mínima de valoración (`retos.desde`; el pibón de la noche, el 27 dic 12:00). La comprueba el servidor.
- Muro común con las fotos validadas y reacciones ❤️ 😂 🍆 🔥 👍 🖕 🚀.

## Seguridad

- Todas las tablas exigen sesión (RLS); el rol anónimo no puede leer ni escribir nada salvo resolver un token a un nombre.
- Fotos en un bucket privado con URLs firmadas de 1 h. Un jugador solo ve sus fotos y las validadas; el jurado, también las pendientes.
- La contraseña inicial vive en `ajustes.pass_defecto`, tabla que ningún cliente puede leer. No está en el repo.
- `config.js` solo lleva la URL y la clave *publishable* (pública por diseño). La `service_role` nunca va al repo ni al cliente.
- CSP, `no-referrer`, `noindex` y cabeceras de seguridad en `index.html` y `vercel.json`.

## Puesta en marcha

1. Supabase: ejecutar `supabase/schema.sql` en el SQL Editor (idempotente).
2. Supabase → Authentication: desactivar **Confirm email** y **Allow new users to sign up**; Site URL = URL de Vercel.
3. Crear usuarios, desde tu máquina (secretos solo en variables de entorno):
   ```bash
   cp supabase/jugadores.example.txt supabase/jugadores.txt   # ajusta nombres (sin el admin)
   export SUPABASE_URL=https://<ref>.supabase.co SERVICE_ROLE_KEY=… DEFAULT_PASS=… \
          ADMIN_EMAIL=… ADMIN_PASS=… ADMIN_NAME=Adrián
   ./supabase/seed-users.sh supabase/jugadores.txt
   ```
4. Entrar como admin → *Admin*: repartir cartones, sortear jurado y enviar los enlaces.

## Desarrollo y pruebas

```bash
python3 -m http.server 8081          # sirve la web
pip install playwright && playwright install chromium
python3 tests/e2e_admin.py           # contra un Supabase simulado (tests/mock.py), sin red
python3 tests/e2e_jugadores.py
```

El simulador reproduce las reglas de RLS y las funciones del esquema; no sustituye una prueba con el proyecto real.

## Pendiente

- Completar el pool hasta ~30 retos y confirmar la hora mínima del pibón.
- Regla opcional de mayoría (2 de 3) en el jurado.
