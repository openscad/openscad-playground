// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, forwardRef, useContext, useEffect, useRef, useState } from 'react';
import { ModelContext } from './contexts';
import { StlViewer} from "react-stl-viewer";
import { ColorPicker } from 'primereact/colorpicker';
import { defaultModelColor } from '../state/initial-state';

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
              position: 'relative',
              width: '100%',
              ...(style ?? {})
          }}>
      {state.output?.outFileURL && (
          <>
            <model-viewer
              src={state.output?.outFileURL ?? ''}
              style={{
                width: '100%',
                height: '100%',
              }}
              camera-controls
              ar
              ref={(ref: any) => {
                modelRef.current = ref;
              }}
            />
            {/* <ColorPicker
              className={`opacity-animated ${!model.isComponentFullyVisible('viewer') ? 'opacity-0' : ''}`}
              value={model.state.view.color}
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
              }}
              onChange={(e) => model.mutate(s => s.view.color = `#${e.value ?? defaultModelColor}`)}
            /> */}
            </>
        )}

    </div>
  )
}
