import Link from "next/link";

export default function NotFound() {
  return <main className="status-page"><section><span>404</span><p className="eyebrow"><i /> MEMORY NOT FOUND</p><h1>这里没有找到那张照片</h1><p>它可能被隐藏、删除，或者你没有查看权限。</p><Link href="/memories">返回班级首页</Link></section></main>;
}
