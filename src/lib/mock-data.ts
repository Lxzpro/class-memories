import "server-only";

import type { Photo, PhotoComment, Profile } from "@/types/domain";

export const MOCK_PROFILES: Profile[] = [
  {
    id: "user-admin", email: "admin@demo.local", displayName: "林老师", avatarKey: null,
    role: "admin", status: "approved", showRealName: true, requireTagApproval: false,
    allowOriginalDownload: true, createdAt: "2026-01-02T08:00:00.000Z",
  },
  {
    id: "user-member", email: "member@demo.local", displayName: "夏宁", avatarKey: null,
    role: "member", status: "approved", showRealName: true, requireTagApproval: true,
    allowOriginalDownload: true, createdAt: "2026-01-03T08:00:00.000Z",
  },
  {
    id: "user-lin", email: "lin@demo.local", displayName: "林澈", avatarKey: null,
    role: "member", status: "approved", showRealName: false, requireTagApproval: true,
    allowOriginalDownload: false, createdAt: "2026-01-04T08:00:00.000Z",
  },
  {
    id: "user-zhou", email: "zhou@demo.local", displayName: "周予安", avatarKey: null,
    role: "member", status: "approved", showRealName: true, requireTagApproval: false,
    allowOriginalDownload: true, createdAt: "2026-01-05T08:00:00.000Z",
  },
  {
    id: "user-pending", email: "pending@demo.local", displayName: "待审核同学", avatarKey: null,
    role: "member", status: "pending", showRealName: true, requireTagApproval: true,
    allowOriginalDownload: false, createdAt: "2026-08-20T08:00:00.000Z",
  },
];

export const MOCK_CREDENTIALS = {
  "admin@demo.local": "Admin123!",
  "member@demo.local": "Member123!",
  "pending@demo.local": "Pending123!",
} as const;

export const MOCK_INVITE_CODE = "SHIGUANG-2026";

const memorySeeds = [
  ["午后的教室", "阳光从最后一排慢慢移到黑板边。", "三楼教室", ["教室", "日常"], 4, 5],
  ["跑道尽头", "风很大，我们笑得比加油声还响。", "操场", ["操场", "运动会"], 5, 4],
  ["放学以后", "那天没有计划，却一起留到了天色变蓝。", "教学楼下", ["放学", "朋友"], 4, 3],
  ["靠窗的位置", "作业本下面藏着写到一半的留言。", "教室", ["教室", "同桌"], 3, 4],
  ["一场没赢的球赛", "比分已经忘了，欢呼声还记得。", "篮球场", ["操场", "热血"], 4, 5],
  ["食堂靠里的那桌", "总有人最后一个到，也总有人帮忙占座。", "食堂", ["食堂", "日常"], 1, 1],
  ["课间十分钟", "短短十分钟，足够发生好多小事。", "走廊", ["课间", "搞怪"], 3, 4],
  ["雨后的操场", "积水里倒映着刚亮起来的晚霞。", "操场", ["操场", "安静"], 5, 3],
  ["排练间隙", "认真不到三分钟，又开始互相逗笑。", "礼堂", ["晚会", "搞怪"], 4, 3],
  ["校门口见", "这句话后来好像说了很多年。", "校门", ["放学", "朋友"], 3, 4],
  ["没有日期的合照", "谁站在谁旁边，比日期更容易记住。", "未知地点", ["合照", "珍贵"], 5, 4],
  ["值日生留影", "扫把还在角落，黑板已经擦得很干净。", "教室", ["教室", "搞怪"], 4, 5],
  ["春天从窗外经过", "我们低头写题，树叶在外面发亮。", "自习室", ["教室", "安静"], 5, 3],
  ["老师转身以后", "照片拍糊了，但每个人都笑得很清楚。", "教室", ["课堂", "搞怪"], 4, 3],
  ["毕业前的晚风", "那时候还不知道，普通的一天也会变得珍贵。", "天台", ["毕业", "晚风"], 5, 4],
  ["最后一次大扫除", "桌椅搬空以后，教室突然变得很大。", "教室", ["毕业", "教室"], 3, 4],
  ["站成一排的我们", "有人闭眼，有人看错镜头，但一个都不少。", "校园广场", ["合照", "毕业"], 5, 3],
  ["记不起哪一天", "一眼就认得，那是当时的我们。", "未知地点", ["日常", "珍贵"], 4, 5],
  ["只给照片里的人", "这张回忆需要当事人同意以后才会出现。", "教室", ["同桌", "私密"], 3, 4],
  ["指定给你的留言", "有些照片，只想和几个老朋友一起看。", "校门", ["朋友", "私密"], 4, 3],
  ["自己的收藏页", "暂时放在这里，等准备好了再分享。", "未知地点", ["私人"], 1, 1],
  ["等待确认的瞬间", "被标记的同学确认后，照片才会进入全班相册。", "操场", ["待确认"], 5, 4],
] as const;

export const MOCK_PHOTOS: Photo[] = memorySeeds.map((seed, index) => {
  const [title, description, location, tags, widthRatio, heightRatio] = seed;
  const number = index + 1;
  const visibility = number === 19 ? "tagged_people" : number === 20 ? "selected" : number === 21 ? "private" : "class";
  const reviewStatus = number === 22 ? "draft" : "published";
  const people = number === 22
    ? [{ id: "user-member", name: "夏宁", consentStatus: "pending" as const }]
    : number % 3 === 0
    ? [{ id: "user-member", name: "夏宁", consentStatus: "approved" as const }, { id: "user-lin", name: "林澈", consentStatus: "approved" as const }]
    : [{ id: "user-zhou", name: "周予安", consentStatus: "approved" as const }];

  return {
    id: `photo-${String(number).padStart(2, "0")}`,
    title,
    description,
    originalKey: `originals/photo-${String(number).padStart(2, "0")}/memory.jpg`,
    previewKey: `previews/photo-${String(number).padStart(2, "0")}.webp`,
    thumbnailKey: `thumbnails/photo-${String(number).padStart(2, "0")}.webp`,
    mediaType: "photo",
    mediaUrl: `/api/demo-image/${number}?variant=preview`,
    previewUrl: `/api/demo-image/${number}?variant=preview`,
    thumbnailUrl: `/api/demo-image/${number}?variant=thumbnail`,
    width: widthRatio * 320,
    height: heightRatio * 320,
    location,
    people,
    tags: [...tags],
    visibility,
    selectedUserIds: number === 20 ? ["user-member", "user-zhou"] : [],
    downloadAllowed: number % 4 !== 0,
    reviewStatus,
    uploadedBy: number === 21 ? "user-member" : "user-admin",
    createdAt: new Date(Date.UTC(2026, 0, Math.min(number, 28), 8)).toISOString(),
  } satisfies Photo;
});

export const MOCK_COMMENTS: PhotoComment[] = [
  { id: "comment-1", photoId: "photo-01", userId: "user-lin", authorName: "林澈", content: "我记得窗外那棵树，那天应该刚下过雨。", status: "visible", createdAt: "2026-08-21T09:20:00.000Z" },
  { id: "comment-2", photoId: "photo-01", userId: "user-zhou", authorName: "周予安", content: "最后一排是不是还藏着我们的值日表？", status: "visible", createdAt: "2026-08-22T10:20:00.000Z" },
];

export function getMockProfile(id: string): Profile | null {
  return MOCK_PROFILES.find((profile) => profile.id === id) ?? null;
}

export function getMockPhoto(id: string): Photo | null {
  return MOCK_PHOTOS.find((photo) => photo.id === id) ?? null;
}
