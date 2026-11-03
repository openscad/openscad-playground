/**
 * ChatGPT file-extension entrypoint (OpenAI MCP Extensions, "File Extension
 * Entrypoint"): ChatGPT opens a `.scad` file with this app, passing
 * `{file: {name, resourceUri}}` as tool input. The file is read through the
 * host with standard `resources/read` and, where the host marks it writable,
 * saved back with the `openai/resources/write` request. DOM-free for tests.
 */

export interface HostFile {
  name: string;
  resourceUri: string;
}

export interface HostFileContent {
  text: string;
  etag?: string;
  writable: boolean;
}

/** The slice of App this module needs (kept structural so tests can mock it). */
export interface FileHostApp {
  readServerResource(params: { uri: string; _meta?: Record<string, unknown> }): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string; _meta?: Record<string, unknown> }> }>;
  /** Non-spec methods need a result schema (SDK 2.x): `request(req, resultSchema, options)`. */
  request(req: { method: string; params: unknown }, resultSchema: unknown, options?: unknown): Promise<unknown>;
}

export function parseFileInput(args: unknown): HostFile | null {
  const f = (args as { file?: { name?: unknown; resourceUri?: unknown } } | undefined)?.file;
  if (!f || typeof f.name !== 'string' || !f.name || typeof f.resourceUri !== 'string' || !f.resourceUri.trim()) return null;
  return { name: f.name, resourceUri: f.resourceUri };
}

/** Whether the host intercepts resource reads/writes for entrypoint files. */
export function hasOpenAIResources(hostCapabilities: { experimental?: Record<string, unknown> } | undefined): boolean {
  return !!hostCapabilities?.experimental?.['openai/resource'];
}

export function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function readHostFile(app: FileHostApp, file: HostFile): Promise<HostFileContent> {
  const res = await app.readServerResource({ uri: file.resourceUri, _meta: { 'openai/resource': { representation: 'text' } } });
  const item = res.contents[0];
  if (!item) throw new Error(`The host returned no content for ${file.name}`);
  const text = item.text ?? (item.blob != null ? decodeBase64Utf8(item.blob) : undefined);
  if (text == null) throw new Error(`The host returned no text for ${file.name}`);
  const meta = item._meta?.['openai/resource'] as { etag?: string; writable?: boolean } | undefined;
  return { text, etag: meta?.etag, writable: meta?.writable === true };
}

export type WriteOutcome = { outcome: 'saved'; etag: string } | { outcome: 'conflict'; etag: string } | { outcome: 'too-large'; maxBytes: number };

/**
 * Debounced saver for one opened file. Stops after a conflict or size error
 * (the host's copy is authoritative then), reporting through `onStatus`.
 */
export class HostFileWriter {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSaved: string;
  private etag: string | undefined;
  private stopped = false;
  private pending: string | null = null;
  private writing = false;

  constructor(
    private app: FileHostApp,
    private file: HostFile,
    initial: HostFileContent,
    private resultSchema: unknown,
    private onStatus: (msg: string) => void = () => {},
    private debounceMs = 1000,
  ) {
    this.lastSaved = initial.text;
    this.etag = initial.etag;
    this.stopped = !initial.writable;
  }

  get writable(): boolean { return !this.stopped; }

  /** Call whenever the editor content changes. */
  schedule(content: string): void {
    if (this.stopped || content === this.lastSaved) return;
    this.pending = content;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.writing) return; // the running write re-checks `pending` when it finishes
    this.writing = true;
    try {
      while (!this.stopped && this.pending != null && this.pending !== this.lastSaved) {
        const text = this.pending;
        this.pending = null;
        let result: WriteOutcome;
        try {
          result = await this.app.request({ method: 'openai/resources/write', params: { uri: this.file.resourceUri, text, ...(this.etag ? { ifMatch: this.etag } : {}) } }, this.resultSchema) as WriteOutcome;
        } catch (e) {
          this.stopped = true;
          this.onStatus(`Saving ${this.file.name} failed: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
        if (result.outcome === 'saved') {
          this.lastSaved = text;
          this.etag = result.etag;
        } else if (result.outcome === 'conflict') {
          this.stopped = true;
          this.onStatus(`${this.file.name} changed elsewhere; your edits were not saved.`);
        } else {
          this.stopped = true;
          this.onStatus(`${this.file.name} is too large to save (limit ${result.maxBytes} bytes).`);
        }
      }
    } finally {
      this.writing = false;
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopped = true;
  }
}
