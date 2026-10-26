/* Datos de ejemplo de la PoC. En la versión real vienen de la base de datos. */
window.NPG = {
  EVENTO: { fecha: '2026-12-26', nombre: 'Quedada de Navidad NPG', lugar: 'Jaraíz de la Vera' },

  // Pool inicial de retos (primera iteración). El fijo es la casilla central de todos los cartones.
  RETOS: [
    { id: 1,  icono: '🥃', titulo: '2 chupitos de Jäger antes de las 18:00', franja: 'Día', tipo: 'individual',
      pista: 'Foto con los 2 chupitos y la hora visible en el móvil.' },
    { id: 2,  icono: '🪂', titulo: 'Manteo a Maritsu', franja: '19:00 · Cá Maritsu', tipo: 'grupal', fijo: true,
      pista: 'Foto o vídeo corto del manteo. Vale una sola para todo el grupo.' },
    { id: 3,  icono: '😁', titulo: 'Foto con Jose, de Bar La Plaza, sonriendo', franja: 'Ruta', tipo: 'individual',
      pista: 'Selfie con Jose. Los dos sonriendo, que se vean los dientes.' },
    { id: 4,  icono: '💋', titulo: 'Pico a un chico (que no sea tu pareja)', franja: 'Cualquiera', tipo: 'individual',
      pista: 'Foto del pico. Solo vale si el otro quiere salir en la foto.' },
    { id: 5,  icono: '💋', titulo: 'Pico a una chica (que no sea tu pareja)', franja: 'Cualquiera', tipo: 'individual',
      pista: 'Foto del pico. Solo vale si ella quiere salir en la foto.' },
    { id: 6,  icono: '🔥', titulo: 'Foto al pibón de la noche', franja: 'Noche', tipo: 'jurado',
      pista: 'Que sepa que sale en la foto y se lo tome con humor. Decide el jurado.' },
    { id: 7,  icono: '🐴', titulo: 'Montar a borriquito a Angelines', franja: 'Nuevo Café', tipo: 'individual',
      pista: 'Foto montando a Angelines. Solo si Angelines se apunta.' },
    { id: 8,  icono: '🏆', titulo: 'Mejor atuendo del día', franja: 'Cena', tipo: 'jurado',
      pista: 'Foto del atuendo completo. Vota el jurado en la cena.' },
    { id: 9,  icono: '💩', titulo: 'Peor atuendo del día', franja: 'Cena', tipo: 'jurado',
      pista: 'Foto del atuendo completo. Vota el jurado en la cena.' },
    { id: 10, icono: '📝', titulo: 'Teléfono en una servilleta a una chica', franja: 'Noche', tipo: 'individual',
      pista: 'Foto de la servilleta entregada, o que otra persona te haga la foto mientras la entregas.' },
    { id: 11, icono: '🎤', titulo: 'Cantar «Mané Mané»', franja: 'Nuevo Café', tipo: 'grupal',
      pista: 'Foto o vídeo corto del grupo cantando. Vale una sola para todos.' },
    { id: 12, icono: '💡', titulo: 'Encender las luces de la discoteca al cerrar', franja: 'Cierre', tipo: 'individual',
      pista: 'Foto con las luces ya encendidas, tú en el plano y la hora visible en el móvil.' }
  ],

  // Reacciones del muro (cada jugador puede poner o quitar cada una).
  REACCIONES: ['😂', '🔥', '💀', '👏', '🍻'],

  // Cantos: no están en el cartón. Se desbloquean al completar una línea o los 9 sellos
  // y funcionan igual que cualquier reto: foto + validación del jurado.
  CANTOS: {
    linea: { id: 'linea', icono: '🎯', titulo: '¡Línea!', franja: 'Al completarla', tipo: 'canto',
      pista: 'Foto tuya con el cartón abierto en el móvil y la línea completa a la vista. El jurado comprueba las fotos de esa línea.' },
    bingo: { id: 'bingo', icono: '🏁', titulo: '¡Bingo!', franja: 'Al completarlo', tipo: 'canto',
      pista: 'Foto tuya con el cartón abierto en el móvil y los 9 sellos a la vista. El jurado comprueba las 9 fotos.' }
  },

  // Los 22 jugadores incluyen al admin: tiene cartón como el resto, más funciones especiales.
  ADMIN: 'Adri',
  JUGADORES: ['Dani', 'Marcos', 'Raúl', 'Javi', 'Nacho', 'Pablo', 'Sergio', 'Álvaro', 'Iván', 'Rubén', 'Fer',
    'Toni', 'Edu', 'Jesús', 'Carlos', 'David', 'Óscar', 'Víctor', 'Manu', 'Luis', 'Adri', 'Jota']
};
