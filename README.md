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
- Jurado: 3 jugadores al azar más el admin. Los elegidos ven un banner en su cartón, una pestaña «Jurado» y pueden validar las fotos de los demás (nunca las suyas). El admin puede volver a sortear.
- Instalable en el móvil (manifest + iconos): «Añadir a pantalla de inicio» en Safari o Chrome.
- Muro de fotos validadas, bote de multas con reparto de ejemplo y panel de admin (validar fotos, cantos de línea y bingo, multas y enlaces).

## Lo que no hace todavía

- No hay login real ni base de datos: cualquier contraseña vale y el estado vive solo en el navegador de cada móvil, así que **no se sincroniza entre teléfonos**. Para usarlo en la quedada hace falta backend.
- Los retos son los 12 de la primera iteración (faltan unos 18 para el pool de 30).
- No hay reparto equilibrado por dificultad y franja.

## Publicar en GitHub Pages

El workflow `.github/workflows/pages.yml` publica la raíz del repo en cada push a `main`. Hay que activar Pages con origen **GitHub Actions** en *Settings → Pages*. En repos privados, Pages requiere un plan de pago.

## Datos de ejemplo

Edita `data.js` (retos, multas y jugadores). Botón «Reiniciar datos de ejemplo» en la pantalla de entrada para restaurar el estado.
