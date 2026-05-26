#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const OUTPUT_DIR = resolve(process.env.SOCIALOPS_KLING_OUTPUT_DIR ?? "/tmp/socialops-twitter-videos");
const KLING_BASE_URL = (process.env.KLING_AI_BASE_URL ?? "https://api.klingai.com").replace(/\/+$/u, "");
const POLL_INTERVAL_MS = Number(process.env.SOCIALOPS_KLING_POLL_INTERVAL_MS ?? 15_000);
const POLL_TIMEOUT_MS = Number(process.env.SOCIALOPS_KLING_POLL_TIMEOUT_MS ?? 12 * 60_000);
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "ffmpeg";

const projects = [
  {
    key: "vcpeer",
    name: "VCPeer",
    domain: "vcpeer.com",
    label: "AI venture diligence workspace",
    hook: "Find better venture signals before the deal gets noisy.",
    proof: "Research, signals, notes, and investor-ready context in one content loop.",
    cta: "Turn diligence work into public proof.",
    palette: {
      bg: "#07111f",
      panel: "#0e1b2d",
      ink: "#e6f1ff",
      muted: "#9fb3ca",
      accent: "#42e8c5",
      accent2: "#6aa9ff",
    },
    prompt:
      "Cinematic vertical tech product brand film, premium AI venture diligence workspace, glowing signal graph, tasteful kinetic camera push, crisp typography, dark interface-inspired background, no fake UI, no people, no logos beyond the source frame.",
    edit: {
      duration: 16,
      scenes: [
        { kind: "vcpeer-ask", eyebrow: "Private-market answer engine", headline: "Start with an answer.", detail: "Explain a startup, compare funded companies, trace investor behavior, or map a market." },
        { kind: "vcpeer-modes", eyebrow: "Core research modes", headline: "Ask. Compare. Map.", detail: "Research modes for startups, investors, companies, rounds, and markets." },
        { kind: "vcpeer-report", eyebrow: "Workspace", headline: "Turn the answer into a report.", detail: "Save, export, alerts, full reports, and deeper evidence after sign in." },
        { kind: "vcpeer-cta", eyebrow: "vcpeer.com", headline: "Diligence before the directory.", detail: "For founders, investors, and startup operators." },
      ],
    },
  },
  {
    key: "recoder",
    name: "Recoder",
    domain: "recoder.xyz",
    label: "Coding agent workspace",
    hook: "Describe the task. Let agents do the implementation work.",
    proof: "Threads, sandboxes, GitHub tasks, and review loops for real shipping.",
    cta: "Turn product work into shipped pull requests.",
    palette: {
      bg: "#10130f",
      panel: "#182018",
      ink: "#f4f1e8",
      muted: "#b8c3aa",
      accent: "#d7ff63",
      accent2: "#7dd3fc",
    },
    prompt:
      "Cinematic vertical tech product brand film, coding agent workspace, terminal energy and product shipping workflow, smooth parallax camera push, crisp typography, no fake UI, no people, no public figure, no testimonial framing.",
    edit: {
      duration: 18,
      scenes: [
        { kind: "recoder-hero", eyebrow: "Build with AI. Keep control.", headline: "Agents, Web IDE, CLI, PM, Agency.", detail: "One system for coding, planning, and delivery." },
        { kind: "recoder-activation", eyebrow: "Activation path", headline: "Sign in. Connect keys. Ship.", detail: "Bring OpenRouter, OpenAI, Anthropic, or Google keys." },
        { kind: "recoder-surfaces", eyebrow: "Five working surfaces", headline: "Move between the surfaces.", detail: "Agents, Web IDE, PM, Agency, and terminal-first recoder-code." },
        { kind: "recoder-a2a", eyebrow: "A2A / MCP ready", headline: "Connect Claude Code, Codex, Cursor.", detail: "Agent discovery, scoped auth, audit logs, and streaming responses." },
        { kind: "recoder-cta", eyebrow: "recoder.xyz", headline: "BYOK-first developer platform.", detail: "No credit card to start. Keep model choice and cost control." },
      ],
    },
  },
];

await loadDotEnv(resolve(".env"));

const args = parseArgs(process.argv.slice(2));
const selectedKeys = csv(args.projects ?? "vcpeer,recoder");
const selectedProjects = projects.filter((project) => selectedKeys.includes(project.key));
if (selectedProjects.length === 0) {
  throw new Error(`No known projects selected. Use --projects ${projects.map((project) => project.key).join(",")}`);
}

const accessKey = process.env.KLING_AI_ACCESS_KEY;
const secretKey = process.env.KLING_AI_SECRET_KEY;
if (!accessKey || !secretKey) {
  throw new Error("KLING_AI_ACCESS_KEY and KLING_AI_SECRET_KEY are required. Set them in the environment or local .env.");
}

await mkdir(OUTPUT_DIR, { recursive: true });
await mkdir(join(OUTPUT_DIR, "frames"), { recursive: true });
await mkdir(join(OUTPUT_DIR, "videos"), { recursive: true });

const manifest = {
  createdAt: new Date().toISOString(),
  provider: "kling_ai",
  outputDir: OUTPUT_DIR,
  videos: [],
};

for (const project of selectedProjects) {
  const frameSvg = join(OUTPUT_DIR, "frames", `${project.key}.svg`);
  const framePng = join(OUTPUT_DIR, "frames", `${project.key}.png`);
  await writeFile(frameSvg, renderSourceFrame(project), "utf8");
  await renderSvgToPng(frameSvg, framePng);

  const videoPath = join(OUTPUT_DIR, "videos", `${project.key}-twitter-kling.mp4`);
  let submitted = null;
  let completed = null;
  let error = null;

  try {
    const imageBase64 = (await readFile(framePng)).toString("base64");
    submitted = await submitKlingJob({
      accessKey,
      secretKey,
      imageBase64,
      prompt: project.prompt,
      externalTaskId: `socialops-${project.key}-${Date.now()}`,
    });

    console.log(`${project.name}: submitted Kling task ${submitted.taskId}`);
    completed = args.noWait === "true" ? submitted : await pollKlingJob({ accessKey, secretKey, taskId: submitted.taskId });

    if (completed.videoUrl) {
      await download(completed.videoUrl, videoPath);
      console.log(`${project.name}: downloaded ${videoPath}`);
    } else {
      console.log(`${project.name}: task queued, no video URL yet`);
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    if (args.noFallback !== "true") {
      await renderFallbackVideo(project, videoPath);
      completed = { taskId: submitted?.taskId ?? null, status: "ffmpeg_fallback", videoUrl: null };
      console.log(`${project.name}: Kling unavailable; rendered FFmpeg fallback ${videoPath}`);
    } else {
      throw caught;
    }
  }

  manifest.videos.push({
    project: project.key,
    domain: project.domain,
    sourceFrame: framePng,
    taskId: submitted?.taskId ?? null,
    status: completed?.status ?? "failed",
    videoUrl: completed?.videoUrl ?? null,
    videoPath: completed?.videoUrl || completed?.status === "ffmpeg_fallback" ? videoPath : null,
    error,
  });
}

const manifestPath = join(OUTPUT_DIR, "manifest.json");
await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Manifest: ${manifestPath}`);

async function submitKlingJob(input) {
  const response = await fetch(`${KLING_BASE_URL}/v1/videos/image2video`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${signKlingJwt(input.accessKey, input.secretKey)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model_name: args.model ?? "kling-v1-6",
      image: input.imageBase64,
      prompt: input.prompt,
      negative_prompt:
        "fake product interface, fake screenshots, fake dashboard, testimonial, person, face, hands, distorted text, unreadable text, watermark, low quality",
      aspect_ratio: args.aspectRatio ?? "9:16",
      duration: args.duration ?? "5",
      mode: args.mode ?? "std",
      external_task_id: input.externalTaskId,
    }),
  });
  const body = await readResponseJson(response);
  if (!response.ok || body.code) {
    throw new Error(`Kling submit failed (${response.status}): ${JSON.stringify(body)}`);
  }
  const taskId = body.data?.task_id ?? body.task_id;
  if (!taskId) {
    throw new Error(`Kling submit did not return a task id: ${JSON.stringify(body)}`);
  }
  return { taskId, status: body.data?.task_status ?? body.status ?? "submitted" };
}

async function pollKlingJob(input) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const response = await fetch(`${KLING_BASE_URL}/v1/videos/image2video/${input.taskId}`, {
      headers: {
        authorization: `Bearer ${signKlingJwt(input.accessKey, input.secretKey)}`,
      },
    });
    const body = await readResponseJson(response);
    if (!response.ok || body.code) {
      throw new Error(`Kling poll failed (${response.status}): ${JSON.stringify(body)}`);
    }
    const status = body.data?.task_status ?? body.status;
    console.log(`Kling task ${input.taskId}: ${status}`);
    if (status === "succeed" || status === "completed" || status === "success") {
      return {
        taskId: input.taskId,
        status,
        videoUrl: body.data?.task_result?.videos?.[0]?.url ?? body.video_url ?? body.output?.[0],
      };
    }
    if (status === "failed" || status === "fail") {
      throw new Error(`Kling task failed: ${JSON.stringify(body)}`);
    }
  }
  return { taskId: input.taskId, status: "timeout" };
}

async function download(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function renderSvgToPng(svgPath, pngPath) {
  await execFile("rsvg-convert", ["--width", "1080", "--height", "1920", "--format", "png", "--output", pngPath, svgPath]);
}

async function renderFallbackVideo(project, outputPath) {
  const editDir = join(OUTPUT_DIR, "edit", project.key);
  await rm(editDir, { recursive: true, force: true });
  await mkdir(editDir, { recursive: true });

  const clips = [];
  for (let index = 0; index < project.edit.scenes.length; index += 1) {
    const scene = project.edit.scenes[index];
    const svgPath = join(editDir, `scene-${String(index + 1).padStart(2, "0")}.svg`);
    const pngPath = join(editDir, `scene-${String(index + 1).padStart(2, "0")}.png`);
    const clipPath = join(editDir, `clip-${String(index + 1).padStart(2, "0")}.mp4`);
    await writeFile(svgPath, renderEditScene(project, scene, index), "utf8");
    await renderSvgToPng(svgPath, pngPath);
    await renderSceneClip(pngPath, clipPath, sceneDuration(project));
    clips.push(clipPath);
  }

  const concatPath = join(editDir, "concat.txt");
  await writeFile(concatPath, clips.map((clip) => `file '${clip.replace(/'/gu, "'\\''")}'`).join("\n"), "utf8");
  await execFile(FFMPEG_PATH, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

function sceneDuration(project) {
  const requested = Number(args.duration);
  if (Number.isFinite(requested) && requested >= project.edit.scenes.length * 2) {
    return requested / project.edit.scenes.length;
  }
  return project.edit.duration / project.edit.scenes.length;
}

async function renderSceneClip(framePath, outputPath, durationSeconds) {
  const frames = Math.round(durationSeconds * 30);
  await execFile(FFMPEG_PATH, [
    "-y",
    "-loop",
    "1",
    "-i",
    framePath,
    "-t",
    String(durationSeconds),
    "-r",
    "30",
    "-vf",
    `zoompan=z='min(zoom+0.0018,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p`,
    "-an",
    "-c:v",
    "h264_videotoolbox",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ]);
}

function renderEditScene(project, scene, index) {
  if (project.key === "vcpeer") {
    return renderVcpeerScene(project, scene, index);
  }
  return renderRecoderScene(project, scene, index);
}

function renderVcpeerScene(project, scene, index) {
  const { palette } = project;
  const nodes = [
    [188, 620, "Founder"], [410, 520, "Round"], [682, 642, "Investor"], [848, 490, "Market"],
    [262, 890, "Company"], [572, 884, "Signal"], [834, 1010, "Report"],
  ];
  return svgWrap(palette, `
    <rect x="64" y="92" width="952" height="1736" rx="36" fill="#07111f" stroke="${palette.accent}" stroke-opacity="0.26"/>
    <text x="104" y="174" ${font(28, 800, palette.accent)}>${escapeXml(scene.eyebrow)}</text>
    <text x="104" y="316" ${font(84, 900, palette.ink)}>${lines(scene.headline, 820, 84, 104)}</text>
    <g opacity="0.9">
      ${nodes.map(([x, y, label], nodeIndex) => `
        <circle cx="${x}" cy="${y}" r="${nodeIndex === index + 1 ? 82 : 56}" fill="${nodeIndex % 2 ? palette.accent2 : palette.accent}" fill-opacity="${nodeIndex === index + 1 ? 0.28 : 0.14}" stroke="${nodeIndex % 2 ? palette.accent2 : palette.accent}" stroke-width="3"/>
        <text x="${x}" y="${y + 8}" text-anchor="middle" ${font(23, 800, palette.ink)}>${label}</text>`).join("")}
      <path d="M188 620 C322 548 520 566 682 642 S762 568 848 490" fill="none" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
      <path d="M262 890 C402 802 480 960 572 884 S746 904 834 1010" fill="none" stroke="${palette.accent2}" stroke-width="7" stroke-linecap="round"/>
    </g>
    <rect x="104" y="1230" width="872" height="290" rx="28" fill="${palette.panel}" stroke="${palette.accent}" stroke-opacity="0.24"/>
    <text x="144" y="1322" ${font(42, 850, palette.ink)}>${lines(scene.detail, 780, 42, 144)}</text>
    <text x="104" y="1654" ${font(32, 800, palette.muted)}>vcpeer.com</text>
    <text x="104" y="1710" ${font(26, 650, palette.muted)}>Source: public homepage copy, captured by SocialOps</text>
  `);
}

function renderRecoderScene(project, scene, index) {
  const { palette } = project;
  const columns = ["Agents", "Web IDE", "CLI", "PM", "Agency"];
  return svgWrap(palette, `
    <rect x="54" y="70" width="972" height="1780" rx="30" fill="#10130f" stroke="${palette.accent}" stroke-opacity="0.24"/>
    <text x="96" y="152" ${font(28, 850, palette.accent)}>${escapeXml(scene.eyebrow)}</text>
    <text x="96" y="298" ${font(78, 900, palette.ink)}>${lines(scene.headline, 830, 78, 96)}</text>
    <g transform="translate(96 560)">
      <rect x="0" y="0" width="888" height="520" rx="22" fill="#050705" stroke="${palette.accent}" stroke-opacity="0.25"/>
      <text x="36" y="72" ${font(28, 800, palette.accent2)}>$ recoder task "${escapeXml(commandForRecoder(index))}"</text>
      <text x="36" y="146" ${font(26, 700, palette.muted)}>connect provider -> create agent -> run tools -> review output</text>
      <path d="M54 258 H828" stroke="${palette.accent}" stroke-width="4" stroke-dasharray="14 16" opacity="0.65"/>
      ${columns.map((label, columnIndex) => {
        const x = 70 + columnIndex * 164;
        const active = columnIndex === index % columns.length;
        return `<rect x="${x}" y="${active ? 294 : 318}" width="126" height="${active ? 112 : 88}" rx="16" fill="${active ? palette.accent : palette.panel}" fill-opacity="${active ? 0.28 : 0.88}" stroke="${active ? palette.accent : palette.muted}" stroke-opacity="0.5"/>
        <text x="${x + 63}" y="${active ? 358 : 370}" text-anchor="middle" ${font(22, 850, palette.ink)}>${label}</text>`;
      }).join("")}
    </g>
    <rect x="96" y="1220" width="888" height="286" rx="24" fill="${palette.panel}" stroke="${palette.accent2}" stroke-opacity="0.22"/>
    <text x="132" y="1310" ${font(42, 850, palette.ink)}>${lines(scene.detail, 790, 42, 132)}</text>
    <text x="96" y="1654" ${font(32, 800, palette.muted)}>recoder.xyz</text>
    <text x="96" y="1710" ${font(26, 650, palette.muted)}>Source: public homepage copy, captured by SocialOps</text>
  `);
}

function svgWrap(palette, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <radialGradient id="a" cx="76%" cy="14%" r="70%"><stop offset="0" stop-color="${palette.accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${palette.bg}" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="18%" cy="88%" r="68%"><stop offset="0" stop-color="${palette.accent2}" stop-opacity="0.24"/><stop offset="1" stop-color="${palette.bg}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="${palette.bg}"/>
  <rect width="1080" height="1920" fill="url(#a)"/>
  <rect width="1080" height="1920" fill="url(#b)"/>
  ${body}
</svg>`;
}

function commandForRecoder(index) {
  return ["ship onboarding", "connect OpenRouter", "open Web IDE", "sync Codex", "review PR"][index] ?? "ship feature";
}

function font(size, weight, color) {
  return `fill="${color}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0"`;
}

function lines(text, maxWidth, size, xOffset) {
  const approx = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
  const words = String(text).split(/\s+/u);
  const out = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > approx && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out.map((value, i) => `<tspan x="${xOffset || 0}" dy="${i === 0 ? 0 : size * 1.13}">${escapeXml(value)}</tspan>`).join("");
}

function renderSourceFrame(project) {
  const { palette } = project;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <radialGradient id="glowA" cx="72%" cy="18%" r="56%">
      <stop offset="0" stop-color="${palette.accent}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${palette.bg}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="18%" cy="84%" r="64%">
      <stop offset="0" stop-color="${palette.accent2}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${palette.bg}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${palette.panel}" stop-opacity="0.96"/>
      <stop offset="1" stop-color="${palette.bg}" stop-opacity="0.72"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000000" flood-opacity="0.36"/>
    </filter>
  </defs>
  <rect width="1080" height="1920" fill="${palette.bg}"/>
  <rect width="1080" height="1920" fill="url(#glowA)"/>
  <rect width="1080" height="1920" fill="url(#glowB)"/>
  <g opacity="0.26" stroke="${palette.muted}" stroke-width="1">
    ${Array.from({ length: 18 }, (_, i) => `<line x1="${80 + i * 56}" y1="0" x2="${80 + i * 56}" y2="1920"/>`).join("")}
    ${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="${120 + i * 72}" x2="1080" y2="${120 + i * 72}"/>`).join("")}
  </g>
  <g filter="url(#softShadow)">
    <rect x="72" y="190" width="936" height="1260" rx="28" fill="url(#panel)" stroke="${palette.accent}" stroke-opacity="0.32"/>
    <rect x="112" y="240" width="856" height="72" rx="18" fill="#ffffff" fill-opacity="0.07"/>
    <circle cx="148" cy="276" r="9" fill="${palette.accent}"/>
    <circle cx="180" cy="276" r="9" fill="${palette.muted}"/>
    <circle cx="212" cy="276" r="9" fill="${palette.accent2}"/>
    <text x="112" y="426" fill="${palette.accent}" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="0">${escapeXml(project.domain)}</text>
    <text x="112" y="555" fill="${palette.ink}" font-family="Inter, Arial, sans-serif" font-size="106" font-weight="800" letter-spacing="0">${escapeXml(project.name)}</text>
    <text x="116" y="640" fill="${palette.muted}" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="0">${escapeXml(project.label)}</text>
    <path d="M116 740 C260 670, 344 820, 500 752 S760 716, 924 628" fill="none" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round"/>
    <path d="M118 900 C258 830, 356 974, 508 904 S742 872, 924 806" fill="none" stroke="${palette.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.78"/>
    <g fill="${palette.accent}">
      <circle cx="260" cy="678" r="14"/>
      <circle cx="500" cy="752" r="14"/>
      <circle cx="760" cy="716" r="14"/>
      <circle cx="924" cy="628" r="14"/>
    </g>
    <rect x="112" y="1048" width="856" height="2" fill="${palette.ink}" fill-opacity="0.12"/>
    <text x="112" y="1150" fill="${palette.ink}" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="800" letter-spacing="0">${escapeXml(project.hook)}</text>
    <text x="112" y="1256" fill="${palette.muted}" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="500" letter-spacing="0">${escapeXml(project.proof)}</text>
    <rect x="112" y="1325" width="540" height="68" rx="18" fill="${palette.accent}" fill-opacity="0.16" stroke="${palette.accent}" stroke-opacity="0.52"/>
    <text x="140" y="1370" fill="${palette.ink}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="0">${escapeXml(project.cta)}</text>
  </g>
  <text x="72" y="1588" fill="${palette.muted}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600" letter-spacing="0">SocialOps Twitter video source frame</text>
  <text x="72" y="1642" fill="${palette.ink}" fill-opacity="0.78" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="500" letter-spacing="0">Built from real product positioning. No generated fake UI.</text>
</svg>`;
}

async function readResponseJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function loadDotEnv(path) {
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/gu, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function signKlingJwt(accessKey, secretKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }));
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secretKey).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(input) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function csv(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}
