# Animation (`$t`)

A model that reads OpenSCAD's animation variable `$t` (0 <= `$t` < 1) gets a play/pause button and a time slider, in the
web app's footer, in the embed toolbar (next to Render, with the slider along the bottom of the viewer) and in the MCP
app. Play loops the animation; the slider scrubs it; the gear next to `$t=...` sets the loop (**steps** = frames per loop,
**fps**; the popover also shows the resulting duration).

```scad
rotate([0, 0, $t * 360]) cube([20, 8, 8]);
```

## How it works

- **Detection** (`src/state/animation-detect.ts`): `$t` as a whole identifier (not `$tx`, `$t2`...) in the active file or in
  the project files it `include`s / `use`s (transitively), with comments and string literals ignored. Library files that
  are only mounted from the library archives are not scanned, so a `$t` used only inside a library does not show the
  controls. A false positive (say, a top-level `$t = 0.5;`) just shows controls.
- **Frames**: frame `i` of `steps` is `$t = i / steps`, rendered as a *preview* (`-D '$t=<t>'`, fast, the same render as
  edits trigger) in its own job slot, one at a time, and converted to GLB for the viewer like any render.
  A normal render (an edit, F5, customizer) also uses the current `$t`, and Render (F6) renders the *current frame* in full.
- **Cache** (`src/state/animation-cache.ts`): LRU keyed by (hash of sources + customizer values + features, `t`), capped at
  240 frames / 96 MB. Frames at equal times are shared when the number of steps changes. Evicted frames release their
  object URLs.
- **Playback** (`src/state/animation.ts`, `AnimationController`, unit tested with a fake clock): while playing, frames are
  rendered ahead of the displayed one; playback never advances onto a frame that is not ready, so the first lap runs at
  the render speed and the following laps at the set fps. The displayed model is swapped only when the next frame is
  ready *and* the viewer reported the previous one loaded; the viewer keeps the old frame on screen meanwhile (no fade,
  no flicker), skips the per-frame thumbnail, and keeps the camera as the user had it (model-viewer would otherwise re-frame
  and re-center on every frame, which would cancel any motion).
- **Scrubbing** shows the nearest cached frame at once, and renders the requested one on demand once the slider rested
  for 120 ms. Scrubbing pauses.
- **Invalidation and priority**: any change to what frames depend on (source, included files, customizer values,
  features, active file) drops the cache and pauses. Normal renders have priority: the running frame render is killed
  when one starts, background rendering resumes when it ends; Render (F6) also pauses. Nothing is rendered in a hidden tab.
- **JavaScript engine (wasm2js)**: much slower, so the defaults are 8 steps at 4 fps and only the next frame is
  rendered ahead (30 steps at 15 fps otherwise).

## Persistence and the MCP app

- Loop settings changed by the user are part of the share link (`view.animation = {steps, fps}`); playing and the current
  time are not (a link never autoplays).
- The MCP app keeps `{steps, fps, t}` in its view state (survives remounts), reports the animation in `get_viewer_state`
  and, only while the model animates, in the model-context update (`Animation: $t=0.37 (frame 12 of 30, 15 fps, playing)`);
  the context is refreshed on play/pause and when a frame settles, not on every frame.
- Tool: `set_view_options` takes `animation: {playing?, t?, steps?, fps?}`. `t` pauses and returns once that frame is
  displayed, so a following `screenshot` shows it.

Limits: all frames of a loop that does not fit the cache are re-rendered on every lap (still correct, just slower);
the camera is framed on the first frame.
