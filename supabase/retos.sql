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
 ('12','💡','Encender las luces de la discoteca al cerrar','Cierre','individual',false,'Foto con las luces ya encendidas, tú en el plano.',null,timestamptz '2026-12-27 08:00:00+01')
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
