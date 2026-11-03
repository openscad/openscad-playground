// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useRef } from 'react';
import { Button } from 'primereact/button';
import { MenuItem } from 'primereact/menuitem';
import { Menu } from 'primereact/menu';
import { ModelContext } from './contexts.ts';
import { State } from '../state/app-state.ts';
import { isInStandaloneMode } from '../utils.ts';
import { confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';
import { notify } from '../state/notify.ts';
import { isFramed, resolveMcpSetupUrl } from '../state/embed.ts';

// Build-time define (webpack EnvironmentPlugin); empty unless the deployment serves an MCP endpoint.
const mcpSetupUrl = resolveMcpSetupUrl(process.env.OPENSCAD_MCP_URL, window.location.href, isFramed());
import { encodeStateParamsAsFragment } from '../state/fragment-state.ts';

/** iframe snippet for the current model: `?embed=1` plus the usual URL state fragment. */
export async function buildEmbedCode(state: State): Promise<string> {
  const url = new URL(window.location.href);
  url.search = '?embed=1';
  url.hash = '#' + await encodeStateParamsAsFragment(state);
  return `<iframe src="${url.toString()}" style="width: 100%; height: 480px; border: 0" allow="fullscreen; clipboard-write" loading="lazy"></iframe>`;
}

export default function SettingsMenu({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const state = model.state;

  const settingsMenu = useRef<Menu>(null);
  const toast = useRef<Toast>(null);
  return (
    <>
      <Toast ref={toast} position="bottom-center" />
      <Menu model={[
        {
          label: state.view.layout.mode === 'multi'
            ? 'Switch to single panel mode'
            : "Switch to side-by-side mode",
          icon: 'pi pi-table',
          // disabled: true,
          command: () => model.changeLayout(state.view.layout.mode === 'multi' ? 'single' : 'multi'),
        },
        {
          separator: true
        },
        {
          // Session-level (not persisted, not in share links): same state `set_layout` and get_viewer_state use.
          label: 'Embed mode',
          icon: state.view.embed ? 'pi pi-check' : 'pi pi-window-minimize',
          command: () => model.mutate(s => { s.view.embed = !s.view.embed; s.view.customizerOverlay = false; }),
        },
        {
          label: 'Copy embed code',
          icon: 'pi pi-code',
          command: async () => {
            const html = await buildEmbedCode(state);
            try {
              await navigator.clipboard.writeText(html);
              // Sole feedback of an explicit click: essential.
              notify(!!state.view.embed, {toast: (severity, detail, life) => toast.current?.show({severity, detail, life}), announce: () => {}}, 'success', 'Embed code copied', {essential: true, life: 2000});
            } catch {
              window.prompt('Copy the embed code:', html);
            }
          },
        },
        {
          separator: true
        },  
        {
          label: state.view.showAxes ? 'Hide axes' : 'Show axes',
          icon: 'pi pi-asterisk',
          // disabled: true,
          command: () => model.mutate(s => s.view.showAxes = !s.view.showAxes)
        },
        {
          label: state.view.lineNumbers ? 'Hide line numbers' : 'Show line numbers',
          icon: 'pi pi-list',
          // disabled: true,
          command: () => model.mutate(s => s.view.lineNumbers = !s.view.lineNumbers)
        },
        ...(mcpSetupUrl ? [
          {
            label: 'Configure MCP',
            icon: 'pi pi-sparkles',
            // Opens the MCP setup help page in a new tab.
            command: () => { window.open(mcpSetupUrl, '_blank', 'noopener,noreferrer'); },
          },
        ] : []),
        ...(isInStandaloneMode() ? [
          {
            separator: true
          },  
          {
            label: 'Clear local storage',
            icon: 'pi pi-list',
            // disabled: true,
            command: () => {
              confirmDialog({
                message: "This will clear all the edits you've made and files you've created in this playground " +
                  "and will reset it to factory defaults. " +
                  "Are you sure you wish to proceed? (you might lose your models!)",
                header: 'Clear local storage',
                icon: 'pi pi-exclamation-triangle',
                accept: () => {
                  localStorage.clear();
                  location.reload();
                },
                acceptLabel: `Clear all files!`,
                rejectLabel: 'Cancel'
              });
            },
          },
        ] : []),
      ] as MenuItem[]} popup ref={settingsMenu} />
    
      <Button title="Settings menu"
          style={style}
          className={className}
          rounded
          text
          icon="pi pi-cog"
          onClick={(e) => settingsMenu.current && settingsMenu.current.toggle(e)} />
    </>
  );
}