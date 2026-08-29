# 拾光簿

一个只服务于一个高中班级的私人照片纪念网站。照片不按高一、高二或具体日期排列，而是通过地点、人物、标签和一句回忆重新相遇。

项目使用 Supabase 和 Cloudflare R2 保存真实班级数据，并通过 Vercel 部署。生产环境不会回退到模拟数据；缺少必要配置时会直接报错。

## 已实现的第一版

- 限时班级口令入口、注册、登录、待审核状态和密码重置入口
- `admin`、`member`、`pending` 三种使用状态
- 响应式班级首页和沉浸式照片瀑布墙
- 标题、人物、地点搜索和标签筛选
- 照片详情、键盘切换、手机滑动、收藏、留言和受控原图下载
- 华丽洗牌随机回忆和模拟相机显影
- 我的收藏、人物标记、隐藏或删除申请，以及动画和声音偏好
- 已审核成员可向私有 R2 上传照片和视频，提交成功后立即展示，无需再次确认
- 上传者可直接编辑、隐藏、恢复或永久删除自己的照片和视频
- 管理员概览、可重试批量上传、成员/隐私审核、全媒体故事与权限、邀请码和操作记录
- Supabase PostgreSQL 迁移、RLS、邀请兑换事务函数
- 私有 R2 存储适配器与仅限开发测试使用的本地替身
- 私有 R2 预签名上传、读取和删除接口
- 单元测试、类型检查、ESLint 和生产构建脚本

## 技术架构

```text
浏览器
  ↓
Next.js App Router（Vercel）
  ├─ Supabase Auth：注册、登录和会话
  ├─ Supabase PostgreSQL：照片资料、成员、权限、邀请码、留言
  └─ Cloudflare R2 私有 Bucket：原图、预览图、缩略图、头像
```

数据库只保存 R2 的对象 Key。任何照片读取链接都必须在服务端完成成员身份和照片权限验证后，才会生成短时有效的预签名 URL。

## 本地开发

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。建议在本地连接独立的 Supabase 开发项目和 R2 测试 Bucket，不要复用生产密钥。

## 环境变量

复制 `.env.example` 为 `.env.local`，并填写：

```env
STORAGE_DRIVER=r2

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DATABASE_URL=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=class-memories
R2_ENDPOINT=

AUTH_SECRET=
NEXT_PUBLIC_APP_URL=
```

`SUPABASE_SECRET_KEY`、`DATABASE_URL`、`R2_SECRET_ACCESS_KEY` 和 `AUTH_SECRET` 只能配置在服务端，不能增加 `NEXT_PUBLIC_` 前缀，也不能提交到 Git。

## 配置 Supabase

1. 创建一个 Supabase 项目。
2. 在 SQL Editor 中执行 [`supabase/migrations/202608260001_initial.sql`](supabase/migrations/202608260001_initial.sql)。
3. 在 Authentication 中启用邮箱密码登录。
4. 建议在正式邀请成员前配置自己的 SMTP；免费默认邮件服务只适合开发测试。
5. 注册第一个管理员账号后，在 SQL Editor 中将其提升为管理员：

```sql
update public.profiles
set role = 'admin', status = 'approved'
where email = '你的管理员邮箱';
```

6. 将项目 URL、Publishable Key 和服务端 Secret Key 写入 Vercel 环境变量。

迁移已经包含：

- 所有目标数据表、外键、唯一约束和索引
- 新 Auth 用户自动创建 `pending` Profile 的触发器
- 并发安全的邀请码兑换事务函数
- 成员、照片、人物关联、指定访问、收藏、隐私申请和留言的 RLS
- 匿名用户无法读取照片表
- 普通成员无法把自己提升为管理员

## 配置 Cloudflare R2

1. 创建名为 `class-memories` 的 R2 Bucket。
2. Bucket 必须保持私有，不要开启公开 `r2.dev` 访问。
3. 创建只限定到该 Bucket 的 Object Read & Write API Token。
4. 记录 Account ID、Access Key ID、Secret Access Key 和 S3 Endpoint。
5. CORS 只允许自己的 Vercel 域名和本地开发地址，例如：

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://你的域名.example"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

对象目录结构：

```text
originals/{photoId}/{filename}
previews/{photoId}.webp
thumbnails/{photoId}.webp
avatars/{userId}.webp
```

管理员选择照片后，浏览器会先在本地生成 WebP 预览图和缩略图，再通过服务端签发的 10 分钟上传链接分别上传。普通成员得到的读取链接默认只在 5 分钟内有效。

## 部署到 Vercel

1. 把项目推送到自己的 Git 仓库。
2. 在 Vercel 中导入仓库。
3. 将 `.env.example` 中的变量分别配置到 Development、Preview 和 Production。
4. Production 和正式验收用的 Preview 均设置 `STORAGE_DRIVER=r2`。
5. Build Command 使用 `npm run build`。
6. 部署完成后，把正式域名加入 R2 CORS 的 `AllowedOrigins`。
7. 把 `NEXT_PUBLIC_APP_URL` 更新为正式 HTTPS 域名并重新部署。

不要把生产 Supabase Secret Key 或 R2 Secret Key放进公开的 Preview 环境。

## 验证

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

也可以一次执行：

```bash
npm run check
```

## 隐私模型

每张照片支持四种范围：

- `class`：所有已审核同学可见
- `tagged_people`：照片中被标记的人可见
- `selected`：管理员指定的同学可见
- `private`：上传者和管理员可见

人物标记上传后直接生效；同学仍可提交隐藏或删除申请，由管理员处理。权限不仅应用于页面，也应用于搜索、随机回忆、图片签名、留言和原图下载接口。

## 数据备份

云端不应是唯一副本：

- 原始照片在电脑和移动硬盘各保留一份。
- 定期导出 Supabase PostgreSQL 数据库。
- 定期使用兼容 S3 的备份工具把 R2 同步到第二块存储设备。
- 免费方案的配额和暂停规则可能调整，正式长期使用前应查看 Supabase 最新定价与备份政策。

## 目录概览

```text
src/app/                  页面和后端 Route Handlers
src/components/           用户端、随机回忆和管理端交互
src/lib/authz.ts          照片权限核心规则
src/lib/storage/          R2 存储与本地开发适配器
supabase/migrations/      PostgreSQL、RLS 和函数
tests/                    核心权限与交互单元测试
```

## 正式上线检查

切换前必须同时满足：

1. Supabase 迁移已执行。
2. 已创建并审核第一个管理员。
3. 私有 R2 Bucket 和限定权限 Token 已创建。
4. 所有服务端环境变量已经配置。
5. 正式域名已经加入 R2 CORS。
6. `STORAGE_DRIVER` 已设置为 `r2`。
7. 登录页、邀请页和待审核页不显示任何测试账号或示例口令。

缺少任何一项时不要上线，也不要把 R2 Bucket 临时改为公开。生产环境不会自动切换到本地模拟数据。
