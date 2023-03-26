// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useRef } from 'react';
import { State } from '../state/app-state'
import { ModelContext } from './contexts';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { MenuItem } from 'primereact/menuitem';
import { Badge } from 'primereact/badge';
import { Menu } from 'primereact/menu';
import { ToggleButton } from 'primereact/togglebutton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';

function downloadOutput(state: State) {
  if (!state.output) return;

  const fileName = state.output!.isPreview ? 'preview.stl' : 'render.stl';
  const doDownload = () => {
    const a = document.createElement('a')
    a.href = state.output!.stlFileURL
    a.download = fileName;
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  };

  if (state.output.isPreview && state.params.source.indexOf('$preview') >= 0) {
    confirmDialog({
        message: "This model references the $preview variable but hasn't been rendered (F6), or its rendering is stale. You're about to download the preview result itself, which may not have the intended refinement of the render. Sure you want to proceed?",
        header: 'Preview vs. Render',
        icon: 'pi pi-exclamation-triangle',
        accept: () => doDownload, 
        acceptLabel: `Download ${fileName}`,
        rejectLabel: 'Cancel'
        // reject: () => {}
    });
  } else {
    doDownload();
  }

}


export default function Footer({style}: {style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  
  const menu = useRef<Menu>(null);
  const toast = useRef<Toast>(null);

  const state = model.state;
  
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
                    visibility: state.rendering || state.previewing || state.checkingSyntax
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
      <Button onClick={() => model.render({isPreview: false, now: true})}
        loading={state.rendering}
        icon="pi pi-refresh"
        title="Render the model (F6 / Ctrl+Enter). Models can test $preview to enable more detail in renders only."
        label="Render" />
      
      {/* {state.error != null &&
        <i className="pi pi-exclamation-circle" style={{color: 'red'}} title={state.error}></i>} */}

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
      </Button>

      {/* {state.output &&
        <span style={{color: 'blue'}}>
          <i className="pi pi-stopwatch" title={state.error}></i>
          <span style={{margin: '5px'}}>{state.output.formattedElapsedMillis}</span>
        </span>} */}
        
      {/* {state.previewing && 'previewing... '}
      {state.rendering && 'rendering... '}
      {state.checkingSyntax && 'checking syntax... '} */}

      {/* <span style={{flex: 1}}></span> */}
      
      <span style={{flex: 1}}></span>

      <ConfirmDialog />

      <Toast ref={toast} />

      {state.output && (
        <Button icon='pi pi-download'
          title={`Download ${state.output.isPreview ? "preview.stl" : "render.stl"} (${state.output.formattedStlFileSize})`}
          severity="secondary"
          text
          // label={state.output.isPreview ? "preview.stl" : "render.stl"}
          iconPos='right'
          onClick={() => downloadOutput(state)} />
        // <a href={state.output.stlFileURL}
        // target="_blank" 
        // download={state.output.isPreview ? "preview.stl" : "render.stl"}
        // title="STL Download">
        //     {state.output.isPreview ? "preview.stl" : "render.stl"} ({state.output.formattedStlFileSize})
        // </a>
      )}

      <ToggleButton
                  style={{
                    // flex: 1,
                  }}
                  onIcon='pi pi-table'
                  offIcon='pi pi-table'
                  onLabel=''
                  offLabel=''
                  // onLabel='Multi'
                  // offLabel='Single'
                  title='Change between single and multiple layout'
                  checked={state.view.layout.mode === 'multi'}
                  onChange={e => model.changeLayout(e.value ? 'multi' : 'single')} />
      
      <Menu model={[
        {
          label: "openscad-playground",
          icon: 'pi pi-github',
          command: () => window.open('https://github.com/openscad/openscad-playground/tree/rewrite1', '_blank'),
        },
        {
          label: 'LICENSES',
          icon: 'pi pi-info-circle',
          command: () => window.open('https://github.com/openscad/openscad-playground/blob/rewrite1/LICENSE.md', '_blank'),
        },
        {
          label: 'OpenSCAD Docs',
          icon: 'pi pi-book',
          command: () => window.open('http://openscad.org/documentation.html', '_blank'),
        },
        {
          label: 'OpenSCAD Cheatsheet',
          icon: 'pi pi-palette',
          command: () => window.open('http://openscad.org/cheatsheet/', '_blank'),
        },
        {
          label: 'BOSL2 Cheatsheet',
          icon: 'pi pi-palette',
          command: () => window.open('https://github.com/revarbat/BOSL2/wiki/CheatSheet', '_blank'),
        },
      ] as MenuItem[]} popup ref={menu} />
      <Button title="Help & Licenses" rounded icon="pi pi-question-circle" onClick={(e) => menu.current && menu.current.toggle(e)} />

    </div>
  </>
}
