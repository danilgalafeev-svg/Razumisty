alter table public.messages
  add column if not exists kind text not null default 'text',
  add column if not exists media_url text,
  add column if not exists media_duration integer;

update public.messages
set kind = 'text'
where kind is null;

insert into storage.buckets (id, name, public)
values ('circles', 'circles', true)
on conflict do nothing;

