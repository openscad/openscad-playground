// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useContext } from 'react';
import { SingleLayoutComponentId } from '../state/app-state.ts'
import { TabMenu } from 'primereact/tabmenu';
import { ToggleButton } from 'primereact/togglebutton';
import { Button } from 'primereact/button';
import { ModelContext } from './contexts.ts';

export default function PanelSwitcher({
  onOpenGallery,
  editorEnabled,
  showEditorToggle,
}: {
  onOpenGallery?: (variant: 'dialog' | 'fullscreen') => void;
  editorEnabled: boolean;
  showEditorToggle: boolean;
}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;

  const singleTargets: {id: SingleLayoutComponentId, icon: string, label: string}[] = [];
  if (editorEnabled) {
    singleTargets.push({ id: 'editor', icon: 'pi pi-pencil', label: 'Edit' });
  }
  singleTargets.push({ id: 'viewer', icon: 'pi pi-box', label: 'View' });
  const staticProject = state.project?.type === 'static';
  const hasCustomizer = !staticProject && (state.parameterSet?.parameters?.length ?? 0) > 0;
  if (hasCustomizer) {
    singleTargets.push({ id: 'customizer', icon: 'pi pi-sliders-h', label: 'Customize' });
  }
  const multiTargets = singleTargets;

  const editorVisible = editorEnabled && (
    state.view.layout.mode === 'multi'
      ? (state.view.layout as any).editor
      : state.view.layout.focus === 'editor'
  );

  const toggleLabel = editorVisible ? 'Hide Editor' : 'Show Editor';

  let currentFocus: SingleLayoutComponentId = 'viewer';
  if (state.view.layout.mode === 'single') {
    currentFocus = state.view.layout.focus;
  } else {
    const layout = state.view.layout as {
      mode: 'multi';
      editor: boolean;
      viewer: boolean;
      customizer: boolean;
    };
    if (editorEnabled && layout.editor) {
      currentFocus = 'editor';
    } else if (layout.viewer) {
      currentFocus = 'viewer';
    } else if (layout.customizer) {
      currentFocus = 'customizer';
    }
  }

  const tabMenuActiveIndex = Math.max(singleTargets.findIndex(t => t.id === currentFocus), 0);

  return (
    <div className="">
      <div className='flex flex-row gap-2 align-items-center' style={{
        margin: '5px',
        position: 'relative',
      }}>
        <div style={{ flex: 1 }}>
          {state.view.layout.mode === 'multi'
            ?   <div className='flex flex-row gap-1' style={{
                  justifyContent: 'center',
                  margin: '5px'
                }}>
                  {multiTargets.map(({icon, label, id}) => 
                    <ToggleButton
                      key={id}
                      checked={(state.view.layout as any)[id]}
                      onLabel={label}
                      offLabel={label}
                      onIcon={icon}
                      offIcon={icon}
                      onChange={e => model.changeMultiVisibility(id, e.value)}
                    />
                  )}
                </div>
            :   <TabMenu
                  activeIndex={tabMenuActiveIndex}
                  style={{ flex: 1 }}
                  model={singleTargets.map(({icon, label, id}) => 
                    ({icon, label, command: () => model.changeSingleVisibility(id)}))} />}
        </div>
        <div className='flex flex-row gap-2'>
          {editorEnabled && showEditorToggle && (
            <Button
              icon={editorVisible ? 'pi pi-eye-slash' : 'pi pi-pencil'}
              label={toggleLabel}
              outlined
              onClick={() => model.toggleEditorVisibility()}
            />
          )}
          <Button
            icon="pi pi-images"
            label="Gallery"
            outlined
            onClick={() => onOpenGallery && onOpenGallery('dialog')}
          />
        </div>
      </div>
    </div>
  );
}
