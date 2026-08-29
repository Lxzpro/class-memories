begin;

-- Keep a short-lived claim on a pending request while one administrator applies
-- the media side effect. A stale claim can be retried after the API timeout
-- window, so a crashed process cannot leave the request permanently stuck.
alter table public.privacy_requests
  add column processing_at timestamptz,
  add column processing_by uuid references public.profiles(id) on delete set null,
  add column processing_token uuid;

create index privacy_requests_processing_idx
  on public.privacy_requests (processing_at)
  where status = 'pending';

drop policy if exists privacy_requests_own_insert on public.privacy_requests;
create policy privacy_requests_own_insert
on public.privacy_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_approved_member()
  and public.can_view_photo(photo_id)
  and exists (
    select 1
    from public.photos as requested_photo
    where requested_photo.id = privacy_requests.photo_id
      and requested_photo.uploaded_by <> auth.uid()
  )
  and status = 'pending'
  and resolved_at is null
  and processing_at is null
  and processing_by is null
  and processing_token is null
);

-- Administrators process requests only through the server-side API, where the
-- corresponding photo/R2 effect and audit log are applied together.
drop policy if exists privacy_requests_admin_update on public.privacy_requests;
revoke insert on public.privacy_requests from authenticated;
revoke update on public.privacy_requests from authenticated;
grant insert (user_id, photo_id, kind, message)
  on public.privacy_requests
  to authenticated;

-- All media mutations go through the authenticated server routes, which use
-- service_role and coordinate database rows with their private R2 objects.
revoke insert, update, delete on public.photos from authenticated;
revoke insert, update, delete on public.photo_people from authenticated;
revoke insert, update, delete on public.photo_access from authenticated;
revoke insert, update, delete on public.photo_tags from authenticated;
revoke insert, update, delete on public.tags from authenticated;

comment on column public.privacy_requests.processing_at is
  '管理员处理占用时间；超过十分钟的占用允许安全重试';
comment on column public.privacy_requests.processing_by is
  '当前处理该申请的管理员，仅供服务端并发控制';
comment on column public.privacy_requests.processing_token is
  '每次处理尝试的唯一租约令牌，防止过期请求释放或完成新的处理';

commit;
