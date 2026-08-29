import { ProfileSettings } from "@/components/profile-settings";
import { requireApprovedUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import {
  getFavoritePhotoIds,
  getOwnedMedia,
  getUploadMemberOptions,
  getVisiblePhotos,
} from "@/lib/photos";

type ProfilePageProps = {
  searchParams: Promise<{
    tab?: string | string[];
    manage?: string | string[];
  }>;
};

export default async function ProfilePage({
  searchParams,
}: ProfilePageProps) {
  const user = await requireApprovedUser();
  const [photos, ownedMedia, favoriteIds, members] =
    await Promise.all([
    getVisiblePhotos(user),
    getOwnedMedia(user),
    getFavoritePhotoIds(user),
    getUploadMemberOptions(),
  ]);
  const query = await searchParams;
  const requestedTab = typeof query.tab === "string" ? query.tab : "";
  const initialTab =
    requestedTab === "favorites" ||
    requestedTab === "uploads" ||
    requestedTab === "privacy"
      ? requestedTab
      : "about";
  const initialManageId =
    typeof query.manage === "string" ? query.manage : null;
  const relevantPhotos = photos.filter(
    (photo) =>
      photo.uploadedBy === user.id ||
      photo.people.some((person) => person.id === user.id),
  );

  return (
    <div className="profile-page reference-profile-page">
      <ProfileSettings
        user={user}
        ownedMedia={ownedMedia}
        members={members}
        relevantPhotos={relevantPhotos}
        visiblePhotos={photos}
        initialFavoriteIds={favoriteIds}
        demoMode={DEMO_MODE}
        initialTab={initialTab}
        initialManageId={initialManageId}
      />
    </div>
  );
}
