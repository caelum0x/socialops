import "./styles.css";

type Workspace = {
  id: string;
  name: string;
  plan: string;
};

type ContentDraft = {
  id: string;
  title: string;
  hook: string;
  content: string;
  mode: string;
  channel: string;
  status: string;
};

type VideoScript = {
  id: string;
  title: string;
  platform: string;
  mode: string;
  hook: string;
  script: string;
  scenes_json: Array<{ order?: number; caption?: string; narration?: string; duration_seconds?: number }>;
  captions_json: Array<{ start_ms?: number; end_ms?: number; text: string }>;
  status: "draft" | "approved" | "rejected";
};

type VideoJob = {
  id: string;
  template_key: string;
  status: string;
  render_provider: string;
  aspect_ratio: string;
};

type VideoAsset = {
  id: string;
  file_name: string;
  public_url?: string | null;
  storage_path: string;
  width: number;
  height: number;
  duration_seconds: number;
  status: string;
};

type VideoExportPackage = {
  asset: Pick<VideoAsset, "id" | "file_name" | "public_url" | "storage_path" | "status">;
  content_draft: Pick<ContentDraft, "id" | "title" | "hook" | "content" | "channel" | "status"> | null;
  post_copy: string;
  caption_text: string;
  manual_upload: {
    platform: string;
    required: boolean;
    ready: boolean;
    blocked_by: string[];
    instructions: string[];
    checklist: string[];
  };
};

type StorageStatus = {
  enabled: boolean;
  kind: string;
  help: string;
};

type UploadedMedia = {
  id: string;
  file_name: string;
  url: string;
  media_kind: string;
  status: string;
  size_bytes?: number;
};

type UploadState = {
  busy: boolean;
  progress: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  realUser: boolean;
};

type AppState = {
  loading: boolean;
  error: string;
  info: string;
  workspace: Workspace | null;
  drafts: ContentDraft[];
  selectedDraftId: string;
  videoScript: VideoScript | null;
  videoJob: VideoJob | null;
  videoAsset: VideoAsset | null;
  exportPackage: VideoExportPackage | null;
  storage: StorageStatus | null;
  uploads: UploadedMedia[];
  upload: UploadState;
};

const apiBaseUrl = getApiBaseUrl();
const devHeaders = {
  "content-type": "application/json",
  "x-socialops-user-email": "dev@socialops.local",
  "x-socialops-user-name": "SocialOps Dev",
};

const navItems = [
  "Dashboard",
  "Capture",
  "Content",
  "Videos",
  "Media",
  "Calendar",
  "Approvals",
  "Analytics",
  "Billing",
];

const state: AppState = {
  loading: true,
  error: "",
  info: "",
  workspace: null,
  drafts: [],
  selectedDraftId: "",
  videoScript: null,
  videoJob: null,
  videoAsset: null,
  exportPackage: null,
  storage: null,
  uploads: [],
  upload: {
    busy: false,
    progress: "",
    fileName: "",
    fileSize: 0,
    contentType: "",
    realUser: true,
  },
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("app root missing");
}
const root = app;

void boot();

async function boot(): Promise<void> {
  try {
    const [workspaces, storage] = await Promise.all([
      api<Workspace[]>("/v1/workspaces"),
      api<StorageStatus>("/v1/storage/status").catch(() => ({ enabled: false, kind: "disabled", help: "" })),
    ]);
    state.workspace = workspaces[0] ?? null;
    state.storage = storage;
    if (!state.workspace) {
      state.error = "No workspace found. Run the API seed first with pnpm run seed:api.";
      return;
    }
    await loadDrafts();
  } catch (error) {
    state.error = errorMessage(error);
  } finally {
    state.loading = false;
    render();
  }
}

async function loadDrafts(): Promise<void> {
  if (!state.workspace) {
    return;
  }
  state.drafts = await api<ContentDraft[]>(`/v1/workspaces/${state.workspace.id}/content-drafts`);
  state.selectedDraftId = state.selectedDraftId || state.drafts[0]?.id || "";
}

function render(): void {
  const selectedDraft = state.drafts.find((draft) => draft.id === state.selectedDraftId) ?? null;

  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand">
          <div class="mark" aria-hidden="true">S</div>
          <div>
            <strong>SocialOps</strong>
            <span>Product shell</span>
          </div>
        </div>
        <nav>
          ${navItems.map((item) => `<button class="nav-item ${item === "Videos" ? "active" : ""}" type="button">${item}</button>`).join("")}
        </nav>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">${escapeHtml(state.workspace?.name ?? "Workspace")}</p>
            <h1>Generate a captioned social video from an approved work draft</h1>
          </div>
          <div class="actions">
            <button id="refresh" type="button" class="ghost">Refresh</button>
            <button id="create-demo-draft" type="button" class="primary">Create Demo Draft</button>
          </div>
        </header>

        ${state.loading ? `<div class="notice">Loading SocialOps workspace...</div>` : ""}
        ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ""}
        ${state.info ? `<div class="notice success">${escapeHtml(state.info)}</div>` : ""}

        <section class="metrics" aria-label="Video workflow metrics">
          ${metric("Drafts", String(state.drafts.length), "available as video source")}
          ${metric("Script", state.videoScript?.status ?? "none", "approval-first")}
          ${metric("Render Job", state.videoJob?.status ?? "none", "FFmpeg assembler")}
          ${metric("Export", state.exportPackage ? (state.exportPackage.manual_upload.ready ? "ready" : "blocked") : (state.videoAsset?.status ?? "none"), "manual fallback")}
        </section>

        ${uploadCard()}

        <section class="video-workflow">
          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Step 1</p>
                <h2>Choose source draft</h2>
              </div>
            </div>
            <label class="field">
              <span>Content draft</span>
              <select id="draft-select">
                ${
                  state.drafts.length === 0
                    ? `<option value="">No drafts yet</option>`
                    : state.drafts
                        .map(
                          (draft) =>
                            `<option value="${escapeAttribute(draft.id)}" ${draft.id === state.selectedDraftId ? "selected" : ""}>${escapeHtml(
                              draft.title || draft.hook || draft.content.slice(0, 64),
                            )}</option>`,
                        )
                        .join("")
                }
              </select>
            </label>
            ${selectedDraft ? draftPreview(selectedDraft) : `<p class="muted">Create a demo draft to start the video flow.</p>`}
            <button id="generate-script" type="button" class="primary full" ${selectedDraft ? "" : "disabled"}>Generate Video Script</button>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Step 2</p>
                <h2>Approve script</h2>
              </div>
            </div>
            ${state.videoScript ? videoScriptPreview(state.videoScript) : `<p class="muted">Generate a script from the selected draft.</p>`}
            <button id="approve-script" type="button" class="primary full" ${state.videoScript && state.videoScript.status !== "approved" ? "" : "disabled"}>Approve Script</button>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Step 3</p>
                <h2>Render video</h2>
              </div>
            </div>
            ${state.videoJob ? jobPreview(state.videoJob) : `<p class="muted">Create a render job after script approval.</p>`}
            <div class="button-row">
              <button id="create-job" type="button" class="ghost full" ${state.videoScript?.status === "approved" && !state.videoJob ? "" : "disabled"}>Create Render Job</button>
              <button id="render-job" type="button" class="primary full" ${state.videoJob && state.videoJob.status === "queued" ? "" : "disabled"}>Render MP4</button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Step 4</p>
                <h2>Review asset</h2>
              </div>
            </div>
            ${state.videoAsset ? assetPreview(state.videoAsset) : `<p class="muted">Rendered video metadata appears here. Approve it, attach it, then prepare a manual export package.</p>`}
            ${state.exportPackage ? exportPackagePreview(state.exportPackage) : ""}
            <div class="button-row">
              <button id="approve-asset" type="button" class="ghost full" ${state.videoAsset?.status === "rendered" ? "" : "disabled"}>Approve Video</button>
              <button id="attach-asset" type="button" class="primary full" ${state.videoAsset?.status === "approved" ? "" : "disabled"}>Attach to Draft</button>
            </div>
            <button id="export-package" type="button" class="ghost full" ${
              state.videoAsset && ["approved", "used"].includes(state.videoAsset.status) ? "" : "disabled"
            }>Prepare Manual Export</button>
          </div>
        </section>
      </main>
    </div>
  `;

  bindEvents();
}

function bindEvents(): void {
  document.querySelector("#refresh")?.addEventListener("click", () => runAction(refresh));
  document.querySelector("#create-demo-draft")?.addEventListener("click", () => runAction(createDemoDraft));
  document.querySelector("#generate-script")?.addEventListener("click", () => runAction(generateVideoScript));
  document.querySelector("#approve-script")?.addEventListener("click", () => runAction(approveVideoScript));
  document.querySelector("#create-job")?.addEventListener("click", () => runAction(createRenderJob));
  document.querySelector("#render-job")?.addEventListener("click", () => runAction(renderVideoJob));
  document.querySelector("#approve-asset")?.addEventListener("click", () => runAction(approveVideoAsset));
  document.querySelector("#attach-asset")?.addEventListener("click", () => runAction(attachVideoAsset));
  document.querySelector("#export-package")?.addEventListener("click", () => runAction(loadExportPackage));
  document.querySelector("#draft-select")?.addEventListener("change", (event) => {
    state.selectedDraftId = (event.target as HTMLSelectElement).value;
    state.videoScript = null;
    state.videoJob = null;
    state.videoAsset = null;
    state.exportPackage = null;
    render();
  });
  bindUploadEvents();
}

function bindUploadEvents(): void {
  const dropzone = document.querySelector<HTMLDivElement>("#dropzone");
  const input = document.querySelector<HTMLInputElement>("#upload-input");
  const realUser = document.querySelector<HTMLInputElement>("#real-user");

  realUser?.addEventListener("change", () => {
    state.upload.realUser = realUser.checked;
  });

  if (!dropzone || !input) {
    return;
  }
  dropzone.addEventListener("click", () => {
    if (state.upload.busy || !state.storage?.enabled) {
      return;
    }
    input.click();
  });
  dropzone.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !state.upload.busy && state.storage?.enabled) {
      event.preventDefault();
      input.click();
    }
  });
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void runAction(() => uploadClip(file));
    }
  });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      void runAction(() => uploadClip(file));
    }
  });
}

async function uploadClip(file: File): Promise<void> {
  if (!state.workspace) {
    throw new Error("No workspace selected");
  }
  if (!state.storage?.enabled) {
    throw new Error("Storage is not configured on the API");
  }
  if (!state.upload.realUser) {
    throw new Error("Confirm real-user / real-product consent before uploading (FTC rule).");
  }

  state.upload.busy = true;
  state.upload.fileName = file.name;
  state.upload.fileSize = file.size;
  state.upload.contentType = file.type || "application/octet-stream";

  state.upload.progress = "Requesting upload URL...";
  render();
  const presigned = await api<{
    upload_url: string;
    public_url: string;
    key: string;
    required_headers: Record<string, string>;
  }>(`/v1/workspaces/${state.workspace.id}/uploads/presign`, {
    method: "POST",
    body: JSON.stringify({
      file_name: file.name,
      content_type: state.upload.contentType,
      size_bytes: file.size,
    }),
  });

  state.upload.progress = `Uploading direct to storage (${formatBytes(file.size)})...`;
  render();
  const putHeaders: Record<string, string> = { ...presigned.required_headers };
  const putResponse = await fetch(presigned.upload_url, { method: "PUT", headers: putHeaders, body: file });
  if (!putResponse.ok) {
    throw new Error(`Direct upload failed: ${putResponse.status} ${await putResponse.text()}`);
  }

  state.upload.progress = "Registering media asset...";
  render();
  const mediaKind = file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("audio/")
      ? "audio"
      : file.type.startsWith("image/")
        ? "image"
        : "video";
  const registered = await api<UploadedMedia>(`/v1/workspaces/${state.workspace.id}/videos/people/upload`, {
    method: "POST",
    body: JSON.stringify({
      url: presigned.public_url,
      file_name: file.name,
      mime_type: state.upload.contentType,
      media_kind: mediaKind,
      size_bytes: file.size,
      is_real_user: true,
    }),
  });
  state.uploads = [{ ...registered, size_bytes: file.size }, ...state.uploads].slice(0, 12);
  state.upload.busy = false;
  state.upload.progress = "";
  state.info = `Uploaded ${file.name} — media_asset_id = ${registered.id}`;
}

async function refresh(): Promise<void> {
  await loadDrafts();
  state.info = "Workspace refreshed.";
}

async function createDemoDraft(): Promise<void> {
  if (!state.workspace) {
    return;
  }
  const draft = await api<ContentDraft>(`/v1/workspaces/${state.workspace.id}/content-drafts`, {
    method: "POST",
    body: JSON.stringify({
      mode: "project",
      channel: "tiktok",
      type: "script",
      title: "Weekly update video seed",
      hook: "Turn your weekly work into proof.",
      content:
        "This week I worked on VCPeer Terminal, payment providers, and SocialOps. The useful part was turning product work into an approval-first content workflow.",
      target_audience: "students, builders, and founders",
      purpose: "weekly update video",
      generated_by_ai: false,
      reason_this_works: "It starts from real work and turns it into public proof.",
      suggested_visual: "Captioned vertical video with SocialOps workflow scenes.",
    }),
  });
  state.selectedDraftId = draft.id;
  state.videoScript = null;
  state.videoJob = null;
  state.videoAsset = null;
  state.exportPackage = null;
  await loadDrafts();
  state.info = "Demo draft created.";
}

async function generateVideoScript(): Promise<void> {
  if (!state.workspace || !state.selectedDraftId) {
    return;
  }
  state.videoScript = await api<VideoScript>(`/v1/workspaces/${state.workspace.id}/videos/script`, {
    method: "POST",
    body: JSON.stringify({
      content_draft_id: state.selectedDraftId,
      platform: "tiktok",
      mode: "project",
      video_type: "career_lesson_vertical",
      duration_seconds: 30,
    }),
  });
  state.videoJob = null;
  state.videoAsset = null;
  state.exportPackage = null;
  state.info = "Video script generated. Review and approve it before rendering.";
}

async function approveVideoScript(): Promise<void> {
  if (!state.workspace || !state.videoScript) {
    return;
  }
  state.videoScript = await api<VideoScript>(`/v1/workspaces/${state.workspace.id}/videos/scripts/${state.videoScript.id}/approval`, {
    method: "POST",
    body: JSON.stringify({ action: "approve" }),
  });
  state.info = "Video script approved.";
}

async function createRenderJob(): Promise<void> {
  if (!state.workspace || !state.videoScript) {
    return;
  }
  state.videoJob = await api<VideoJob>(`/v1/workspaces/${state.workspace.id}/videos/jobs`, {
    method: "POST",
    body: JSON.stringify({
      video_script_id: state.videoScript.id,
      template_key: "career-lesson-vertical",
      render_provider: "remotion",
      aspect_ratio: "9:16",
    }),
  });
  state.info = "Render job queued.";
}

async function renderVideoJob(): Promise<void> {
  if (!state.workspace || !state.videoJob) {
    return;
  }
  const result = await api<{ job?: VideoJob; asset?: VideoAsset; status?: string }>(
    `/v1/workspaces/${state.workspace.id}/videos/jobs/${state.videoJob.id}/render`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  if (result.job) {
    state.videoJob = result.job;
  }
  if (result.asset) {
    state.videoAsset = result.asset;
  }
  state.exportPackage = null;
  state.info = result.asset ? "Video rendered and stored as a VideoAsset." : "Video render moved into worker queue.";
}

async function approveVideoAsset(): Promise<void> {
  if (!state.workspace || !state.videoAsset) {
    return;
  }
  state.videoAsset = await api<VideoAsset>(`/v1/workspaces/${state.workspace.id}/videos/assets/${state.videoAsset.id}/approval`, {
    method: "POST",
    body: JSON.stringify({ action: "approve" }),
  });
  state.exportPackage = null;
  state.info = "Video approved. It can now attach to the source draft.";
}

async function attachVideoAsset(): Promise<void> {
  if (!state.workspace || !state.videoAsset || !state.selectedDraftId) {
    return;
  }
  const result = await api<{ video_asset: VideoAsset; media_asset: unknown; draft: ContentDraft; bridge: { status: string } }>(
    `/v1/workspaces/${state.workspace.id}/videos/assets/${state.videoAsset.id}/attach-to-draft`,
    {
      method: "POST",
      body: JSON.stringify({ content_draft_id: state.selectedDraftId }),
    },
  );
  state.videoAsset = result.video_asset;
  state.exportPackage = null;
  await loadDrafts();
  state.info = `Video attached to draft as approved media. Bridge status: ${result.bridge.status}.`;
}

async function loadExportPackage(): Promise<void> {
  if (!state.workspace || !state.videoAsset) {
    return;
  }
  state.exportPackage = await api<VideoExportPackage>(
    `/v1/workspaces/${state.workspace.id}/videos/assets/${state.videoAsset.id}/export-package`,
  );
  state.info = state.exportPackage.manual_upload.ready
    ? "Manual export package is ready."
    : "Manual export package created, but approval checks are blocking upload.";
}

async function runAction(action: () => Promise<void>): Promise<void> {
  state.error = "";
  state.info = "";
  state.loading = true;
  render();
  try {
    await action();
  } catch (error) {
    state.error = errorMessage(error);
    // Always release upload-busy on error so the dropzone is interactive again.
    state.upload.busy = false;
    state.upload.progress = "";
  } finally {
    state.loading = false;
    render();
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...devHeaders,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function uploadCard(): string {
  const storage = state.storage;
  const status = storage?.enabled ? "Storage: connected" : "Storage: not configured";
  const help = storage?.enabled
    ? "Drag a phone/cam/screen-rec clip below. SocialOps presigns an R2 PUT, the browser uploads direct, then the asset is registered for the assembler."
    : (storage?.help ?? "Set STORAGE_KIND=r2 + STORAGE_BUCKET + access keys on the API to enable browser uploads.");
  const disabledAttr = state.upload.busy || !storage?.enabled ? "disabled" : "";
  const realUserChecked = state.upload.realUser ? "checked" : "";
  return `
    <section class="panel" aria-label="Upload a clip" style="margin-top:18px">
      <div class="panel-head">
        <div>
          <p class="eyebrow">${escapeHtml(status)}</p>
          <h2>Drop a real product / camera / screen-rec clip</h2>
        </div>
      </div>
      <p class="muted" style="margin:0 0 12px 0">${escapeHtml(help)}</p>
      <div id="dropzone" class="dropzone${state.upload.busy ? " busy" : ""}" tabindex="0" role="button" aria-label="Drop clip or click to pick">
        <div class="dropzone-title">${state.upload.busy ? escapeHtml(state.upload.progress || "Uploading...") : "Drop a clip here, or click to choose"}</div>
        <div class="dropzone-help">${
          state.upload.fileName
            ? `${escapeHtml(state.upload.fileName)} (${formatBytes(state.upload.fileSize)})`
            : "Supports mp4 / mov / webm / m4a / wav up to 2GB. Direct-to-R2, no API egress."
        }</div>
      </div>
      <input type="file" id="upload-input" style="display:none" accept="video/*,audio/*,image/*" />
      <label class="checkbox-row" style="margin-top:12px;display:flex;gap:8px;align-items:center">
        <input type="checkbox" id="real-user" ${realUserChecked} />
        <span>I confirm this footage is a real user / my real product (FTC fake-testimonial rule)</span>
      </label>
      ${state.uploads.length > 0 ? uploadsList() : ""}
    </section>
  `;
}

function uploadsList(): string {
  return `
    <div class="uploads-list" style="margin-top:14px">
      <h3 style="font-size:14px;margin:0 0 8px 0;color:#374151">Recent uploads</h3>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
        ${state.uploads
          .map(
            (upload) => `
          <li style="display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:8px 12px;background:#f9fafb;border-radius:8px">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(upload.file_name)}</span>
            <span style="color:#6b7280">${escapeHtml(upload.media_kind)} / ${escapeHtml(upload.status)}</span>
          </li>
        `,
          )
          .join("")}
      </ul>
    </div>
  `;
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

function metric(label: string, value: string, detail: string): string {
  return `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function draftPreview(draft: ContentDraft): string {
  return `
    <article class="preview">
      <span>${escapeHtml(draft.channel)} / ${escapeHtml(draft.mode)} / ${escapeHtml(draft.status)}</span>
      <strong>${escapeHtml(draft.hook || draft.title)}</strong>
      <p>${escapeHtml(draft.content)}</p>
    </article>
  `;
}

function videoScriptPreview(script: VideoScript): string {
  return `
    <article class="preview">
      <span>${escapeHtml(script.platform)} / ${escapeHtml(script.mode)} / ${escapeHtml(script.status)}</span>
      <strong>${escapeHtml(script.hook)}</strong>
      <div class="scene-list">
        ${script.scenes_json
          .map(
            (scene) => `
              <div>
                <b>Scene ${escapeHtml(String(scene.order ?? ""))}</b>
                <span>${escapeHtml(scene.caption ?? scene.narration ?? "")}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function jobPreview(job: VideoJob): string {
  return `
    <article class="preview">
      <span>${escapeHtml(job.render_provider)} / ${escapeHtml(job.aspect_ratio)}</span>
      <strong>${escapeHtml(job.template_key)}</strong>
      <p>Status: ${escapeHtml(job.status)}</p>
    </article>
  `;
}

function assetPreview(asset: VideoAsset): string {
  const video = asset.public_url
    ? `<video class="video-preview" src="${escapeAttribute(asset.public_url)}" controls></video>`
    : `<div class="video-placeholder">MP4 stored at ${escapeHtml(asset.storage_path)}</div>`;
  return `
    <article class="preview">
      <span>${escapeHtml(asset.status)} / ${asset.width}x${asset.height} / ${asset.duration_seconds}s</span>
      <strong>${escapeHtml(asset.file_name)}</strong>
      ${video}
    </article>
  `;
}

function exportPackagePreview(pkg: VideoExportPackage): string {
  return `
    <article class="export-package">
      <div>
        <span>Manual export / ${escapeHtml(pkg.manual_upload.platform)} / ${pkg.manual_upload.ready ? "ready" : "blocked"}</span>
        <strong>${escapeHtml(pkg.content_draft?.hook || pkg.content_draft?.title || pkg.asset.file_name)}</strong>
      </div>
      ${
        pkg.manual_upload.blocked_by.length > 0
          ? `<ul class="blocked">${pkg.manual_upload.blocked_by.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
          : `<p class="ready-copy">Approved for manual upload fallback.</p>`
      }
      <div class="copy-box">
        <b>Post copy</b>
        <p>${escapeHtml(pkg.post_copy || "No post copy attached yet.")}</p>
      </div>
      <div class="copy-box">
        <b>Upload steps</b>
        <ol>${pkg.manual_upload.instructions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
      </div>
    </article>
  `;
}

function getApiBaseUrl(): string {
  const env = import.meta as unknown as { env?: Record<string, string | undefined> };
  return env.env?.VITE_API_URL ?? "http://localhost:3001";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
