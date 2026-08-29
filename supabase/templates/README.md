# Supabase 认证邮件模板

本目录保存需要手动同步到 Supabase Dashboard 的邮件模板，仓库中的文件不会自动修改线上 Supabase 项目。

## 注册确认邮件

1. 打开 Supabase Dashboard → Authentication → Emails → Templates。
2. 选择 Confirm signup / Confirm your email 模板。
3. Subject 填写：“【拾光簿】确认邮箱，完成班级相册注册”。
4. 将 confirmation.html 的完整内容粘贴到邮件正文并保存。
5. Authentication → URL Configuration 的 Redirect URLs 至少包含：
   - https://www.lxzblog.click/auth/callback?next=/pending
   - 本地调试时可另外加入：http://localhost:3000/auth/callback?next=/pending

注册模板使用 RedirectTo 和 TokenHash 完成服务器端邮箱验证，确认成功后进入成员审核页。

## 密码重置邮件

1. 打开 Supabase Dashboard → Authentication → Emails → Templates。
2. 选择 Reset password / Recovery 模板。
3. Subject 填写：“【拾光簿】重置你的班级相册密码”。
4. 将 recovery.html 的完整内容粘贴到邮件正文并保存。
5. Authentication → URL Configuration 中确认：
   - Site URL：https://www.lxzblog.click
   - Redirect URLs 至少包含：https://www.lxzblog.click/auth/callback?next=/reset-password
   - 本地调试时可另外加入：http://localhost:3000/auth/callback?next=/reset-password

模板先进入 `/auth/recovery` 人工确认页，再由用户主动提交 TokenHash 建立服务器端恢复会话。这样可避免 QQ 邮箱等安全扫描器提前访问并消耗一次性令牌；不要改回直接验证或只使用 ConfirmationURL 的链接。
