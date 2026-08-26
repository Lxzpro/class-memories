import { ProfileSettings } from "@/components/profile-settings";
import { requireApprovedUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { getFavoritePhotoIds, getPendingTagRequests, getVisiblePhotos } from "@/lib/photos";

export default async function ProfilePage() {
  const user = await requireApprovedUser(); const [photos, requests, favoriteIds] = await Promise.all([getVisiblePhotos(user), getPendingTagRequests(user), getFavoritePhotoIds(user)]);
  const relevantPhotos = photos.filter((photo) => photo.uploadedBy === user.id || photo.people.some((person) => person.id === user.id));
  return <div className="profile-page"><header className="page-intro"><p className="eyebrow"><span /> MY CORNER</p><div><h1>我的相册角落</h1><p>控制别人怎样看到与你有关的照片，也调整属于自己的浏览体验。</p></div></header><ProfileSettings user={user} ownPhotoCount={photos.filter((photo) => photo.uploadedBy === user.id).length} pendingTagRequests={requests} relevantPhotos={relevantPhotos} visiblePhotos={photos} initialFavoriteIds={favoriteIds} demoMode={DEMO_MODE} /></div>;
}
