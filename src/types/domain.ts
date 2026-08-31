export type UserRole = "admin" | "member";
export type UserStatus = "pending" | "approved" | "rejected";
export type PhotoVisibility = "class" | "tagged_people" | "selected" | "private";
export type ReviewStatus = "draft" | "published" | "hidden" | "deleted";
export type MediaType = "photo" | "video";

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  realName: string | null;
  avatarKey: string | null;
  role: UserRole;
  status: UserStatus;
  showRealName: boolean;
  allowOriginalDownload: boolean;
  createdAt: string;
}

export interface Photo {
  id: string;
  title: string;
  description: string;
  originalKey: string;
  previewKey: string;
  thumbnailKey: string;
  mediaType: MediaType;
  mediaUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  location: string;
  people: Array<{ id: string; name: string; consentStatus: "pending" | "approved" | "rejected" }>;
  tags: string[];
  visibility: PhotoVisibility;
  selectedUserIds: string[];
  downloadAllowed: boolean;
  reviewStatus: ReviewStatus;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole?: UserRole;
  createdAt: string;
}

export interface PhotoComment {
  id: string;
  photoId: string;
  userId: string;
  authorName: string;
  content: string;
  status: "visible" | "hidden";
  createdAt: string;
}

export interface PrivacyRequest {
  id: string;
  userId: string;
  userName: string;
  photoId: string | null;
  photoTitle: string;
  kind: "hide" | "delete";
  message: string;
  status: "pending" | "resolved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
}
