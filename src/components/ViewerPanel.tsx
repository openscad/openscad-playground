// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ModelContext } from './contexts.ts';
import { Toast } from 'primereact/toast';
import { notify, visuallyHidden, type NotifyLevel, type NotifyOptions } from '../state/notify.ts';
import { blurHashToImage, imageToBlurhash, imageToThumbhash, thumbHashToImage } from '../io/image_hashes.ts';
import { resolveUrl } from '../resource-loader.ts';
import type { CameraState, CapturedImage, CaptureOptions } from '../state/mcp-tools.ts';
import { fitSize, type ResolvedCamera } from '../state/mcp-tools-logic.ts';

export interface CameraInfo {
  theta: number;
  phi: number;
  closestView: string;
}

export interface ViewerPanelHandle {
  captureScreenshot(): Promise<string | null>;
  setCameraOrbit(theta: number, phi: number): void;
  getModelViewerRef(): any;
  zoom(factor: number): void;
  autoFit(): void;
  getCameraInfo(): CameraInfo | null;
  /** MCP tools: full camera state (async: probes the fit radius). */
  getCamera(): Promise<CameraState | null>;
  setCamera(camera: ResolvedCamera): Promise<CameraState | null>;
  /** Resolves true once the latest rendered model is loaded in the viewer. */
  waitForModel(timeoutMs: number): Promise<boolean>;
  captureImage(opts: CaptureOptions): Promise<CapturedImage | null>;
}

const nextFrames = (n: number) => new Promise<void>(resolve => {
  const step = (left: number) => left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
  step(n);
});

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * model-viewer's default ('auto') limits clamp the orbit radius to roughly
 * [0.55, 1] x the fit radius and the field of view to 30deg-ish, which would
 * silently defeat zoom/fov requests from the MCP tools. Widen them (angles
 * keep their limits).
 */
function widenCameraLimits(mv: any) {
  // Scale the limits to the model: an extreme near/far ratio wrecks depth precision and the model vanishes.
  const d = mv.getDimensions();
  const size = Math.max(d.x, d.y, d.z, 1e-3);
  mv.minCameraOrbit = `auto 0deg ${size / 20}m`;
  mv.maxCameraOrbit = `auto 180deg ${size * 20}m`;
  mv.minFieldOfView = '10deg';
  mv.maxFieldOfView = '120deg';
}

/** Radius at which model-viewer frames the whole model, probed without a visible camera jump. */
async function probeFitRadius(mv: any): Promise<number | undefined> {
  widenCameraLimits(mv);
  await mv.updateComplete;
  mv.jumpCameraToGoal(); // read the settled camera, not a mid-animation one
  const o = mv.getCameraOrbit();
  mv.cameraOrbit = `${o.theta}rad ${o.phi}rad auto`;
  await mv.updateComplete;
  mv.jumpCameraToGoal();
  const fit = mv.getCameraOrbit().radius;
  // Restore: keep 'auto' semantics (re-fit on model change) when already at fit.
  const atFit = Math.abs(fit - o.radius) / fit < 0.005;
  mv.cameraOrbit = `${o.theta}rad ${o.phi}rad ${atFit ? 'auto' : `${o.radius}m`}`;
  await mv.updateComplete;
  mv.jumpCameraToGoal();
  return Number.isFinite(fit) && fit > 0 ? fit : undefined;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": any;
    }
  }
}

export const PREDEFINED_ORBITS: [string, number, number][] = [
  ["Diagonal", Math.PI / 4, Math.PI / 4],
  ["Front", 0, Math.PI / 2],
  ["Right", Math.PI / 2, Math.PI / 2],
  ["Back", Math.PI, Math.PI / 2],
  ["Left", -Math.PI / 2, Math.PI / 2],
  ["Top", 0, 0],
  ["Bottom", 0, Math.PI],
];

function spherePoint(theta: number, phi: number): [number, number, number] {
  return [
    Math.cos(theta) * Math.sin(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(phi),
  ];
}

function euclideanDist(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
const radDist = (a: number, b: number) => Math.min(Math.abs(a - b), Math.abs(a - b + 2 * Math.PI), Math.abs(a - b - 2 * Math.PI));

function getClosestPredefinedOrbitIndex(theta: number, phi: number): [number, number, number] {
  const point = spherePoint(theta, phi);
  const points = PREDEFINED_ORBITS.map(([_, t, p]) => spherePoint(t, p));
  const distances = points.map(p => euclideanDist(point, p));
  const radDistances = PREDEFINED_ORBITS.map(([_, ptheta, pphi]) => Math.max(radDist(theta, ptheta), radDist(phi, pphi)));
  const [index, dist] = distances.reduce((acc, d, i) => d < acc[1] ? [i, d] : acc, [0, Infinity]) as [number, number];
  return [index, dist, radDistances[index]];
}

const originalOrbit = (([name, theta, phi]) => `${theta}rad ${phi}rad auto`)(PREDEFINED_ORBITS[0]);

function ViewerPanelInner({className, style, viewerRef, disableZoom, onCameraChange}: {className?: string, style?: CSSProperties, viewerRef?: React.Ref<ViewerPanelHandle>, disableZoom?: boolean, onCameraChange?: () => void}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;
  const [interactionPrompt, setInteractionPrompt] = useState('auto');
  const modelViewerRef = useRef<any>(null);
  const axesViewerRef = useRef<any>(null);
  const toastRef = useRef<Toast>(null);
  // Central notification policy (state/notify.ts): in embed mode non-essential notices are only announced.
  const [announcement, setAnnouncement] = useState('');
  const notifyUser = (level: NotifyLevel, text: string, opts?: NotifyOptions) =>
    notify(!!state.view.embed, {
      toast: (lvl, t, life) => toastRef.current?.show({severity: lvl === 'warn' ? 'warn' : lvl, detail: t, life: life ?? 1000}),
      announce: t => setAnnouncement(prev => prev === t ? t + '\u200b' : t), // (re-announce the same text)
    }, level, text, opts);

  const [loadedUri, setLoadedUri] = useState<string | undefined>();

  const [cachedImageHash, setCachedImageHash] = useState<{hash: string, uri: string} | undefined>(undefined);

  const modelUri = state.output?.displayFileURL ?? state.output?.outFileURL ?? '';
  const loaded = loadedUri === modelUri;
  const loadStatusRef = useRef({ loaded: false, hasModel: false });
  loadStatusRef.current = { loaded, hasModel: modelUri !== '' };

  const skyboxUrl = useMemo(() => resolveUrl('./skybox-lights.jpg'), []);
  const axesUrl = useMemo(() => resolveUrl('./axes.glb'), []);

  if (state?.preview) {
    let {hash, uri} = cachedImageHash ?? {};
    if (state.preview.blurhash && hash !== state.preview.blurhash) {
      hash = state.preview.blurhash;
      uri = blurHashToImage(hash, 100, 100);
      setCachedImageHash({hash, uri});
    } else if (state.preview.thumbhash && hash !== state.preview.thumbhash) {
      hash = state.preview.thumbhash;
      uri = thumbHashToImage(hash);
      setCachedImageHash({hash, uri});
    }
  } else if (cachedImageHash) {
    setCachedImageHash(undefined);
  }

  const onLoad = useCallback(async (e: any) => {
    setLoadedUri(modelUri);
    console.log('onLoad', e);

    if (!modelViewerRef.current) return;

    const uri = await modelViewerRef.current.toDataURL('image/png', 0.5);
    const preview = {blurhash: await imageToBlurhash(uri)};
    // const preview = {thumbhash: await imageToThumbhash(uri)};
    console.log(preview);
    
    model?.mutate(s => s.preview = preview);
  }, [model, modelUri, setLoadedUri, modelViewerRef.current]);

  useEffect(() => {
    if (!modelViewerRef.current) return;

    const element = modelViewerRef.current;
    element.addEventListener('load', onLoad);
    return () => element.removeEventListener('load', onLoad);
  }, [modelViewerRef.current, onLoad]);


  for (const ref of [modelViewerRef, axesViewerRef]) {
    const otherRef = ref === modelViewerRef ? axesViewerRef : modelViewerRef;
    useEffect(() => {
      if (!ref.current) return;

      function handleCameraChange(e: any) {
        if (!otherRef.current) return;
        if (e.detail.source === 'user-interaction') {
          const cameraOrbit = ref.current.getCameraOrbit();
          cameraOrbit.radius = otherRef.current.getCameraOrbit().radius;

          otherRef.current.cameraOrbit = cameraOrbit.toString();
          // Notify parent (e.g. McpApp) when camera changes on main viewer
          if (ref === modelViewerRef) onCameraChange?.();
        }
      }
      const element = ref.current;
      element.addEventListener('camera-change', handleCameraChange);
      return () => element.removeEventListener('camera-change', handleCameraChange);
    }, [ref.current, otherRef.current]);
  }

  // Shift+scroll zoom when model-viewer's built-in zoom is disabled (inline mode)
  useEffect(() => {
    if (!disableZoom) return; // built-in zoom handles it
    const el = modelViewerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const orbit = el.getCameraOrbit();
      orbit.radius *= factor;
      el.cameraOrbit = orbit.toString();
      onCameraChange?.();
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [modelViewerRef.current, disableZoom, onCameraChange]);

  // Cycle through predefined views when user clicks on the axes viewer
  useEffect(() => {
    let mouseDownSpherePoint: [number, number, number] | undefined;
    function getSpherePoint() {
      const orbit = axesViewerRef.current.getCameraOrbit();
      return spherePoint(orbit.theta, orbit.phi);
    }
    function onMouseDown(e: MouseEvent) {
      if (e.target === axesViewerRef.current) {
        mouseDownSpherePoint = getSpherePoint();
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (e.target === axesViewerRef.current) {
        const euclEps = 0.01;
        const radEps = 0.1;

        const spherePoint = getSpherePoint();
        const clickDist = mouseDownSpherePoint ? euclideanDist(spherePoint, mouseDownSpherePoint) : Infinity;
        if (clickDist > euclEps) {
          return;
        }
        // Note: unlike the axes viewer, the model viewer has a prompt that makes the model wiggle around, we only fetch it to get the radius.
        const axesOrbit = axesViewerRef.current.getCameraOrbit();
        const modelOrbit = modelViewerRef.current.getCameraOrbit();
        const [currentIndex, dist, radDist] = getClosestPredefinedOrbitIndex(axesOrbit.theta, axesOrbit.phi);
        const newIndex = dist < euclEps && radDist < radEps ? (currentIndex + 1) % PREDEFINED_ORBITS.length : currentIndex;
        const [name, theta, phi] = PREDEFINED_ORBITS[newIndex];
        Object.assign(modelOrbit, {theta, phi});
        modelViewerRef.current.cameraOrbit = modelOrbit.toString();
        // Sync axes viewer angles only — keep axes radius as 'auto' to prevent clipping
        axesViewerRef.current.cameraOrbit = `${modelOrbit.theta}rad ${modelOrbit.phi}rad auto`;
        notifyUser('info', `${name} view`);
        setInteractionPrompt('none');
      }
    }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    // window.addEventListener('click', onClick);
    return () => {
      // window.removeEventListener('click', onClick);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  });

  // Expose methods for MCP integration
  const readCamera = async (): Promise<CameraState | null> => {
    const mv = modelViewerRef.current;
    if (!mv) return null;
    const fitRadius = loadStatusRef.current.loaded ? await probeFitRadius(mv) : undefined;
    const orbit = mv.getCameraOrbit();
    const target = mv.getCameraTarget();
    const dims = loadStatusRef.current.loaded ? mv.getDimensions() : undefined;
    return {
      theta: orbit.theta,
      phi: orbit.phi,
      radius: orbit.radius,
      fitRadius,
      target: { x: target.x, y: target.y, z: target.z },
      fov: mv.getFieldOfView(),
      dimensions: dims ? { x: dims.x, y: dims.y, z: dims.z } : undefined,
    };
  };

  useImperativeHandle(viewerRef, () => ({
    async captureScreenshot(): Promise<string | null> {
      if (!modelViewerRef.current) return null;
      try {
        return await modelViewerRef.current.toDataURL('image/png', 0.5);
      } catch {
        return null;
      }
    },
    setCameraOrbit(theta: number, phi: number) {
      if (modelViewerRef.current) {
        // Keep the radius 'auto' (framed): copying the current radius would freeze
        // whatever transient value the camera has before the model has loaded.
        modelViewerRef.current.cameraOrbit = `${theta}rad ${phi}rad auto`;
        if (axesViewerRef.current) {
          axesViewerRef.current.cameraOrbit = `${theta}rad ${phi}rad auto`;
        }
      }
    },
    getModelViewerRef() {
      return modelViewerRef.current;
    },
    zoom(factor: number) {
      const mv = modelViewerRef.current;
      if (!mv) return;
      const orbit = mv.getCameraOrbit();
      orbit.radius *= factor;
      mv.cameraOrbit = orbit.toString();
      // Don't sync radius to axes — only angles
    },
    autoFit() {
      const mv = modelViewerRef.current;
      if (!mv) return;
      // Setting radius to 'auto' makes model-viewer recalculate ideal framing
      const orbit = mv.getCameraOrbit();
      mv.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad auto`;
      if (axesViewerRef.current) {
        const axOrbit = axesViewerRef.current.getCameraOrbit();
        axesViewerRef.current.cameraOrbit = `${axOrbit.theta}rad ${axOrbit.phi}rad auto`;
      }
    },
    getCamera: readCamera,
    async setCamera(r: ResolvedCamera): Promise<CameraState | null> {
      const mv = modelViewerRef.current;
      if (!mv) return null;
      widenCameraLimits(mv);
      let radius: string;
      if (r.zoom === 1) {
        radius = 'auto';
      } else if (r.zoom != null) {
        const fit = await probeFitRadius(mv);
        radius = fit ? `${fit / r.zoom}m` : 'auto';
      } else if (r.distance != null) {
        radius = `${r.distance}m`;
      } else {
        radius = `${mv.getCameraOrbit().radius}m`;
      }
      mv.cameraOrbit = `${r.theta}rad ${r.phi}rad ${radius}`;
      if (r.target != null) {
        mv.cameraTarget = r.target === 'auto' ? 'auto auto auto' : `${r.target.x}m ${r.target.y}m ${r.target.z}m`;
      }
      if (r.fov != null) {
        mv.fieldOfView = r.fov === 'auto' ? 'auto' : `${r.fov}deg`;
      }
      await mv.updateComplete;
      mv.jumpCameraToGoal();
      if (axesViewerRef.current) {
        axesViewerRef.current.cameraOrbit = `${r.theta}rad ${r.phi}rad auto`;
      }
      await nextFrames(2);
      onCameraChange?.();
      return await readCamera();
    },
    async waitForModel(timeoutMs: number): Promise<boolean> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const st = loadStatusRef.current;
        if (st.hasModel && st.loaded) {
          await nextFrames(2);
          return true;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    },
    async captureImage({ maxSize, mimeType, quality }: CaptureOptions): Promise<CapturedImage | null> {
      const mv = modelViewerRef.current;
      if (!mv) return null;
      try {
        await mv.updateComplete;
        await nextFrames(2);
        let blob: Blob;
        try {
          blob = await mv.toBlob({ mimeType: 'image/png', idealAspect: false });
        } catch {
          blob = await (await fetch(mv.toDataURL('image/png'))).blob();
        }
        const bitmap = await createImageBitmap(blob);
        const { width, height } = fitSize(bitmap.width, bitmap.height, maxSize);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ececec'; // the 3D canvas is transparent: give the model a neutral backdrop
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const out: Blob | null = await new Promise(res => canvas.toBlob(res, mimeType, quality));
        if (!out) return null;
        return { data: await blobToBase64(out), mimeType, width, height };
      } catch (e) {
        console.warn('captureImage failed:', e);
        return null;
      }
    },
    getCameraInfo(): CameraInfo | null {
      const mv = modelViewerRef.current;
      if (!mv) return null;
      const orbit = mv.getCameraOrbit();
      const [idx] = getClosestPredefinedOrbitIndex(orbit.theta, orbit.phi);
      return { theta: orbit.theta, phi: orbit.phi, closestView: PREDEFINED_ORBITS[idx][0] };
    },
  }), [modelViewerRef.current, axesViewerRef.current]);

  return (
    <div className={className}
          style={{
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              flex: 1,
              width: '100%',
              ...(style ?? {})
          }}>
      <Toast ref={toastRef} position='top-right'  />
      <div data-announcer aria-live="polite" aria-atomic="true" style={visuallyHidden}>{announcement}</div>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 0.4; }
            50% { opacity: 0.7; }
            100% { opacity: 0.4; }
          }
        `}
      </style>

      {!loaded && cachedImageHash && 
        <img
        src={cachedImageHash.uri}
        style={{
          animation: 'pulse 1.5s ease-in-out infinite',
          position: 'absolute',
          pointerEvents: 'none',
          width: '100%',
          height: '100%'
        }} />
      }

      <model-viewer
        orientation="0deg -90deg 0deg"
        class="main-viewer"
        src={modelUri}
        style={{
          transition: 'opacity 0.5s',
          opacity: loaded ? 1 : 0,
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
        camera-orbit={originalOrbit}
        interaction-prompt={interactionPrompt}
        environment-image={skyboxUrl}
        max-camera-orbit="auto 180deg auto"
        min-camera-orbit="auto 0deg auto"
        camera-controls
        {...(disableZoom ? { 'disable-zoom': true } : {})}
        ar
        ref={modelViewerRef}
      >
        <span slot="progress-bar"></span>
      </model-viewer>
      {state.view.showAxes && (
        <model-viewer
                orientation="0deg -90deg 0deg"
                src={axesUrl}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  zIndex: 10,
                  height: '100px',
                  width: '100px',
                }}
                loading="eager"
                camera-orbit={originalOrbit}
                // interpolation-decay="0"
                environment-image={skyboxUrl}
                max-camera-orbit="auto 180deg auto"
                min-camera-orbit="auto 0deg auto"
                orbit-sensitivity="5"
                interaction-prompt="none"
                camera-controls="false"
                disable-zoom
                disable-tap 
                disable-pan
                ref={axesViewerRef}
        >
          <span slot="progress-bar"></span>
        </model-viewer>
      )}
    </div>
  )
}

const ViewerPanel = forwardRef<ViewerPanelHandle, {className?: string, style?: CSSProperties, disableZoom?: boolean, onCameraChange?: () => void}>(
  (props, ref) => <ViewerPanelInner {...props} viewerRef={ref} />
);
export default ViewerPanel;
