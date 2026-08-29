import { PhotoWall } from "@/components/photo-wall";
import { requireApprovedUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { getFavoritePhotoIds, getVisibleVideos } from "@/lib/photos";

type VideosPageProps = {
  searchParams: Promise<{ open?: string | string[] }>;
};

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const user = await requireApprovedUser();
  const [videos, favoriteIds] = await Promise.all([
    getVisibleVideos(user),
    getFavoritePhotoIds(user),
  ]);
  const open = (await searchParams).open;

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
        demoMode={DEMO_MODE}
        initialSelectedId={typeof open === "string" ? open : null}
      />
    </div>
  );
}
