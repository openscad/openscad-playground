// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, forwardRef, useContext, useEffect, useRef, useState } from 'react';
import { ModelContext } from './contexts';
import { StlViewer} from "react-stl-viewer";
import { ColorPicker } from 'primereact/colorpicker';
import { defaultModelColor } from '../state/initial-state';

export default function ViewerPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;

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
      {state.output?.stlFileURL &&
        <StlViewer
            className='absolute-fill'
            style={{
              zIndex: 0,
              // flex: 1,
              // width: '100%'
            }}
            // ref={stlModelRef}
            showAxes={state.view.showAxes}
            orbitControls
            shadows={state.view.showShadows}
            modelProps={{
              color: model.state.view.color,
            }}
            url={state.output?.stlFileURL ?? ''}
            />}
            
            <ColorPicker
              className={`opacity-animated ${!model.isComponentFullyVisible('viewer') ? 'opacity-0' : ''}`}
              value={model.state.view.color}
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                // pointerEvents: model.isComponentFullyVisible('viewer') ? undefined : 'none',
              }}
              onChange={(e) => model.mutate(s => s.view.color = `#${e.value ?? defaultModelColor}`)} />
          

    </div>
  )
}
