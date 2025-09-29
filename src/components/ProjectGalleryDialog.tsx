import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { ModelContext, FSContext } from './contexts.ts';
import { join } from '../fs/filesystem.ts';
import './ProjectGalleryDialog.css';

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
  const toolbar = (
    <div className="gallery-toolbar">
      <div className="gallery-field">
        <span>Search</span>
        <div className="gallery-input-group">
          <svg
            className="gallery-input-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            focusable="false"
          >
            <path
              d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm9.707 12.293-3.387-3.387a1 1 0 1 0-1.414 1.414l3.387 3.387a1 1 0 0 0 1.414-1.414z"
              fill="currentColor"
            />
          </svg>
          <input
            type="search"
            value={searchTerm}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
            placeholder="Search by name, tags, or description"
            className="gallery-input"
            aria-label="Search projects"
          />
        </div>
      </div>
      {categories.length > 0 && (
        <div className="gallery-field">
          <span>Category</span>
          <select
            value={selectedCategory ?? ''}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              const value = event.target.value;
              setSelectedCategory(value ? value : null);
            }}
            className="gallery-select"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const body = loading ? (
    <div className="gallery-placeholder" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm6.364 3.636a1 1 0 0 1 0 1.414l-2.829 2.828a1 1 0 0 1-1.414-1.414l2.829-2.828a1 1 0 0 1 1.414 0zM21 11a1 1 0 1 1 0 2h-4a1 1 0 1 1 0-2h4zm-3.636 6.364a1 1 0 0 1-1.414 0l-2.829-2.828a1 1 0 0 1 1.414-1.414l2.829 2.828a1 1 0 0 1 0 1.414zM13 21a1 1 0 1 1-2 0v-4a1 1 0 1 1 2 0v4zm-6.364-3.636a1 1 0 0 1-1.414 0 1 1 0 0 1 0-1.414l2.828-2.829a1 1 0 0 1 1.414 1.414L6.636 17.364zM7 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h4zm2.05-5.657a1 1 0 0 1 1.414 0l2.829 2.828a1 1 0 0 1-1.414 1.414L9.05 6.757a1 1 0 0 1 0-1.414z"
          fill="currentColor"
        />
      </svg>
      <span>Loading projects…</span>
    </div>
  ) : filteredProjects.length > 0 ? (
    <div className="gallery-grid">
      {filteredProjects.map(project => {
        const displayedTags = (project.tags ?? []).slice(0, 4);
        const extraTags = project.tags && project.tags.length > 4 ? project.tags.length - 4 : 0;

        return (
          <article
            key={project.id}
            className="gallery-card"
            role="button"
            tabIndex={0}
            aria-label={`Open ${project.title}`}
            onClick={() => openProject(project)}
            onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openProject(project);
              }
            }}
          >
            {project.image && (
              <div className="gallery-card-image">
                <img src={project.image} alt={`${project.title} preview`} loading="lazy" />
              </div>
            )}
            <div className="gallery-card-body">
              <div className="gallery-card-title">{project.title}</div>
              {project.description && (
                <p className="gallery-card-description">{project.description}</p>
              )}
              <div className="gallery-card-meta">
                <span>
                  Entry: <code>{project.entry}</code>
                </span>
                {project.category && <span>Category: {project.category}</span>}
                {project.author && <span>Author: {project.author}</span>}
              </div>
            </div>
            {(displayedTags.length > 0 || extraTags > 0) && (
              <div className="gallery-tags">
                {displayedTags.map(tag => (
                  <span key={tag} className="gallery-tag">
                    {tag}
                  </span>
                ))}
                {extraTags > 0 && (
                  <span className="gallery-tag">+{extraTags}</span>
                )}
              </div>
            )}
            <div className="gallery-card-footer">
              <button
                type="button"
                className="gallery-button"
                onClick={(event) => {
                  event.stopPropagation();
                  openProject(project);
                }}
              >
                <span>Open</span>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </article>
        );
      })}
    </div>
  ) : (
    <div className="gallery-placeholder">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 5a2 2 0 0 1 2-2h6l2 2h6a2 2 0 0 1 2 2v1H4V5Zm18 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9h18Zm-11 3H7v2h4v-2Zm8 0h-6v2h6v-2Z"
          fill="currentColor"
        />
      </svg>
      <span>No projects match the current filters.</span>
    </div>
  );

  const content = (
    <div className="gallery-view">
      {toolbar}
      {error && (
        <div className="gallery-error">{error}</div>
      )}
      {body}
    </div>
  );

  if (variant === 'fullscreen') {
    if (!visible) return null;

    const showCloseButton = mode !== 'standalone';

    return (
      <div
        className="gallery-fullscreen-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-title"
      >
        <div className="gallery-fullscreen-panel">
          <div className="gallery-fullscreen-inner">
            <header className="gallery-fullscreen-header">
              <div className="gallery-fullscreen-heading">
                <p className="gallery-eyebrow">Model Gallery</p>
                <h2 id="gallery-title">Pick a project to open</h2>
                <p className="gallery-subtitle">
                  Browse curated OpenSCAD models and launch them instantly in the viewer.
                </p>
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  className="gallery-close-button"
                  aria-label="Close gallery"
                  onClick={onHide}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m7 7 10 10" />
                    <path d="M17 7 7 17" />
                  </svg>
                </button>
              )}
            </header>
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
      contentClassName="gallery-dialog-content"
    >
      {content}
    </Dialog>
  );
}
