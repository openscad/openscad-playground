import chroma from 'chroma-js';
import React, { useContext, useState } from 'react';
import { ColorPicker, ColorPickerHSBType, ColorPickerRGBType } from 'primereact/colorpicker';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ModelContext } from './contexts';

import { SplitButton } from 'primereact/splitbutton';
import { Dialog } from 'primereact/dialog';
import ExtruderColors from './ExtruderColors';
import { MenuItem, MenuItemCommandEvent } from 'primereact/menuitem';
import { downloadUrl } from '../utils';

export default function ExportButton({className, style}: {className?: string, style?: React.CSSProperties}) {
    const model = useContext(ModelContext);
    if (!model) throw new Error('No model');
    const state = model.state;

    const [showMulticolorDialog, setShowMulticolorDialog] = useState(false);
    const [dropdownVisible, setDropdownVisible] = useState(false);

    const dropdownModel: MenuItem[] = [
      {
        data: 'glb',
        label: 'glTF',
        icon: 'pi pi-download',
        command: () => model!.exportFormat = 'glb',
      },
      {
        data: 'stl',
        label: 'STL',
        icon: 'pi pi-download',
        command: () => model!.exportFormat = 'stl',
      },
      {
        data: 'off',
        label: 'OFF',
        icon: 'pi pi-download',
        command: () => model!.exportFormat = 'off',
      },
      // {
      //   data: 'stp',
      //   label: 'STEP',
      //   icon: 'pi pi-download',
      //   command: () => model!.exportFormat = 'stp',
      // },
      {
        data: 'x3d',
        label: 'X3D',
        icon: 'pi pi-download',
        command: () => model!.exportFormat = 'x3d',
      },
      {
        data: '3mf',
        label: '3MF (Multi-material)',
        icon: 'pi pi-download',
        command: () => model!.exportFormat = '3mf',
      },
      {
        label: 'Edit materials',
        icon: 'pi pi-cog',
        command: () => model!.mutate(s => s.view.extruderPicker = true),
      }
    ];

    const selectedItem = dropdownModel.filter(item => item.data === state.params.exportFormat)[0] || dropdownModel[0]!;

  const hideExtruderPicker = () => {
    model!.mutate(s => s.view.extruderPicker = false);
  };
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
      <Dialog 
          header="Export 3MF (Multicolor)" 
          visible={state.view.extruderPicker} 
          onHide={hideExtruderPicker}
          footer={
              <div>
                  <Button label="Cancel" icon="pi pi-times" onClick={hideExtruderPicker} className="p-button-text" />
                  <Button label="Export" icon="pi pi-check" onClick={e => {
                    hideExtruderPicker();
                    model!.export();
                  }} autoFocus />
              </div>
          }
      >
          <div className="flex flex-column align-items-center">
              <h3 className="mb-3">Choose a color for 3MF export:</h3>
              <ExtruderColors 
                extruderColors={state.params.extruderColors ?? []}
                setExtruderColors={colors => model!.mutate(s => s.params.extruderColors = colors)}
                />
          </div>
      </Dialog>
    </div>
  );
}
