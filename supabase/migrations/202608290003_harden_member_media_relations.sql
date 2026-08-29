-- 收紧成员可直接修改的关联列，避免通过 Supabase REST 移动人物关联或评论。
-- 管理员应用接口使用 service_role，不受这些 authenticated 列权限影响。

revoke update on public.photo_people from authenticated;
drop policy if exists photo_people_update_self on public.photo_people;

-- 当前产品没有成员编辑评论入口，直接撤销 UPDATE，保留新增和删除自己的评论。
revoke update on public.comments from authenticated;
drop policy if exists comments_update_own_or_admin on public.comments;
