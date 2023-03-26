// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useContext } from 'react';
import { SingleLayoutComponentId } from '../state/app-state'
import { TabMenu } from 'primereact/tabmenu';
import { ToggleButton } from 'primereact/togglebutton';
import { ModelContext, FSContext } from './contexts';
import SettingsMenu from './SettingsMenu';

export default function PanelSwitcher() {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;

  const singleTargets: {id: SingleLayoutComponentId, icon: string, label: string}[] = [
    { id: 'editor', icon: 'pi pi-pencil', label: 'Edit' },
    { id: 'viewer', icon: 'pi pi-box', label: 'View' },
    { id: 'customizer', icon: 'pi pi-sliders-h', label: 'Customize' },
  ];
  const multiTargets = singleTargets;

  return (
    <div className="">
      <div className='flex flex-row' style={{
        margin: '5px',
      }}>

        {state.view.layout.mode === 'multi'
          ?   <div className='flex flex-row gap-1' style={{
            justifyContent: 'center',
            flex: 1,
            margin: '5px'
          }}>
                {multiTargets.map(({icon, label, id}) => 
                  // <Button
                  <ToggleButton
                    key={id}
                    // raised={(state.view.layout as any)[id]}
                    checked={(state.view.layout as any)[id]}
                    // label={label}
                    onLabel={label}
                    offLabel={label}
                    onIcon={icon}
                    offIcon={icon}
                    // icon={icon}
                    disabled={id === 'customizer'}
                    // onClick={() => model.changeMultiVisibility(id, !(state.view.layout as any)[id])}
                    onChange={e => model.changeMultiVisibility(id, e.value)}
                    />
                  )}
              </div>
          :   <>
                <TabMenu
                  activeIndex={singleTargets.map(t => t.id).indexOf(state.view.layout.focus)}
                  style={{
                    flex: 1,
                    // justifyContent: 'center'
                  }}
                  model={singleTargets.map(({icon, label, id}) => 
                  ({icon, label, disabled: id === 'customizer', command: () => model.changeSingleVisibility(id)}))} />
              </>
        }
        <SettingsMenu />
      </div>
    </div>
  );
}
