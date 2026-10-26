-- NPGingo · challenge pool. Run in the Supabase SQL Editor AFTER schema.sql and BEFORE dealing the cards.
-- THIS FILE IS THE SOURCE OF TRUTH: the challenges listed here are created/updated and every other challenge
-- is DELETED (with its photos). Cards that contain a deleted challenge are deleted too: deal them again from Admin.
-- Idempotent: re-running leaves the same result. `desde` = the jury cannot rule before it; `hasta` = deadline.

drop table if exists pg_temp._retos_vivos;
create temp table _retos_vivos (id text primary key);

with nuevos as (
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
    fijo = excluded.fijo, pista = excluded.pista, desde = excluded.desde, hasta = excluded.hasta
  returning id
)
insert into _retos_vivos select id from nuevos;

-- Premium challenges: outside the cards, anyone can try them; the first one the jury approves (2 of 3) wins.
-- None defined yet. To create one: add its row above (id 13...) and list its id in the array below;
-- it then gets its own prize line (editable from Admin > Premios) and shows up in the Premios tab.
update public.retos set premium = (id = any (array[]::text[]));
insert into public.premios (tipo, reto, puesto)
  select 'premium', id, 1 from public.retos where premium
  on conflict (tipo, reto, puesto) do nothing;
delete from public.premios where tipo = 'premium' and reto not in (select id from public.retos where premium);

-- Sync: delete everything that is not listed above.
delete from public.fotos where reto not in (select id from _retos_vivos);
delete from public.cartones c
 where exists (select 1 from unnest(c.celdas) x where x not in (select id from _retos_vivos));
delete from public.retos where id not in (select id from _retos_vivos);

drop table if exists pg_temp._retos_vivos;
