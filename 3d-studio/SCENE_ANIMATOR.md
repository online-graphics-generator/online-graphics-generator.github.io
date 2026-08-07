# Scene Animator - quick guide

## Start

Run the project through a local server:

```bash
cd 3d-studio-enhanced
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html` and choose **Scene Animator**. From **World Builder**, you can press **Animate scene** to send the current world directly.

## Object Animation

1. Select an object from the list or directly in the viewport.
2. Move the timeline to the desired time.
3. Change Position, Rotation, or Scale. With **Auto-key** enabled, a keyframe is created automatically.
   Use the numeric boxes beside sliders when you need exact values.
4. Use **+ Object key** to add an explicit keyframe.
5. Optionally add one or more procedural motions: Straight line, Spin, Tumble, Orbit, Bob, Pulse, or Swing. Compatible motions can use the X, Y, Z, or XYZ axis.
   Use **+ Motion** to stack effects, such as orbit plus rotation or multiple rotations on different axes.
6. Press Space or the Play button to preview.

In the viewport:

- Empty click: deselect the object.
- Drag: rotate the camera.
- Shift + drag: move the selected object on X/Y.
- Scroll: zoom.
- Left/right arrows: move one frame backward/forward.
- K: add an object keyframe.

## Camera And World Animation

- Position the camera and press **+ Camera key** at multiple times.
- **Animated camera** can automatically add Orbit, Orbit 3D, Dolly, or Float motion.
- **World motion** applies Turntable on X/Y/Z/XYZ, Breathe, Wave, or Explode to all objects.
- Scene duration can reach 3600 s, and rotations can span multiple full turns.

## Export

- **Video MP4 / H.264**: first tries the WebCodecs encoder, which can process frames directly, then falls back automatically to MP4 through MediaRecorder if the browser provides it.
- **Video WebM**: a broadly compatible video fallback for modern browsers.
- **GIF**: useful for short loops; it is limited to 640 px width and 300 frames to control memory use.
- **Resolution / bitrate**: choose width up to 3840 px, animation FPS, and video bitrate between 6 and 35 Mbps.
- **Placement mesh**: toggle the floor guide/default ground tile in the preview; the export uses the same setting.
- **Animation project**: saves the world, materials, render settings, keyframes, camera, and procedural motion in a re-editable JSON file.

## STL And Texture

Standard STL does not contain UVs, images, or materials. That is why there are three options:

- **STL print mesh** - standard geometry without color.
- **STL texture relief** - texture brightness is converted into real geometry displacement. It is portable and useful for 3D printing, but color becomes tactile relief.
- **Color STL experimental** - writes one color per triangle through the VisCAM/SolidView extension. Some applications display it, while many ignore it.

For real texture data, use **glTF** or **OBJ package** (`.obj` + `.mtl` + `.png`).
