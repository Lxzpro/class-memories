begin;

-- 新的人物关联默认直接生效。历史 pending/rejected 记录保持原状，
-- 避免迁移过程未经本人同意扩大旧内容的可见范围。
alter table public.photo_people
  alter column consent_status set default 'approved';

alter table public.profiles
  alter column require_tag_approval set default false;

commit;
