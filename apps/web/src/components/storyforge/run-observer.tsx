import { Activity, ShieldCheck } from "lucide-react";
import type { ProjectSnapshot } from "@storyforge/contracts";

export function RunObserver({ project }: { project: ProjectSnapshot }) {
  const totalDuration = project.stageRuns.reduce((sum, stage) => sum + stage.durationMs, 0);
  return (
    <aside className="observer-rail" aria-label="运行观察器">
      <div className="panel-heading observer-heading">
        <h2>运行观察器</h2>
        <span><ShieldCheck size={11} style={{ display: "inline", marginRight: 4 }} />已清洗事件</span>
      </div>
      <div className="observer-metrics">
        <div className="observer-metric"><strong>{(totalDuration / 1000).toFixed(1)}s</strong><span>阶段耗时</span></div>
        <div className="observer-metric"><strong>{project.usage.tokens.toLocaleString()}</strong><span>Token</span></div>
        <div className="observer-metric"><strong>${project.usage.costUsd.toFixed(2)}</strong><span>演示费用</span></div>
      </div>
      <div className="panel-heading observer-heading">
        <h3><Activity size={12} style={{ display: "inline", marginRight: 6 }} />实时事件</h3>
        <span>{project.events.length} 条</span>
      </div>
      <div className="event-list" aria-live="polite">
        {[...project.events].reverse().map((event) => {
          const state = event.type.includes("completed") ? "completed" : event.type.includes("failed") ? "failed" : "started";
          return (
            <div className={`event-item ${state}`} key={event.id}>
              <span className="event-dot" />
              <div className="event-copy">
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
                <div className="event-meta">
                  <span>#{String(event.sequence).padStart(2, "0")}</span>
                  {event.metrics?.durationMs ? <span>{event.metrics.durationMs} ms</span> : null}
                  {event.metrics?.tokens ? <span>{event.metrics.tokens} tok</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
