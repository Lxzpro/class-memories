-- 拾光簿：单班级照片纪念网站初始数据库结构
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'member');
create type public.user_status as enum ('pending', 'approved', 'rejected');
create type public.photo_visibility as enum ('class', 'tagged_people', 'selected', 'private');
create type public.review_status as enum ('draft', 'published', 'hidden', 'deleted');
create type public.consent_status as enum ('pending', 'approved', 'rejected');
create type public.comment_status as enum ('visible', 'hidden');
create type public.redemption_status as enum ('redeemed', 'revoked');
create type public.privacy_request_kind as enum ('hide', 'delete');
create type public.privacy_request_status as enum ('pending', 'resolved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_key text,
  role public.user_role not null default 'member',
  status public.user_status not null default 'pending',
  show_real_name boolean not null default true,
  require_tag_approval boolean not null default true,
  allow_original_download boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 100),
  used_count integer not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (used_count <= max_uses)
);

create table public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invite_codes(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  status public.redemption_status not null default 'redeemed',
  unique (user_id),
  unique (invite_id, user_id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  original_key text not null unique,
  preview_key text not null unique,
  thumbnail_key text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  location text not null default '' check (char_length(location) <= 100),
  visibility public.photo_visibility not null default 'class',
  download_allowed boolean not null default false,
  review_status public.review_status not null default 'draft',
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.photo_people (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_status public.consent_status not null default 'pending',
  primary key (photo_id, user_id)
);

create table public.photo_access (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (photo_id, user_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 30)
);

create table public.photo_tags (
  photo_id uuid not null references public.photos(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (photo_id, tag_id)
);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photo_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 300),
  status public.comment_status not null default 'visible',
  created_at timestamptz not null default now()
);

create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 120),
  resource_type text not null check (char_length(resource_type) between 1 and 50),
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  kind public.privacy_request_kind not null,
  message text not null default '' check (char_length(message) <= 500),
  status public.privacy_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index photos_review_created_idx on public.photos (review_status, created_at desc);
create index photos_visibility_idx on public.photos (visibility);
create index photos_uploaded_by_idx on public.photos (uploaded_by);
create index photo_people_user_idx on public.photo_people (user_id, consent_status);
create index photo_access_user_idx on public.photo_access (user_id);
create index comments_photo_created_idx on public.comments (photo_id, created_at);
create index invite_codes_expires_idx on public.invite_codes (expires_at) where revoked_at is null;
create index admin_logs_created_idx on public.admin_logs (created_at desc);
create index privacy_requests_status_idx on public.privacy_requests (status, created_at desc);
create unique index privacy_requests_pending_unique_idx on public.privacy_requests (user_id, photo_id, kind) where status = 'pending';

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger photos_set_updated_at before update on public.photos
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, '同学'), '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_approved_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'approved' and role = 'admin');
$$;

create or replace function public.can_view_photo(p_photo_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.photos p
    where p.id = p_photo_id
      and p.review_status = 'published'
      and public.is_approved_member()
      and (
        public.is_admin()
        or p.uploaded_by = auth.uid()
        or (
          not exists (
            select 1 from public.photo_people rejected
            where rejected.photo_id = p.id and rejected.consent_status <> 'approved'
          )
          and (
            p.visibility = 'class'
            or (p.visibility = 'tagged_people' and exists (
              select 1 from public.photo_people tagged
              where tagged.photo_id = p.id and tagged.user_id = auth.uid() and tagged.consent_status = 'approved'
            ))
            or (p.visibility = 'selected' and exists (
              select 1 from public.photo_access selected
              where selected.photo_id = p.id and selected.user_id = auth.uid()
            ))
          )
        )
      )
  );
$$;

create or replace function public.redeem_invite(p_invite_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target public.invite_codes%rowtype;
begin
  select * into target from public.invite_codes where id = p_invite_id for update;
  if not found or target.revoked_at is not null or target.expires_at <= now() or target.used_count >= target.max_uses then
    raise exception 'invite_invalid';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'profile_missing';
  end if;
  insert into public.invite_redemptions (invite_id, user_id) values (p_invite_id, p_user_id);
  update public.invite_codes set used_count = used_count + 1 where id = p_invite_id;
end;
$$;

create view public.member_directory with (security_invoker = false) as
select id, case when show_real_name then display_name else '匿名同学' end as display_name
from public.profiles where status = 'approved' and (public.is_approved_member() or public.is_admin());

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.photos enable row level security;
alter table public.photo_people enable row level security;
alter table public.photo_access enable row level security;
alter table public.tags enable row level security;
alter table public.photo_tags enable row level security;
alter table public.favorites enable row level security;
alter table public.comments enable row level security;
alter table public.admin_logs enable row level security;
alter table public.privacy_requests enable row level security;

create policy profiles_select_self_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy invites_admin_all on public.invite_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy redemptions_select_own_or_admin on public.invite_redemptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy redemptions_admin_all on public.invite_redemptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy photos_select_authorized on public.photos for select to authenticated using (public.can_view_photo(id));
create policy photos_admin_all on public.photos for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy photo_people_select_authorized on public.photo_people for select to authenticated using (user_id = auth.uid() or public.can_view_photo(photo_id) or public.is_admin());
create policy photo_people_update_self on public.photo_people for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy photo_people_admin_all on public.photo_people for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy photo_access_select_own_or_admin on public.photo_access for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy photo_access_admin_all on public.photo_access for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy tags_select_members on public.tags for select to authenticated using (public.is_approved_member());
create policy tags_admin_all on public.tags for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy photo_tags_select_authorized on public.photo_tags for select to authenticated using (public.can_view_photo(photo_id));
create policy photo_tags_admin_all on public.photo_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy favorites_own_select on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_own_insert on public.favorites for insert to authenticated with check (user_id = auth.uid() and public.can_view_photo(photo_id));
create policy favorites_own_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

create policy comments_select_authorized on public.comments for select to authenticated using (status = 'visible' and public.can_view_photo(photo_id));
create policy comments_insert_own on public.comments for insert to authenticated with check (user_id = auth.uid() and public.can_view_photo(photo_id));
create policy comments_update_own_or_admin on public.comments for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy comments_delete_own_or_admin on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy admin_logs_admin_only on public.admin_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy privacy_requests_own_select on public.privacy_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy privacy_requests_own_insert on public.privacy_requests for insert to authenticated with check (user_id = auth.uid() and public.is_approved_member() and public.can_view_photo(photo_id));
create policy privacy_requests_admin_update on public.privacy_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.invite_codes from anon;
revoke all on public.invite_redemptions from anon;
revoke all on public.photos from anon;
revoke all on public.photo_people from anon;
revoke all on public.photo_access from anon;
revoke all on public.favorites from anon;
revoke all on public.comments from anon;
revoke all on public.admin_logs from anon;
revoke all on public.privacy_requests from anon;
revoke all on public.member_directory from anon;
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_key, show_real_name, require_tag_approval, allow_original_download) on public.profiles to authenticated;
grant select on public.member_directory to authenticated;
revoke all on function public.redeem_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redeem_invite(uuid, uuid) to service_role;

comment on table public.photos is '只保存 Cloudflare R2 对象 Key，不保存永久公开 URL';
comment on column public.invite_codes.code_hash is '邀请口令的 HMAC-SHA256 哈希，绝不保存明文';
