begin;

-- Existing invite codes only have a one-way HMAC hash and cannot be recovered.
-- New invites keep that hash for lookup plus an AES-256-GCM ciphertext produced
-- by the application. The plaintext code is never stored in PostgreSQL.
alter table public.invite_codes
  add column code_ciphertext text
  check (
    code_ciphertext is null
    or char_length(code_ciphertext) between 40 and 512
  );

comment on column public.invite_codes.code_ciphertext is
  '管理员按需查看用的 AES-256-GCM 密文；历史记录为 null，数据库不保存明文';

commit;
