-- NPGingo · challenge pool. Run in the Supabase SQL Editor AFTER schema.sql and BEFORE dealing the cards.
-- THIS FILE IS THE SOURCE OF TRUTH: the challenges listed here are created/updated and every other challenge
-- is DELETED (with its photos). Cards that contain a deleted challenge are deleted too: deal them again from Admin.
-- Idempotent: re-running leaves the same result. `desde` = the jury cannot rule before it; `hasta` = deadline.

drop table if exists pg_temp._retos_vivos;
create temp table _retos_vivos (id text primary key);

with nuevos as (
  insert into public.retos (id, icono, titulo, franja, tipo, fijo, pista, desde, hasta) values
 ('1','🥃','2 chupitos de Jäger antes de las 18:00','Día','individual',false,'Foto con los 2 chupitos y la hora visible en el móvil.',null,timestamptz '2026-12-26 18:00:00+01'),
 ('2','🪂','Manteo a Maritsu','19:00 · Cá Maritsu','grupal',true,'Foto del manteo. Vale una sola para todo el grupo.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('3','😁','Foto con Jose, de Bar La Plaza, sonriendo','Ruta','individual',false,'Selfie con Jose. Los dos sonriendo, que se vean los dientes.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('4','💋','Pico a un tío','Cualquiera','individual',false,'Foto del pico. Solo vale si la otra persona quiere salir en la foto.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('5','💋','Pico a una tía','Cualquiera','individual',false,'Foto del pico. Solo vale si la otra persona quiere salir en la foto.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('6','🔥','Pibón de la jornada','Noche','individual',false,'Que sepa que sale en la foto y se lo tome con humor. Cada uno sube la suya y votamos: gana la más votada.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('7','🐴','Montar a borriquito a Angelines','Nuevo Café','individual',false,'Foto montando a Angelines. Solo si Angelines se apunta.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('8','🏆','Mejor outfit del día','Cena','jurado',false,'Foto del outfit completo, de cuerpo entero.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('9','💩','Peor outfit del día','Cena','jurado',false,'Foto del outfit completo, de cuerpo entero.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('10','📝','Teléfono en una servilleta a una chica','Noche','individual',false,'Foto de la servilleta entregada, o que otra persona te haga la foto mientras la entregas.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('11','🎤','Cantar «Mané Mané»','Nuevo Café','grupal',false,'Foto del grupo cantando. Vale una sola para todos.',null,timestamptz '2026-12-27 08:00:00+01'),
 ('12','💡','Encender las luces de la discoteca al cerrar','Cierre','individual',false,'Foto con las luces ya encendidas, tú en el plano.',null,timestamptz '2026-12-27 08:00:00+01')
  on conflict (id) do update set
    icono = excluded.icono, titulo = excluded.titulo, franja = excluded.franja, tipo = excluded.tipo,
    fijo = excluded.fijo, pista = excluded.pista, desde = excluded.desde, hasta = excluded.hasta
  returning id
)
insert into _retos_vivos select id from nuevos;

-- Premium challenges: outside the cards, anyone can try them (own prize each, editable from Admin > Premios).
--  · Normal premium: the first proof the jury approves (2 of 3) wins.
--  · Photo contest (listed in the second array too): everyone uploads a photo, every player has one vote, the most
--    voted wins when voting closes (voto_hasta). Here: '6' = Pibón de la jornada, votes close 27 Dec 12:00.
update public.retos set premium = (id = any (array['6']::text[]));
update public.retos set voto_hasta = case when id = '6' then timestamptz '2026-12-27 12:00:00+01' end;
insert into public.premios (tipo, reto, puesto)
  select 'premium', id, 1 from public.retos where premium
  on conflict (tipo, reto, puesto) do nothing;
delete from public.premios where tipo = 'premium' and reto not in (select id from public.retos where premium);

-- Cards that contain a premium challenge are invalid (premium goes outside the cards): deal them again.
delete from public.cartones c
 where exists (select 1 from unnest(c.celdas) x where x in (select id from public.retos where premium));
-- Photos waiting for the jury only make sense for retos with `desde`.
update public.fotos set estado = 'ok', valorada_en = coalesce(valorada_en, now())
 where estado = 'pend' and reto in (select id from public.retos where desde is null);

-- Sync: delete everything that is not listed above.
delete from public.fotos where reto not in (select id from _retos_vivos);
delete from public.cartones c
 where exists (select 1 from unnest(c.celdas) x where x not in (select id from _retos_vivos));
delete from public.retos where id not in (select id from _retos_vivos);

drop table if exists pg_temp._retos_vivos;
