import { Volume2 } from "lucide-react";
import type { Shot } from "@storyforge/contracts";

export function TimelineView({ shots, onAssetClick }: { shots: Shot[]; onAssetClick: (assetId: string) => void }) {
  return (
    <div className="timeline-list">
      {shots.map((shot) => (
        <article className="timeline-shot" id={shot.id} key={shot.id}>
          <div className="shot-time">
            <strong>{shot.id.replace("SHOT-", "#")}</strong>
            {shot.start.toFixed(1)}<br />{shot.end.toFixed(1)}s
          </div>
          <span className="shot-rail" />
          <div className="shot-body">
            <h3>{shot.scene} · {shot.framing}</h3>
            <p>{shot.camera}。{shot.action}</p>
            {shot.dialogue ? <p className="shot-dialogue">{shot.dialogue}</p> : null}
            <div className="asset-tags" style={{ marginTop: 8 }}>
              {shot.assetIds.map((assetId) => (
                <button className="asset-chip" type="button" key={assetId} onClick={() => onAssetClick(assetId)}>{assetId}</button>
              ))}
            </div>
          </div>
          <div className="shot-sound">
            <strong><Volume2 size={11} style={{ display: "inline", marginRight: 4 }} />声音与转场</strong>
            <p>{shot.sound}</p>
            <p style={{ marginTop: 5 }}>{shot.transition}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
