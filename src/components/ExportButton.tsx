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

export default function ExportButton() {
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
        command: exportHandler('glb'),
      },
      {
        data: 'stl',
        label: 'STL',
        icon: 'pi pi-download',
        command: exportHandler('stl'),
      },
      {
        data: 'off',
        label: 'OFF',
        icon: 'pi pi-download',
        command: exportHandler('off'),
      },
      {
        data: 'stp',
        label: 'STEP',
        icon: 'pi pi-download',
        command: exportHandler('stp'),
      },
      {
        data: 'x3d',
        label: 'X3D',
        icon: 'pi pi-download',
        command: exportHandler('x3d'),
      },
      {
        data: '3mf',
        label: '3MF (Multicolor)',
        icon: 'pi pi-download',
        command: exportHandler('3mf'),
      },
    ];

    const selectedItem = dropdownModel.filter(item => item.data === state.params.renderFormat)[0] || dropdownModel[0]!;
  
    function exportHandler(format: string) {
      return (event: MenuItemCommandEvent) => {
        model!.renderFormat = event.item.data;
        if (event.item.data === '3mf' && (dropdownVisible || (state.params.extruderColors ?? []).length === 0)) {
            setShowMulticolorDialog(true);
        } else {
            setShowMulticolorDialog(false)
            model!.render({isPreview: false, now: true})
        }
      };
    }

  return (<>
      <SplitButton 
        label={selectedItem.label}
        icon="pi pi-download" 
        model={dropdownModel}
        onClick={e => selectedItem.command!({originalEvent: e, item: selectedItem})}
        className="p-button-sm"
        onShow={() => setDropdownVisible(true)}
        onHide={() => setDropdownVisible(false)}
      />
      <Dialog 
          header="Export 3MF (Multicolor)" 
          visible={showMulticolorDialog} 
          onHide={() => setShowMulticolorDialog(false)}
          footer={
              <div>
                  <Button label="Cancel" icon="pi pi-times" onClick={() => setShowMulticolorDialog(false)} className="p-button-text" />
                  <Button label="Export" icon="pi pi-check" onClick={e => selectedItem.command!({originalEvent: e, item: selectedItem})} autoFocus />
              </div>
          }
      >
          <div className="flex flex-column align-items-center">
              <h3 className="mb-3">Choose a color for 3MF export:</h3>
              <ExtruderColors />
          </div>
      </Dialog>
      </>);
}
