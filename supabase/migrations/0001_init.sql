-- Schema for "Messenger" (tz.txt)

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  password_hash text not null,
  avatar_emoji text not null default '🙂',
  created_at timestamptz not null default now()
);

create unique index if not exists users_nickname_lower_uniq on public.users (lower(nickname));

-- Public-safe mirror (no password_hash)
create table if not exists public.user_public (
  id uuid primary key references public.users (id) on delete cascade,
  nickname text not null,
  avatar_emoji text not null,
  created_at timestamptz not null
);

create unique index if not exists user_public_nickname_lower_uniq on public.user_public (lower(nickname));

create or replace function public.sync_user_public()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.user_public (id, nickname, avatar_emoji, created_at)
    values (new.id, new.nickname, new.avatar_emoji, new.created_at);
    return new;
  elsif (tg_op = 'UPDATE') then
    update public.user_public
      set nickname = new.nickname,
          avatar_emoji = new.avatar_emoji
      where id = new.id;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_user_public on public.users;
create trigger trg_sync_user_public
after insert or update of nickname, avatar_emoji
on public.users
for each row
execute function public.sync_user_public();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  text text not null,
  reply_to uuid null references public.messages (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at);
create index if not exists messages_user_id_idx on public.messages (user_id);
create index if not exists messages_reply_to_idx on public.messages (reply_to);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists sessions_token_hash_uniq on public.sessions (token_hash);
create index if not exists sessions_user_id_idx on public.sessions (user_id);

alter table public.users enable row level security;
alter table public.user_public enable row level security;
alter table public.messages enable row level security;
alter table public.sessions enable row level security;

-- Public read access (chat is global)
drop policy if exists user_public_select on public.user_public;
create policy user_public_select on public.user_public
for select
using (true);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
for select
using (true);

-- Grants (RLS doesn't replace privileges)
grant usage on schema public to anon;
grant select on public.user_public to anon;
grant select on public.messages to anon;

-- Realtime publication
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

