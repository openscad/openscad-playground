// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { checkSyntax, render, renderIsolated, RenderArgs, RenderOutput } from "../runner/actions.ts";
import { MultiLayoutComponentId, SingleLayoutComponentId, State, StatePersister } from "./app-state.ts";
import { VALID_EXPORT_FORMATS_2D, VALID_EXPORT_FORMATS_3D } from './formats.ts';
import { bubbleUpDeepMutations } from "./deep-mutate.ts";
import { downloadUrl, fetchSource, formatBytes, formatMillis, readFileAsDataURL, SupersededError } from '../utils.ts'

import JSZip from 'jszip';
import { ProcessStreams } from "../runner/openscad-runner.ts";
import { whenLibrariesMounted } from "../fs/filesystem.ts";
import { getRequiredArchives } from "../fs/archive-deps.ts";
import { is2DFormatExtension } from "./formats.ts";
import { parseOff } from "../io/import_off.ts";
import { exportGlb } from "../io/export_glb.ts";
import { export3MF } from "../io/export_3mf.ts";
import chroma from "chroma-js";
import type { ExportFormat } from "./export-logic.ts";

const githubRx = /^https:\/\/github.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/;

export class Model {
  // Call counters: every check/render call supersedes the previous one (the job runner cancels the older job and
  // rejects its promise), so only the newest call may touch the busy flags or publish its output. Otherwise an
  // older call finishing (or being cancelled) leaves `previewing`/`checkingSyntax` stuck or clears them early.
  private renderGen = 0;
  private syntaxGen = 0;

  constructor(private fs: FS, public state: State, private setStateCallback?: (state: State) => void, 
    private statePersister?: StatePersister) {
  }
  
  init() {
    if (!this.state.output && !this.state.lastCheckerRun && !this.state.previewing && !this.state.checkingSyntax && !this.state.rendering) {
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

  /**
   * Customizer path shared by the UI and the MCP tools: set several values,
   * skipping those that already match (some inputs report their initial value
   * on mount, which must not trigger a render), with a single preview render.
   * Returns whether anything changed.
   */
  setVars(values: {[name: string]: any}): boolean {
    const current = (name: string) => this.state.params.vars?.[name]
      ?? this.state.parameterSet?.parameters.find(p => p.name === name)?.initial;
    const changed = Object.entries(values).filter(([name, v]) => JSON.stringify(current(name)) !== JSON.stringify(v));
    if (changed.length === 0) return false;
    this.mutate(s => s.params.vars = {...s.params.vars ?? {}, ...Object.fromEntries(changed)});
    this.render({isPreview: true, now: false});
    return true;
  }

  /** Drop customizer overrides (all, or the named ones) back to the source defaults. Returns whether anything changed. */
  resetVars(names?: string[]): boolean {
    const vars = this.state.params.vars ?? {};
    const targets = (names ?? Object.keys(vars)).filter(n => n in vars);
    if (targets.length === 0) return false;
    this.mutate(s => {
      const next = {...s.params.vars};
      for (const n of targets) delete next[n];
      s.params.vars = next;
    });
    this.render({isPreview: true, now: false});
    return true;
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
    // console.log(`openFile: ${path}`);
    if (this.mutate(s => {
      if (s.params.activePath != path) {
        const readSource = (path: string) => {
          try {
            return new TextDecoder("utf-8").decode(this.fs.readFileSync(path));
          } catch (e) {
            console.error('Error while reading file:', e);
            return '';
          }
        };
        // Remove source of previous active path if it's unmodified
        const activePathContent = readSource(s.params.activePath);
        s.params.sources = s.params.sources.filter(src => src.path !== s.params.activePath || src.content != activePathContent);

        s.params.activePath = path;
        if (!s.params.sources.find(src => src.path === path)) {
          const content = readSource(path);
          s.params.sources = [...s.params.sources, {path, content}];
        }
        s.lastCheckerRun = undefined;
        s.output = undefined;
        s.export = undefined;
        s.preview = undefined;
        s.currentRunLogs = undefined;
        s.error = undefined;
        s.is2D = undefined;
        console.log('Opened file:', path);
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

  async processSource() {
    let src = this.state.params.sources.find(src => src.path === this.state.params.activePath);
    if (src && src.content == null) {
      let {path, url} = src;
      // Transform https://github.com/tenstad/keyboard/blob/main/keyboard.scad to https://raw.githubusercontent.com/tenstad/keyboard/refs/heads/main/keyboard.scad
      let match;
      if (url && (match = url.match(githubRx))) {
        url = `https://raw.githubusercontent.com/${match[1]}/${match[2]}/refs/heads/${match[3]}`;
      }
      if (!url) {
        // Reading from the file system: the library archives must be mounted.
        await whenLibrariesMounted(getRequiredArchives([], [path]));
      }
      const content = new TextDecoder().decode(await fetchSource(this.fs, {path, url}));
      this.mutate(s => {
        s.params.sources = s.params.sources.map(src => src.path === s.params.activePath ? {...src, content} : src);
      });
    }
    if (this.source.trim() !== '') {
      if (this.state.params.activePath.endsWith('.scad')) {
        this.checkSyntax();
      }
      this.render({isPreview: true, now: false});
    }
  }

  async checkSyntax() {
    const gen = ++this.syntaxGen;
    this.mutate(s => s.checkingSyntax = true);
    try {
      const checkerRun = await checkSyntax({
        activePath: this.state.params.activePath,
        sources: this.state.params.sources,
      })({now: false});
      if (gen !== this.syntaxGen) return; // a newer check owns the result and the flag
      this.mutate(s => {
        s.lastCheckerRun = checkerRun;
        s.parameterSet = checkerRun?.parameterSet;
        s.checkingSyntax = false;
      });
    } catch (err) {
      if (err instanceof SupersededError || gen !== this.syntaxGen) return;
      console.error('Error while checking syntax:', err)
      // Clear the flag or everything that waits for idle (e.g. MCP tool
      // handlers) blocks on its timeout forever after a checker failure.
      this.mutate(s => s.checkingSyntax = false);
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
        output = await renderIsolated({
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

  /**
   * Produce the current model in `format` as a File, without downloading it
   * (the delivery channel is the caller's business: browser download, MCP host
   * download, ...). Same conversions as export(): OFF/SVG/GLB come straight
   * from the render, 3MF is built from the OFF, STL/DXF go through OpenSCAD.
   */
  async exportFile(format: ExportFormat): Promise<File> {
    const out = this.state.output;
    if (!out?.outFile || !out.outFileURL) throw new Error('No rendered model to export yet');
    const stem = out.outFile.name.replace(/\.[^.]+$/, '');
    const is2D = !!this.state.is2D;
    if ((is2D && format === 'svg') || (!is2D && format === 'off')) return out.outFile;
    if (!is2D && format === 'glb') {
      if (out.displayFile?.name.endsWith('.glb')) return out.displayFile;
      return new File([await exportGlb(parseOff(await out.outFile.text()))], `${stem}.glb`);
    }
    if (format === '3mf') {
      const data = parseOff(await out.outFile.text());
      const colors = this.state.params.extruderColors?.map(c => chroma(c));
      return new File([export3MF(data, colors)], `${stem}.3mf`);
    }
    const result = await renderIsolated({
      mountArchives: false,
      scadPath: '/export.scad',
      sources: [
        { path: '/export.scad', content: `import("${out.outFile.name}");` },
        { path: out.outFile.name, url: out.outFileURL },
      ],
      extraArgs: [], isPreview: false,
      features: this.state.params.features,
      renderFormat: format as 'stl' | 'dxf',
      streamsCallback: ps => console.log('Export', JSON.stringify(ps)),
    })({now: true});
    return result.outFile;
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
        zip.file(path, await fetchSource(this.fs, source));
      }
      zip.generateAsync({type: 'blob'}).then(blob => {
        const file = new File([blob], 'project.zip');
        downloadUrl(URL.createObjectURL(file), file.name);
      });
    }
  }

  async render({isPreview, mountArchives, now, retryInOtherDim}: {isPreview: boolean, mountArchives?: boolean, now: boolean, retryInOtherDim?: boolean}) {
    // console.log(JSON.stringify(this.state, null, 2));
    mountArchives ??= true;
    retryInOtherDim ??= true;
    const setRendering = (s: State, value: boolean) => {
      if (isPreview) {
        s.previewing = value;
      } else {
        s.rendering = value;
      }
    }
    // This call supersedes any older one (see renderGen): its busy flag replaces the older call's.
    const gen = ++this.renderGen;
    this.mutate(s => {
      s.currentRunLogs = [];
      s.previewing = isPreview;
      s.rendering = !isPreview;
    });

    let {
      activePath,
      sources,
      vars,
      features,
    } = this.state.params;

    let is2D = this.state.is2D;

    // An empty file yields no output and a baffling "Failed to read output file": say what is wrong instead.
    if (activePath.endsWith('.scad') && (sources.find(src => src.path === activePath)?.content ?? '').trim() === '') {
      this.mutate(s => {
        setRendering(s, false);
        s.error = 'The source is empty: nothing to render';
      });
      return;
    }

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
      if (gen !== this.renderGen) return;
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
      if (gen !== this.renderGen) return;
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
      if (err instanceof SupersededError || gen !== this.renderGen) return;
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
