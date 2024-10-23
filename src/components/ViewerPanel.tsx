// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, forwardRef, useContext, useEffect, useRef, useState } from 'react';
import { ModelContext } from './contexts';
import { StlViewer} from "react-stl-viewer";
import { ColorPicker } from 'primereact/colorpicker';
import { defaultModelColor } from '../state/initial-state';
import { SVGViewer } from './SVGViewer';

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
  const modelRef = useRef();

  return (
    <div className={className}
          style={{
              display: 'flex',
              flexDirection: 'column', 
              flex: 1, 
              width: '100%',
              ...(style ?? {})
          }}>
      {state.output?.outFile && state.output.outFile.name.endsWith('.glb') && state.output?.outFileURL && (
            <model-viewer
              src={state.output?.outFileURL ?? ''}
              style={{
                width: '100%',
                height: '100%',
              }}
              environment-image="./skybox-lights.jpg"
              max-camera-orbit="auto 180deg auto"
              min-camera-orbit="auto 0deg auto"
              camera-controls
              ar
              ref={(ref: any) => {
                modelRef.current = ref;
              }}
            />
      )}
      {state.output?.outFile && state.output.outFile.name.endsWith('.svg') && state.output?.outFileURL && (
        <SVGViewer url={state.output?.outFileURL ?? ''}
          style={{
            flex: 1,
            width: '100%',
            maxHeight: 'calc(100vh - 125px)',
            overflow: 'hidden',
          }} />
        // <img src={state.output?.outFileURL ?? ''} style={{flex: 1, width: '100%'}} />
      )}
      {state.output?.outFile && state.output.outFile.name.endsWith('.stl') && state.output?.outFileURL && (
        <>
         <StlViewer
             style={{
              width: '100%',
              height: '100%',
             }}
             // ref={stlModelRef}
             showAxes={state.view.showAxes}
             orbitControls
             shadows={state.view.showShadows}
             modelProps={{
               color: model.state.view.color,
             }}
             url={state.output?.outFileURL ?? ''}
             />
            <ColorPicker
              className={`opacity-animated ${!model.isComponentFullyVisible('viewer') ? 'opacity-0' : ''}`}
              value={model.state.view.color}
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
              }}
              onChange={(e) => model.mutate(s => s.view.color = `#${e.value ?? defaultModelColor}`)}
            />
            </>
        )}
    </div>
  )
}
