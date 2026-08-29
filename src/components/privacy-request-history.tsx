"use client";

import { useCallback, useEffect, useState } from "react";

type RequestItem = {
  id: string;
  photoId: string | null;
  photoTitle: string;
  kind: "hide" | "delete";
  message: string;
  status: "pending" | "resolved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
};

const statusLabels: Record<RequestItem["status"], string> = {
  pending: "等待管理员处理",
  resolved: "管理员已接受",
  rejected: "管理员未接受",
};

export function PrivacyRequestHistory() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/privacy-requests", { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as {
        requests?: RequestItem[];
      };
      if (!response.ok || !Array.isArray(result.requests)) {
        setState("error");
        return;
      }
      setItems(result.requests);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    window.addEventListener("privacy-request-created", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("privacy-request-created", load);
    };
  }, [load]);

  return (
    <section className="profile-request-history" aria-labelledby="request-history-title">
      <header>
        <div>
          <small>PRIVACY REQUESTS</small>
          <h2 id="request-history-title">我的申请记录</h2>
        </div>
        {state === "ready" && <span>{items.length} 条</span>}
      </header>
      <p className="profile-request-guide">
        需要处理别人上传的照片或视频时，请在该内容的详情页选择“申请处理此内容”。
      </p>

      {state === "loading" ? (
        <div className="profile-request-state" role="status">正在读取申请记录…</div>
      ) : state === "error" ? (
        <div className="profile-request-state error" role="alert">
          <span>申请记录暂时读取失败。</span>
          <button type="button" onClick={() => void load()}>重新加载</button>
        </div>
      ) : items.length === 0 ? (
        <div className="profile-request-state">
          <b>还没有申请记录</b>
          <span>当某份内容让你感到不舒服，可以直接从详情页提出隐藏或删除申请。</span>
        </div>
      ) : (
        <div className="profile-request-list">
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <span className={`privacy-status ${item.status}`}>
                  {statusLabels[item.status]}
                </span>
                <time>{new Date(item.createdAt).toLocaleString("zh-CN")}</time>
              </div>
              <h3>{item.photoTitle || "内容已删除"}</h3>
              <p>
                <b>{item.kind === "delete" ? "永久删除" : "隐藏内容"}</b>
                <span>{item.message || "未填写补充说明"}</span>
              </p>
              {item.resolvedAt && (
                <small>处理于 {new Date(item.resolvedAt).toLocaleString("zh-CN")}</small>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
