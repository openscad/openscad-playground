import React, { useContext } from 'react';
import { ModelContext } from './contexts.ts';

import { downloadSource } from '../utils.ts';
import { SplitButton } from 'primereact/splitbutton';
import { MenuItem } from 'primereact/menuitem';

type ExtendedMenuItem = MenuItem & { buttonLabel?: string };

export default function ExportButton({className, style}: {className?: string, style?: React.CSSProperties}) {
    const model = useContext(ModelContext);
    if (!model) throw new Error('No model');
    const state = model.state;

    const SCAD_ITEM: ExtendedMenuItem = {
      label: 'SCAD (source)',
      icon: 'pi pi-file-edit',
      command: () => { downloadSource(state.params.sources, state.params.activePath); },
    };

    const dropdownModel: ExtendedMenuItem[] = 
      state.is2D ? [
        SCAD_ITEM,
        {
          data: 'svg',
          buttonLabel: 'SVG',
          label: 'SVG (Simple Vector Graphics)',
          icon: 'pi pi-download',
          command: () => model!.setFormats('svg', undefined),
        },
        {
          data: 'dxf',
          buttonLabel: 'DXF',
          label: 'DXF (Drawing Exchange Format)',
          icon: 'pi pi-download',
          command: () => model!.setFormats('dxf', undefined),
        },
      ] : [
        SCAD_ITEM,
        {
          data: 'glb',
          buttonLabel: 'Download GLB',
          label: 'GLB (binary glTF)',
          icon: 'pi pi-file',
          command: () => model!.setFormats(undefined, 'glb'),
        },
        {
          data: 'stl',
          buttonLabel: 'Download STL',
          label: 'STL (binary)',
          icon: 'pi pi-file',
          command: () => model!.setFormats(undefined, 'stl'),
        },
        {
          data: 'off',
          buttonLabel: 'Download OFF',
          label: 'OFF (Object File Format)',
          icon: 'pi pi-file',
          command: () => model!.setFormats(undefined, 'off'),
        },
        {
          data: '3mf',
          buttonLabel: 'Download 3MF',
          label: '3MF (Multimaterial)',
          icon: 'pi pi-file',
          command: () => model!.setFormats(undefined, '3mf'),
        },
        {
          separator: true
        },
        {
          label: 'Edit materials' + ((state.params.extruderColors ?? []).length > 0 ? ` (${(state.params.extruderColors ?? []).length})` : ''),
          icon: 'pi pi-cog',
          command: () => model!.mutate(s => s.view.extruderPickerVisibility = 'editing'),
        }
      ];

    const exportFormat = state.is2D ? state.params.exportFormat2D : state.params.exportFormat3D;
    const selectedItem = dropdownModel.filter(item => item.data === exportFormat)[0] || dropdownModel.find(item => item.data)!;

  return (
    <div className={className} style={style}>
      <SplitButton 
        label={selectedItem.buttonLabel}
        disabled={!state.output || state.output.isPreview || state.rendering || state.exporting}
        icon="pi pi-download" 
        model={dropdownModel}
        severity="secondary"
        onClick={e => model!.export()}
        className="p-button-sm"
      />
    </div>
  );
}
