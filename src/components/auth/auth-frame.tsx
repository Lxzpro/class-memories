import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_MODE } from "@/lib/config";
import { BrandLogo } from "@/components/brand-logo";

export function AuthFrame({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand"><BrandLogo className="auth-logo" priority /><b>拾光簿</b></Link>
      <section className="auth-card">
        {DEMO_MODE && <div className="demo-pill"><i /> 本地演示模式</div>}
        <p className="eyebrow"><span /> {eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </section>
      <p className="auth-privacy">⌁ 这是一个仅向受邀班级成员开放的私人空间</p>
    </main>
  );
}
