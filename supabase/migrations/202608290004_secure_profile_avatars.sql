revoke update (avatar_key)
on table public.profiles
from authenticated;

alter table public.profiles
  add constraint profiles_avatar_key_owned
  check (
    avatar_key is null
    or avatar_key ~ (
      '^avatars/members/' || id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
    )
  ) not valid;

comment on column public.profiles.avatar_key is
  '仅保存 avatars/members/{profile.id}/{uuid}.webp 形式的私有 R2 对象 Key；由服务端头像接口写入';
