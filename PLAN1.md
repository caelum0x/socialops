Yes. The best local setup is to build a **small AI ad studio** around ComfyUI/WanGP, using real product photos as anchors so the product does not drift or mutate.

The important distinction: **AI product video** is fine when it shows your real product creatively; **AI UGC/testimonial video** must not pretend to be a real customer review unless it is true. The FTC’s final rule bans fake reviews and testimonials and specifically targets AI-generated fake testimonials, so use AI UGC as “scripted spokesperson/demo content,” not fake customer proof. ([Federal Trade Commission][1])

## Recommended local open-source / open-weight stack

| Need                                 | Best local tool choices                                                 | Why                                                                                                                                                                                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main AI video interface              | **ComfyUI** or **WanGP**                                                | ComfyUI is a node/graph interface for complex diffusion workflows without coding, while WanGP wraps many video models with a web UI and low-VRAM options. ([GitHub][2])                                                                                                 |
| Product image-to-video               | **Wan2.2 TI2V 5B**, **Wan2.2 I2V**, **HunyuanVideo-1.5**, **LTX-Video** | Wan2.2 supports text-to-video and image-to-video; the 5B version is the best starter for local product animation. ([GitHub][3])                                                                                                                                         |
| Fast experiments                     | **LTX-Video**                                                           | LTX-Video is built for high-speed video generation and its model card says it can produce 30 FPS video at 1216×704 faster than playback. ([Hugging Face][4])                                                                                                            |
| Higher-quality cinematic clips       | **HunyuanVideo-1.5**                                                    | HunyuanVideo-1.5 is an 8.3B video model for text-to-video and image-to-video and supports consumer-GPU workflows, with ComfyUI and Diffusers integration. ([Hugging Face][5])                                                                                           |
| Low-VRAM video generation            | **WanGP**                                                               | WanGP supports Wan 2.1/2.2, Hunyuan, LTX, Flux, and other models, with low-VRAM modes and AMD/NVIDIA support. ([GitHub][6])                                                                                                                                             |
| Product cutouts                      | **rembg**                                                               | rembg is an MIT-licensed local background-removal tool usable as CLI, Python library, server, or Docker container. ([GitHub][7])                                                                                                                                        |
| Product consistency / brand LoRAs    | **kohya_ss**                                                            | kohya_ss provides a GUI for LoRA, DreamBooth, fine-tuning, and SDXL training workflows. ([GitHub][8])                                                                                                                                                                   |
| AI spokesperson / UGC face animation | **MuseTalk**, **LivePortrait**                                          | MuseTalk is a real-time lip-sync model; LivePortrait is an official portrait-animation implementation. ([GitHub][9])                                                                                                                                                    |
| Voice generation                     | **OpenVoice**, **Piper**, with caution on **F5-TTS**                    | OpenVoice is MIT-licensed and free for commercial/research use; Piper is a fast local TTS system under MIT; F5-TTS code is MIT but its pretrained models are CC-BY-NC, so do not use those pretrained F5 voices commercially without checking licensing. ([GitHub][10]) |
| Captions / subtitles                 | **Whisper / WhisperX**                                                  | Whisper code and weights are MIT-licensed; WhisperX adds alignment features useful for word-level captions. ([GitHub][11])                                                                                                                                              |
| Editing/export                       | **Kdenlive**, **FFmpeg**, **RIFE**                                      | Kdenlive is a free open-source editor; FFmpeg handles conversion/export; RIFE is useful for frame interpolation and smoothing diffusion-generated clips. ([Kdenlive][12])                                                                                               |
| 3D product shots                     | **Blender**                                                             | Blender is a free and open-source 3D creation suite, useful if you can model or scan the product for perfect turntables and camera moves. ([Blender][13])                                                                                                               |

## Hardware recommendation

For serious local AI video, use an **NVIDIA GPU** if possible. AMD can work through some stacks, but NVIDIA CUDA is still the easiest path.

A practical tiering:

| Machine            | What you can do                                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8–12 GB VRAM**   | Basic Wan2.2 5B / low-res / short clips through ComfyUI offloading or WanGP. ComfyUI’s Wan2.2 guide says the 5B version should fit on 8 GB VRAM with native offloading, but expect slower generation. ([docs.comfy.org][14]) |
| **16 GB VRAM**     | Better 480p/short vertical ads, image-to-video, faster iteration.                                                                                                                                                            |
| **24 GB VRAM**     | Ideal starting point for a local ad studio. Wan2.2’s own repo says the TI2V-5B command can run on a 24 GB GPU such as an RTX 4090. ([GitHub][3])                                                                             |
| **48–80 GB+ VRAM** | Higher-res, longer clips, larger 14B models, less offloading. Wan2.2’s official 14B text-to-video example notes at least 80 GB VRAM for that command. ([GitHub][3])                                                          |

## Workflow 1: AI product video, no human

This is the safest and most reliable workflow for your products.

1. **Shoot real product assets**
   Take 10–30 photos: front, side, back, packaging, close-up texture, product in hand, product on a clean surface, product in real use.

2. **Clean the product cutout**
   Use `rembg` to remove backgrounds. Keep transparent PNGs. ([GitHub][7])

3. **Create 3–5 hero stills**
   Use ComfyUI with SDXL/Stability models, Krita, or Blender. For product accuracy, do not ask the model to invent the product from text. Use image-to-image, inpainting, and the real product cutout.

4. **Animate with image-to-video**
   Use Wan2.2 TI2V/I2V, HunyuanVideo-1.5 I2V, or LTX-Video. Start with 5–8 second clips. For ads, generate many short clips instead of one long clip.

5. **Post-process**
   Smooth with RIFE, upscale if needed, then assemble in Kdenlive. Use FFmpeg for final exports. ([GitHub][15])

6. **Add text, price, logo, CTA in the editor**
   Do not ask the video model to render readable packaging text, prices, discount codes, or disclaimers. AI video models still distort text, so add all readable text in Kdenlive or another editor.

Example prompt for product image-to-video:

> Vertical 9:16 handheld product ad, real product remains unchanged, close-up macro shot, soft natural window light, slow push-in camera movement, shallow depth of field, clean modern kitchen counter, premium e-commerce aesthetic, subtle steam in background, realistic reflections, no extra text, no logo distortion, no extra products, no deformed packaging.

## Workflow 2: AI UGC-style product video

This makes “creator-style” ads without hiring a creator every time, but you should frame it as **scripted AI spokesperson content**, not fake customer testimony.

1. **Write a 20–35 second UGC script**
   Structure: hook → problem → product demo → benefit → CTA.

2. **Generate or record voice**
   Use OpenVoice if you have a voice you own or have explicit permission to clone; use Piper for simpler local TTS. OpenVoice’s repo says V1 and V2 are MIT-licensed and free for commercial/research use. ([GitHub][10])

3. **Create the spokesperson video**
   Use one of these routes:

   * Real filmed person with consent → MuseTalk lip-sync.
   * Static portrait with consent → LivePortrait motion + MuseTalk lip-sync.
   * No human face → voiceover with product b-roll, usually safer and more believable.

4. **Overlay real product b-roll**
   Cut between the talking head and real/AI product shots. The product should appear often; otherwise the ad feels fake.

5. **Add captions**
   Use Whisper/WhisperX, then style captions in Kdenlive. Whisper’s code and model weights are MIT-licensed. ([GitHub][11])

Example UGC script:

> “I didn’t expect this to be the thing that fixed my [problem]. I’ve been using [product] for [use case], and the part I like most is [benefit]. Here’s how it works: [quick demo]. It feels [emotional benefit], and it saves me [time/money/effort]. If you’re dealing with [problem], this is worth checking out.”

For compliance, replace “I’ve been using” with “Here’s how it works” unless the speaker is a real user.

## Workflow 3: Product video with perfect consistency

For products with complex logos, labels, bottles, boxes, watches, shoes, cosmetics, or electronics, pure AI video may mutate details. Use this stronger workflow:

1. Build a **product LoRA** from 20–50 real product images using kohya_ss.
2. Generate still images with the product locked in.
3. Animate only the background/camera motion with image-to-video.
4. Add final label/logo as a tracked overlay if needed.
5. For premium products, make a simple 3D model in Blender and use AI only for backgrounds, lighting concepts, and b-roll mood. Blender is free and open source. ([GitHub][8])

## The stack I would start with

For a practical local setup, start with this:

**Core**

* ComfyUI
* WanGP
* Wan2.2 TI2V 5B
* HunyuanVideo-1.5
* LTX-Video
* rembg
* Kdenlive
* FFmpeg
* Whisper
* RIFE

**For UGC**

* OpenVoice or Piper for voice
* MuseTalk for lip-sync
* LivePortrait for portrait movement

**For product consistency**

* kohya_ss for LoRA training
* Blender for 3D product shots
* Krita for cleanup/inpainting support

## Licensing notes for commercial product ads

Wan2.2 is one of the cleaner choices because its repo says the models are Apache 2.0 and that the project claims no rights over generated content. ([GitHub][3]) MuseTalk is also commercially friendly according to its repo: code MIT and trained model available for any purpose, including commercial use. ([GitHub][9])

Be careful with models that are “open weights” but not commercially open. FLUX `[dev]`, for example, grants use of the model only for non-commercial purposes unless you obtain a commercial license, even though outputs have separate terms. ([Black Forest Labs][16]) F5-TTS is similar: the code is MIT, but its pretrained models are CC-BY-NC, so use OpenVoice/Piper or properly licensed voices for product ads. ([GitHub][17])

## First production plan

Start with **10 short videos**, not one big polished video:

| Batch    | Format                           | Goal                                           |
| -------- | -------------------------------- | ---------------------------------------------- |
| 3 videos | Product-only vertical b-roll     | Hero shots, close-ups, use-case visuals        |
| 3 videos | AI voiceover + product b-roll    | Fast UGC-style ads without synthetic face risk |
| 2 videos | AI spokesperson + product b-roll | Test talking-head conversion                   |
| 2 videos | Before/after or problem/solution | Best for TikTok/Reels/Shorts hooks             |

Use this ad formula:

> **0–2 sec:** strong visual hook
> **2–6 sec:** problem
> **6–15 sec:** product demo
> **15–25 sec:** benefit/proof
> **25–35 sec:** CTA

A good first local benchmark is: can you produce **five 9:16 videos under 35 seconds** using real product photos, AI-generated b-roll, local voice, captions, and Kdenlive editing. Once that works, train product LoRAs and automate prompt batches.

Share your GPU, operating system, and product category, and I’ll give you the exact install order and first 10 prompts for your products.

[1]: https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials?utm_source=chatgpt.com "Federal Trade Commission Announces Final Rule Banning ..."
[2]: https://github.com/Comfy-Org/ComfyUI "GitHub - Comfy-Org/ComfyUI: The most powerful and modular diffusion model GUI, api and backend with a graph/nodes interface. · GitHub"
[3]: https://github.com/Wan-Video/Wan2.2 "GitHub - Wan-Video/Wan2.2: Wan: Open and Advanced Large-Scale Video Generative Models · GitHub"
[4]: https://huggingface.co/Lightricks/LTX-Video "Lightricks/LTX-Video · Hugging Face"
[5]: https://huggingface.co/tencent/HunyuanVideo-1.5 "tencent/HunyuanVideo-1.5 · Hugging Face"
[6]: https://github.com/deepbeepmeep/Wan2GP "GitHub - deepbeepmeep/Wan2GP: A fast AI Video Generator for the GPU Poor. Supports Wan 2.1/2.2, Qwen Image, Hunyuan Video, LTX  Video and Flux. · GitHub"
[7]: https://github.com/danielgatis/rembg "GitHub - danielgatis/rembg: Rembg is a tool to remove images background · GitHub"
[8]: https://github.com/bmaltais/kohya_ss "GitHub - bmaltais/kohya_ss · GitHub"
[9]: https://github.com/TMElyralab/MuseTalk "GitHub - TMElyralab/MuseTalk: MuseTalk: Real-Time High Quality Lip Synchorization with Latent Space Inpainting · GitHub"
[10]: https://github.com/myshell-ai/OpenVoice "GitHub - myshell-ai/OpenVoice: Instant voice cloning by MIT and MyShell. Audio foundation model. · GitHub"
[11]: https://github.com/openai/whisper "GitHub - openai/whisper: Robust Speech Recognition via Large-Scale Weak Supervision · GitHub"
[12]: https://kdenlive.org/ "Kdenlive - Free and Open Source Video Editor"
[13]: https://www.blender.org/?utm_source=chatgpt.com "Blender - The Free and Open Source 3D Creation Software ..."
[14]: https://docs.comfy.org/tutorials/video/wan/wan2_2 "Wan2.2 Video Generation ComfyUI Official Native Workflow Example - ComfyUI"
[15]: https://github.com/hzwer/ECCV2022-RIFE "GitHub - hzwer/ECCV2022-RIFE: ECCV2022 - Real-Time Intermediate Flow Estimation for Video Frame Interpolation · GitHub"
[16]: https://bfl.ai/legal/non-commercial-license-terms "FLUX [dev] Non-Commercial License v2.0 | Black Forest Labs"
[17]: https://github.com/swivid/f5-tts "GitHub - SWivid/F5-TTS: Official code for \"F5-TTS: A Fairytaler that Fakes Fluent and Faithful Speech with Flow Matching\" · GitHub"
