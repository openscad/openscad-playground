// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useEffect, useRef, useState } from 'react';
import { ModelContext } from './contexts';
import { on } from 'events';
import { Toast } from 'primereact/toast';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": any;
    }
  }
}

const PREDEFINED_ORBITS: [string, number, number][] = [
  ["Front", 0, Math.PI / 2],
  ["Right", Math.PI / 2, Math.PI / 2],
  ["Top", 0, 0],
  ["Bottom", -Math.PI, Math.PI],
];

export default function ViewerPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;
  const modelViewerRef = useRef<any>();
  const axesViewerRef = useRef<any>();
  const toastRef = useRef<Toast>(null);

  for (const ref of [modelViewerRef, axesViewerRef]) {
    const otherRef = ref === modelViewerRef ? axesViewerRef : modelViewerRef;
    useEffect(() => {
      if (!ref.current) return;

      function handleCameraChange(e: any) {
        if (!otherRef.current) return;
        if (e.detail.source === 'user-interaction') {
          const cameraOrbit = ref.current.getCameraOrbit();
          console.log(cameraOrbit.toString());
          cameraOrbit.radius = otherRef.current.getCameraOrbit().radius;
        
          otherRef.current.cameraOrbit = cameraOrbit.toString();
        }
      }
      const element = ref.current;
      element.addEventListener('camera-change', handleCameraChange);
      return () => element.removeEventListener('camera-change', handleCameraChange);
    }, [ref.current, otherRef.current]);
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.target === axesViewerRef.current) {
        // Cycle through orbits
        const orbit = axesViewerRef.current.getCameraOrbit();
        const eps = 0.01;
        const currentIndex = PREDEFINED_ORBITS.findIndex(([_, theta, phi]) => Math.abs(orbit.theta - theta) < eps && Math.abs(orbit.phi - phi) < eps);
        const newIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % PREDEFINED_ORBITS.length;
        const [name, theta, phi] = PREDEFINED_ORBITS[newIndex];
        orbit.theta = theta;
        orbit.phi = phi;
        const newOrbit = modelViewerRef.current.cameraOrbit = axesViewerRef.current.cameraOrbit = orbit.toString();
        toastRef.current?.show({severity: 'info', detail: `${name} view`, life: 1000,});
      }
    }
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  });
  
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
      <Toast ref={toastRef} position='bottom-right'  />
      <model-viewer
        orientation="0deg -90deg 0deg"
        class="main-viewer"
        src={state.output?.displayFileURL ?? state.output?.outFileURL ?? ''}
        style={{
          width: '100%',
          height: '100%',
        }}
        environment-image="./skybox-lights.jpg"
        max-camera-orbit="auto 180deg auto"
        min-camera-orbit="auto 0deg auto"
        camera-controls
        ar
        ref={modelViewerRef}
      >
        <span slot="progress-bar"></span>
      </model-viewer>
      {state.view.showAxes && (
        <model-viewer
                orientation="0deg -90deg 0deg"
                src="./axes.glb"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  zIndex: 10,
                  height: '100px',
                  width: '100px',
                }}
                loading="eager"
                interpolation-decay="0"
                environment-image="./skybox-lights.jpg"
                max-camera-orbit="auto 180deg auto"
                min-camera-orbit="auto 0deg auto"
                orbit-sensitivity="5"
                interaction-prompt="none"
                disable-zoom
                camera-controls="false"
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
