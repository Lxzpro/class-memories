"use client";

import type { PhotoOrder } from "@/lib/photo-order";

const orderOptions: Array<{ value: PhotoOrder; label: string }> = [
  { value: "random", label: "随机浏览" },
  { value: "newest", label: "最近加入" },
  { value: "oldest", label: "从头翻起" },
];

type Props = {
  order: PhotoOrder;
  mediaLabel: "照片" | "视频";
  onChange: (order: PhotoOrder) => void;
  onReshuffle: () => void;
};

export function PhotoOrderControl({
  order,
  mediaLabel,
  onChange,
  onReshuffle,
}: Props) {
  const reshuffleLabel = `重新随机排列${mediaLabel}`;

  return (
    <div className="photo-order-control">
      <span className="photo-order-label">展示顺序</span>
      <div
        className="photo-order-options"
        role="group"
        aria-label={`${mediaLabel}展示顺序`}
      >
        {orderOptions.map((option) => (
          <button
            type="button"
            className={order === option.value ? "active" : ""}
            aria-pressed={order === option.value}
            onClick={() => onChange(option.value)}
            key={option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="photo-reshuffle-button"
        aria-label={reshuffleLabel}
        title={reshuffleLabel}
        disabled={order !== "random"}
        onClick={onReshuffle}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M16 3h5v5" />
          <path d="m21 3-6.4 6.4a2 2 0 0 1-2.8 0L4 17.2" />
          <path d="M16 16h5v5" />
          <path d="m21 21-6.4-6.4" />
          <path d="M4 6.8 7.2 10" />
        </svg>
      </button>
    </div>
  );
}
