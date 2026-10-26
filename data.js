/* Datos fijos del evento. Retos, cartones, jugadores y jurado viven en Supabase (ver supabase/schema.sql). */
window.NPG = {
  EVENTO: { fecha: '2026-12-26', nombre: 'Quedada de Navidad NPG', lugar: 'Jaraíz de la Vera' },

  // Reacciones del muro (cada jugador puede poner o quitar cada una). Deben coincidir con el CHECK de supabase/schema.sql.
  REACCIONES: ['❤️', '😂', '🍆', '🔥', '👍', '🖕', '🚀']
};
