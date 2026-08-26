import { ImageResponse } from "next/og";

const palettes = [
  ["#bdd2d8", "#eef0df", "#879989"], ["#a9c4d0", "#dce8e5", "#bd9f75"],
  ["#d8c8be", "#eee1c5", "#91a7ad"], ["#aebfaf", "#dfe7d9", "#738188"],
  ["#c7d9df", "#f1dfba", "#829990"], ["#d9cdc2", "#a7bbc1", "#7f8e82"],
] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Number((await params).id);
  const id = Number.isFinite(parsed) ? Math.max(1, Math.min(22, parsed)) : 1;
  const palette = palettes[(id - 1) % palettes.length];
  const portrait = id % 3 !== 0;
  const width = portrait ? 900 : 1200;
  const height = portrait ? 1200 : 820;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: `linear-gradient(145deg, ${palette[0]} 0%, ${palette[1]} 56%, ${palette[2]} 57%)`, color: "white" }}>
      <div style={{ position: "absolute", width: width * .72, height: width * .72, borderRadius: "50%", right: -width * .2, top: -width * .35, background: "rgba(255,255,255,.24)", display: "flex" }} />
      <div style={{ position: "absolute", left: width * .08, right: width * .08, bottom: height * .17, height: 3, background: "rgba(255,255,255,.55)", transform: "rotate(-7deg)", display: "flex" }} />
      <div style={{ position: "absolute", left: width * .1, bottom: height * .08, display: "flex", flexDirection: "column", textShadow: "0 2px 20px rgba(38,50,58,.28)" }}>
        <span style={{ fontSize: portrait ? 34 : 30, letterSpacing: 7 }}>MEMORY / {String(id).padStart(2, "0")}</span>
        <span style={{ marginTop: 14, fontSize: 18, letterSpacing: 6, opacity: .82 }}>OUR CLASS · MEMORY {String(id).padStart(2, "0")}</span>
      </div>
      <div style={{ position: "absolute", left: width * .12, top: height * .18, width: portrait ? 100 : 80, height: portrait ? 320 : 240, borderRadius: "50px 50px 18px 18px", background: "rgba(54,73,82,.3)", display: "flex" }} />
      <div style={{ position: "absolute", left: width * .27, top: height * .24, width: portrait ? 86 : 72, height: portrait ? 280 : 210, borderRadius: "50px 50px 18px 18px", background: "rgba(190,153,116,.36)", display: "flex" }} />
    </div>,
    { width, height, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
