alter table public.users
  add column if not exists is_moderator boolean not null default false,
  add column if not exists is_blocked boolean not null default false;

update public.users
set is_moderator = true
where lower(nickname) = 'galkanorth';
