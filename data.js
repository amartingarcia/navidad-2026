/* Datos fijos del evento. Retos, cartones, jugadores y jurado viven en Supabase (ver supabase/schema.sql). */
window.NPG = {
  EVENTO: { fecha: '2026-12-26', nombre: 'Quedada de Navidad NPG', lugar: 'Jaraíz de la Vera',
    // Modo discoteca: del 26 dic a las 18:00 al 27 dic a las 08:00 (hora de Madrid)
    discoDesde: '2026-12-26T18:00:00+01:00', discoHasta: '2026-12-27T08:00:00+01:00' },

  // Reacciones del muro (cada jugador puede poner o quitar cada una). Deben coincidir con el CHECK de supabase/schema.sql.
  REACCIONES: ['❤️', '😂', '🍆', '🔥', '👍', '🖕', '🚀']
};
