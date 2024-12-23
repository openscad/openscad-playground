// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useEffect, useRef, useState } from 'react';
import { ModelContext } from './contexts';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": any;
    }
  }
}

export default function ViewerPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;
  const modelViewerRef = useRef<any>();
  const axesViewerRef = useRef<any>();

  for (const ref of [modelViewerRef, axesViewerRef]) {
    const otherRef = ref === modelViewerRef ? axesViewerRef : modelViewerRef;
    useEffect(() => {
      function handleCameraChange(e: any) {
        if (e.detail.source === 'user-interaction') {
          const cameraOrbit = ref.current.getCameraOrbit();
          cameraOrbit.radius = otherRef.current.getCameraOrbit().radius;
        
          otherRef.current.cameraOrbit = cameraOrbit.toString();
        }
      }
      ref.current.addEventListener('camera-change', handleCameraChange);
      return () => ref.current.removeEventListener('camera-change', handleCameraChange);
    }, [ref.current, otherRef.current]);
  }
  
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
                  right: 0,
                  zIndex: 10,
                  height: '200px',
                  width: '200px',
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
