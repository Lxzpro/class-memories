import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LaAnalytics } from "@/components/analytics/la-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾光簿｜我们的高中照片纪念册",
  description: "一座只对班级成员开放的明亮青春影像馆。",
  icons: { icon: "/brand-logo.png", apple: "/brand-logo.png" },
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        {children}
        <LaAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
