-- ============================================================
--  WireNerd Forum — Reply Notifications
--  Run once in Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade, -- recipient
  actor_name  text,
  type        text not null default 'reply',
  post_id     uuid references public.forum_posts(id) on delete cascade,
  post_title  text,
  read        boolean not null default false,
  created_at  timestamptz default now()
);
alter table public.notifications enable row level security;

drop policy if exists "notif_read"   on public.notifications;
drop policy if exists "notif_update" on public.notifications;
create policy "notif_read"   on public.notifications for select using (auth.uid() = user_id);
create policy "notif_update" on public.notifications for update using (auth.uid() = user_id);
-- (no client insert policy: the trigger below creates notifications)

-- When a reply is posted, notify the post's author — but not if you reply to your own post.
create or replace function public.notify_post_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; aname text; ptitle text;
begin
  select user_id, title into author, ptitle from public.forum_posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    select coalesce(display_name, 'Someone') into aname from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, actor_name, type, post_id, post_title)
    values (author, aname, 'reply', new.post_id, ptitle);
  end if;
  return new;
end; $$;

drop trigger if exists on_reply_notify on public.forum_replies;
create trigger on_reply_notify after insert on public.forum_replies
  for each row execute function public.notify_post_author();

-- Enable realtime so the bell updates instantly (idempotent).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Done.
