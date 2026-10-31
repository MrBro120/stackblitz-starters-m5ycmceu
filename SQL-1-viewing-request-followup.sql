-- House Connect: viewing request follow-up (run once in Supabase > SQL Editor)

alter table public.viewing_requests
  add column if not exists followed_up_at timestamptz,
  add column if not exists followed_up_by uuid references auth.users(id);

-- Let the admin see and update ALL viewing requests.
-- (Harmless if Row Level Security is off; needed if it is on.)
drop policy if exists "Admins read all viewing requests" on public.viewing_requests;
create policy "Admins read all viewing requests"
  on public.viewing_requests for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins update viewing requests" on public.viewing_requests;
create policy "Admins update viewing requests"
  on public.viewing_requests for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
