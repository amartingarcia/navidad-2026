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

- Cartón 3x3 fijo por jugador: casilla central «Manteo a Maritsu» y 8 retos al azar del pool (`supabase/retos.sql`, tabla `retos`).
- Solo cuentan las **filas horizontales**. Las fotos se aceptan al subirlas y se pueden repetir (la nueva sustituye a la anterior).
- **Cantos:** «¡Cantar línea!» y «¡Cantar bingo!» no llevan foto. El jurado (2 jugadores al azar + el admin) revisa las fotos del jugador y vota; se necesitan **2 de 3** a favor. Nadie vota su propio canto. Hay **3 premios de línea y 1 de bingo** (premios por determinar, columna `premios.premio`). Solo el jurado valora la foto del pibón de la noche.
- **Retos premium** (p. ej. el Bizum de Goria): están fuera del cartón, cualquiera puede intentarlos y gana quien primero consiga que el jurado (2 de 3) valide su prueba. Cada uno tiene su premio. Se marcan en `supabase/retos.sql`.
- La pestaña **Premios** muestra el podio (1ª, 2ª, 3ª línea, bingo y cada reto premium) con el nombre de quien se lo lleva; el admin define el texto de cada premio en Admin → Premios.
- Cada reto puede tener una hora mínima de valoración (`retos.desde`; el pibón de la noche, el 27 dic 12:00). La comprueba el servidor.
- Muro común con todas las fotos y reacciones ❤️ 😂 🍆 🔥 👍 🖕 🚀.

## Seguridad

- Todas las tablas exigen sesión (RLS); el rol anónimo no puede leer ni escribir nada salvo resolver un token a un nombre.
- Fotos en un bucket privado con URLs firmadas de 1 h. Un jugador ve sus fotos y las aceptadas; el jurado, también las pendientes (pibón).
- La contraseña inicial vive en `ajustes.pass_defecto`, tabla que ningún cliente puede leer. No está en el repo.
- `config.js` solo lleva la URL y la clave *publishable* (pública por diseño). La `service_role` nunca va al repo ni al cliente.
- CSP, `no-referrer`, `noindex` y cabeceras de seguridad en `index.html` y `vercel.json`.

## Puesta en marcha

1. Supabase: ejecutar `supabase/schema.sql` y después `supabase/retos.sql` en el SQL Editor (ambos idempotentes).
2. Supabase → Authentication: desactivar **Confirm email** y **Allow new users to sign up**; Site URL = URL de Vercel.
3. Crear usuarios, desde tu máquina. Los secretos van en `supabase/.env` (ignorado por git; plantilla en `supabase/.env.example`) o como variables de entorno:
   ```bash
   cp supabase/.env.example supabase/.env           # rellena SERVICE_ROLE_KEY, ADMIN_PASS y DEFAULT_PASS
   cp supabase/jugadores.example.txt supabase/jugadores.txt   # ajusta nombres (sin el admin)
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

## Fiesta (solo presentación, `fiesta.js`)
- **Modo discoteca:** del 26 dic 18:00 al 27 dic 08:00 (`data.js` → `EVENTO.discoDesde/discoHasta`): luces, bola de espejos, logo con neón y lluvia de chupitos, cañas y botellas. Para verlo antes: añade `?disco` a la dirección (`?disco=0` lo apaga).
- **Premio gordo:** cuando sale un ganador nuevo (línea, bingo o reto premium) a todos los que tengan la app abierta les salta una pantalla con confeti, sirena y el nombre. Se muestra una vez por navegador. Para probarla: `?demo=gordo`.
- **Papá Noel borracho:** cruza la pantalla cada ~40-70 s. Se desactiva con «reducir movimiento» del sistema.
