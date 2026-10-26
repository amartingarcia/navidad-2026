# NPGingo (PoC)

Bingo de retos con fotos para la quedada de Navidad de NPG (26 dic 2026, Jaraíz de la Vera).

Esta PoC es solo interfaz: HTML, CSS y JS sin build ni backend. Los datos son de ejemplo y se guardan en el `localStorage` del navegador.

## Ver en local

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```

También funciona abriendo `index.html` directamente.

## Qué incluye

- Pantalla de entrada con enlace personal (`#/entrar/<token>`): usuario, contraseña provisional y cambio obligatorio.
- Cartón 3x3 con la casilla central fija (manteo a Maritsu) y 8 retos por jugador, repartidos de forma determinista.
- Subida de foto por reto (cámara del móvil), con compresión en el cliente.
- Línea y bingo se cantan con foto, como cualquier otro reto: al completar una línea o los 9 sellos aparece el botón, subes la foto y el jurado la valida (ve las fotos del cartón para comprobarla). El primero en ser validado gana.
- Admin: es un jugador más (tiene cartón) con funciones especiales: sorteo del jurado y enlaces personales.
- Jurado: 2 jugadores al azar más el admin (3 en total). Los elegidos ven un banner en su cartón y una pestaña «Jurado» para validar las fotos de los demás (nunca las suyas).
- Instalable en el móvil (manifest + iconos): «Añadir a pantalla de inicio» en Safari o Chrome.
- Muro de fotos validadas, y panel de admin (sorteo del jurado y enlaces).

## Lo que no hace todavía

- No hay login real ni base de datos: cualquier contraseña vale y el estado vive solo en el navegador de cada móvil, así que **no se sincroniza entre teléfonos**. Para usarlo en la quedada hace falta backend.
- Los retos son los 12 de la primera iteración (faltan unos 18 para el pool de 30).
- No hay reparto equilibrado por dificultad y franja.

## Publicar en GitHub Pages

El workflow `.github/workflows/pages.yml` publica la raíz del repo en cada push a `main`. Hay que activar Pages con origen **GitHub Actions** en *Settings → Pages*. En repos privados, Pages requiere un plan de pago.

## Datos de ejemplo

Edita `data.js` (retos y jugadores). Botón «Reiniciar datos de ejemplo» en la pantalla de entrada para restaurar el estado.
