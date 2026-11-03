/**
 * Delivering an exported model through the MCP Apps host. The sandboxed iframe
 * cannot save files itself (`<a download>` and blob saves are blocked), so:
 *
 *  1. `ui/download-file` (App.downloadFile) when the host advertises
 *     `hostCapabilities.downloadFile`: the host shows its own save dialog.
 *  2. Otherwise `ui/message` (App.sendMessage) with an embedded resource block,
 *     when the host's `message` capability includes `resource`: the file lands
 *     in the chat as an attachment.
 *  3. Otherwise the caller falls back (tool result resource, or a manual-copy dialog).
 */

import type { App } from '@modelcontextprotocol/ext-apps';
import { dataUri, formatSize, stepName, type Form, type HostFileCapabilities, type Step } from './export-logic.ts';

export interface ExportedFile {
  filename: string;
  mimeType: string;
  base64: string;
  size: number;
}

export function hostFileCaps(app: App): HostFileCapabilities {
  const caps = app.getHostCapabilities();
  return { download: !!caps?.downloadFile, message: !!caps?.message?.resource, messageLink: !!caps?.message?.resourceLink };
}

/** The host answered but refused (user cancelled / policy): do not retry another form. */
export class DeclinedError extends Error {}

function fileBlock(file: ExportedFile, form: Form) {
  const uri = form === 'link' ? dataUri(file.mimeType, file.base64) : `file:///${encodeURIComponent(file.filename)}`;
  return form === 'link'
    ? { type: 'resource_link' as const, uri, name: file.filename, mimeType: file.mimeType, size: file.size }
    : { type: 'resource' as const, resource: { uri, mimeType: file.mimeType, blob: file.base64 } };
}
export { fileBlock };

/** Deliver one step through the host (download or message). Resolves to the human-readable outcome. */
export async function deliverViaHost(app: App, file: ExportedFile, step: Step): Promise<string> {
  const block = fileBlock(file, step.form);
  if (step.channel === 'download') {
    const res = await app.downloadFile({ contents: [block] });
    if (res.isError) throw new DeclinedError('The host declined or cancelled the download');
    return `Downloaded ${file.filename}`;
  }
  const res = await app.sendMessage({
    role: 'user',
    content: [{ type: 'text', text: `Exported model ${file.filename} (${formatSize(file.size)}) from the OpenSCAD viewer.` }, block],
  });
  if (res.isError) throw new DeclinedError('The host rejected the message with the file');
  return `Sent ${file.filename} to the chat (this host cannot save files directly)`;
}

/**
 * Try the host steps of a plan in order. A thrown error (e.g. the host does
 * not accept that content form) moves on to the next step; a refusal stops.
 * Returns undefined when the plan has no host step left (only tool-result
 * steps), so the caller can use its own fallback.
 */
export async function deliverPlanViaHost(app: App, file: ExportedFile, steps: Step[]): Promise<{ outcome: string; step: Step } | undefined> {
  const errors: string[] = [];
  for (const step of steps) {
    if (step.channel === 'return') break;
    try {
      return { outcome: await deliverViaHost(app, file, step), step };
    } catch (e) {
      if (e instanceof DeclinedError) throw e;
      errors.push(`${stepName(step)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (errors.length) console.warn('Host delivery failed:', errors.join('; '));
  return undefined;
}
