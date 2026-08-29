import { randomUUID } from "node:crypto";
import { PhotoWall } from "@/components/photo-wall";
import { requireApprovedUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { parsePhotoOrder } from "@/lib/photo-order";
import { getFavoritePhotoIds, getVisiblePhotos } from "@/lib/photos";

export default async function PhotosPage({ searchParams }: PageProps<"/photos">) {
  const user = await requireApprovedUser();
  const [photos, favoriteIds] = await Promise.all([getVisiblePhotos(user), getFavoritePhotoIds(user)]);
  const params = await searchParams;
  const open = params.open;
  const order = parsePhotoOrder(params.order);
  return <div className="photos-page">
    <header className="page-intro"><p className="eyebrow"><span /> ALL OUR MOMENTS</p><div><h1>散落在各处的我们</h1><p>不按时间，只按记忆。点击任意一张，让它从原地慢慢展开。</p></div></header>
    <PhotoWall photos={photos} initialFavoriteIds={favoriteIds} initialOrder={order} shuffleSeed={randomUUID()} demoMode={DEMO_MODE} viewerId={user.id} initialSelectedId={typeof open === "string" ? open : null} />
  </div>;
}
