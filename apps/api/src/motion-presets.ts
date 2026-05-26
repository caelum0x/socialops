export type MotionPresetKey =
  | "static_locked"
  | "slow_push_in"
  | "crash_zoom"
  | "dolly_in"
  | "dolly_out"
  | "slow_orbit"
  | "robo_arm_reveal"
  | "whip_pan"
  | "vortex_pull"
  | "parallax_pan"
  | "fpv_dive"
  | "macro_glide";

export type MotionPresetProviderKey =
  | "comfyui_wan_i2v"
  | "comfyui_ltx"
  | "runway_gen3"
  | "luma_dream"
  | "pika"
  | "higgsfield"
  | "kling_ai"
  | "hailuo_minimax"
  | "replicate"
  | "huggingface_space"
  | "fal_ai"
  | "manual";

export type MotionPreset = {
  key: MotionPresetKey;
  label: string;
  /** Short prompt suffix appended to the user's image prompt for ComfyUI providers. */
  promptSuffix: string;
  /** Mapping from provider → provider-specific param payload. */
  providerParams: Partial<Record<MotionPresetProviderKey, Record<string, unknown>>>;
  /** Default clip length in seconds. */
  defaultDurationSeconds: number;
  /** Use cases where this motion shines, for UI hints. */
  goodFor: string[];
};

export const motionPresets: MotionPreset[] = [
  {
    key: "static_locked",
    label: "Static locked",
    promptSuffix: "locked-off camera, no movement, product perfectly centered, gentle ambient micro-motion only",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "static", motion_strength: 0.05 },
      runway_gen3: { camera_motion: "static" },
      luma_dream: { loop: false },
      higgsfield: { motion: "static" },
      kling_ai: { camera_control: "static" },
      hailuo_minimax: { motion: "static" },
      replicate: { motion_strength: 0.05 },
    },
    defaultDurationSeconds: 4,
    goodFor: ["product hero shot", "thumbnail", "LinkedIn pro update"],
  },
  {
    key: "slow_push_in",
    label: "Slow push-in",
    promptSuffix: "slow cinematic push-in, gentle dolly forward, premium e-commerce aesthetic",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "push_in", motion_strength: 0.35 },
      runway_gen3: { camera_motion: "zoom_in", motion_amount: 0.4 },
      luma_dream: { camera: "Push In" },
      higgsfield: { motion: "push_in_slow" },
    },
    defaultDurationSeconds: 5,
    goodFor: ["product reveal", "founder update intro"],
  },
  {
    key: "crash_zoom",
    label: "Crash zoom",
    promptSuffix: "fast crash zoom into product center, motion blur, kinetic energy, vlog style",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "crash_zoom", motion_strength: 0.85 },
      runway_gen3: { camera_motion: "zoom_in", motion_amount: 0.95 },
      pika: { motion: 4 },
      higgsfield: { motion: "crash_zoom" },
    },
    defaultDurationSeconds: 3,
    goodFor: ["TikTok hook", "reveal punchline"],
  },
  {
    key: "dolly_in",
    label: "Dolly in",
    promptSuffix: "smooth dolly in along the optical axis, gimbal stabilized, cinematic depth",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "dolly_in", motion_strength: 0.5 },
      runway_gen3: { camera_motion: "dolly_in" },
      luma_dream: { camera: "Dolly In" },
      higgsfield: { motion: "dolly_in" },
    },
    defaultDurationSeconds: 5,
    goodFor: ["product hero", "launch video"],
  },
  {
    key: "dolly_out",
    label: "Dolly out",
    promptSuffix: "slow pull-back dolly revealing the environment, cinematic wide reveal",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "dolly_out", motion_strength: 0.5 },
      runway_gen3: { camera_motion: "dolly_out" },
      luma_dream: { camera: "Dolly Out" },
      higgsfield: { motion: "dolly_out" },
    },
    defaultDurationSeconds: 5,
    goodFor: ["scene establish", "CTA card lead-in"],
  },
  {
    key: "slow_orbit",
    label: "Slow orbit",
    promptSuffix: "slow horizontal orbit around the product, parallax background, cinematic turntable",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "orbit_left", motion_strength: 0.4 },
      runway_gen3: { camera_motion: "orbit" },
      luma_dream: { camera: "Orbit Left" },
      higgsfield: { motion: "orbit_slow" },
    },
    defaultDurationSeconds: 6,
    goodFor: ["product turntable", "feature showcase"],
  },
  {
    key: "robo_arm_reveal",
    label: "Robo-arm reveal",
    promptSuffix: "complex robotic arm camera move, sweeping arc reveal, premium commercial cinematography",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "arc_reveal", motion_strength: 0.75 },
      runway_gen3: { camera_motion: "arc" },
      higgsfield: { motion: "robo_arm" },
    },
    defaultDurationSeconds: 6,
    goodFor: ["launch hero shot", "pitch video opener"],
  },
  {
    key: "whip_pan",
    label: "Whip pan",
    promptSuffix: "fast whip pan with motion blur, transition style, kinetic vlog energy",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "whip_pan_right", motion_strength: 0.9 },
      runway_gen3: { camera_motion: "pan_right", motion_amount: 0.95 },
      pika: { motion: 4 },
      higgsfield: { motion: "whip_pan" },
    },
    defaultDurationSeconds: 2,
    goodFor: ["scene transition", "before/after reveal"],
  },
  {
    key: "vortex_pull",
    label: "Vortex pull",
    promptSuffix: "vortex-style camera pull with subtle rotation, hypnotic motion, premium ad aesthetic",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "vortex", motion_strength: 0.7 },
      runway_gen3: { camera_motion: "zoom_in", motion_amount: 0.75 },
      higgsfield: { motion: "vortex" },
    },
    defaultDurationSeconds: 4,
    goodFor: ["dreamy hero shot", "trend reel hook"],
  },
  {
    key: "parallax_pan",
    label: "Parallax pan",
    promptSuffix: "horizontal parallax pan with multi-layer depth separation, magazine-style still-to-motion",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "pan_right", motion_strength: 0.3 },
      runway_gen3: { camera_motion: "pan_right", motion_amount: 0.4 },
      luma_dream: { camera: "Pan Right" },
      higgsfield: { motion: "parallax_pan" },
    },
    defaultDurationSeconds: 5,
    goodFor: ["carousel slide as video", "context establishing"],
  },
  {
    key: "fpv_dive",
    label: "FPV dive",
    promptSuffix: "first-person-view drone dive through the scene, kinetic depth, ad-grade energy",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "fpv_dive", motion_strength: 0.95 },
      runway_gen3: { camera_motion: "zoom_in", motion_amount: 0.9 },
      higgsfield: { motion: "fpv_dive" },
    },
    defaultDurationSeconds: 4,
    goodFor: ["launch trailer", "demo opener"],
  },
  {
    key: "macro_glide",
    label: "Macro glide",
    promptSuffix: "slow macro glide across product surface, shallow depth of field, tactile detail",
    providerParams: {
      comfyui_wan_i2v: { camera_motion: "macro_glide", motion_strength: 0.35 },
      runway_gen3: { camera_motion: "pan_left", motion_amount: 0.3 },
      higgsfield: { motion: "macro_glide" },
    },
    defaultDurationSeconds: 5,
    goodFor: ["product texture detail", "premium e-commerce ad"],
  },
];

const byKey = new Map(motionPresets.map((preset) => [preset.key, preset]));

export function getMotionPreset(key: string): MotionPreset | undefined {
  return byKey.get(key as MotionPresetKey);
}

export function listMotionPresets(): readonly MotionPreset[] {
  return motionPresets;
}

export function motionPresetExists(key: string): boolean {
  return byKey.has(key as MotionPresetKey);
}
