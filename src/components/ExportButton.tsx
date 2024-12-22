import React, { useContext } from 'react';
import { ModelContext } from './contexts';

import { SplitButton } from 'primereact/splitbutton';
import { MenuItem } from 'primereact/menuitem';

export default function ExportButton({className, style}: {className?: string, style?: React.CSSProperties}) {
    const model = useContext(ModelContext);
    if (!model) throw new Error('No model');
    const state = model.state;

    const dropdownModel: MenuItem[] = 
      state.is2D ? [
        {
          data: 'svg',
          label: 'SVG',
          icon: 'pi pi-download',
          command: () => model!.setFormats('svg', undefined),
        },
        {
          data: 'dxf',
          label: 'DXF',
          icon: 'pi pi-download',
          command: () => model!.setFormats('dxf', undefined),
        },
      ] : [
        {
          data: 'glb',
          label: 'GLB (glTF)',
          icon: 'pi pi-download',
          command: () => model!.setFormats(undefined, 'glb'),
        },
        {
          data: 'stl',
          label: 'STL',
          icon: 'pi pi-download',
          command: () => model!.setFormats(undefined, 'stl'),
        },
        {
          data: 'off',
          label: 'OFF',
          icon: 'pi pi-download',
          command: () => model!.setFormats(undefined, 'off'),
        },
      ];

    const exportFormat = state.is2D ? state.params.exportFormat2D : state.params.exportFormat3D;
    const selectedItem = dropdownModel.filter(item => item.data === exportFormat)[0] || dropdownModel[0]!;

  return (
    <div className={className} style={style}>
      <SplitButton 
        label={selectedItem.label}
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
