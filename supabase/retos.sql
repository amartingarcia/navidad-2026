-- NPGingo · challenge pool (ids 1-30). Run in the Supabase SQL Editor AFTER schema.sql and BEFORE dealing the cards.
-- Idempotent: re-running updates the texts of existing ids. Edit or delete lines freely before running.
-- `desde` (valuation time) is null = no waiting; the "pibón" is only ruled on from 27 Dec 12:00.
-- `hasta` (deadline): every challenge closes at 08:00 on 27 Dec; the Jäger one earlier, at 18:00 on 26 Dec.
-- If cards are already dealt, use "Rehacer cartones" in the admin panel after changing the pool.

insert into public.retos (id, icono, titulo, franja, tipo, fijo, pista, desde, hasta) values
 ('1','🥃','2 chupitos de Jäger antes de las 18:00','Día','individual',false,'Foto con los 2 chupitos y la hora visible en el móvil.',null,timestamptz '2026-12-26 18:00:00+01'),
 ('2','🪂','Manteo a Maritsu','19:00 · Cá Maritsu','grupal',true,'Foto o vídeo corto del manteo. Vale una sola para todo el grupo.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('3','😁','Foto con Jose, de Bar La Plaza, sonriendo','Ruta','individual',false,'Selfie con Jose. Los dos sonriendo, que se vean los dientes.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('4','💋','Pico a un tío','Cualquiera','individual',false,'Foto del pico. Solo vale si la otra persona quiere salir en la foto.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('5','💋','Pico a una tía','Cualquiera','individual',false,'Foto del pico. Solo vale si la otra persona quiere salir en la foto.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('6','🔥','Pibón de la jornada','Noche','jurado',false,'Que sepa que sale en la foto y se lo tome con humor. Se someterá a votación.', timestamptz '2026-12-27 12:00:00+01',timestamptz '2026-12-27 08:00:00+01'),
 ('7','🐴','Montar a borriquito a Angelines','Nuevo Café','individual',false,'Foto montando a Angelines. Solo si Angelines se apunta.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('8','🏆','Mejor outfit del día','Cena','jurado',false,'Foto del outfit completo, de cuerpo entero.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('9','💩','Peor outfit del día','Cena','jurado',false,'Foto del outfit completo, de cuerpo entero.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('10','📝','Teléfono en una servilleta a una chica','Noche','individual',false,'Foto de la servilleta entregada, o que otra persona te haga la foto mientras la entregas.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('11','🎤','Cantar «Mané Mané»','Nuevo Café','grupal',false,'Foto o vídeo corto del grupo cantando. Vale una sola para todos.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('12','💡','Encender las luces de la discoteca al cerrar','Cierre','individual',false,'Foto con las luces ya encendidas, tú en el plano y la hora visible en el móvil.',null,timestamptz '2026-12-27 08:00:00+01'),

 ('13','🍻','Brindar con un camarero o camarera','Ruta','individual',false,'Selfie brindando con quien te ha puesto la caña. Que se vea la sonrisa de los dos.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('14','🎅','Selfie con un desconocido con gorro de Papá Noel','Cualquiera','individual',false,'Selfie con alguien que no sea del grupo y lleve gorro navideño. Solo si quiere salir.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('15','🎄','Un adorno navideño del bar puesto en la cabeza','Ruta','individual',false,'Foto con un adorno del local en la cabeza. Si el dueño te lo deja, mejor.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('16','🎶','Villancico improvisado en un bar','Ruta','grupal',false,'Foto o vídeo corto del grupo cantando un villancico en un bar. Vale una sola para todos.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('17','🌿','Foto bajo un muérdago con alguien que no sea tu pareja','Cualquiera','individual',false,'Vale un muérdago de verdad o uno improvisado, pero que se vea claro. Solo si el otro quiere salir.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('18','🗿','Hacer la estatua en plena calle','Calle','individual',false,'Foto en pose de estatua en la calle, con público a ser posible.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('19','🧥','Cambiar una prenda con otro del grupo','Cualquiera','individual',false,'Foto de los dos con la prenda del otro puesta. Hay que llevarla una ronda entera.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('20','👍','Selfie con un vecino del pueblo con el pulgar arriba','Cualquiera','individual',false,'Selfie con alguien de Jaraíz, los dos con el pulgar arriba. Solo si quiere salir.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('21','😴','Foto a alguien del grupo con cara de dormido','Cualquiera','individual',false,'Foto robada con humor. Solo vale si el retratado se ríe después.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('22','🥃','Chupito de Calisay con la cara que se te quede','Ruta','individual',false,'Foto justo después de tomarlo, con el vaso vacío a la vista.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('23','💃','Bailar con alguien que no conozcas en la discoteca','Noche','individual',false,'Foto del baile con alguien ajeno al grupo. Solo si quiere salir.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('24','🥴','Vaso vacío boca abajo sobre la cabeza','Ruta','individual',false,'Foto con el vaso vacío boca abajo sobre la cabeza, sin que se caiga.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('25','📸','Foto del grupo entero en la barra de un bar','Ruta','grupal',false,'Todos en la barra y todos en la foto. Vale una sola para todos.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('26','🎧','Que pongan tu canción en la discoteca','Noche','individual',false,'Foto con el DJ o con la canción sonando y tú en el plano. Vale que se vea la pantalla.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('27','🕺','Peor baile del día','Noche','jurado',false,'Foto o vídeo corto del baile. Decide el jurado.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('28','🧦','Algo navideño que lleves puesto, a la vista','Cualquiera','individual',false,'Calcetines, gorro, jersey feo o lo que lleves. Foto enseñándolo con orgullo.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('29','🎁','Regalo exprés a alguien del grupo','Ruta','individual',false,'Invita a una tapa o a un chupito a alguien del grupo. Foto del momento de dárselo.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('30','🌙','Foto de los últimos en pie','Cierre','grupal',false,'Mínimo 5 personas del grupo, de madrugada y sin una sola cara seria. Vale una sola para todos.',null,timestamptz '2026-12-27 08:00:00+01')
on conflict (id) do update set
  icono = excluded.icono, titulo = excluded.titulo, franja = excluded.franja, tipo = excluded.tipo,
  fijo = excluded.fijo, pista = excluded.pista, desde = excluded.desde, hasta = excluded.hasta;

-- Premium challenges: outside the cards, anyone can try them; the first one the jury approves (2 of 3) wins.
-- None defined yet. To create one: add its row above (id 31, 32...) and list its id in the array below;
-- it then gets its own prize line (editable from Admin > Premios) and shows up in the Premios tab.
update public.retos set premium = (id = any (array[]::text[]));
insert into public.premios (tipo, reto, puesto)
  select 'premium', id, 1 from public.retos where premium
  on conflict (tipo, reto, puesto) do nothing;
delete from public.premios where tipo = 'premium' and reto not in (select id from public.retos where premium);

-- Cleanup: the "Bizum de Goria" test challenge (31) was dropped.
delete from public.fotos where reto = '31';
delete from public.retos where id = '31';
