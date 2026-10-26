-- NPGingo · Supabase schema (Postgres 15+/17)
-- Run once in the SQL Editor of the project. Idempotent where practical.
-- Auth model: one Supabase Auth user per player, email = <token>@npgingo.local,
-- created with the admin API (see supabase/seed-users.sh). A trigger builds the player profile.

create extension if not exists pgcrypto;

-- ───────────────────────── Tables ─────────────────────────

create table if not exists public.jugadores (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null unique,
  es_admin    boolean not null default false,
  cambio_pass boolean not null default true      -- true until the player sets their own password
);

-- Personal link tokens: only the admin can read them (to build the links).
create table if not exists public.enlaces (
  jugador_id uuid primary key references public.jugadores(id) on delete cascade,
  token      text not null unique
);

-- Server-side settings (e.g. default password). No policies and no grants: unreachable from clients.
create table if not exists public.ajustes (
  clave text primary key,
  valor text not null
);

create table if not exists public.retos (
  id     text primary key,                        -- '1'..'n', plus 'linea' and 'bingo'
  icono  text not null,
  titulo text not null,
  franja text not null,
  tipo   text not null check (tipo in ('individual','grupal','jurado','canto')),
  fijo   boolean not null default false,          -- centre cell of every card
  pista  text not null,
  desde  timestamptz                              -- jury cannot rule before this moment
);

create table if not exists public.cartones (
  jugador_id uuid primary key references public.jugadores(id) on delete cascade,
  celdas     text[] not null check (cardinality(celdas) = 9)   -- celdas[5] is the fixed challenge
);

create table if not exists public.jurado (
  jugador_id uuid primary key references public.jugadores(id) on delete cascade
);

create table if not exists public.fotos (
  id          uuid primary key default gen_random_uuid(),
  jugador_id  uuid not null references public.jugadores(id) on delete cascade,
  reto        text not null references public.retos(id),
  fila        smallint check (fila between 0 and 2),            -- only for 'linea' claims
  ruta        text not null unique,                             -- storage path: <jugador_id>/<uuid>.jpg
  estado      text not null default 'pend' check (estado in ('pend','ok','ko')),
  creada      timestamptz not null default now(),
  valorada_por uuid references public.jugadores(id),
  valorada_en  timestamptz,
  check ((reto = 'linea') = (fila is not null))
);
create unique index if not exists fotos_unica on public.fotos (jugador_id, reto, coalesce(fila, -1));

create table if not exists public.reacciones (
  foto_id    uuid not null references public.fotos(id) on delete cascade,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  emoji      text not null check (emoji in ('❤️','😂','🍆','🔥','👍','🖕','🚀')),
  primary key (foto_id, jugador_id, emoji)
);

create table if not exists public.ganadores (
  tipo    text primary key check (tipo in ('linea','bingo')),
  foto_id uuid not null references public.fotos(id) on delete cascade
);

-- ───────────────────────── Challenge pool (first iteration) ─────────────────────────

insert into public.retos (id, icono, titulo, franja, tipo, fijo, pista, desde) values
 ('1','🥃','2 chupitos de Jäger antes de las 18:00','Día','individual',false,'Foto con los 2 chupitos y la hora visible en el móvil.',null),
 ('2','🪂','Manteo a Maritsu','19:00 · Cá Maritsu','grupal',true,'Foto o vídeo corto del manteo. Vale una sola para todo el grupo.',null),
 ('3','😁','Foto con Jose, de Bar La Plaza, sonriendo','Ruta','individual',false,'Selfie con Jose. Los dos sonriendo, que se vean los dientes.',null),
 ('4','💋','Pico a un chico (que no sea tu pareja)','Cualquiera','individual',false,'Foto del pico. Solo vale si el otro quiere salir en la foto.',null),
 ('5','💋','Pico a una chica (que no sea tu pareja)','Cualquiera','individual',false,'Foto del pico. Solo vale si ella quiere salir en la foto.',null),
 ('6','🔥','Foto al pibón de la noche','Noche','jurado',false,'Que sepa que sale en la foto y se lo tome con humor. Decide el jurado.', timestamptz '2026-12-27 12:00:00+01'),
 ('7','🐴','Montar a borriquito a Angelines','Nuevo Café','individual',false,'Foto montando a Angelines. Solo si Angelines se apunta.',null),
 ('8','🏆','Mejor atuendo del día','Cena','jurado',false,'Foto del atuendo completo. Vota el jurado en la cena.',null),
 ('9','💩','Peor atuendo del día','Cena','jurado',false,'Foto del atuendo completo. Vota el jurado en la cena.',null),
 ('10','📝','Teléfono en una servilleta a una chica','Noche','individual',false,'Foto de la servilleta entregada, o que otra persona te haga la foto mientras la entregas.',null),
 ('11','🎤','Cantar «Mané Mané»','Nuevo Café','grupal',false,'Foto o vídeo corto del grupo cantando. Vale una sola para todos.',null),
 ('12','💡','Encender las luces de la discoteca al cerrar','Cierre','individual',false,'Foto con las luces ya encendidas, tú en el plano y la hora visible en el móvil.',null),
 ('linea','🎯','¡Línea!','Al completarla','canto',false,'Foto tuya con el cartón abierto en el móvil y una fila horizontal completa a la vista. Solo valen las filas.',null),
 ('bingo','🏁','¡Bingo!','Al completarlo','canto',false,'Foto tuya con el cartón abierto en el móvil y los 9 sellos a la vista.',null)
on conflict (id) do update set
  icono = excluded.icono, titulo = excluded.titulo, franja = excluded.franja, tipo = excluded.tipo,
  fijo = excluded.fijo, pista = excluded.pista, desde = excluded.desde;

-- ───────────────────────── Helpers ─────────────────────────

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from jugadores where id = auth.uid()), false);
$$;

create or replace function public.es_jurado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jurado where jugador_id = auth.uid());
$$;

-- Can the caller claim 'linea' (row p_fila, 0-based) or 'bingo'? Needs the stamps (validated photos).
create or replace function public.puede_cantar(p_reto text, p_fila int) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  c text[]; r text; faltan int := 0;
begin
  select celdas into c from cartones where jugador_id = auth.uid();
  if c is null then return false; end if;
  if p_reto = 'linea' then
    if p_fila is null or p_fila not between 0 and 2 then return false; end if;
    for i in 1..3 loop
      r := c[p_fila * 3 + i];
      if not exists (select 1 from fotos where jugador_id = auth.uid() and reto = r and estado = 'ok') then
        faltan := faltan + 1;
      end if;
    end loop;
    return faltan = 0;
  elsif p_reto = 'bingo' then
    foreach r in array c loop
      if not exists (select 1 from fotos where jugador_id = auth.uid() and reto = r and estado = 'ok') then
        return false;
      end if;
    end loop;
    return true;
  end if;
  return false;
end $$;

-- ───────────────────────── Profile creation on signup ─────────────────────────
-- The admin API creates the user with user_metadata {"nombre": "...", "admin": true|false}.

create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Players (synthetic @npgingo.local email) must change the initial password; the admin chose hers.
  insert into jugadores (id, nombre, es_admin, cambio_pass)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
          coalesce((new.raw_user_meta_data ->> 'admin')::boolean, false),
          new.email like '%@npgingo.local');
  if new.email like '%@npgingo.local' then
    insert into enlaces (jugador_id, token) values (new.id, split_part(new.email, '@', 1));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- ───────────────────────── Public / player RPCs ─────────────────────────

-- Login screen: resolve the personal link token to a display name (no auth needed).
create or replace function public.nombre_por_token(p_token text) returns text
language sql stable security definer set search_path = public as $$
  select j.nombre from enlaces e join jugadores j on j.id = e.jugador_id where e.token = p_token;
$$;

-- Called by the client right after the player sets their own password.
-- Fails if the password is still the default one (so the forced change cannot be skipped).
create or replace function public.pass_cambiada() returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare v text; h text;
begin
  select valor into v from ajustes where clave = 'pass_defecto';
  select encrypted_password into h from auth.users where id = auth.uid();
  if v is not null and h = crypt(v, h) then
    raise exception 'Tienes que elegir una contraseña distinta de la inicial';
  end if;
  update jugadores set cambio_pass = false where id = auth.uid();
end $$;

-- Jury ruling. Server-side checks: juror, not own photo, still pending, valuation time reached.
create or replace function public.valorar(p_foto uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare f fotos%rowtype; v timestamptz;
begin
  if not exists (select 1 from jurado where jugador_id = auth.uid()) then
    raise exception 'No eres del jurado';
  end if;
  select * into f from fotos where id = p_foto for update;
  if not found then raise exception 'La foto no existe'; end if;
  if f.jugador_id = auth.uid() then raise exception 'No puedes valorar tus propias fotos'; end if;
  if f.estado <> 'pend' then raise exception 'Esa foto ya está valorada'; end if;
  select desde into v from retos where id = f.reto;
  if v is not null and now() < v then
    raise exception 'Todavía no se puede valorar (desde %)', v;
  end if;

  update fotos set estado = case when p_ok then 'ok' else 'ko' end,
                   valorada_por = auth.uid(), valorada_en = now()
  where id = p_foto;

  if p_ok and f.reto in ('linea','bingo') then
    insert into ganadores (tipo, foto_id) values (f.reto, f.id) on conflict (tipo) do nothing;
  end if;
end $$;

-- ───────────────────────── Admin RPCs ─────────────────────────

-- Reset a player's password to the default one and force a new change (forgotten password).
create or replace function public.resetear_pass(p_jugador uuid) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare v text;
begin
  if not es_admin() then raise exception 'Solo el admin'; end if;
  select valor into v from ajustes where clave = 'pass_defecto';
  if v is null then raise exception 'Falta ajustes.pass_defecto (lo carga seed-users.sh)'; end if;
  update auth.users set encrypted_password = crypt(v, gen_salt('bf')) where id = p_jugador;
  update jugadores set cambio_pass = true where id = p_jugador;
end $$;

-- Draw: admin always + 2 random players. DESTRUCTIVE for the previous draw (replaces it).
create or replace function public.sortear_jurado() returns setof uuid
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el admin'; end if;
  delete from jurado where true;
  insert into jurado (jugador_id) select id from jugadores where es_admin;
  insert into jurado (jugador_id)
    select id from jugadores where not es_admin order by random() limit 2;
  return query select jugador_id from jurado;
end $$;

-- Deal one fixed card per player. Refuses to overwrite existing cards unless p_forzar = true (DESTRUCTIVE:
-- cards are also dealt only once because "el que te toque, te tocó").
create or replace function public.repartir_cartones(p_forzar boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare j record; pool text[]; v_fijo text; n int := 0;
begin
  if not es_admin() then raise exception 'Solo el admin'; end if;
  if exists (select 1 from cartones) and not p_forzar then
    raise exception 'Ya hay cartones repartidos. Usa p_forzar = true para rehacerlos (borra su progreso).';
  end if;
  if p_forzar then delete from cartones where true; end if;
  select r.id into v_fijo from retos r where r.fijo limit 1;
  for j in select id from jugadores loop
    select array_agg(id) into pool
      from (select r.id from retos r where not r.fijo and r.tipo <> 'canto' order by random() limit 8) s;
    if cardinality(pool) < 8 then raise exception 'El pool tiene menos de 8 retos'; end if;
    insert into cartones (jugador_id, celdas) values (j.id, pool[1:4] || v_fijo || pool[5:8]);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────────────────── Realtime (wall + reactions) ─────────────────────────

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.fotos; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.reacciones; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.ganadores; exception when duplicate_object then null; end;
  end if;
end $$;

-- ───────────────────────── Row Level Security ─────────────────────────

alter table public.jugadores  enable row level security;
alter table public.enlaces    enable row level security;
alter table public.retos      enable row level security;
alter table public.cartones   enable row level security;
alter table public.jurado     enable row level security;
alter table public.fotos      enable row level security;
alter table public.reacciones enable row level security;
alter table public.ganadores  enable row level security;
alter table public.ajustes    enable row level security;   -- no policies: clients cannot read it

-- Clients never write directly except photos / reactions (policies below); everything else goes via RPC.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.jugadores, public.retos, public.cartones, public.jurado,
                public.fotos, public.reacciones, public.ganadores, public.enlaces to authenticated;
grant insert, delete on public.fotos to authenticated;
grant insert, delete on public.reacciones to authenticated;

revoke all on function public.nombre_por_token(text) from public;
grant execute on function public.nombre_por_token(text) to anon, authenticated;
revoke all on function public.pass_cambiada(), public.valorar(uuid, boolean), public.sortear_jurado(),
                       public.repartir_cartones(boolean), public.puede_cantar(text, int),
                       public.es_admin(), public.es_jurado(), public.resetear_pass(uuid) from public;
grant execute on function public.pass_cambiada(), public.valorar(uuid, boolean), public.sortear_jurado(),
                          public.repartir_cartones(boolean), public.puede_cantar(text, int),
                          public.es_admin(), public.es_jurado(), public.resetear_pass(uuid) to authenticated;

drop policy if exists jugadores_leer on public.jugadores;
create policy jugadores_leer on public.jugadores for select to authenticated using (true);

drop policy if exists enlaces_admin on public.enlaces;
create policy enlaces_admin on public.enlaces for select to authenticated using (public.es_admin());

drop policy if exists retos_leer on public.retos;
create policy retos_leer on public.retos for select to authenticated using (true);

-- Every player can see every card (needed for the wall and the jury review of a bingo).
drop policy if exists cartones_leer on public.cartones;
create policy cartones_leer on public.cartones for select to authenticated using (true);

drop policy if exists jurado_leer on public.jurado;
create policy jurado_leer on public.jurado for select to authenticated using (true);

drop policy if exists ganadores_leer on public.ganadores;
create policy ganadores_leer on public.ganadores for select to authenticated using (true);

-- Photos: own, validated (wall) or, for jurors, anything pending.
drop policy if exists fotos_leer on public.fotos;
create policy fotos_leer on public.fotos for select to authenticated
  using (jugador_id = auth.uid() or estado = 'ok' or public.es_jurado());

drop policy if exists fotos_subir on public.fotos;
create policy fotos_subir on public.fotos for insert to authenticated
  with check (
    jugador_id = auth.uid()
    and estado = 'pend'
    and valorada_por is null
    and ruta like auth.uid()::text || '/%'
    and (
      exists (select 1 from cartones c where c.jugador_id = auth.uid() and reto = any (c.celdas))
      or (reto in ('linea','bingo') and public.puede_cantar(reto, fila))
    )
  );

drop policy if exists fotos_borrar on public.fotos;
create policy fotos_borrar on public.fotos for delete to authenticated
  using (jugador_id = auth.uid() and estado <> 'ok');

drop policy if exists reac_leer on public.reacciones;
create policy reac_leer on public.reacciones for select to authenticated using (true);

drop policy if exists reac_poner on public.reacciones;
create policy reac_poner on public.reacciones for insert to authenticated
  with check (jugador_id = auth.uid()
              and exists (select 1 from fotos f where f.id = foto_id and f.estado = 'ok'));

drop policy if exists reac_quitar on public.reacciones;
create policy reac_quitar on public.reacciones for delete to authenticated using (jugador_id = auth.uid());

-- ───────────────────────── Storage: private bucket "fotos" ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists fotos_obj_subir on storage.objects;
create policy fotos_obj_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists fotos_obj_borrar on storage.objects;
create policy fotos_obj_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Read: own files, validated photos (wall) or pending photos if you are a juror.
drop policy if exists fotos_obj_leer on storage.objects;
create policy fotos_obj_leer on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.fotos f
                 where f.ruta = name and (f.estado = 'ok' or public.es_jurado()))
    )
  );
