// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { checkSyntax, render, RenderArgs, RenderOutput } from "../runner/actions";
import { MultiLayoutComponentId, SingleLayoutComponentId, Source, State, StatePersister } from "./app-state";
import { VALID_EXPORT_FORMATS_2D, VALID_EXPORT_FORMATS_3D, VALID_RENDER_FORMATS } from './formats';
import { bubbleUpDeepMutations } from "./deep-mutate";
import { downloadUrl, fetchSource, formatBytes, formatMillis, readFileAsDataURL } from '../utils'

import JSZip from 'jszip';
import { ProcessStreams } from "../runner/openscad-runner";
import { is2DFormatExtension } from "./formats";
import { parseOff } from "../io/import_off";
import { exportGlb } from "../io/export_glb";
import { export3MF } from "../io/export_3mf";
import chroma from "chroma-js";

export class Model {
  constructor(private fs: FS, public state: State, private setStateCallback?: (state: State) => void, 
    private statePersister?: StatePersister) {
  }
  
  init() {
    if (!this.state.output && !this.state.lastCheckerRun && !this.state.previewing && !this.state.checkingSyntax && !this.state.rendering &&
        this.source.trim() != '') {
      this.processSource();
    }
  }

  private setState(state: State) {
    this.state = state;
    this.statePersister && this.statePersister.set(state);
    this.setStateCallback && this.setStateCallback(state);
  }

  mutate(f: (state: State) => void) {
    const mutated = bubbleUpDeepMutations(this.state, f);
    // No matter how deep the mutation happened, the top-level object's identity
    // will have changed iff the mutated values are different.
    if (mutated !== this.state) {
      this.setState(mutated);
      return true;
    }

    return false;
  }

  setFormats(
      exportFormat2D: keyof typeof VALID_EXPORT_FORMATS_2D | undefined,
      exportFormat3D: keyof typeof VALID_EXPORT_FORMATS_3D | undefined) {
    this.mutate(s => {
      if (exportFormat2D != null) s.params.exportFormat2D = exportFormat2D;
      if (exportFormat3D != null) s.params.exportFormat3D = exportFormat3D;
    });
  }
  setVar(name: string, value: any) {
    this.mutate(s => s.params.vars = {...s.params.vars ?? {}, [name]: value});
    this.render({isPreview: true, now: false});
  }

  set logsVisible(value: boolean) {
    if (value) {
      if (this.state.view.layout.mode === 'single') {
        this.changeSingleVisibility('editor');
      } else {
        this.changeMultiVisibility('editor', true);  
      }
    }
    this.mutate(s => s.view.logs = value);
  }

  isComponentFullyVisible(id: SingleLayoutComponentId) {
    if (this.state.view.layout.mode === 'multi') {
      return this.state.view.layout[id];
    } else {
      return this.state.view.layout.focus === id;
    }
  }

  changeLayout(mode: 'multi' | 'single') {
    if (this.state.view.layout.mode === mode) return;
    this.mutate(s => {
      s.view.layout = s.view.layout.mode === 'multi'
        ? {
          mode: 'single',
          focus: s.view.layout.editor ? 'editor' : s.view.layout.viewer ? 'viewer' : 'customizer'
        }
        : {
          mode: 'multi',
          editor: s.view.layout.focus === 'editor',
          viewer: s.view.layout.focus === 'viewer',
          customizer: s.view.layout.focus === 'customizer',
        }
    });
  }
  changeSingleVisibility(focus: SingleLayoutComponentId) {
    this.mutate(s => {
      if (s.view.layout.mode !== 'single') throw new Error('Wrong mode');
      s.view.layout.focus = focus;
      if (focus !== 'editor') {
        s.view.logs = false;
      }
    });
  }

  changeMultiVisibility(target: MultiLayoutComponentId, visible: boolean) {
    this.mutate(s => {
      if (s.view.layout.mode !== 'multi') throw new Error('Wrong mode');
      s.view.layout[target] = visible
      if ((s.view.layout.customizer ? 1 : 0) + (s.view.layout.editor ? 1 : 0) + (s.view.layout.viewer ? 1 : 0) == 0) {
        // Select at least one panel
        // s.view.layout.editor = true;
        s.view.layout[target] = !visible;
        if (target === 'editor' && !visible) {
          s.view.logs = false;
        }
      }
    })
  }

  openFile(path: string) {
    // alert(`TODO: open ${path}`);
    if (this.mutate(s => {
      if (s.params.activePath != path) {
        s.params.activePath = path;
        if (!s.params.sources.find(src => src.path === path)) {
          let content = '';
          try {
            content = new TextDecoder("utf-8").decode(this.fs.readFileSync(path));
          } catch (e) {
            console.error('Error while reading file:', e);
          }
          s.params.sources = [...s.params.sources, {path, content}];
        }
        s.lastCheckerRun = undefined;
        s.output = undefined;
        s.export = undefined;
      }
    })) {
      this.processSource();
    }
  }

  get source(): string {
    return this.state.params.sources.find(src => src.path === this.state.params.activePath)?.content ?? '';
  }
  set source(source: string) {
    if (this.mutate(s => s.params.sources = s.params.sources.map(src => src.path === s.params.activePath ? {path: src.path, content: source} : src))) {
      this.processSource();
    }
  }

  private processSource() {
    // const params = this.state.params;
    // if (isFileWritable(params.sourcePath)) {
      // const absolutePath = params.sourcePath.startsWith('/') ? params.sourcePath : `/${params.sourcePath}`;
    // this.fs.writeFile(params.sourcePath, params.source);
    // }
    if (this.state.params.activePath.endsWith('.scad')) {
      this.checkSyntax();
    }
    this.render({isPreview: true, now: false});
  }

  async checkSyntax() {
    this.mutate(s => s.checkingSyntax = true);
    try {
      const checkerRun = await checkSyntax({
        activePath: this.state.params.activePath,
        sources: this.state.params.sources,
      })({now: false});
      this.mutate(s => {
        s.lastCheckerRun = checkerRun;
        s.parameterSet = checkerRun?.parameterSet;
        s.checkingSyntax = false;
      });
    } catch (err) {
      console.error('Error while checking syntax:', err)
    }
  }

  rawStreamsCallback(ps: ProcessStreams) {
    this.mutate(s => {
      if ('stdout' in ps) {
        s.currentRunLogs?.push(['stdout', ps.stdout]);
      } else {
        s.currentRunLogs?.push(['stderr', ps.stderr]);
      }
    });
  }

  async export() {
    if (this.state.output) {
      const normalPassThrough = 
        (this.state.is2D && this.state.params.exportFormat2D === 'svg')
        || (!this.state.is2D && this.state.params.exportFormat3D === 'off');

      const glbPassThrough =
        (!this.state.is2D && this.state.params.exportFormat3D === 'glb')
        && (this.state.output.displayFile?.name.endsWith('.glb') ?? false)
        && (this.state.output.displayFileURL != null);

      if (normalPassThrough || glbPassThrough) {
        this.mutate(s => s.export = s.output);
        if (glbPassThrough) {
          downloadUrl(this.state.output.displayFileURL!, this.state.output.displayFile!.name);
        } else {
          downloadUrl(this.state.output.outFileURL, this.state.output.outFile.name);
        }
        return;
      }
    }
    if (!this.state.is2D && this.state.params.exportFormat3D == '3mf' && !this.state.params.extruderColors) {
      this.mutate(s => this.state.view.extruderPickerVisibility = 'exporting');
      return;
    }
    this.mutate(s => {
      s.currentRunLogs ??= [];
      s.exporting = true;
    });

    if (!this.state.output?.outFile || !this.state.output?.outFileURL) {
      throw new Error('No output file to export');
    }

    const {features, exportFormat2D, exportFormat3D} = this.state.params;
    const exportFormat = this.state.is2D ? exportFormat2D : exportFormat3D;

    try {
      let output: RenderOutput;
      if (exportFormat === '3mf') {
        const start = performance.now();
        const data = parseOff(await this.state.output.outFile.text());
        const exportedData = export3MF(data, this.state.params.extruderColors?.map(c => chroma(c)));
        const elapsedMillis = performance.now() - start;
        output = {
          outFile: new File([exportedData], this.state.output.outFile.name.replace('.off', '.3mf')),
          elapsedMillis,
          logText: '',
          markers: [],
        };
      } else {
        output = await render({
          mountArchives: false,
          scadPath: '/export.scad',
          sources: [
            {
              path: '/export.scad',
              content: `import("${this.state.output?.outFile.name}");`
            },
            {
              path: this.state.output?.outFile.name,
              url: this.state.output?.outFileURL,
            }
          ],
          extraArgs: [], isPreview: false,
          features,
          renderFormat: exportFormat,
          streamsCallback: ps => console.log('Export', JSON.stringify(ps)),
        })({now: true});
      }
      
      const outFileURL = URL.createObjectURL(output.outFile);
      this.mutate(s => {
        s.exporting = false;
        if (s.export?.outFileURL?.startsWith('blob:') ?? false) {
          URL.revokeObjectURL(s.export!.outFileURL);
        }
        s.export = {
          outFile: output.outFile,
          outFileURL,
          elapsedMillis: output.elapsedMillis,
          formattedElapsedMillis: formatMillis(output.elapsedMillis),
          formattedOutFileSize: formatBytes(output.outFile.size),
        };
        downloadUrl(s.export.outFileURL, output.outFile.name);
      });
    } catch (err) {
      this.mutate(s => {
        s.exporting = false;
        console.error('Error while exporting:', err)
        s.error = `${err}`;
      });
    }
  }

  async saveProject() {
    if (this.state.params.sources.length == 1) {
      const content = this.state.params.sources[0].content;
      const contentBytes = new TextEncoder().encode(content);
      const blob = new Blob([contentBytes], {type: 'text/plain'});
      const file = new File([blob], this.state.params.activePath.split('/').pop()!);
      downloadUrl(URL.createObjectURL(file), file.name);
    } else {
      const zip = new JSZip();
      for (const source of this.state.params.sources) {
        let path = source.path
        if (path.startsWith('/')) {
          path = path.substring(1);
        }
        zip.file(path, await fetchSource(source));
      }
      zip.generateAsync({type: 'blob'}).then(blob => {
        const file = new File([blob], 'project.zip');
        downloadUrl(URL.createObjectURL(file), file.name);
      });
    }
  }

  async render({isPreview, mountArchives, now, retryInOtherDim}: {isPreview: boolean, mountArchives?: boolean, now: boolean, retryInOtherDim?: boolean}) {
    mountArchives ??= true;
    retryInOtherDim ??= true;
    const setRendering = (s: State, value: boolean) => {
      if (isPreview) {
        s.previewing = value;
      } else {
        s.rendering = value;
      }
    }
    this.mutate(s => {
      s.currentRunLogs = [];
      setRendering(s, true);
    });

    let {
      activePath,
      sources,
      vars,
      features,
    } = this.state.params;

    let is2D = this.state.is2D;

    const extension = activePath.split('.').pop() ?? '';
    if (!activePath.endsWith('.scad')) {
      const resourcePath = activePath;
      const loaderPath = '/load-resource.scad';
      is2D = is2DFormatExtension(extension);
      
      mountArchives = false;
      activePath = loaderPath;
      sources = [
        {
          path: activePath,
          content: `${is2D ? 'linear_extrude(1) ' : ''} import("${resourcePath}");`,
        },
        ...sources.filter(s => s.path === resourcePath),
      ];
    }

    const renderArgs: RenderArgs = {
      mountArchives,
      scadPath: activePath,
      sources,
      vars,
      features,
      isPreview,
      renderFormat: this.state.is2D ? 'svg' : 'off',
      streamsCallback: this.rawStreamsCallback.bind(this)
    };
    try {
      let output = await render(renderArgs)({now});
      let displayFile = output.outFile;
      if (output.outFile.name.endsWith('.svg') || output.outFile.name.endsWith('.dxf')) {
        is2D = true;
        const fn = output.outFile.name;
        const extrudedOutput = await render({
          mountArchives: false,
          scadPath: '/extruded.scad',
          sources: [
            {
              path: '/extruded.scad',
              content: `linear_extrude(0.1) import("${fn}");`,
            },
            {
              path: `/${fn}`,
              url: await readFileAsDataURL(output.outFile),
            },
          ],
          vars: {},
          features,
          isPreview: false,
          renderFormat: 'off',
          streamsCallback: this.rawStreamsCallback.bind(this)
        })({now});
        displayFile = extrudedOutput.outFile;
      } else {
        is2D = false;
      }
      if (displayFile.name.endsWith('.off')) {
        const offData = parseOff(await displayFile.text());
        displayFile = new File([await exportGlb(offData)], displayFile.name.replace('.off', '.glb'));
      }
      const outFileURL = URL.createObjectURL(output.outFile);
      const displayFileURL = displayFile && await readFileAsDataURL(displayFile);
      this.mutate(s => {
        setRendering(s, false);
        s.error = undefined;
        s.is2D = is2D;
        s.lastCheckerRun = {
          logText: output.logText,
          markers: output.markers,
        }
        if (s.output?.outFileURL?.startsWith('blob:') ?? false) {
          URL.revokeObjectURL(s.output!.outFileURL);
        }
        if (s.output?.displayFileURL?.startsWith('blob:') ?? false) {
          URL.revokeObjectURL(s.output!.displayFileURL!);
        }

        s.output = {
          isPreview: isPreview,
          outFile: output.outFile,
          outFileURL,
          displayFile,
          displayFileURL,
          elapsedMillis: output.elapsedMillis,
          formattedElapsedMillis: formatMillis(output.elapsedMillis),
          formattedOutFileSize: formatBytes(output.outFile.size),
        };

        if (!isPreview) {
          const audio = document.getElementById('complete-sound') as HTMLAudioElement;
          audio?.play();
        }
      });
    } catch (err) {
      this.mutate(s => {
        setRendering(s, false);
        console.error('Error while doing ' + (isPreview ? 'preview' : 'rendering') + ':', err)
        s.error = `${err}`;
      });
    }
    if (retryInOtherDim) {
      let is2D: boolean | undefined;
      let is3D: boolean | undefined;
      let isMixed: boolean | undefined;
      for (const [pipe, line] of this.state.currentRunLogs ?? []) {
        if (line == 'Current top level object is not a 3D object.') {
          is3D = false;
        } else if (line == 'Top level object is a 3D object:') {
          is3D = true;
        } else if (line == 'Current top level object is not a 2D object.') {
          is2D = false;
        } else if (line == 'Top level object is a 2D object:') {
          is2D = true;
        } else if (line.includes('WARNING: Mixing 2D and 3D objects is not supported')) {
          isMixed = true;
        }
      }
      if (is2D === false || is3D === false) {//} || isMixed !== undefined) {
        this.mutate(s => s.is2D = !(is2D === false));
        this.render({isPreview, now: true, retryInOtherDim: false});
        return;
      }
    }
  }
}
