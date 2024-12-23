import React, { useContext } from 'react';
import { ModelContext } from './contexts';

import { SplitButton } from 'primereact/splitbutton';
import { MenuItem } from 'primereact/menuitem';

type ExtendedMenuItem = MenuItem & { buttonLabel: string };

export default function ExportButton({className, style}: {className?: string, style?: React.CSSProperties}) {
    const model = useContext(ModelContext);
    if (!model) throw new Error('No model');
    const state = model.state;

    const dropdownModel: ExtendedMenuItem[] = 
      state.is2D ? [
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
        {
          data: 'glb',
          buttonLabel: 'GLB',
          label: 'GLB (binary glTF)',
          icon: 'pi pi-file',
          command: () => model!.setFormats(undefined, 'glb'),
        },
        {
          data: 'stl',
          buttonLabel: 'STL',
          label: 'STL (binary)',
          icon: 'pi pi-file',
          command: () => model!.setFormats(undefined, 'stl'),
        },
        {
          data: 'off',
          buttonLabel: 'OFF',
          label: 'OFF (Object File Format)',
          icon: 'pi pi-file',
          command: () => model!.setFormats(undefined, 'off'),
        },
      ];

    const exportFormat = state.is2D ? state.params.exportFormat2D : state.params.exportFormat3D;
    const selectedItem = dropdownModel.filter(item => item.data === exportFormat)[0] || dropdownModel[0]!;

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
