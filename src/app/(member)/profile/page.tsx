import { ProfileSettings } from "@/components/profile-settings";
import { requireApprovedUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import {
  getFavoritePhotoIds,
  getPendingTagRequests,
  getVisiblePhotos,
} from "@/lib/photos";

export default async function ProfilePage() {
  const user = await requireApprovedUser();
  const [photos, requests, favoriteIds] = await Promise.all([
    getVisiblePhotos(user),
    getPendingTagRequests(user),
    getFavoritePhotoIds(user),
  ]);
  const relevantPhotos = photos.filter(
    (photo) =>
      photo.uploadedBy === user.id ||
      photo.people.some((person) => person.id === user.id),
  );

  return (
    <div className="profile-page reference-profile-page">
      <ProfileSettings
        user={user}
        ownPhotoCount={
          photos.filter((photo) => photo.uploadedBy === user.id).length
        }
        pendingTagRequests={requests}
        relevantPhotos={relevantPhotos}
        visiblePhotos={photos}
        initialFavoriteIds={favoriteIds}
        demoMode={DEMO_MODE}
      />
    </div>
  );
}
