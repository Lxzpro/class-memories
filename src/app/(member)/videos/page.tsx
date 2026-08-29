import { randomUUID } from "node:crypto";
import { PhotoWall } from "@/components/photo-wall";
import { requireApprovedUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { parsePhotoOrder } from "@/lib/photo-order";
import { getFavoritePhotoIds, getVisibleVideos } from "@/lib/photos";

type VideosPageProps = {
  searchParams: Promise<{
    open?: string | string[];
    order?: string | string[];
  }>;
};

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const user = await requireApprovedUser();
  const [videos, favoriteIds] = await Promise.all([
    getVisibleVideos(user),
    getFavoritePhotoIds(user),
  ]);
  const params = await searchParams;
  const open = params.open;
  const order = parsePhotoOrder(params.order);

  return (
    <div className="photos-page videos-page">
      <header className="page-intro">
        <p className="eyebrow"><span /> VIDEO MEMORIES</p>
        <div>
          <h1>会动的青春片段</h1>
          <p>笑声、风声和没说完的话，都在这里重新播放。</p>
        </div>
      </header>
      <PhotoWall
        photos={videos}
        variant="video"
        initialFavoriteIds={favoriteIds}
        initialOrder={order}
        shuffleSeed={randomUUID()}
        demoMode={DEMO_MODE}
        viewerId={user.id}
        initialSelectedId={typeof open === "string" ? open : null}
      />
    </div>
  );
}
