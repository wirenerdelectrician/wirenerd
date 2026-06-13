-- ============================================================
--  WireNerd Forum + Profiles — Supabase setup
--  Run this once in Supabase → SQL Editor → New query → Run.
--  Safe to re-run (uses IF NOT EXISTS / OR REPLACE / ON CONFLICT).
-- ============================================================

-- ---------- PROFILES (display name, bio, avatar) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio          text,
  avatar_url   text,
  created_at   timestamptz default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill profiles for any users who signed up before this ran
insert into public.profiles (id, display_name)
select u.id, split_part(u.email,'@',1) from auth.users u
on conflict (id) do nothing;

-- ---------- FORUM POSTS ----------
create table if not exists public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null default 'General Q&A',
  title      text not null,
  body       text not null,
  created_at timestamptz default now()
);
alter table public.forum_posts enable row level security;

drop policy if exists "posts_read"   on public.forum_posts;
drop policy if exists "posts_insert" on public.forum_posts;
drop policy if exists "posts_update" on public.forum_posts;
drop policy if exists "posts_delete" on public.forum_posts;
create policy "posts_read"   on public.forum_posts for select using (true);
create policy "posts_insert" on public.forum_posts for insert with check (auth.uid() = user_id);
create policy "posts_update" on public.forum_posts for update using (auth.uid() = user_id);
create policy "posts_delete" on public.forum_posts for delete using (auth.uid() = user_id);

-- ---------- FORUM REPLIES ----------
create table if not exists public.forum_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);
alter table public.forum_replies enable row level security;

drop policy if exists "replies_read"   on public.forum_replies;
drop policy if exists "replies_insert" on public.forum_replies;
drop policy if exists "replies_delete" on public.forum_replies;
create policy "replies_read"   on public.forum_replies for select using (true);
create policy "replies_insert" on public.forum_replies for insert with check (auth.uid() = user_id);
create policy "replies_delete" on public.forum_replies for delete using (auth.uid() = user_id);

-- ---------- AVATAR STORAGE (profile pictures) ----------
insert into storage.buckets (id, name, public)
values ('avatars','avatars', true)
on conflict (id) do nothing;

-- Anyone can view avatars; a user can only write files in their own folder (avatars/<uid>/...)
drop policy if exists "avatars_read"   on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_read"   on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars_update" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ---------- POST IMAGES (pictures in posts & replies) ----------
alter table public.forum_posts   add column if not exists image_url text;
alter table public.forum_replies add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('post-images','post-images', true)
on conflict (id) do nothing;

drop policy if exists "postimg_read"   on storage.objects;
drop policy if exists "postimg_insert" on storage.objects;
create policy "postimg_read"   on storage.objects for select using (bucket_id = 'post-images');
create policy "postimg_insert" on storage.objects for insert
  with check (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- Done.
