"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="status-page"><section><span>⌁</span><p className="eyebrow"><i /> SOMETHING WENT WRONG</p><h1>这段回忆暂时没有显影</h1><p>可能是网络短暂中断，也可能是访问链接刚刚过期。</p><button type="button" onClick={reset}>重新尝试</button><a href="/memories">返回班级首页</a></section></main>;
}
