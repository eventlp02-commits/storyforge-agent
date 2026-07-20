"use client";

import Image from "next/image";
import { Box, Film } from "lucide-react";
import type { Asset } from "@storyforge/contracts";
import { StatusPill } from "./status-pill";

export function AssetsView({ assets, selectedAssetId, onSelectAsset }: {
  assets: Asset[];
  selectedAssetId?: string;
  onSelectAsset: (assetId: string) => void;
}) {
  const selected = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0];
  return (
    <div className="assets-layout">
      <div className="asset-grid">
        {assets.map((asset) => (
          <button
            className={`asset-card ${asset.id === selected?.id ? "selected" : ""}`}
            type="button"
            key={asset.id}
            onClick={() => onSelectAsset(asset.id)}
          >
            <div className="asset-card-media">
              {asset.thumbnailUrl ? (
                <Image src={asset.thumbnailUrl} alt={asset.name} width={320} height={200} />
              ) : <Box size={24} />}
            </div>
            <div className="asset-card-copy">
              <strong>{asset.name}</strong>
              <span>{asset.id} · {asset.shotIds.length} 个镜头</span>
            </div>
          </button>
        ))}
      </div>
      {selected ? (
        <aside className="asset-detail">
          <StatusPill status={selected.status} />
          <h3>{selected.name}</h3>
          <div className="meta-chip">{selected.id} · {selected.type}</div>
          <p>{selected.notes ?? selected.prompt}</p>
          <div className="section-title-row" style={{ marginTop: 14, marginBottom: 8 }}>
            <h3><Film size={12} style={{ display: "inline", marginRight: 5 }} />关联镜头</h3>
            <span className="meta-chip">{selected.shotIds.length}</span>
          </div>
          <div className="asset-tags">
            {selected.shotIds.map((shotId) => <span className="asset-chip" key={shotId}>{shotId}</span>)}
          </div>
          <div className="section-title-row" style={{ marginTop: 16, marginBottom: 7 }}><h3>生成提示词</h3></div>
          <p>{selected.prompt}</p>
        </aside>
      ) : null}
    </div>
  );
}
