// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ModelContext } from './contexts.ts';
import { Toast } from 'primereact/toast';
import { blurHashToImage, imageToBlurhash, imageToThumbhash, thumbHashToImage } from '../io/image_hashes.ts';
import { resolveUrl } from '../resource-loader.ts';

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

  const [loadedUri, setLoadedUri] = useState<string | undefined>();

  const [cachedImageHash, setCachedImageHash] = useState<{hash: string, uri: string} | undefined>(undefined);

  const modelUri = state.output?.displayFileURL ?? state.output?.outFileURL ?? '';
  const loaded = loadedUri === modelUri;

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
        toastRef.current?.show({severity: 'info', detail: `${name} view`, life: 1000,});
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
        const orbit = modelViewerRef.current.getCameraOrbit();
        Object.assign(orbit, { theta, phi });
        modelViewerRef.current.cameraOrbit = orbit.toString();
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
