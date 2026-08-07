# 3D Studio — Sculpt, Materials, Reliefs, and Worlds

This version connects the Viewer, Relief Sculptor, Equation Lab, Sculpt Materials workspace, and World Builder into one reusable asset pipeline. Generated meshes can be transferred between tools, sculpted, painted with layered materials, combined into scenes, and exported into formats used outside the project.

## Run the project

Use a local server so browser storage and page-to-page transfers behave consistently.

```bash
cd 3d-studio-enhanced
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html`.

## Recommended workflow

1. Create a parametric surface in **Equation Lab**, a heightmap in **Relief Sculptor**, or a primitive/fractal in the Viewer or World Builder.
2. Send the asset to **Sculpt Materials** when it needs direct mesh editing or a more expressive material.
3. Sculpt with Inflate, Deflate, Smooth, Flatten, Pinch, or Noise. X/Y/Z symmetry can mirror every brush stroke.
4. Build the material from paint, imported images, and procedural layers.
5. Use blend modes, opacity, soft brushes, and artistic finishing layers to integrate the texture instead of placing one flat image over the object.
6. Optionally use **Bake texture as relief** to convert material brightness into real mesh displacement along surface normals.
7. Choose **Add to World** to combine the result with other objects, or export it for another program.
8. Open **Scene Animator** from World Builder when the world is ready to move. Add object/camera keyframes or procedural motion, then export MP4, WebM, GIF, or an editable animation project.

## Sculpt Materials

`materials.html` is a dense-mesh sculpting and material-authoring workspace.

### Base geometry

The tool includes UV-mapped sphere, cube, torus, and plane meshes. It also accepts `studio3d-asset-v1` JSON and legacy rectangular-grid JSON. Objects selected in World Builder can be opened through **Sculpt / materials**.

### Sculpt brushes

- **Inflate / Deflate** move vertices along their averaged surface normals.
- **Smooth** relaxes vertices toward their connected neighbours.
- **Flatten** moves the brush area toward the picked surface plane.
- **Pinch** pulls nearby vertices together tangentially.
- **Noise** adds irregular surface breakup.
- **X/Y/Z symmetry** mirrors a stroke across one or more local axes.
- **Undo / Redo** stores bounded vertex snapshots for brush strokes and whole-mesh operations.

Whole-mesh operations include Organic, Crystal, Erode, and Smooth All. These are intended as starting points for complex forms rather than destructive final filters.

### Layered materials

A material is composed from independent 512 × 512 layers. Every layer has:

- visibility;
- opacity;
- a blend mode;
- an editable name;
- its own pixels.

Supported blend modes are Normal, Multiply, Screen, Overlay, Soft Light, and Add. Paint layers can be brushed in the square editor or directly on the visible 3D object through its UV coordinates. Hold **Alt** or use the right mouse button to erase.

Procedural layers include Marble, Clouds, Patina, Speckle, Growth Rings, Woven Fibers, Stone Tiles, Cellular, Topographic, Cracked Paint, and Brushed Metal. Scale, detail, contrast, and two source colours can be adjusted before adding the layer. Imported images become new editable layers rather than replacing the whole material.

### Artistic texture integration

The texture system improves visual blending in several ways:

- soft radial brush falloff avoids hard sticker-like edges;
- opacity allows gradual glazing and colour buildup;
- Multiply and Overlay preserve underlying tonal variation;
- Soft Light integrates procedural detail without completely replacing painted colour;
- procedural layers add coherent variation across the complete UV surface;
- Watercolor, Grain, Glaze, and Posterize are added as separate effect layers, so they remain reorderable and removable;
- the final layer stack is flattened only when sent to World Builder or exported to a standard interchange format.

For a natural material, start with an opaque base colour, add a low-opacity procedural layer in Soft Light or Overlay, paint larger colour regions on a separate layer, and finish with a subtle Grain or Glaze layer.

### Texture to geometry

**Bake texture as relief** samples the final composite texture through every vertex UV. Brightness above the neutral level moves outward; brightness below it moves inward. The displacement follows the mesh normals, so the same height design can wrap around a sphere, torus, cube, plane, or another UV-mapped asset.

This operation changes real geometry and can be undone. Use small values first; repeated baking accumulates displacement.

## World Builder

World Builder combines generated surfaces, reliefs, sculpted assets, and primitives in one scene. The viewport now uses the same WebGL2 renderer as the other 3D tools, with a real depth buffer, per-pixel lighting, specular/rim response, UV textures, displacement, grid rendering, and selection outlines.

- Add multiple objects and edit position, rotation, and scale over much larger ranges.
- Use **Free cam** for viewport movement: `W/A/S/D` moves the camera target, `R/F` moves up/down, Shift increases movement speed, and Ctrl/right-drag pans.
- Toggle **Placement mesh** to show or hide the floor guide/default ground tile without deleting the scene object.
- Type precise values in the numeric boxes beside sliders when exact transforms, lighting, or material values matter.
- Paint directly over UV-mapped objects.
- Generate procedural painted textures from selectable patterns with scale, detail, contrast, and object colour controls.
- Apply a texture or relief map to a sphere or another mesh.
- Click empty viewport space to deselect the current object.
- Select **Sculpt / materials** to send one object into the dedicated sculpting workspace; sending it back replaces that same World object instead of creating a duplicate.
- **Relief Sculptor -> Send to World** can transfer an asset directly while World Builder remains open in another tab; **Send + open World** transfers and navigates immediately.
- Tune scene background, exposure, ambient/key light, light direction, rim light, and grid visibility.
- Export and import complete `studio3d-world-v1` scene files, including render settings.
- The current scene is auto-saved in browser storage.

When a Sculpt Materials asset is returned to World Builder, its composite material is embedded in asset metadata and applied automatically.

## Scene Animator

`scene.html` is a dependency-free animation workspace for complete Studio worlds.

### Animation methods

- **Transform keyframes** animate object position, rotation, and scale. The timeline interpolates between keys using Linear, Smooth, Ease in/out, or Hold modes.
- **Camera keyframes** store pitch, yaw, distance, and the full camera target, allowing authored camera moves around the whole world.
- **Procedural object motion** supports stacked Straight line, Spin, Tumble, Orbit, Bob, Pulse, and Swing effects without building every keyframe manually. Add multiple motions to combine orbit plus rotation, layered rotations, or linear travel on X/Y/Z/XYZ.
- **World motion** can rotate the complete composition around X, Y, Z, or XYZ, make all parts breathe, create an indexed wave, or expand/contract objects away from the world origin.
- **Automatic camera motion** provides world orbit, 3D orbit, dolly, and floating observation modes.
- **Direct manipulation** supports click selection, drag-to-orbit, Shift-drag object movement, wheel zoom, Space playback, arrow-key frame stepping, and `K` to add an object keyframe.
- **Free cam** in Scene Animator uses the same `W/A/S/D` and `R/F` camera-target movement as World Builder, and camera keyframes store those offsets.
- **Placement mesh** can be toggled in the preview and is respected by video/GIF export.

Animation duration supports up to 3600 seconds, rotation keyframes can span multiple full turns, and the preview uses the same WebGL2 lighting/material pipeline as World Builder. The current animation is auto-saved in browser storage. **Project animation** exports `studio3d-animation-v1` JSON containing the complete world, materials, render settings, object tracks, camera tracks, and procedural settings.

### MP4, WebM, and GIF export

- **MP4 / H.264** first uses `VideoEncoder` when the browser exposes WebCodecs. That path renders frames directly into the encoder and packages the AVC stream into an MP4 container in vanilla JavaScript, so it is not tied to realtime playback. If WebCodecs H.264 is unavailable, the exporter automatically falls back to native MP4 `MediaRecorder` when the browser exposes it.
- **WebM** uses the browser's native `canvas.captureStream()` and `MediaRecorder` as a broadly supported video fallback.
- **GIF** is encoded locally in vanilla JavaScript. GIF export is intentionally capped at 640 px wide and 300 frames to control memory usage.
- Video export is configurable: output width (up to 3840 px while preserving the stage aspect ratio), animation FPS, and target bitrate (6–35 Mbps). Texture images and displacement maps are preloaded before rendering export frames.

Video export support still depends on browser codecs. The project has no npm/build requirement and does not ship a WASM video encoder; it uses built-in browser H.264/MediaRecorder capabilities plus the local MP4 muxer.

## Equation Lab guide

Equation Lab creates a **parametric surface**. It samples two parameters, `u` and `v`, from `0` to `1`. Every `(u, v)` pair is converted into one 3D point by three expressions:

```text
x = x(u, v)
y = y(u, v)
z = z(u, v)
```

Example wave surface:

```text
x = (u-0.5)*2
y = sin(a*PI*(u*2-1))*cos(b*PI*(v*2-1))*c
z = (v-0.5)*2
```

Here `u` and `v` move across the surface, while `a`, `b`, `c`, and `d` are live slider-controlled parameters. A full circular turn is normally written as `2*PI*u` or `2*PI*v`.

Resolution controls sampling density. Resolution `26` creates `(26 + 1)² = 729` vertices and `2 × 26² = 1,352` triangles. Work at a lower resolution while experimenting and increase it before sculpting or exporting.

Expressions are restricted to the documented variables, numeric values, operators, commas, parentheses, and these functions: `sin`, `cos`, `tan`, `sqrt`, `abs`, `pow`, `exp`, `log`, `atan2`, `floor`, `ceil`, `round`, `min`, `max`, and `sign`.

## External extraction formats

Sculpt Materials provides several ways for an object to “live” outside this program:

| Export | Preserves | Best use |
|---|---|---|
| Embedded `.gltf` | Mesh, normals, UVs, and texture in one file | Web engines, DCC tools, interchange |
| OBJ package | Mesh, UVs, normals, MTL, and PNG as three files | Broad compatibility and manual editing |
| ASCII STL | Triangle geometry only | 3D printing and fabrication |
| Texture-relief STL | Texture brightness converted to real displaced geometry | Printable tactile texture without UV support |
| Experimental Color STL | Per-triangle 15-bit VisCAM colour extension | Viewers/printers that explicitly support colour STL |
| ASCII PLY | Mesh plus texture-sampled vertex colours | Research tools, point/mesh workflows |
| Studio JSON | Full Studio geometry, texture, and editable material layers | Re-editing in this project |
| Texture PNG | Flattened colour material | Reuse in painting or rendering software |
| Height PNG | Grayscale luminance of the composite material | Displacement, bump, masks, and relief workflows |
| World JSON | Multiple objects, transforms, camera, and materials | Complete Studio scenes |
| Animation JSON | World plus keyframes and procedural motion | Re-editable Scene Animator projects |
| WebM | Full rendered animation | Video editing, sharing, web playback |
| GIF | Short 256-colour rendered loop | Previews, messages, lightweight embeds |

The OBJ export starts three downloads: `.obj`, `.mtl`, and `.png`. Keep them in the same folder.

Standard STL has no UV, image, or material channel. The ordinary STL export therefore remains geometry-only. **Texture-relief STL** samples the active material and moves vertices along their normals before writing the STL, which turns visible brightness into printable geometry without changing the editable object. **Experimental Color STL** writes the non-standard VisCAM/SolidView 15-bit per-facet colour attribute; software that does not implement that extension will display a normal uncoloured STL. Use embedded glTF or OBJ + MTL + PNG whenever the actual image texture must remain intact.

## Asset format

Studio assets use the versioned schema `studio3d-asset-v1`:

```json
{
  "schema": "studio3d-asset-v1",
  "name": "Sculpted object",
  "type": "mesh",
  "rows": null,
  "cols": null,
  "vertices": [[0, 0, 0]],
  "faces": [[0, 1, 2]],
  "uvs": [[0, 0]],
  "metadata": {
    "material": {
      "type": "image",
      "textureData": "data:image/png;base64,..."
    }
  }
}
```

Legacy grid JSON containing only `rows`, `cols`, and `vertices` remains importable. Triangle faces and UV coordinates are generated automatically when the grid dimensions are valid.

## Project structure

- `index.html` — studio launcher.
- `viewer.html` — reusable primitive, 3D fractal, and imported-mesh viewer.
- `sculptor.html` — heightmap relief creation and transfer.
- `equation.html` — restricted parametric-expression editor and transfer.
- `materials.html` — sculpting, layered materials, artistic effects, texture displacement, and external exports.
- `materials.js` — mesh editing, UV painting, material compositing, WebGL preview integration, history, and exporters.
- `world.html` — scene and texture editor UI.
- `world.js` — scene state, WebGL rendering integration, object controls, materials, texture painter, displacement, cross-tool handoff, import/export, and auto-save.
- `scene.html` — animation, timeline, camera, motion, and export interface.
- `scene.js` — keyframe evaluation, 3-axis procedural motion, WebGL preview/export rendering, MP4/WebM/GIF export, animation import/export, and auto-save.
- `studio-core.js` — shared schema validation, triangulation, UV generation, downloads, normalization, and browser transfer helpers.
- `studio-webgl.js` — shared dependency-free WebGL2 renderer used by World Builder, Scene Animator, Sculpt Materials, Relief Sculptor, Viewer, and Equation Lab.
- `studio.css` — shared controls and status styling.

## Design notes and limits

The project remains dependency-free and requires no npm installation or build process. All pages use vanilla HTML, CSS, and JavaScript. The 3D viewports share a WebGL2 renderer with a legacy Canvas2D fallback, while picking and sculpt-brush geometry tests remain CPU-side for predictable interaction. Animation export relies on browser video APIs plus the local GIF/MP4 packaging code in `scene.js`.

Sculpt Materials edits one mesh at a time. Build multi-object assemblies in World Builder, then open individual parts for sculpting. It does not currently perform true watertight boolean union, voxel remeshing, automatic retopology, or UV unwrapping; imported meshes should already contain usable triangle faces and preferably UV coordinates. Very dense imported meshes can still make sculpt brush deformation and picking slower because those editing operations remain CPU-side.
