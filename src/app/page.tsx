import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const previewMemories = [
  { title: "午后的教室", note: "窗边的位置，总有人在偷偷写留言。", tone: "sky" },
  { title: "跑道尽头", note: "风很大，我们笑得比加油声还响。", tone: "green" },
  { title: "放学以后", note: "那天没有计划，却留到了天色变蓝。", tone: "gold" },
  { title: "记不起哪一天", note: "但一眼就认得，那是当时的我们。", tone: "rose" },
];

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="回到班级相册首页">
          <BrandLogo className="brand-mark" priority />
          <span><b>拾光簿</b><small>OUR CLASS ARCHIVE</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="主导航">
          <a href="#memories">照片</a><a href="#random">随机回忆</a><Link href="/login">班级入口</Link>
        </nav>
        <Link className="header-entry" href="/login">进入相册 <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> ONE CLASS · MANY MOMENTS</p>
          <h1 id="hero-title">不必记得<br /><em>是哪一天</em></h1>
          <p className="hero-lead">记得那时候的我们就好。这里收藏教室里的光、操场上的风，还有那些没有写下日期的青春片段。</p>
          <div className="hero-actions" id="random">
            <Link className="primary-action" href="/login">
              <span className="action-icon" aria-hidden="true">↝</span>
              <span><b>洗一洗回忆</b><small>从照片里随机抽一张</small></span>
            </Link>
            <Link className="secondary-action" href="/login">
              <span className="camera-dot" aria-hidden="true" />
              <span><b>拍下一刻</b><small>让旧照片重新显影</small></span>
            </Link>
          </div>
          <p className="privacy-note"><span aria-hidden="true">⌁</span> 仅审核通过的班级成员可以浏览完整相册</p>
        </div>

        <div className="hero-gallery" aria-label="班级回忆照片预览">
          <div className="sun-glow" />
          <article className="floating-photo photo-main">
            <div className="photo-art art-classroom">
              <span className="art-window" /><span className="art-desk desk-one" /><span className="art-desk desk-two" />
              <span className="art-figure figure-one" /><span className="art-figure figure-two" />
            </div>
            <div className="photo-caption"><span>我们的某个下午</span><small>地点记得，日期忘了</small></div>
          </article>
          <article className="floating-photo photo-side"><div className="photo-art art-field"><span className="field-line line-one" /><span className="field-line line-two" /><span className="field-sun" /></div></article>
          <article className="floating-photo photo-small"><div className="photo-art art-sky"><span>不必按时间排列</span></div></article>
          <div className="hand-note">有些瞬间，<br />一看到就会想起来。</div>
          <div className="gallery-count"><b>248</b><span>份回忆<br />等待重逢</span></div>
        </div>
      </section>

      <section className="memory-preview" id="memories" aria-labelledby="memory-title">
        <div className="section-heading">
          <div><p className="eyebrow"><span /> A GLIMPSE OF US</p><h2 id="memory-title">散落在各处的我们</h2></div>
          <Link href="/login">查看全部照片 <span aria-hidden="true">→</span></Link>
        </div>
        <div className="preview-grid">
          {previewMemories.map((memory, index) => (
            <article className={`memory-card memory-${memory.tone}`} key={memory.title}>
              <div className="memory-placeholder"><span className="memory-number">0{index + 1}</span><span className="memory-light" /></div>
              <div className="memory-copy"><h3>{memory.title}</h3><p>{memory.note}</p></div>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer"><span>拾光簿 · 我们班的私人影像纪念册</span><span>PRIVATE CLASS ARCHIVE</span></footer>
    </main>
  );
}
