// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext, useRef, useState } from 'react';
import Editor, { loader, Monaco } from '@monaco-editor/react';
import openscadEditorOptions from '../language/openscad-editor-options';
import { ModelContext } from '../state/model';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Button } from 'primereact/button';
import { MenuItem } from 'primereact/menuitem';
import { TreeSelect } from 'primereact/treeselect';
import TreeNode from 'primereact/treenode';
import { Menu } from 'primereact/menu';
import { FSContext, getParentDir } from '../fs/filesystem';
import { buildUrlForStateParams } from '../state/fragment-state';
import { blankProjectState } from '../state/initial-state';

// import "primereact/resources/themes/lara-light-indigo/theme.css";
// import "primereact/resources/primereact.min.css";
// import "primeicons/primeicons.css"; 

let monacoInstance: Monaco
loader.init().then(mi => monacoInstance = mi);

const isFileWritable = (path: string) => getParentDir(path) === '/home'

function listFilesAsNodes(fs: FS, path: string): TreeNode[] {
  const files: [string, string][] = []
  const dirs: [string, string][] = []
  for (const name of fs.readdirSync(path)) {
    const childPath = `${path}/${name}`;
    const stat = fs.lstatSync(childPath);
    const isDirectory = stat.isDirectory();
    if (!isDirectory && !name.endsWith('.scad')) {
      continue;
    }
    (isDirectory ? dirs : files).push([name, childPath]);
  }
  [files, dirs].forEach(arr => arr.sort(([a], [b]) => a.localeCompare(b)));

  const nodes: TreeNode[] = []
  for (const [arr, isDirectory] of [[files, false], [dirs, true]] as [[string, string][], boolean][]) {
    for (const [name, path] of arr) {
      const children = isDirectory ? listFilesAsNodes(fs, path) : undefined;
      if (isDirectory && children!.length == 0) {
        continue;
      }
      nodes.push({
        // icon: path == '/home' ? 'pi-home' : ...
        icon: isDirectory ? 'pi pi-folder' : isFileWritable(path) ? 'pi pi-file' : 'pi pi-lock',
        label: name,
        data: path,
        key: path,
        children,
        selectable: !isDirectory // && (name == 'LICENSE' || name.endsWith('.scad') || name.endsWith('.scad')
      });
    }
  }
  return nodes;
}

export default function EditorPanel({className, style}: {className?: string, style?: CSSProperties}) {

  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const menu = useRef<Menu>(null);

  const state = model.state;

  const fs = useContext(FSContext);
  const [editor, setEditor] = useState(null as monaco.editor.IStandaloneCodeEditor | null)
  // const [modelFile, setModelFile] = useState(state.params.sourcePath);

  if (editor) {
    const checkerRun = state.lastCheckerRun;
    const editorModel = editor.getModel();
    if (editorModel) {
      if (checkerRun) {
        monacoInstance.editor.setModelMarkers(editorModel, 'openscad', checkerRun.markers);
      }
    }
  }

  const onMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.addAction({
      id: "openscad-render",
      label: "Render OpenSCAD",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        monaco.KeyCode.F6,
      ],
      run: () => model.render({isPreview: false, now: true})
    });
    editor.addAction({
      id: "openscad-preview",
      label: "Preview OpenSCAD",
      keybindings: [monaco.KeyCode.F5],
      run: () => model.render({isPreview: true, now: true})
    });
    setEditor(editor)
  }

  const fsItems = fs && listFilesAsNodes(fs, '/home') || [];

  return (
    <div className={`editor-panel ${className ?? ''}`} style={{
      // maxWidth: '5 0vw',
      display: 'flex',
      flexDirection: 'column',
      // position: 'relative',
      // width: '100%', height: '100%',
      ...(style ?? {})
    }}>
      {/* <BreadCrumb model={breadCrumbsItems} home={breadCrumbsHome}/> */}
      <div className='flex flex-row gap-2' style={{
        margin: '5px',
      }}>
          
        <Menu model={[
          {
            label: "New project",
            icon: 'pi pi-plus-circle',
            // disabled: true,
            command: () => window.open(buildUrlForStateParams(blankProjectState), '_blank'),
          },
          {
            // TODO: share text, title and rendering image
            // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
            label: 'Share project',
            icon: 'pi pi-share-alt',
            disabled: true,
            command: () => window.open('http://openscad.org/cheatsheet/', '_blank'),
          },
          {
            separator: true
          },  
          {
            // TODO: popup to ask for file name
            label: "New file",
            icon: 'pi pi-plus',
            disabled: true,
            command: () => window.open('https://github.com/openscad/openscad-playground/tree/rewrite1', '_blank'),
          },
          {
            label: "Copy to new file",
            icon: 'pi pi-clone',
            disabled: true,
            command: () => window.open('https://github.com/openscad/openscad-playground/tree/rewrite1', '_blank'),
          },
          {
            label: "Upload file(s)",
            icon: 'pi pi-upload',
            disabled: true,
            command: () => window.open('https://github.com/openscad/openscad-playground/tree/rewrite1', '_blank'),
          },
          {
            label: 'Download sources',
            icon: 'pi pi-download',
            disabled: true,
            command: () => window.open('https://github.com/revarbat/BOSL2/wiki/CheatSheet', '_blank'),
          },
          {
            separator: true
          },
          // https://vscode-docs.readthedocs.io/en/stable/customization/keybindings/
          // {
          //   label: 'Undo',
          //   icon: 'pi pi-undo',
          //   // disabled: true,
          //   command: () => editor?.trigger(state.params.sourcePath, 'editor.action.undoAction', null),
          // },
          // {
          //   label: 'Redo',
          //   icon: 'pi pi-reply',
          //   // disabled: true,
          //   command: () => editor?.trigger(state.params.sourcePath, 'editor.action.redoAction', null),
          // },
          {
            separator: true
          },
          // {
          //   label: 'Copy',
          //   icon: 'pi pi-copy',
          //   // disabled: true,
          //   command: () => editor?.trigger(state.params.sourcePath, 'editor.action.clipboardCopyAction', null),
          // },
          // {
            //   label: 'Cut',
            //   icon: 'pi pi-eraser',
            //   // disabled: true,
            //   command: () => editor?.trigger(state.params.sourcePath, 'editor.action.clipboardCutAction', null),
            // },
            // {
              //   label: 'Paste',
              //   icon: 'pi pi-images',
              //   // disabled: true,
              //   command: () => editor?.trigger(state.params.sourcePath, 'editor.action.clipboardPasteAction', null),
              // },
              {
                label: 'Select All',
                icon: 'pi pi-info-circle',
                // disabled: true,
                command: () => editor?.trigger(state.params.sourcePath, 'editor.action.selectAll', null),
              },
              {
                separator: true
              },
              {
                label: 'Find',
                icon: 'pi pi-search',
                // disabled: true,
                command: () => editor?.trigger(state.params.sourcePath, 'actions.find', null),
              },
        ] as MenuItem[]} popup ref={menu} />
        <Button title="Editor menu" rounded text icon="pi pi-ellipsis-h" onClick={(e) => menu.current && menu.current.toggle(e)} />
        
        <TreeSelect 
            title='OpenSCAD Playground Files'
            value={state.params.sourcePath}
            onChange={(e) => model.openFile(String(e.value))}
            // dropdownIcon="pi pi-folder-open"
            filter
            style={{
              flex: 1,
            }}
            options={fsItems} />
  
      </div>

      {/* <SplitPane type="vertical"> */}
      {/* <div className='flex flex-column'> */}
      {/* <Splitter style={{ 
        // height: '300px' 
      }} layout="vertical"> */}
        {/* <SplitterPanel className="flex flex-column align-items-center justify-content-center"
          style={{
            // width: '100%', height: '100%'
          }}> */}
          <div style={{
            position: 'relative',
            flex: 1
          }}>
            <Editor
              className="openscad-editor absolute-fill"
              defaultLanguage="openscad"
              path={state.params.sourcePath}
              value={state.params.source}
              onChange={s => model.source = s ?? ''}
              onMount={onMount} // TODO: This looks a bit silly, does it trigger a re-render??
              options={{
                ...openscadEditorOptions,
                readOnly: !isFileWritable(state.params.sourcePath)
              }}
              // height="100%"
              // width="100%"
              // height="80vh"
              />
          </div>

          {/* </SplitterPanel>
          <SplitterPanel className="flex flex-column align-items-center justify-content-center" style={{position: 'relative'}}> */}
            {/* <ScrollPanel style={{
              //  width: '100%', height: '200px' 
            }} className="custombar2"> */}
            <div style={{
              display: state.view.logs ? undefined : 'none',
              overflowY: 'scroll',
              height: 'calc(min(200px, 30vh))',
              // position: 'relative',
              // maxWidth: '100%',
              // maxWidth: '50vw',
            }}>
              <pre><code id="logs" style={{
                // maxWidth: '200px'
              }}>{state.lastCheckerRun?.logText ?? 'No log yet!'}</code></pre>
            </div>
            {/* </ScrollPanel> */}
            {/* <div className="logs-container">
            </div> */}
          {/* </SplitterPanel>
      </Splitter> */}
      {/* </SplitPane> */}
      {/* </div> */}
    
    </div>
  )
}
