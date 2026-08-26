import Image from "next/image";
import Link from "next/link";
import { requireApprovedUser } from "@/lib/auth";
import { getVisiblePhotos } from "@/lib/photos";

export default async function MemoriesPage() {
  const user = await requireApprovedUser();
  const photos = await getVisiblePhotos(user);
  const featured = photos.slice(0, 5);

  return <div className="member-home">
    <section className="member-hero">
      <div><p className="eyebrow"><span /> WELCOME BACK, {user.displayName.toUpperCase()}</p><h1>回到那些<br /><em>没有日期的日子</em></h1><p>照片不必按时间排好。地点、人物和一句话，也足够带我们回到当时。</p>
        <div className="member-hero-actions"><Link className="primary-action" href="/random?mode=shuffle"><span className="action-icon">↝</span><span><b>洗一洗回忆</b><small>随机抽一张青春</small></span></Link><Link className="secondary-action" href="/random?mode=camera"><span className="camera-dot" /><span><b>拍下一刻</b><small>等待旧照片显影</small></span></Link></div>
      </div>
      <div className="member-featured">
        {featured.map((photo, index) => <Link key={photo.id} href={`/photos?open=${photo.id}`} className={`featured-photo featured-${index + 1}`} aria-label={`查看${photo.title}`}><Image src={photo.thumbnailUrl} alt={photo.title} fill sizes="(max-width: 800px) 44vw, 20vw" unoptimized suppressHydrationWarning /><span>{photo.title}</span></Link>)}
        <div className="featured-total"><b>{photos.length}</b><span>张有权限查看的<br />班级回忆</span></div>
      </div>
    </section>
    <section className="member-story-strip"><p>THIS IS OUR SMALL ARCHIVE</p><blockquote>“照片里没有准确日期，<br />但所有人的笑声都像刚刚发生。”</blockquote><Link href="/photos">进入沉浸式照片墙 <span>→</span></Link></section>
  </div>;
}
