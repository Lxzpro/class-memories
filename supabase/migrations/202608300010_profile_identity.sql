begin;

-- `display_name` remains the member's nickname. Real names are optional for
-- existing accounts and are only made public through member_directory when the
-- member explicitly keeps show_real_name enabled.
alter table public.profiles
  add column real_name text;

alter table public.profiles
  add constraint profiles_real_name_length
  check (
    real_name is null
    or char_length(btrim(real_name)) between 2 and 30
  );

alter table public.profiles
  add constraint profiles_display_name_not_blank
  check (char_length(btrim(display_name)) between 1 and 30)
  not valid;

comment on column public.profiles.display_name is
  '成员昵称；关闭真实姓名展示时作为公开名称';

comment on column public.profiles.real_name is
  '成员真实姓名；旧账号允许为空，仅按 show_real_name 通过成员目录公开';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  nickname_value text;
  real_name_value text;
begin
  nickname_value := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  if nickname_value is null then
    nickname_value := nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '');
  end if;
  nickname_value := left(coalesce(nickname_value, '同学'), 30);

  real_name_value := nullif(btrim(new.raw_user_meta_data ->> 'real_name'), '');
  if real_name_value is not null then
    real_name_value := left(real_name_value, 30);
    if char_length(real_name_value) < 2 then
      real_name_value := null;
    end if;
  end if;

  insert into public.profiles (id, email, display_name, real_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nickname_value,
    real_name_value
  );
  return new;
end;
$$;

-- Keep the existing id/display_name contract intact. display_name is the safe
-- public name: a real name is returned only when both the value and consent are
-- present. role is intentionally non-sensitive and supports grouping admin
-- uploads as class archive material.
create or replace view public.member_directory
with (security_invoker = false, security_barrier = true)
as
select
  id,
  case
    when show_real_name and nullif(btrim(real_name), '') is not null
      then btrim(real_name)
    else display_name
  end as display_name,
  role
from public.profiles
where status = 'approved'
  and (public.is_approved_member() or public.is_admin());

revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;

-- profiles_update_self still restricts updates to the current row. This
-- column-level grant does not expose real_name through SELECT to other members.
grant update (real_name) on public.profiles to authenticated;

commit;
