// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useRef } from 'react';
import { State } from '../state/app-state'
import { ModelContext } from './contexts';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Badge } from 'primereact/badge';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import SettingsMenu from './SettingsMenu';
import HelpMenu from './HelpMenu';
import { confirmDialog } from 'primereact/confirmdialog';
// import { SplitButton } from 'primereact/splitbutton';
import { Dropdown } from 'primereact/dropdown';
import ExportButton from './ExportButton';

function downloadOutput(state: State) {
  if (!state.output) return;
  const sourcePathParts = state.params.activePath.split('/');
  const sourceFileName = sourcePathParts.slice(-1)[0] + '.' + state.params.exportFormat;
  // const fileName = [
  //   sourceFileName,
  //   state.output!.isPreview ? 'preview.glb' : 'render.' + state.params.renderFormat
  // ].join('.');
  const doDownload = () => {
    const a = document.createElement('a')
    a.href = state.output!.outFileURL
    a.download = sourceFileName;//
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  };

  // if (state.output.isPreview && state.params.source.indexOf('$preview') >= 0) {
  //   confirmDialog({
  //       message: "This model references the $preview variable but hasn't been rendered (F6), or its rendering is stale. You're about to download the preview result itself, which may not have the intended refinement of the render. Sure you want to proceed?",
  //       header: 'Preview vs. Render',
  //       icon: 'pi pi-exclamation-triangle',
  //       accept: doDownload, 
  //       acceptLabel: `Download ${fileName}`,
  //       rejectLabel: 'Cancel'
  //       // reject: () => {}
  //   });
  // } else {
  doDownload();
  // }

}


export default function Footer({style}: {style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const state = model.state;
  
  const helpMenu = useRef<Menu>(null);
  const toast = useRef<Toast>(null);

  
  const severityByMarkerSeverity = new Map<monaco.MarkerSeverity, 'danger' | 'warning' | 'info'>([
    [monaco.MarkerSeverity.Error, 'danger'],
    [monaco.MarkerSeverity.Warning, 'warning'],
    [monaco.MarkerSeverity.Info, 'info'],
  ]);
  const markers = state.lastCheckerRun?.markers ?? [];
  const getBadge = (s: monaco.MarkerSeverity) => {
    const count = markers.filter(m => m.severity == s).length;
    const sev = s == monaco.MarkerSeverity.Error ? 'danger'
      : s == monaco.MarkerSeverity.Warning ? 'warning'
      : s == monaco.MarkerSeverity.Info ? 'info'
      : 'success';
    return <>{count > 0 && <Badge value={count} severity={severityByMarkerSeverity.get(s)}></Badge>}</>;
  };


  const maxMarkerSeverity = markers.length == 0 ? undefined : markers.map(m => m.severity).reduce((a, b) => Math.max(a, b));
  
  return <>
    <ProgressBar mode="indeterminate"
                style={{
                  marginLeft: '5px',
                  marginRight: '5px',
                    visibility: state.rendering || state.previewing || state.checkingSyntax || state.exporting
                      ? 'visible' : 'hidden',
                    height: '6px' }}></ProgressBar>
      
    <div className="flex flex-row gap-1" style={{
        // display: 'flex',
        // flexDirection: 'row',
        // gap: '10px',
        // verticalAlign: 'center',
        alignItems: 'center',
        margin: '5px',
        ...(style ?? {})
    }}>
      <Button
        icon="pi pi-cog"
        onClick={() => model.render({isPreview: false, now: true})}
        className="p-button-sm"
        label="Render"
        />
      
      {(state.lastCheckerRun || state.output) &&
        <Button type="button"
            // label={state.view.logs ? "Hide logs" : "Show logs"}
            label="Logs"
            icon="pi pi-align-left"
            text={!state.view.logs}
            onClick={() => model.logsVisible = !state.view.logs}
            // onLabel="Logs" offLabel="Logs" 
            // onIcon="pi pi-align-left"
            // offIcon="pi pi-align-left"
            className={maxMarkerSeverity && `p-button-${severityByMarkerSeverity.get(maxMarkerSeverity) ?? 'success'}`}
            >
          {getBadge(monaco.MarkerSeverity.Error)}
          {getBadge(monaco.MarkerSeverity.Warning)}
          {getBadge(monaco.MarkerSeverity.Info)}
        </Button>}

      <div style={{flex: 1}}></div>

      <ExportButton />

        {/* title={`Download ${(state.output.isPreview ? "preview." : "render.") + state.params.renderFormat} (${state.output.formattedOutFileSize})\nGenerated in ${state.output.formattedElapsedMillis}`} */}
      {/* {state.export && (
        <Button icon='pi pi-download'
          severity="secondary"
          text
          title={`Download ${state.export.outFile.name} (${state.export.formattedOutFileSize})\nGenerated in ${state.export.formattedElapsedMillis}`}
          // label={state.output.isPreview ? "preview.stl" : "render.stl"}
          iconPos='right'
          onClick={() => downloadOutput(state)} />
      )} */}

      {/* {state.output &&
        <span style={{color: 'blue'}}>
          <i className="pi pi-stopwatch" title={state.error}></i>
          <span style={{margin: '5px'}}>{state.output.formattedElapsedMillis}</span>
        </span>} */}
        
      {/* {state.previewing && 'previewing... '}
      {state.rendering && 'rendering... '}
      {state.checkingSyntax && 'checking syntax... '} */}

      {/* <span style={{flex: 1}}></span> */}
      
      {/* <span style={{flex: 1}}></span> */}

      <Toast ref={toast} />
    </div>
  </>
}
