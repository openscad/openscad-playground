// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useRef } from 'react';
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
              width: '100%',
              ...(style ?? {})
          }}>
      {(state.output?.displayFileURL || state.output?.outFile && state.output.outFile.name.endsWith('.glb') && state.output?.outFileURL) && (
            <model-viewer
              orientation="0deg -90deg 0deg"
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
              ref={(ref: any) => {
                modelRef.current = ref;
              }}
            />
      )}
    </div>
  )
}
