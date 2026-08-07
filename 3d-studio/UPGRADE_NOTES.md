# Enhanced build notes

## Rendering

- Shared dependency-free WebGL2 renderer across World Builder, Scene Animator, Sculpt Materials, Relief Sculptor, Viewer, and Equation Lab.
- Real depth buffer, per-pixel lighting, specular/rim response, UV textures, displacement support, subtle world grid, and clean selection silhouette.
- World Builder starts with wireframe disabled for a cleaner shaded preview; wireframe remains available as a toggle.
- Render/environment controls are saved with the world/animation project.

## World Builder / sculpt workflow

- Click empty viewport space to deselect.
- Transform ranges are substantially larger (position, multi-turn rotation, and scale).
- Relief Sculptor can **Send to World** without leaving the sculptor, or **Send + open World**.
- When World Builder is already open, queued assets can arrive through the browser storage event.
- An object sent from World Builder to Sculpt Materials carries its World object ID; sending it back replaces that object instead of duplicating it.

## Animation

- Duration up to 300 seconds.
- Object procedural motion supports X/Y/Z/XYZ where applicable.
- World turntable supports X/Y/Z/XYZ.
- Camera includes a 3D orbit preset.
- Rotation/keyframe ranges support multiple full turns.

## Export

- MP4/H.264, WebM, and GIF.
- Video width up to 3840 px while preserving viewport aspect ratio.
- Configurable bitrate: 6, 12, 20, or 35 Mbps.
- MP4 first tries frame-driven H.264 WebCodecs + the local MP4 muxer; if unavailable it falls back to native MP4 MediaRecorder support.
- Export contains video only (no audio track).

## Validation performed

- JavaScript syntax checks on all external and inline scripts.
- HTML ID/reference validation on every tool page.
- Real Chromium WebGL2 shader/context rendering checks.
- Runtime startup checks for World Builder, Scene Animator, Sculpt Materials, Relief Sculptor, Viewer, and Equation Lab.
- Real empty-space deselection interaction test in World Builder.
- Real Chromium native H.264/MP4 MediaRecorder smoke test.

## Video quality / framing fix
- Scene Animator export defaults to 1920 px instead of 640 px.
- Added fixed export aspect ratios (16:9 default, 21:9, 4:3, 1:1, 9:16, Match preview).
- The Scene Animator preview is letterboxed to the chosen export aspect, so framing matches the video.
- Added 1x / 1.5x / 2x supersampled video rendering with high-quality downsampling.
- H.264/WebCodecs now prefers quality latency mode and no-preference hardware acceleration; realtime is only a fallback.
- Default video bitrate increased to 35 Mbps; 60 Mbps option added.
- MP4/WebM video renderer uses the same WebGL scene settings and camera framing as the preview.
