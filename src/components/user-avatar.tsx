"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AVATAR_UPDATED_EVENT,
  avatarVersion,
  qqNumberFromEmail,
} from "@/lib/profile-avatars";
import type { Profile } from "@/types/domain";

type AvatarUser = Pick<Profile, "id" | "displayName" | "email" | "avatarKey">;

type AvatarUpdateDetail = {
  userId: string;
  hasCustom: boolean;
  version: string;
  previewUrl?: string | null;
};

type Props = {
  user: AvatarUser;
  className?: string;
  size: number;
  priority?: boolean;
  avatarEndpoint?: string;
  alwaysTryRemote?: boolean;
  listenForUpdates?: boolean;
  sourceOverride?: string | null;
  forceHasCustom?: boolean;
};

function appendAvatarQuery(endpoint: string, query: string) {
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query}`;
}

export function UserAvatar({
  user,
  className = "",
  size,
  priority = false,
  avatarEndpoint = "/api/profile/avatar",
  alwaysTryRemote = false,
  listenForUpdates = true,
  sourceOverride = null,
  forceHasCustom,
}: Props) {
  const [liveAvatar, setLiveAvatar] = useState<AvatarUpdateDetail | null>(null);
  const [failure, setFailure] = useState({ key: "", count: 0 });

  useEffect(() => {
    if (!listenForUpdates) return;

    function updateAvatar(event: Event) {
      const detail = (event as CustomEvent<AvatarUpdateDetail>).detail;
      if (detail?.userId === user.id) setLiveAvatar(detail);
    }
    window.addEventListener(AVATAR_UPDATED_EVENT, updateAvatar);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, updateAvatar);
  }, [listenForUpdates, user.id]);

  const qqNumber = qqNumberFromEmail(user.email);
  const hasCustom =
    forceHasCustom ?? liveAvatar?.hasCustom ?? Boolean(user.avatarKey);
  const hasRemoteSource = alwaysTryRemote || hasCustom || Boolean(qqNumber);
  const version = liveAvatar?.version ?? avatarVersion(user.avatarKey);
  const localSource = sourceOverride ?? liveAvatar?.previewUrl ?? null;
  const sourceKey = `${user.id}:${avatarEndpoint}:${localSource ?? "remote"}:${version}:${hasCustom}:${alwaysTryRemote}:${qqNumber ?? ""}`;
  const failureCount = failure.key === sourceKey ? failure.count : 0;
  const remoteStage = localSource ? 1 : 0;
  const qqFallbackStage = remoteStage + 1;
  let shouldLoad = false;
  let src = appendAvatarQuery(
    avatarEndpoint,
    `v=${encodeURIComponent(version)}`,
  );
  if (localSource && failureCount === 0) {
    shouldLoad = true;
    src = localSource;
  } else if (
    failureCount === remoteStage &&
    hasRemoteSource
  ) {
    shouldLoad = true;
  } else if (
    hasCustom &&
    qqNumber &&
    failureCount === qqFallbackStage
  ) {
    shouldLoad = true;
    src = appendAvatarQuery(
      avatarEndpoint,
      `default=qq&v=${encodeURIComponent(version)}`,
    );
  }
  const initial = user.displayName.trim().slice(0, 1) || "同";

  return (
    <span
      className={`user-avatar ${className}`.trim()}
      role="img"
      aria-label={`${user.displayName}的头像`}
    >
      <span className="user-avatar-fallback" aria-hidden="true">
        {initial}
      </span>
      {shouldLoad && (
        <Image
          key={src}
          className="user-avatar-image"
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          priority={priority}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() =>
            setFailure({ key: sourceKey, count: failureCount + 1 })
          }
        />
      )}
    </span>
  );
}
