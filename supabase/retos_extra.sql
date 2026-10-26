-- NPGingo · retos 13-30 (tanda 2). Run once in the Supabase SQL Editor, BEFORE dealing the cards.
-- Delete the lines you do not like before running. Safe to re-run (existing ids are left untouched).
-- `desde` (valuation time) is null = the jury can rule on the spot.

insert into public.retos (id, icono, titulo, franja, tipo, fijo, pista, desde) values
 ('13','🍻','Brindar con un camarero o camarera','Ruta','individual',false,'Selfie brindando con quien te ha puesto la caña. Que se vea la sonrisa de los dos.',null),
 ('14','🎅','Selfie con un desconocido con gorro de Papá Noel','Cualquiera','individual',false,'Selfie con alguien que no sea del grupo y lleve gorro navideño. Solo si quiere salir.',null),
 ('15','🎄','Un adorno navideño del bar puesto en la cabeza','Ruta','individual',false,'Foto con un adorno del local en la cabeza. Si el dueño te lo deja, mejor.',null),
 ('16','🎶','Villancico improvisado en un bar','Ruta','grupal',false,'Foto o vídeo corto del grupo cantando un villancico en un bar. Vale una sola para todos.',null),
 ('17','🌿','Foto bajo un muérdago con alguien que no sea tu pareja','Cualquiera','individual',false,'Vale un muérdago de verdad o uno improvisado, pero que se vea claro. Solo si el otro quiere salir.',null),
 ('18','🗿','Hacer la estatua en plena calle','Calle','individual',false,'Foto en pose de estatua en la calle, con público a ser posible.',null),
 ('19','🧥','Cambiar una prenda con otro del grupo','Cualquiera','individual',false,'Foto de los dos con la prenda del otro puesta. Hay que llevarla una ronda entera.',null),
 ('20','👍','Selfie con un vecino del pueblo con el pulgar arriba','Cualquiera','individual',false,'Selfie con alguien de Jaraíz, los dos con el pulgar arriba. Solo si quiere salir.',null),
 ('21','😴','Foto a alguien del grupo con cara de dormido','Cualquiera','individual',false,'Foto robada con humor. Solo vale si el retratado se ríe después.',null),
 ('22','🥃','Chupito de Calisay con la cara que se te quede','Ruta','individual',false,'Foto justo después de tomarlo, con el vaso vacío a la vista.',null),
 ('23','💃','Bailar con alguien que no conozcas en la discoteca','Noche','individual',false,'Foto del baile con alguien ajeno al grupo. Solo si quiere salir.',null),
 ('24','🥴','Vaso vacío boca abajo sobre la cabeza','Ruta','individual',false,'Foto con el vaso vacío boca abajo sobre la cabeza, sin que se caiga.',null),
 ('25','📸','Foto del grupo entero en la barra de un bar','Ruta','grupal',false,'Todos en la barra y todos en la foto. Vale una sola para todos.',null),
 ('26','🎧','Que pongan tu canción en la discoteca','Noche','individual',false,'Foto con el DJ o con la canción sonando y tú en el plano. Vale que se vea la pantalla.',null),
 ('27','🕺','Peor baile del día','Noche','jurado',false,'Foto o vídeo corto del baile. Decide el jurado.',null),
 ('28','🧦','Algo navideño que lleves puesto, a la vista','Cualquiera','individual',false,'Calcetines, gorro, jersey feo o lo que lleves. Foto enseñándolo con orgullo.',null),
 ('29','🎁','Regalo exprés a alguien del grupo','Ruta','individual',false,'Invita a una tapa o a un chupito a alguien del grupo. Foto del momento de dárselo.',null),
 ('30','🌙','Foto de los últimos en pie','Cierre','grupal',false,'Mínimo 5 personas del grupo, de madrugada y sin una sola cara seria. Vale una sola para todos.',null)
on conflict (id) do nothing;
