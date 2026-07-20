"use client";

import { useMemo, useState } from "react";
import { Cpu, Image as ImageIcon, KeyRound, Video, X } from "lucide-react";
import {
  getProviderPreset,
  listProviderPresets,
  type ProviderModality,
  type ProviderPreset,
} from "@storyforge/agent-core";

type DraftConnection = {
  providerId: string;
  protocol: ProviderPreset["protocol"];
  baseUrl: string;
  model: string;
  apiKey: string;
  useResponses?: boolean;
};

type StartedInfo = {
  backend?: "local" | "cloud";
  verification?: Partial<Record<ProviderModality, "verified" | "deferred">>;
  llmLabel: string;
};

function draftFor(modality: ProviderModality, providerId: string, previousKey = ""): DraftConnection {
  const preset = getProviderPreset(modality, providerId);
  return {
    providerId: preset.id,
    protocol: preset.protocol,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: previousKey,
    useResponses: preset.useResponses,
  };
}

function connectionPayload(modality: ProviderModality, draft: DraftConnection) {
  return {
    modality,
    providerId: draft.providerId,
    protocol: draft.protocol,
    baseUrl: draft.baseUrl,
    model: draft.model,
    apiKey: draft.apiKey.trim(),
    useResponses: draft.useResponses,
    enabled: true,
  };
}

export function ProviderConnectionModal(props: {
  runId: string;
  onClose: () => void;
  onStarted: (info: StartedInfo) => void;
  onError: (message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<ProviderModality>("llm");
  const [llm, setLlm] = useState(() => draftFor("llm", "openai"));
  const [image, setImage] = useState(() => draftFor("image", "openai"));
  const [video, setVideo] = useState(() => draftFor("video", "runway"));
  const [imageEnabled, setImageEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [maxImages, setMaxImages] = useState(4);
  const [maxVideoSeconds, setMaxVideoSeconds] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const presets = useMemo(() => listProviderPresets(activeTab), [activeTab]);
  const draft = activeTab === "llm" ? llm : activeTab === "image" ? image : video;
  const enabled = activeTab === "llm" || activeTab === "image" ? activeTab === "llm" || imageEnabled : videoEnabled;

  function setDraft(next: DraftConnection) {
    if (activeTab === "llm") setLlm(next);
    else if (activeTab === "image") setImage(next);
    else setVideo(next);
  }

  function selectProvider(providerId: string) {
    setDraft(draftFor(activeTab, providerId, draft.apiKey));
  }

  const isConfigured = (connection: DraftConnection) => connection.apiKey.trim().length >= 8
    && connection.model.trim().length > 0
    && connection.baseUrl.trim().length > 0;
  const ready = isConfigured(llm)
    && (!imageEnabled || isConfigured(image))
    && (!videoEnabled || isConfigured(video));

  async function submit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/credentials/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: props.runId,
          providers: {
            llm: connectionPayload("llm", llm),
            ...(imageEnabled ? { image: connectionPayload("image", image) } : {}),
            ...(videoEnabled ? { video: connectionPayload("video", video) } : {}),
            limits: {
              maxImages: imageEnabled ? maxImages : 0,
              maxVideoSeconds: videoEnabled ? maxVideoSeconds : 0,
            },
          },
        }),
      });
      const body = await response.json() as StartedInfo & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "模型连接失败，请检查配置后重试。");
      props.onStarted({ ...body, llmLabel: getProviderPreset("llm", llm.providerId).label });
    } catch (error) {
      props.onError(error instanceof Error ? error.message : "模型连接失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="连接模型 API">
      <div className="modal credential-modal provider-modal">
        <div className="modal-header">
          <div><h2>连接模型 API</h2><span>Provider Hub</span></div>
          <button className="icon-button" type="button" title="关闭" onClick={props.onClose}><X size={14} /></button>
        </div>
        <div className="provider-body">
          <div className="credential-note"><KeyRound size={18} /><p>无需登录。密钥仅在服务端临时使用，不写入浏览器存储、日志或 Agent trace。</p></div>
          <div className="provider-tabs" role="tablist" aria-label="模型类型">
            <button type="button" role="tab" aria-selected={activeTab === "llm"} onClick={() => setActiveTab("llm")}><Cpu size={14} />LLM</button>
            <button type="button" role="tab" aria-selected={activeTab === "image"} onClick={() => setActiveTab("image")}><ImageIcon size={14} />图片</button>
            <button type="button" role="tab" aria-selected={activeTab === "video"} onClick={() => setActiveTab("video")}><Video size={14} />视频</button>
          </div>

          <div className="provider-panel" role="tabpanel">
            {activeTab !== "llm" ? (
              <label className="provider-enable">
                <input type="checkbox" checked={activeTab === "image" ? imageEnabled : videoEnabled} onChange={(event) => activeTab === "image" ? setImageEnabled(event.target.checked) : setVideoEnabled(event.target.checked)} />
                <span>为本次运行启用{activeTab === "image" ? "图片" : "视频"}生成</span>
              </label>
            ) : null}
            <div className="provider-fields" aria-disabled={!enabled}>
              <label>
                <span>供应商</span>
                <select value={draft.providerId} disabled={!enabled} onChange={(event) => selectProvider(event.target.value)}>
                  {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
              </label>
              <label>
                <span>模型</span>
                <input value={draft.model} disabled={!enabled} onChange={(event) => setDraft({ ...draft, model: event.target.value })} aria-label={`${activeTab} 模型`} />
              </label>
              <label className="provider-wide">
                <span>Base URL</span>
                <input value={draft.baseUrl} disabled={!enabled} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} aria-label={`${activeTab} Base URL`} spellCheck={false} />
              </label>
              <label className="provider-wide">
                <span>API Key</span>
                <input type="password" autoComplete="off" value={draft.apiKey} disabled={!enabled} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} aria-label={`${activeTab} API Key`} placeholder="仅用于本次运行" />
              </label>
              {activeTab === "image" && imageEnabled ? (
                <label>
                  <span>最多生成图片</span>
                  <input type="number" min={1} max={50} value={maxImages} onChange={(event) => setMaxImages(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} />
                </label>
              ) : null}
              {activeTab === "video" && videoEnabled ? (
                <label>
                  <span>最多生成秒数</span>
                  <input type="number" min={1} max={300} value={maxVideoSeconds} onChange={(event) => setMaxVideoSeconds(Math.max(1, Math.min(300, Number(event.target.value) || 1)))} />
                </label>
              ) : null}
            </div>
            <p className="provider-description">{getProviderPreset(activeTab, draft.providerId).description}</p>
          </div>
          <div className="provider-run-id">运行编号：{props.runId}</div>
        </div>
        <div className="modal-footer">
          <div className="provider-summary">LLM：{getProviderPreset("llm", llm.providerId).label} · 图片：{imageEnabled ? getProviderPreset("image", image.providerId).label : "提示词"} · 视频：{videoEnabled ? getProviderPreset("video", video.providerId).label : "提示词"}</div>
          <button className="command-button" type="button" onClick={props.onClose}>取消</button>
          <button className="command-button primary" type="button" onClick={() => void submit()} disabled={!ready || submitting}>{submitting ? "正在确认…" : "确认配置并启动"}</button>
        </div>
      </div>
    </div>
  );
}
