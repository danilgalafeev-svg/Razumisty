create table if not exists public.typing_state (
  user_id uuid primary key references public.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.typing_state enable row level security;

drop policy if exists typing_state_select on public.typing_state;
create policy typing_state_select on public.typing_state
for select
using (true);

grant select on public.typing_state to anon;

do $$
begin
  alter publication supabase_realtime add table public.typing_state;
exception
  when duplicate_object then null;
end $$;

