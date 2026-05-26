import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export type ViewportPreset = "landscape_1920" | "linkedin_1080" | "vertical_1080" | "square_1080";

const VIEWPORTS: Record<ViewportPreset, { width: number; height: number }> = {
  landscape_1920: { width: 1920, height: 1080 },
  linkedin_1080: { width: 1080, height: 1350 },
  vertical_1080: { width: 1080, height: 1920 },
  square_1080: { width: 1080, height: 1080 },
};

export type SceneAction =
  | { type: "wait_ms"; ms: number }
  | { type: "wait_for"; selector: string; timeoutMs?: number }
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string; delayMs?: number }
  | { type: "scroll"; y: number };

export type CaptureSceneInput = {
  order: number;
  url: string;
  viewport: ViewportPreset;
  actions?: SceneAction[];
  /** "screenshot" returns a single PNG. "screen_recording" returns an MP4 of `durationMs`. */
  mode: "screenshot" | "screen_recording";
  durationMs?: number;
  /** Wait this long after navigation+actions before capturing. */
  settleMs?: number;
};

export type CaptureRequest = {
  jobId: string;
  scenes: CaptureSceneInput[];
};

export type CaptureSceneResult = {
  order: number;
  url: string;
  mode: "screenshot" | "screen_recording";
  filePath: string;
  width: number;
  height: number;
};

export type CaptureResult = {
  jobId: string;
  captures: CaptureSceneResult[];
};

export type CaptureEngine = {
  capture: (input: CaptureRequest, outputDir: string) => Promise<CaptureResult>;
};

/**
 * Create the production Playwright engine. Chromium is loaded lazily so the
 * worker can boot (and tests can run) without the playwright peer installed.
 */
export function createPlaywrightEngine(): CaptureEngine {
  return {
    async capture(input, outputDir) {
      const playwright = await loadPlaywright();
      const browser = await playwright.chromium.launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox"],
      });
      try {
        const captures: CaptureSceneResult[] = [];
        for (const scene of input.scenes) {
          const captured = await captureScene({
            browser,
            scene,
            outputDir: join(outputDir, input.jobId),
          });
          captures.push(captured);
        }
        return { jobId: input.jobId, captures };
      } finally {
        await browser.close().catch(() => {});
      }
    },
  };
}

type PlaywrightLike = {
  chromium: {
    launch: (options?: { args?: string[] }) => Promise<PlaywrightBrowser>;
  };
};

type PlaywrightBrowser = {
  newContext: (options?: {
    viewport?: { width: number; height: number };
    recordVideo?: { dir: string; size?: { width: number; height: number } };
  }) => Promise<PlaywrightContext>;
  close: () => Promise<void>;
};

type PlaywrightContext = {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
};

type PlaywrightPage = {
  goto: (url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number }) => Promise<void>;
  waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  click: (selector: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  type: (selector: string, text: string, options?: { delay?: number }) => Promise<void>;
  evaluate: (fn: (y: number) => void, arg: number) => Promise<void>;
  screenshot: (options: { path: string; fullPage?: boolean }) => Promise<Buffer>;
  video: () => { path: () => Promise<string> } | null;
  close: () => Promise<void>;
};

async function loadPlaywright(): Promise<PlaywrightLike> {
  try {
    // Module name through a variable so TS does not statically resolve the optional peer dep.
    const moduleId = "playwright";
    const mod = (await import(moduleId)) as unknown as PlaywrightLike;
    return mod;
  } catch (error) {
    throw new Error(
      `playwright is not installed. Run \`pnpm add -F @socialops/video-worker playwright\` and \`pnpm exec playwright install chromium\`. Underlying: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function captureScene(args: {
  browser: PlaywrightBrowser;
  scene: CaptureSceneInput;
  outputDir: string;
}): Promise<CaptureSceneResult> {
  const { browser, scene } = args;
  const viewport = VIEWPORTS[scene.viewport];
  await mkdir(args.outputDir, { recursive: true });

  const wantsRecording = scene.mode === "screen_recording";
  const context = await browser.newContext({
    viewport,
    ...(wantsRecording
      ? {
          recordVideo: {
            dir: args.outputDir,
            size: viewport,
          },
        }
      : {}),
  });
  const page = await context.newPage();
  await page.goto(scene.url, { waitUntil: "networkidle", timeout: 45_000 });

  for (const action of scene.actions ?? []) {
    await runAction(page, action);
  }

  if (scene.settleMs && scene.settleMs > 0) {
    await page.waitForTimeout(scene.settleMs);
  }

  if (wantsRecording) {
    const durationMs = Math.max(2000, Math.min(scene.durationMs ?? 5000, 30_000));
    await page.waitForTimeout(durationMs);
    await page.close();
    const video = page.video();
    const videoPath = video ? await video.path() : "";
    await context.close();
    return {
      order: scene.order,
      url: scene.url,
      mode: "screen_recording",
      filePath: videoPath,
      width: viewport.width,
      height: viewport.height,
    };
  }

  const filePath = join(args.outputDir, `scene-${pad(scene.order)}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  await page.close();
  await context.close();
  return {
    order: scene.order,
    url: scene.url,
    mode: "screenshot",
    filePath,
    width: viewport.width,
    height: viewport.height,
  };
}

async function runAction(page: PlaywrightPage, action: SceneAction): Promise<void> {
  switch (action.type) {
    case "wait_ms":
      await page.waitForTimeout(action.ms);
      return;
    case "wait_for":
      await page.waitForSelector(action.selector, { timeout: action.timeoutMs ?? 15_000 });
      return;
    case "click":
      await page.click(action.selector);
      return;
    case "type":
      await page.type(action.selector, action.text, { delay: action.delayMs ?? 30 });
      return;
    case "scroll":
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), action.y);
      return;
  }
}

function pad(n: number): string {
  return n.toString().padStart(3, "0");
}
