// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext, useEffect, useState } from 'react';
import { TreeSelect } from 'primereact/treeselect';
import { TreeNode } from 'primereact/treenode';
import { ModelContext, FSContext } from './contexts.ts';
import { getParentDir, isArchiveMounted, join, onLibrariesMounted, whenLibrariesMounted } from '../fs/filesystem.ts';
import { getLoadedLibraryIndex, LibraryIndex, loadLibraryIndex } from '../fs/library-index.ts';
import { getRequiredArchives } from '../fs/archive-deps.ts';
import { defaultSourcePath } from '../state/initial-state.ts';
import { zipArchives } from '../fs/zip-archives.ts';

const biasedCompare = (a: string, b: string) => 
  a === 'openscad' ? -1 : b === 'openscad' ? 1 : a.localeCompare(b);

function listFilesAsNodes(fs: FS, path: string, accept?: (path: string) => boolean): TreeNode[] {
  const files: [string, string][] = []
  const dirs: [string, string][] = []
  for (const name of fs.readdirSync(path)) {
    if (name.startsWith('.')) {
      continue;
    }
    const childPath = join(path, name);
    if (accept && !accept(childPath)) {
      continue;
    }
    const stat = fs.lstatSync(childPath);
    const isDirectory = stat.isDirectory();
    if (!isDirectory && !name.endsWith('.scad')) {
      continue;
    }
    (isDirectory ? dirs : files).push([name, childPath]);
  }
  [files, dirs].forEach(arr => arr.sort(([a], [b]) => biasedCompare(a, b)));

  const nodes: TreeNode[] = []
  for (const [arr, isDirectory] of [[files, false], [dirs, true]] as [[string, string][], boolean][]) {
    for (const [name, path] of arr) {
      let children: TreeNode[] = [];
      let label = name;
      if (path.lastIndexOf('/') === 0) {
        const config = zipArchives[name];
        if (config && config.gitOrigin) {
          const repoUrl = config.gitOrigin.repoUrl;
          if (!children) children = [];

          children.push({
            icon: 'pi pi-github',
            label: repoUrl.replaceAll("https://github.com/", ''),
            key: repoUrl,
            selectable: true,
          });

          for (const [label, link] of Object.entries(config.docs ?? [])) {
            children.push({
              icon: 'pi pi-book',
              label,
              key: link,
              selectable: true,
            });
          }
        }
      }

      if (isDirectory) {
        children = [...children, ...listFilesAsNodes(fs, path, accept)];
        if (children.length == 0) {
          continue;
        }
      }

      nodes.push({
        icon: isDirectory ? 'pi pi-folder' : path === defaultSourcePath ? 'pi pi-home' : 'pi pi-file',
        label,
        data: path,
        key: path,
        children,
        selectable: !isDirectory
      });
    }
  }
  return nodes;
}

const LIBRARIES = '/libraries';

/** A tree of "not loaded yet" nodes for the .scad files of a library, from the build-time index. */
function nodesFromIndex(library: string, files: [string, number][]): TreeNode {
  type Dir = {dirs: Map<string, Dir>, files: string[]};
  const root: Dir = {dirs: new Map(), files: []};
  for (const [path] of files) {
    const parts = path.split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let child = dir.dirs.get(part);
      if (!child) dir.dirs.set(part, child = {dirs: new Map(), files: []});
      dir = child;
    }
    dir.files.push(parts[parts.length - 1]);
  }
  const convert = (dir: Dir, path: string): TreeNode[] => [
    ...dir.files.sort(biasedCompare).map(name => ({
      icon: 'pi pi-file',
      label: name,
      data: `${path}/${name}`,
      key: `${path}/${name}`,
      selectable: true,
    })),
    ...[...dir.dirs.entries()].sort(([a], [b]) => biasedCompare(a, b)).map(([name, child]) => ({
      icon: 'pi pi-folder',
      label: name,
      data: `${path}/${name}`,
      key: `${path}/${name}`,
      children: convert(child, `${path}/${name}`),
      selectable: false,
    })),
  ];
  const path = `${LIBRARIES}/${library}`;
  return {icon: 'pi pi-cloud-download', label: library, data: path, key: path, children: convert(root, path), selectable: false};
}

/** Adds the libraries that aren't mounted (yet) to the tree, as listed by the index. */
function addUnmountedLibraries(nodes: TreeNode[], index: LibraryIndex) {
  let root = nodes.find(n => n.key === LIBRARIES);
  const present = new Set((root?.children ?? []).map(c => c.label));
  const missing = Object.keys(index).filter(n => n in zipArchives && !present.has(n));
  if (missing.length === 0) {
    return;
  }
  if (!root) {
    nodes.push(root = {icon: 'pi pi-folder', label: 'libraries', data: LIBRARIES, key: LIBRARIES, children: [], selectable: false});
  }
  root.children = [...(root.children ?? []), ...missing.map(n => nodesFromIndex(n, index[n].files))]
    .sort((a, b) => biasedCompare(a.label ?? '', b.label ?? ''));
}

export default function FilePicker({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const state = model.state;

  const fs = useContext(FSContext);

  // Re-list the files once the (deferred) library archives are mounted.
  const [, setMountedCount] = useState(0);
  useEffect(() => onLibrariesMounted(() => setMountedCount(n => n + 1)), []);

  const [index, setIndex] = useState<LibraryIndex>(getLoadedLibraryIndex() ?? {});
  useEffect(() => { loadLibraryIndex().then(setIndex); }, []);

  // Opening a file of a library that isn't mounted yet fetches it first.
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = async (key: string) => {
    const needed = key.startsWith(`${LIBRARIES}/`) ? getRequiredArchives([], [key]).filter(n => !isArchiveMounted(n)) : [];
    if (needed.length > 0) {
      setLoading(needed.join(', '));
      await whenLibrariesMounted(needed);
      setLoading(null);
      if (needed.some(n => !isArchiveMounted(n))) {
        setError(`Could not load ${needed.join(', ')}: are you offline?`);
        setTimeout(() => setError(null), 8000);
        return;
      }
    }
    model.openFile(key);
  };

  // Controlled, otherwise the tree collapses whenever the app re-renders (the options are rebuilt).
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const fsItems: TreeNode[] = [];
  for (const {path} of state.params.sources) {
    const parent = getParentDir(path);
    if (parent === '/') {
      fsItems.push({
        icon: 'pi pi-home',
        label: path.split('/').pop(),
        data: path,
        key: path,
        selectable: true,
      });
    }
  }
  if (fs) {
    fsItems.push(...listFilesAsNodes(fs, '/'));
  }
  addUnmountedLibraries(fsItems, index);

  return (
      <TreeSelect 
          className={className}
          title='OpenSCAD Playground Files'
          value={state.params.activePath}
          resetFilterOnHide={true}
          filterBy="key"
          onChange={e => {
            const key = e.value;
            if (typeof key === 'string') {
              if (key.startsWith('https://')) {
                window.open(key, '_blank')
              } else {
                open(key);
              }
            }
          }}
          valueTemplate={(node: TreeNode | TreeNode[] | null, props: {placeholder?: string}) => {
            if (loading) return <span><i className="pi pi-spin pi-spinner" /> Loading {loading}...</span>;
            if (error) return <span title={error}><i className="pi pi-exclamation-triangle" /> {error}</span>;
            const selected = Array.isArray(node) ? node[0] : node;
            return <span>{selected?.label ?? props.placeholder}</span>;
          }}
          filter
          expandedKeys={expandedKeys}
          onToggle={e => setExpandedKeys(e.value as Record<string, boolean>)}
          style={style}
          options={fsItems} />
  )
}
