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
import { formatSize, type Delivery, type HostFileCapabilities } from './export-logic.ts';

export interface ExportedFile {
  filename: string;
  mimeType: string;
  base64: string;
  size: number;
}

export function hostFileCaps(app: App): HostFileCapabilities {
  const caps = app.getHostCapabilities();
  return { download: !!caps?.downloadFile, message: !!caps?.message?.resource };
}

function resourceBlock(file: ExportedFile) {
  return {
    type: 'resource' as const,
    resource: { uri: `file:///${encodeURIComponent(file.filename)}`, mimeType: file.mimeType, blob: file.base64 },
  };
}

/** Deliver through the host (download or message). Resolves to the human-readable outcome. */
export async function deliverViaHost(app: App, file: ExportedFile, delivery: Exclude<Delivery, 'return'>): Promise<string> {
  if (delivery === 'download') {
    const res = await app.downloadFile({ contents: [resourceBlock(file)] });
    if (res.isError) throw new Error('The host declined or cancelled the download');
    return `Downloaded ${file.filename}`;
  }
  const res = await app.sendMessage({
    role: 'user',
    content: [
      { type: 'text', text: `Exported model ${file.filename} (${formatSize(file.size)}) from the OpenSCAD viewer.` },
      resourceBlock(file),
    ],
  });
  if (res.isError) throw new Error('The host rejected the message with the file');
  return `Sent ${file.filename} to the chat (this host cannot save files directly)`;
}
