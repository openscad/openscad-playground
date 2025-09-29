import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { ModelContext, FSContext } from './contexts.ts';
import { join } from '../fs/filesystem.ts';

interface BrowserProject {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  author?: string;
  entry: string;
  scadPath: string;
  image?: string;
}

const MODELS_BASE_PATH = '/libraries/Models';

function safeReadJSON(fs: FS, path: string) {
  const bfs = fs as any;
  try {
    const content = bfs.readFileSync(path, 'utf-8') as string;
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to parse JSON at ${path}:`, error);
    return null;
  }
}

function toDataUrl(fs: any, path: string): string | undefined {
  try {
    const data = fs.readFileSync(path) as Uint8Array;
    const ext = path.split('.').pop()?.toLowerCase();
    if (!ext) return undefined;

    if (ext === 'svg') {
      const text = new TextDecoder().decode(data);
      return `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
    }

    const mime =
      ext === 'png' ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'webp' ? 'image/webp'
      : undefined;

    if (!mime) return undefined;

    let binary = '';
    for (let i = 0; i < data.length; i += 1) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.warn('Failed to read preview asset', path, error);
    return undefined;
  }
}

function findDefaultEntry(fs: FS, directory: string) {
  const bfs = fs as any;
  try {
    const entries = bfs.readdirSync(directory) as string[];
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      if (!name.toLowerCase().endsWith('.scad')) continue;
      const fullPath = join(directory, name);
      try {
        const stat = bfs.lstatSync(fullPath);
        if (stat.isFile()) {
          return name;
        }
      } catch (error) {
        console.warn(`Failed to inspect ${fullPath}:`, error);
      }
    }
  } catch (error) {
    console.warn(`Failed to enumerate ${directory}:`, error);
  }
  return null;
}

function collectProjects(fs: FS): BrowserProject[] {
  const bfs = fs as any;
  let entries: string[] = [];
  try {
    entries = bfs.readdirSync(MODELS_BASE_PATH) as string[];
  } catch (error) {
    console.warn('Models archive not mounted:', error);
    return [];
  }

  const projects: BrowserProject[] = [];

  for (const name of entries) {
    if (name.startsWith('.')) continue;

    const projectDir = join(MODELS_BASE_PATH, name);
    let stats;
    try {
      stats = bfs.lstatSync(projectDir);
    } catch (error) {
      console.warn(`Failed to stat ${projectDir}:`, error);
      continue;
    }
    if (!stats.isDirectory()) {
      continue;
    }

    const projectJson = safeReadJSON(fs, join(projectDir, 'project.json')) ?? {};
    let entry = typeof projectJson.entry === 'string' && projectJson.entry.length > 0
      ? projectJson.entry
      : findDefaultEntry(fs, projectDir);

    let scadPath = entry ? join(projectDir, entry) : undefined;
    if (scadPath) {
      try {
        const stat = bfs.lstatSync(scadPath);
        if (!stat.isFile()) {
          scadPath = undefined;
        }
      } catch {
        scadPath = undefined;
      }
    }

    if (!scadPath) {
      entry = findDefaultEntry(fs, projectDir);
      scadPath = entry ? join(projectDir, entry) : undefined;
    }

    if (!entry || !scadPath) {
      console.warn(`No entry SCAD file found for project ${name}`);
      continue;
    }

    const imageCandidates: string[] = [];
    if (typeof projectJson.image === 'string') imageCandidates.push(projectJson.image);
    if (typeof projectJson.thumbnail === 'string') imageCandidates.push(projectJson.thumbnail);
    imageCandidates.push('thumbnail.png', 'thumbnail.jpg', 'thumbnail.jpeg', 'thumbnail.webp', 'thumbnail.svg');

    let imageData: string | undefined;
    for (const candidate of imageCandidates) {
      const candidatePath = join(projectDir, candidate);
      try {
        const candidateStats = bfs.lstatSync(candidatePath);
        if (candidateStats.isFile()) {
          imageData = toDataUrl(bfs, candidatePath);
          if (imageData) break;
        }
      } catch {
        // ignore missing preview assets
      }
    }

    projects.push({
      id: name,
      title: projectJson.title ?? name,
      description: projectJson.description,
      category: projectJson.category,
      tags: projectJson.tags,
      author: projectJson.author,
      entry,
      scadPath,
      image: imageData,
    });
  }

  return projects.sort((a, b) => a.title.localeCompare(b.title));
}

export function ProjectGalleryDialog({
  visible,
  onHide,
  onOpenProject,
  variant = 'dialog',
  mode = 'embedded',
}: {
  visible: boolean;
  onHide: () => void;
  onOpenProject?: (projectId: string) => void;
  variant?: 'dialog' | 'fullscreen';
  mode?: 'embedded' | 'standalone';
}) {
  const model = useContext(ModelContext);
  const fs = useContext(FSContext);

  const [projects, setProjects] = useState<BrowserProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (!fs) {
      setError('File system is not ready yet.');
      setProjects([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve().then(() => {
      const scanned = collectProjects(fs);
      if (!cancelled) {
        setProjects(scanned);
        if (scanned.length === 0) {
          setError('No projects found in /libraries/Models. Run `make public` to build the archive.');
        }
        setLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error('Failed to load projects:', err);
        setError(err instanceof Error ? err.message : String(err));
        setProjects([]);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [visible, fs]);

  useEffect(() => {
    if (!visible) {
      setSearchTerm('');
      setSelectedCategory(null);
    }
  }, [visible]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(project => {
      if (project.category) set.add(project.category);
    });
    return Array.from(set).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return projects.filter(project => {
      const matchesCategory = !selectedCategory || project.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      const haystack = [
        project.title,
        project.description ?? '',
        project.author ?? '',
        project.category ?? '',
        ...(project.tags ?? []),
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [projects, searchTerm, selectedCategory]);

  const openProject = (project: BrowserProject) => {
    try {
      if (!model || mode === 'standalone') {
        const url = new URL(window.location.href);
        url.searchParams.set('model', project.id);
        window.location.href = url.toString();
        onOpenProject?.(project.id);
        return;
      }

      model.openFile(project.scadPath);

      const url = new URL(window.location.href);
      url.searchParams.set('model', project.id);
      window.history.pushState({}, '', url.toString());

      onOpenProject?.(project.id);
      onHide();
    } catch (err) {
      console.error('Failed to open project:', err);
      setError('Unable to open project. See console for details.');
    }
  };
  const content = loading ? (
    <div className="flex align-items-center justify-content-center" style={{ minHeight: '220px' }}>
      Loading projects...
    </div>
  ) : (
    <div className="flex flex-column gap-3">
      <div className="flex flex-column md:flex-row gap-3 md:align-items-center">
        <span className="p-input-icon-left w-full md:w-20rem">
          <i className="pi pi-search" />
          <InputText
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, tags, or description"
            className="w-full"
          />
        </span>
        <Dropdown
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.value ?? null)}
          options={categories.map(category => ({ label: category, value: category }))}
          placeholder="Filter by category"
          showClear
          className="w-full md:w-16rem"
        />
      </div>

      {error && (
        <div className="text-sm" style={{ color: 'var(--red-500, #c0392b)' }}>
          {error}
        </div>
      )}

      <div className="grid">
        {filteredProjects.map(project => (
          <div key={project.id} className="col-12 sm:col-6 lg:col-4">
            <div
              className="surface-card border-round shadow-1 p-3 h-full flex flex-column gap-3 cursor-pointer"
              onClick={() => openProject(project)}
              style={{ transition: 'box-shadow 0.15s ease-in-out' }}
            >
              {project.image && (
                <div className="border-round overflow-hidden" style={{ background: 'var(--surface-ground)', maxHeight: '180px' }}>
                  <img
                    src={project.image}
                    alt={project.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <div className="flex flex-column gap-1 flex-grow-1">
                <div className="text-lg font-semibold">{project.title}</div>
                {project.description && (
                  <div className="text-sm" style={{ color: 'var(--text-color-secondary, #6c757d)' }}>
                    {project.description}
                  </div>
                )}
                <div className="text-xs" style={{ color: 'var(--text-color-secondary, #6c757d)' }}>
                  Entry: <code>{project.entry}</code>
                </div>
                {project.category && (
                  <div className="text-xs" style={{ color: 'var(--text-color-secondary, #6c757d)' }}>
                    Category: {project.category}
                  </div>
                )}
              </div>
              {project.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {project.tags.slice(0, 4).map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 border-round"
                      style={{
                        fontSize: '0.75rem',
                        background: 'var(--surface-hover, #f2f2f2)',
                        color: 'var(--text-color-secondary, #6c757d)'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  {project.tags.length > 4 && (
                    <span className="px-2 py-1 border-round" style={{ fontSize: '0.75rem', background: 'var(--surface-hover, #f2f2f2)', color: 'var(--text-color-secondary, #6c757d)' }}>
                      +{project.tags.length - 4}
                    </span>
                  )}
                </div>
              )}
              <div className="flex justify-content-end">
                <Button
                  label="Open"
                  icon="pi pi-play"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    openProject(project);
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="flex align-items-center justify-content-center flex-column gap-2" style={{ minHeight: '180px', color: 'var(--text-color-secondary, #6c757d)' }}>
          <i className="pi pi-folder-open text-3xl" />
          <span>No projects match the current filters.</span>
        </div>
      )}
    </div>
  );

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 'clamp(1rem, 4vw, 3rem)',
    overflow: 'auto',
  };

  const panelStyle: React.CSSProperties = {
    width: 'min(1200px, 100%)',
    minHeight: '100%',
    background: 'var(--surface-card, #ffffff)',
    borderRadius: '16px',
    padding: 'clamp(1.5rem, 3vw, 2.5rem)',
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.25)',
  };

  if (variant === 'fullscreen') {
    if (!visible) return null;

    const showCloseButton = mode !== 'standalone';

    return (
      <div style={overlayStyle} className="gallery-fullscreen-overlay">
        <div style={panelStyle} className="gallery-fullscreen-panel flex flex-column gap-3">
          <div className="flex justify-content-between align-items-center">
            <h2 className="m-0">Model Gallery</h2>
            {showCloseButton && (
              <Button
                icon="pi pi-times"
                rounded
                text
                aria-label="Close gallery"
                onClick={onHide}
              />
            )}
          </div>
          <div className="flex flex-column gap-3" style={{ flex: 1, overflow: 'auto' }}>
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog
      header="Model Gallery"
      visible={visible}
      onHide={onHide}
      style={{ width: 'min(1080px, 95vw)' }}
      breakpoints={{ '960px': '98vw' }}
      dismissableMask
    >
      {content}
    </Dialog>
  );
}
