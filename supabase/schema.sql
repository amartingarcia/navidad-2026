-- NPGingo · Supabase schema (Postgres 15+/17)
-- Run once in the SQL Editor of the project. Idempotent where practical.
-- Auth model: one Supabase Auth user per player, email = <token>@npgingo.local,
-- created with the admin API (see supabase/seed-users.sh). A trigger builds the player profile.

create extension if not exists pgcrypto;

-- ───────────────────────── Migration v1 -> v2 (idempotent) ─────────────────────────
-- v1 sang línea/bingo with a photo; v2 claims are plain "cantos" voted by the jury (2 of 3).
do $$
begin
  if to_regclass('public.fotos') is not null then
    drop policy if exists fotos_subir on public.fotos;
    delete from public.fotos where reto in ('linea','bingo');
    drop index if exists public.fotos_unica;
    alter table public.fotos drop column if exists fila;      -- also drops its check constraint
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'ganadores' and column_name = 'foto_id') then
    drop table public.ganadores;                               -- old shape (tipo, foto_id)
  end if;
  if to_regclass('public.retos') is not null then
    delete from public.retos where id in ('linea','bingo');
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'premios' and column_name = 'cupo') then
    drop table public.premios;                                 -- v2 shape (tipo, cupo): now one row per prize
  end if;
end $$;
drop function if exists public.puede_cantar(text, int);

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
  id     text primary key,                        -- '1'..'n'
  icono  text not null,
  titulo text not null,
  franja text not null,
  tipo   text not null check (tipo in ('individual','grupal','jurado','canto')),
  fijo   boolean not null default false,          -- centre cell of every card
  pista  text not null,
  desde  timestamptz                              -- jury cannot rule before this moment
);
alter table public.retos add column if not exists hasta timestamptz;   -- deadline: no uploads, replacements or deletions after this moment

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
  ruta        text not null unique,                             -- storage path: <jugador_id>/<uuid>.jpg
  estado      text not null default 'pend' check (estado in ('pend','ok','ko')),
  creada      timestamptz not null default now(),
  valorada_por uuid references public.jugadores(id),
  valorada_en  timestamptz
);
create unique index if not exists fotos_unica_v2 on public.fotos (jugador_id, reto);

-- Photos are accepted as soon as they are uploaded (a player can redo a challenge by replacing it).
-- Only challenges with a valuation time (the night's "pibón") stay pending for the jury.
create or replace function public.foto_estado_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from retos r where r.id = new.reto and r.hasta is not null and now() > r.hasta) then
    raise exception 'El plazo de este reto ha terminado';
  end if;
  new.estado := case when exists (select 1 from retos r where r.id = new.reto and r.desde is not null) then 'pend' else 'ok' end;
  new.valorada_por := null; new.valorada_en := null;
  return new;
end $$;
drop trigger if exists fotos_estado_inicial on public.fotos;
create trigger fotos_estado_inicial before insert on public.fotos
  for each row execute function public.foto_estado_inicial();
-- Migration: photos that were waiting for the jury are accepted now (except timed challenges).
update public.fotos set estado = 'ok', valorada_en = coalesce(valorada_en, now())
 where estado = 'pend' and reto in (select id from public.retos where desde is null);

create table if not exists public.reacciones (
  foto_id    uuid not null references public.fotos(id) on delete cascade,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  emoji      text not null check (emoji in ('❤️','😂','🍆','🔥','👍','🖕','🚀')),
  primary key (foto_id, jugador_id, emoji)
);

-- Prizes in play, one row per podium place: 1st/2nd/3rd line and the bingo. `premio` null = still to be decided.
-- The number of rows of each type is the number of prizes available (the admin edits the text with definir_premio).
create table if not exists public.premios (
  tipo   text not null check (tipo in ('linea','bingo','premium')),
  reto   text not null default '',                 -- premium challenge id ('' for línea / bingo)
  puesto smallint not null check (puesto > 0),
  premio text,
  primary key (tipo, reto, puesto)
);
-- (the premium challenges' prizes are created by retos.sql, one per challenge)

-- A "canto" = a player shouting línea/bingo. No photo: the jury checks the player's validated photos
-- (3 of the row for a línea, all 9 for a bingo) and needs 2 approvals to accept it.
create table if not exists public.cantos (
  id           uuid primary key default gen_random_uuid(),
  jugador_id   uuid not null references public.jugadores(id) on delete cascade,
  tipo         text not null check (tipo in ('linea','bingo','premium')),
  fila         smallint check (fila between 0 and 2),            -- row (0-based) for 'linea'
  reto         text references public.retos(id) on delete cascade, -- premium challenge for 'premium'
  estado       text not null default 'pend' check (estado in ('pend','ok','ko')),
  creada       timestamptz not null default now(),
  resuelta_en  timestamptz,
  constraint cantos_fila_ck check ((tipo = 'linea') = (fila is not null)),
  constraint cantos_reto_ck check ((tipo = 'premium') = (reto is not null))
);

create table if not exists public.votos (
  canto_id  uuid not null references public.cantos(id) on delete cascade,
  jurado_id uuid not null references public.jugadores(id) on delete cascade,
  ok        boolean not null,
  creada    timestamptz not null default now(),
  primary key (canto_id, jurado_id)
);

create table if not exists public.ganadores (
  canto_id   uuid primary key references public.cantos(id) on delete cascade,
  tipo       text not null check (tipo in ('linea','bingo','premium')),
  reto       text not null default '',
  puesto     smallint not null check (puesto > 0),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  creada     timestamptz not null default now(),
  constraint ganadores_unico unique (tipo, reto, puesto)
);

-- Migration v2 -> v3 (idempotent): premium challenges + prizes per challenge.
alter table public.retos add column if not exists premium boolean not null default false;  -- outside the cards, first to win takes the prize
do $$
begin
  alter table public.premios add column if not exists reto text not null default '';
  alter table public.premios drop constraint if exists premios_pkey;
  alter table public.premios drop constraint if exists premios_tipo_check;
  alter table public.premios add constraint premios_tipo_check check (tipo in ('linea','bingo','premium'));
  if not exists (select 1 from pg_constraint where conrelid = 'public.premios'::regclass and contype = 'p') then
    alter table public.premios add primary key (tipo, reto, puesto);
  end if;

  alter table public.cantos add column if not exists reto text references public.retos(id) on delete cascade;
  alter table public.cantos drop constraint if exists cantos_tipo_check;
  alter table public.cantos add constraint cantos_tipo_check check (tipo in ('linea','bingo','premium'));
  alter table public.cantos drop constraint if exists cantos_check;
  alter table public.cantos drop constraint if exists cantos_fila_ck;
  alter table public.cantos add constraint cantos_fila_ck check ((tipo = 'linea') = (fila is not null));
  alter table public.cantos drop constraint if exists cantos_reto_ck;
  alter table public.cantos add constraint cantos_reto_ck check ((tipo = 'premium') = (reto is not null));

  alter table public.ganadores add column if not exists reto text not null default '';
  alter table public.ganadores drop constraint if exists ganadores_tipo_puesto_key;
  alter table public.ganadores drop constraint if exists ganadores_tipo_check;
  alter table public.ganadores add constraint ganadores_tipo_check check (tipo in ('linea','bingo','premium'));
  alter table public.ganadores drop constraint if exists ganadores_unico;
  alter table public.ganadores add constraint ganadores_unico unique (tipo, reto, puesto);
end $$;
drop index if exists public.cantos_un_pendiente;
create unique index if not exists cantos_un_pendiente_v3 on public.cantos (jugador_id, tipo, (coalesce(reto, ''))) where estado = 'pend';
insert into public.premios (tipo, puesto) values ('linea', 1), ('linea', 2), ('linea', 3), ('bingo', 1)
  on conflict (tipo, reto, puesto) do nothing;
drop function if exists public.cantar(text);
drop function if exists public.definir_premio(text, int, text);

-- Challenges live in supabase/retos.sql (run it after this file, before dealing the cards).
-- ───────────────────────── Helpers ─────────────────────────

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from jugadores where id = auth.uid()), false);
$$;

create or replace function public.es_jurado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jurado where jugador_id = auth.uid());
$$;

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
end $$;

-- A player shouts línea (a complete row of photos), bingo (all 9) or claims a premium challenge (p_reto) they
-- have already uploaded the proof for. No photo goes with the canto itself; the jury votes on it.
create or replace function public.cantar(p_tipo text, p_reto text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c text[]; v_fila int := null; v_cupo int; v_id uuid; i int; v_reto text := coalesce(p_reto, '');
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if p_tipo not in ('linea','bingo','premium') then raise exception 'Tipo no válido'; end if;
  if (p_tipo = 'premium') <> (p_reto is not null) then raise exception 'Tipo no válido'; end if;
  if p_tipo = 'premium' and not exists (select 1 from retos r where r.id = p_reto and r.premium) then
    raise exception 'Ese reto no es premium';
  end if;
  select count(*) into v_cupo from premios pr where pr.tipo = p_tipo and pr.reto = v_reto;
  if (select count(*) from ganadores g where g.tipo = p_tipo and g.reto = v_reto) >= v_cupo then
    raise exception 'Ya se han llevado todos los premios de este tipo';
  end if;
  if exists (select 1 from ganadores g where g.tipo = p_tipo and g.reto = v_reto and g.jugador_id = auth.uid()) then
    raise exception 'Ya has ganado esto';
  end if;
  if exists (select 1 from cantos k where k.jugador_id = auth.uid() and k.tipo = p_tipo and coalesce(k.reto, '') = v_reto and k.estado = 'pend') then
    raise exception 'Ya lo has cantado: espera al jurado';
  end if;

  if p_tipo = 'premium' then
    if not exists (select 1 from fotos f where f.jugador_id = auth.uid() and f.reto = p_reto and f.estado = 'ok') then
      raise exception 'Primero sube la prueba';
    end if;
  else
    select celdas into c from cartones where jugador_id = auth.uid();
    if c is null then raise exception 'Todavía no tienes cartón'; end if;
    if p_tipo = 'linea' then
      for i in 0..2 loop
        if (select count(*) from fotos f
            where f.jugador_id = auth.uid() and f.estado = 'ok'
              and f.reto = any (array[c[i * 3 + 1], c[i * 3 + 2], c[i * 3 + 3]])) = 3 then
          v_fila := i; exit;
        end if;
      end loop;
      if v_fila is null then raise exception 'No tienes ninguna fila completa'; end if;
    elsif (select count(distinct f.reto) from fotos f
           where f.jugador_id = auth.uid() and f.estado = 'ok' and f.reto = any (c)) < 9 then
      raise exception 'Te faltan sellos para el bingo';
    end if;
  end if;

  insert into cantos (jugador_id, tipo, fila, reto) values (auth.uid(), p_tipo, v_fila, p_reto) returning id into v_id;
  return v_id;
end $$;

-- Jury vote on a canto. It is accepted with 2 approvals and rejected as soon as 2 approvals are impossible
-- (the claimant never votes on their own canto). Prizes go in order of acceptance; when the last one is
-- taken, the other pending cantos of that type are closed.
create or replace function public.votar_canto(p_canto uuid, p_ok boolean) returns text
language plpgsql security definer set search_path = public as $$
declare k cantos%rowtype; v_si int; v_no int; v_elegibles int; v_cupo int; v_ocupados int; v_estado text := 'pend';
begin
  if not exists (select 1 from jurado where jugador_id = auth.uid()) then raise exception 'No eres del jurado'; end if;
  perform pg_advisory_xact_lock(hashtext('cantos'));
  select * into k from cantos where id = p_canto for update;
  if not found then raise exception 'Ese canto no existe'; end if;
  if k.jugador_id = auth.uid() then raise exception 'No puedes votar tu propio canto'; end if;
  if k.estado <> 'pend' then raise exception 'Ese canto ya está resuelto'; end if;
  if exists (select 1 from votos where canto_id = p_canto and jurado_id = auth.uid()) then raise exception 'Ya has votado'; end if;

  insert into votos (canto_id, jurado_id, ok) values (p_canto, auth.uid(), p_ok);
  select count(*) filter (where v.ok), count(*) filter (where not v.ok) into v_si, v_no from votos v where v.canto_id = p_canto;
  select count(*) into v_elegibles from jurado j where j.jugador_id <> k.jugador_id;

  if v_si >= 2 then
    select count(*) into v_cupo from premios pr where pr.tipo = k.tipo and pr.reto = coalesce(k.reto, '');
    select count(*) into v_ocupados from ganadores g where g.tipo = k.tipo and g.reto = coalesce(k.reto, '');
    if v_ocupados < v_cupo then
      insert into ganadores (canto_id, tipo, reto, puesto, jugador_id) values (k.id, k.tipo, coalesce(k.reto, ''), v_ocupados + 1, k.jugador_id);
      update cantos set estado = 'ok', resuelta_en = now() where id = k.id;
      v_estado := 'ok';
      if v_ocupados + 1 >= v_cupo then
        update cantos set estado = 'ko', resuelta_en = now() where tipo = k.tipo and coalesce(reto, '') = coalesce(k.reto, '') and estado = 'pend';
      end if;
    else
      update cantos set estado = 'ko', resuelta_en = now() where id = k.id;
      v_estado := 'ko';
    end if;
  elsif v_elegibles - v_no < 2 then
    update cantos set estado = 'ko', resuelta_en = now() where id = k.id;
    v_estado := 'ko';
  end if;
  return v_estado;
end $$;

-- ───────────────────────── Admin RPCs ─────────────────────────

-- Set the text of a prize (p_tipo 'linea'|'bingo'|'premium', p_puesto 1..n, p_reto for premium). Empty = to be decided.
create or replace function public.definir_premio(p_tipo text, p_puesto int, p_premio text, p_reto text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el admin'; end if;
  update premios set premio = nullif(btrim(p_premio), '')
   where tipo = p_tipo and puesto = p_puesto and reto = coalesce(p_reto, '');
  if not found then raise exception 'Ese premio no existe'; end if;
end $$;

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
      from (select r.id from retos r where not r.fijo and not r.premium and r.tipo <> 'canto' order by random() limit 8) s;
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
    begin alter publication supabase_realtime add table public.cantos; exception when duplicate_object then null; end;
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
alter table public.premios    enable row level security;
alter table public.cantos     enable row level security;
alter table public.votos      enable row level security;
alter table public.ajustes    enable row level security;   -- no policies: clients cannot read it

-- Clients never write directly except photos / reactions (policies below); everything else goes via RPC.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.jugadores, public.retos, public.cartones, public.jurado, public.fotos,
                public.reacciones, public.ganadores, public.enlaces, public.premios, public.cantos, public.votos to authenticated;
grant insert, delete on public.fotos to authenticated;
grant insert, delete on public.reacciones to authenticated;

-- The server-side role (service_role, used by supabase/seed-users.sh) needs explicit grants too:
-- newer Supabase projects no longer grant privileges on new tables automatically.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.nombre_por_token(text) from public;
grant execute on function public.nombre_por_token(text) to anon, authenticated;
revoke all on function public.pass_cambiada(), public.valorar(uuid, boolean), public.sortear_jurado(),
                       public.repartir_cartones(boolean), public.cantar(text, text), public.votar_canto(uuid, boolean),
                       public.es_admin(), public.es_jurado(), public.resetear_pass(uuid), public.definir_premio(text, int, text, text) from public;
grant execute on function public.pass_cambiada(), public.valorar(uuid, boolean), public.sortear_jurado(),
                          public.repartir_cartones(boolean), public.cantar(text, text), public.votar_canto(uuid, boolean),
                          public.es_admin(), public.es_jurado(), public.resetear_pass(uuid), public.definir_premio(text, int, text, text) to authenticated;
grant execute on all functions in schema public to service_role;

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

drop policy if exists premios_leer on public.premios;
create policy premios_leer on public.premios for select to authenticated using (true);

-- Cantos: your own, accepted ones (winners) and, for jurors, the pending ones. Votes: jurors only.
drop policy if exists cantos_leer on public.cantos;
create policy cantos_leer on public.cantos for select to authenticated
  using (jugador_id = auth.uid() or estado = 'ok' or public.es_jurado());

drop policy if exists votos_leer on public.votos;
create policy votos_leer on public.votos for select to authenticated using (public.es_jurado());

-- Photos: own, validated (wall) or, for jurors, anything pending.
drop policy if exists fotos_leer on public.fotos;
create policy fotos_leer on public.fotos for select to authenticated
  using (jugador_id = auth.uid() or estado = 'ok' or public.es_jurado());

drop policy if exists fotos_subir on public.fotos;
create policy fotos_subir on public.fotos for insert to authenticated
  with check (
    jugador_id = auth.uid()
    and ruta like auth.uid()::text || '/%'
    and (exists (select 1 from cartones c where c.jugador_id = auth.uid() and reto = any (c.celdas))
         or exists (select 1 from retos r where r.id = reto and r.premium))
  );

drop policy if exists fotos_borrar on public.fotos;
create policy fotos_borrar on public.fotos for delete to authenticated
  using (jugador_id = auth.uid()
         and not exists (select 1 from retos r where r.id = reto and r.hasta is not null and now() > r.hasta));

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
