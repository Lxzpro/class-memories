import { BrandLogo } from "@/components/brand-logo";

export default function Loading() {
  return <main className="loading-page" aria-label="正在加载"><BrandLogo className="loading-mark" priority /><div className="loading-line"><span /></div><p>有一些回忆正在显影……</p></main>;
}
