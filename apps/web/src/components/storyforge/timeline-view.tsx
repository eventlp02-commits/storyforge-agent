import { ExternalLink, Volume2 } from "lucide-react";
import type { Shot } from "@storyforge/contracts";
import { StatusPill } from "./status-pill";

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
            <div className="shot-heading">
              <h3>{shot.scene} · {shot.framing}</h3>
              <StatusPill status={shot.generationStatus} />
              {shot.fileUrl ? <a className="icon-button shot-media-link" href={shot.fileUrl} target="_blank" rel="noreferrer" title="打开生成片段" aria-label={`打开 ${shot.id} 生成片段`}><ExternalLink size={11} /></a> : null}
            </div>
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
            {shot.mediaProvider ? <p className="shot-provider">{shot.mediaProvider}{shot.providerJobId ? ` · ${shot.providerJobId}` : ""}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
