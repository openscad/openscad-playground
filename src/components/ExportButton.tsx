import chroma from 'chroma-js';
import React, { useContext, useState } from 'react';
import { ColorPicker, ColorPickerHSBType, ColorPickerRGBType } from 'primereact/colorpicker';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ModelContext } from './contexts';

import { SplitButton } from 'primereact/splitbutton';
import { Dialog } from 'primereact/dialog';
import { MenuItem, MenuItemCommandEvent } from 'primereact/menuitem';
import { downloadUrl } from '../utils';
import { is2DFormatExtension } from '../state/formats';

export default function ExportButton({className, style}: {className?: string, style?: React.CSSProperties}) {
    const model = useContext(ModelContext);
    if (!model) throw new Error('No model');
    const state = model.state;

    const [showMulticolorDialog, setShowMulticolorDialog] = useState(false);
    const [dropdownVisible, setDropdownVisible] = useState(false);

    const is2D = is2DFormatExtension(state.params.renderFormat);

    const dropdownModel: MenuItem[] = 
      is2D ? [
        {
          data: 'svg',
          label: 'SVG',
          icon: 'pi pi-download',
          command: () => model!.setFormats('svg', 'svg'),
        },
        {
          data: 'dxf',
          label: 'DXF',
          icon: 'pi pi-download',
          command: () => model!.setFormats('svg', 'dxf'),
        },
      ] : [
        {
          data: 'glb',
          label: 'GLB (glTF)',
          icon: 'pi pi-download',
          command: () => model!.setFormats('off', 'glb'),
        },
        {
          data: 'stl',
          label: 'STL',
          icon: 'pi pi-download',
          command: () => model!.setFormats('off', 'stl'),
        },
        {
          data: 'off',
          label: 'OFF',
          icon: 'pi pi-download',
          command: () => model!.setFormats('off', 'off'),
        },
      ];

    const selectedItem = dropdownModel.filter(item => item.data === state.params.exportFormat)[0] || dropdownModel[0]!;

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
        onShow={() => setDropdownVisible(true)}
        onHide={() => setDropdownVisible(false)}
      />
    </div>
  );
}
