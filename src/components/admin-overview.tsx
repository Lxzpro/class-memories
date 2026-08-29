"use client";

import Image from "next/image";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import type {
  AdminInviteView,
  AdminLogView,
} from "@/lib/admin-data";
import type { Photo, PrivacyRequest, Profile } from "@/types/domain";

type AdminOverviewProps = {
  photos: Photo[];
  members: Profile[];
  invites: AdminInviteView[];
  logs: AdminLogView[];
  privacyRequests: PrivacyRequest[];
  onUpdatePhoto: (id: string, update: Partial<Photo>) => Promise<void>;
  onReviewMember: (
    id: string,
    status: "approved" | "rejected",
  ) => Promise<void>;
  onReviewPrivacyRequest: (
    id: string,
    status: "resolved" | "rejected",
  ) => Promise<void>;
};

const metricIcons = {
  published: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m7 15 3.5-3.5 2.8 2.8 2.2-2.2L19 16" />
      <circle cx="8" cy="9" r="1.2" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4.5 6v5.4c0 4.7 3.1 8.1 7.5 9.6 4.4-1.5 7.5-4.9 7.5-9.6V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  members: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M15 14.5a4 4 0 0 1 5.5 3.7V20" />
    </svg>
  ),
  invite: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="16" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="m10.2 13.8 3.6-3.6M16 5V3M19 8h2M8 19v2M5 16H3" />
    </svg>
  ),
};

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

export function AdminOverview({
  photos,
  members,
  invites,
  logs,
  privacyRequests,
  onUpdatePhoto,
  onReviewMember,
  onReviewPrivacyRequest,
}: AdminOverviewProps) {
  const publishedCount = photos.filter(
    (photo) => photo.reviewStatus === "published",
  ).length;
  const draftPhotos = photos
    .filter((photo) => photo.reviewStatus === "draft")
    .slice(0, 3);
  const pendingMembers = members.filter(
    (member) => member.status === "pending",
  );
  const approvedMembers = members.filter(
    (member) => member.status === "approved",
  ).length;
  const activeInvites = invites.filter(
    (invite) => !invite.revokedAt && invite.usedCount < invite.maxUses,
  ).length;
  const pendingPrivacy = privacyRequests.filter(
    (request) => request.status === "pending",
  );
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  const firstMember = pendingMembers[0];
  const firstPrivacy = pendingPrivacy[0];
  const privacyPhoto = firstPrivacy?.photoId
    ? photoById.get(firstPrivacy.photoId)
    : undefined;

  return (
    <section
      id="overview"
      className="admin-section admin-reference-overview"
    >
      <div className="admin-reference-metrics" aria-label="班级相册概况">
        <article className="is-blue">
          <span className="metric-icon">{metricIcons.published}</span>
          <p>
            <strong>{publishedCount}</strong>
            <small>张</small>
          </p>
          <b>已发布</b>
          <em>班级可见的照片</em>
        </article>
        <article className="is-gold">
          <span className="metric-icon">{metricIcons.review}</span>
          <p>
            <strong>{draftPhotos.length}</strong>
            <small>张</small>
          </p>
          <b>未发布草稿</b>
          <em>异常中断或历史草稿</em>
        </article>
        <article className="is-sage">
          <span className="metric-icon">{metricIcons.members}</span>
          <p>
            <strong>{approvedMembers}</strong>
            <small>位</small>
          </p>
          <b>成员</b>
          <em>{pendingMembers.length} 位等待加入</em>
        </article>
        <article className="is-blue">
          <span className="metric-icon">{metricIcons.invite}</span>
          <p>
            <strong>{activeInvites}</strong>
            <small>个</small>
          </p>
          <b>有效邀请</b>
          <em>可用于邀请新成员</em>
        </article>
      </div>

      <div className="admin-reference-workbench">
        <article className="reference-admin-panel pending-photo-panel">
          <header>
            <div>
              <h2>未发布草稿 <small>（{draftPhotos.length} 份）</small></h2>
              <p>成员正常上传会立即展示；这里用于处理异常中断或历史草稿</p>
            </div>
            <Link href="/admin?tab=photos" scroll={false}>
              查看全部草稿 <span>›</span>
            </Link>
          </header>
          {draftPhotos.length > 0 ? (
            <div className="pending-photo-grid">
              {draftPhotos.map((photo) => (
                <section key={photo.id} className="pending-photo-card">
                  <div className="pending-photo-image">
                    <Image
                      src={photo.thumbnailUrl}
                      alt={photo.title}
                      fill
                      sizes="(max-width: 760px) 80vw, 240px"
                      unoptimized
                      suppressHydrationWarning
                    />
                  </div>
                  <div className="pending-photo-meta">
                    <span className="admin-mini-avatar" aria-hidden="true">
                      {photo.title.slice(0, 1)}
                    </span>
                    <p>
                      <b>{photo.title}</b>
                      <small>{photo.location || "地点未填写"}</small>
                    </p>
                    <em>{photo.visibility === "private" ? "仅自己" : "班级"}</em>
                  </div>
                  <div className="pending-photo-actions">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePhoto(photo.id, { reviewStatus: "published" })
                      }
                    >
                      立即发布
                    </button>
                    <Link href="/admin?tab=photos" scroll={false}>
                      查看详情
                    </Link>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="reference-empty-state">
              <span>✓</span>
              <p>没有未发布的照片或视频草稿</p>
            </div>
          )}
        </article>

        <article className="reference-admin-panel pending-member-panel">
          <header>
            <div>
              <h2>待审核成员 <small>（{pendingMembers.length} 位）</small></h2>
            </div>
            <Link href="/admin?tab=members" scroll={false}>
              全部成员 <span>›</span>
            </Link>
          </header>
          {firstMember ? (
            <div className="pending-member-card">
              <div className="pending-member-person">
                <span className="admin-person-avatar">
                  <UserAvatar
                    user={firstMember}
                    size={48}
                    avatarEndpoint={`/api/admin/members/${encodeURIComponent(firstMember.id)}/avatar`}
                    listenForUpdates={false}
                  />
                </span>
                <p>
                  <b>{firstMember.displayName}</b>
                  <small>申请加入班级 · {formatStamp(firstMember.createdAt)}</small>
                </p>
              </div>
              <p className="pending-member-message">
                大家好！我是{firstMember.displayName}，希望加入班级相册，
                一起珍藏我们的高中回忆。
              </p>
              <div className="reference-review-actions">
                <button
                  type="button"
                  onClick={() => onReviewMember(firstMember.id, "approved")}
                >
                  同意加入
                </button>
                <button
                  type="button"
                  onClick={() => onReviewMember(firstMember.id, "rejected")}
                >
                  拒绝
                </button>
              </div>
            </div>
          ) : (
            <div className="reference-empty-state compact">
              <span>✓</span>
              <p>成员申请已处理完</p>
            </div>
          )}
        </article>

        <article className="reference-admin-panel privacy-overview-panel">
          <header>
            <div>
              <h2>最近的隐私申请</h2>
            </div>
            <Link href="/admin?tab=members" scroll={false}>
              查看全部 <span>›</span>
            </Link>
          </header>
          {firstPrivacy ? (
            <div className="privacy-overview-content">
              {privacyPhoto ? (
                <div className="privacy-overview-image">
                  <Image
                    src={privacyPhoto.thumbnailUrl}
                    alt={firstPrivacy.photoTitle}
                    fill
                    sizes="220px"
                    unoptimized
                    suppressHydrationWarning
                  />
                </div>
              ) : (
                <div className="privacy-overview-image is-missing">照片</div>
              )}
              <div>
                <h3>
                  申请{firstPrivacy.kind === "delete" ? "删除" : "隐藏"}照片
                  <small>{pendingPrivacy.length} 条待处理</small>
                </h3>
                <p>{firstPrivacy.userName} · {formatStamp(firstPrivacy.createdAt)}</p>
                <blockquote>{firstPrivacy.message || "未填写补充说明"}</blockquote>
                <small>涉及照片：{firstPrivacy.photoTitle}</small>
              </div>
              <div className="privacy-overview-actions">
                <button
                  type="button"
                  onClick={() =>
                    onReviewPrivacyRequest(firstPrivacy.id, "resolved")
                  }
                >
                  处理申请
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onReviewPrivacyRequest(firstPrivacy.id, "rejected")
                  }
                >
                  驳回
                </button>
              </div>
            </div>
          ) : (
            <div className="reference-empty-state compact">
              <span>✓</span>
              <p>暂无待处理的隐私申请</p>
            </div>
          )}
        </article>

        <article className="reference-admin-panel recent-log-panel">
          <header>
            <div>
              <h2>最近操作记录</h2>
            </div>
            <Link href="/admin?tab=logs" scroll={false}>
              全部记录 <span>›</span>
            </Link>
          </header>
          <ul>
            {logs.slice(0, 5).map((log, index) => (
              <li key={log.id}>
                <span className={`log-symbol tone-${index % 4}`} aria-hidden="true">
                  {index % 3 === 0 ? "▧" : index % 3 === 1 ? "↥" : "◎"}
                </span>
                <p>
                  <b>{log.adminName}</b> {log.action}
                </p>
                <time dateTime={log.createdAt}>{formatStamp(log.createdAt)}</time>
              </li>
            ))}
          </ul>
          {logs.length === 0 && (
            <div className="reference-empty-state compact">
              <p>还没有操作记录</p>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
