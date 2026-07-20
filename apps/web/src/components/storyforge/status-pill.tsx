import { CircleCheck, CirclePause, CircleX, Clock3, LoaderCircle } from "lucide-react";

const labels: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  waiting: "等待中",
  done: "已生成",
  planned: "已规划",
  "prompt-only": "仅提示词",
  generating: "生成中",
  deferred: "已延后",
};

export function StatusPill({ status }: { status: string }) {
  const Icon = status === "completed" || status === "done"
    ? CircleCheck
    : status === "running" || status === "generating"
      ? LoaderCircle
      : status === "failed" || status === "cancelled"
        ? CircleX
        : status === "paused"
          ? CirclePause
          : Clock3;
  return (
    <span className={`status-pill ${status}`}>
      <Icon size={12} aria-hidden="true" />
      {labels[status] ?? status}
    </span>
  );
}
