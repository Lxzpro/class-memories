import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾光簿｜我们的高中照片纪念册",
  description: "一座只对班级成员开放的明亮青春影像馆。",
  icons: { icon: "/brand-logo.png", apple: "/brand-logo.png" },
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
