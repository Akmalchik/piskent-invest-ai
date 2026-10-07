-- Run this in the Supabase SQL editor after reviewing it for your project.
-- The public application may read data, but only trusted server-side roles may write.

alter table public.piskent_plots enable row level security;
alter table public.district_profile enable row level security;

drop policy if exists "Public can read plots" on public.piskent_plots;
create policy "Public can read plots"
on public.piskent_plots for select
to anon, authenticated
using (true);

drop policy if exists "Public can read district profile" on public.district_profile;
create policy "Public can read district profile"
on public.district_profile for select
to anon, authenticated
using (true);

-- No INSERT/UPDATE/DELETE policy is intentionally created for anon/authenticated.
-- Administrative writes must use a server-only service-role client after this policy is enabled.

insert into storage.buckets (id, name, public)
values ('plot-images', 'plot-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read plot images" on storage.objects;
create policy "Public can read plot images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'plot-images');

-- No public upload/update/delete policy is created for plot-images.
