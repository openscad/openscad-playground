// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext } from 'react';
import { TreeSelect } from 'primereact/treeselect';
import { TreeNode } from 'primereact/treenode';
import { ModelContext, FSContext } from './contexts.ts';
import { getParentDir, join } from '../fs/filesystem.ts';
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

export default function FilePicker({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const state = model.state;

  const fs = useContext(FSContext);

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
                model.openFile(key);
              }
            }
          }}
          filter
          style={style}
          options={fsItems} />
  )
}
