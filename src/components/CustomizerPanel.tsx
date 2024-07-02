// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext } from 'react';
import { ModelContext, FSContext } from './contexts';

import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Fieldset } from 'primereact/fieldset';
import { Parameter } from '../state/customizer-types';
import { Button } from 'primereact/button';

export default function CustomizerPanel({className, style}: {className?: string, style?: CSSProperties}) {

  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;

  const handleChange = (name: string, value: any) => {
    model.setVar(name, value);
  };

  const groupedParameters = (state.parameterSet?.parameters ?? []).reduce((acc, param) => {
    if (!acc[param.group]) {
      acc[param.group] = [];
    }
    acc[param.group].push(param);
    return acc;
  }, {} as { [key: string]: any[] });

  const groups = Object.entries(groupedParameters);
  const expandedTabSet = new Set(state.view.customizerExpandedTabs ?? []);
  const setTabOpen = (name: string, open: boolean) => {
    if (open) {
      expandedTabSet.add(name)
    } else {
      expandedTabSet.delete(name);
    }
    model.mutate(s => s.view.customizerExpandedTabs = Array.from(expandedTabSet));
  }

  return (
    <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'scroll',
          ...style,
        }}>
      {groups.map(([group, params]) => (
        <Fieldset 
            style={{
              margin: '5px 10px 5px 10px',
              backgroundColor: 'transparent',
            }}
            onCollapse={() => setTabOpen(group, false)}
            onExpand={() => setTabOpen(group, true)}
            collapsed={!expandedTabSet.has(group)}
            key={group}
            legend={group}
            toggleable={true}>
          {params.map((param) => (
            <ParameterInput
              key={param.name}
              value={(state.params.vars ?? {})[param.name]}
              param={param}
              handleChange={handleChange} />
          ))}
        </Fieldset>
      ))}
    </div>
  );
};

function ParameterInput({param, value, className, style, handleChange}: {param: Parameter, value: any, className?: string, style?: CSSProperties, handleChange: (key: string, value: any) => void}) {
  return (
    <div style={{
      ...style,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <label><b>{param.name}</b></label>
        <div>{param.caption}</div>
      </div>
      <div style={{
        // flex: 1,
        margin: '10px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {param.type === 'number' && 'options' in param && (
          <Dropdown
            style={{flex: 1}}
            value={value || param.initial}
            options={param.options}
            onChange={(e) => handleChange(param.name, e.value)}
            optionLabel="name"
            optionValue="value"
          />
        )}
        {param.type === 'string' && param.options && (
          <Dropdown
           style={{flex: 1}}
            value={value || param.initial}
            options={param.options}
            onChange={(e) => handleChange(param.name, e.value)}
            optionLabel="name"
            optionValue="value"
          />
        )}
        {!Array.isArray(param.initial) && param.type === 'number' && param.min !== undefined && (
          <Slider
            style={{
              flex: 1,
              minWidth: '150px',
            }}
            value={value || param.initial}
            min={param.min}
            max={param.max}
            step={param.step}
            onChange={(e) => handleChange(param.name, e.value)}
          />
        )}
        {param.type === 'boolean' && (
          <Checkbox
            style={{flex: 1}}
            checked={value ?? param.initial}
            onChange={(e) => handleChange(param.name, e.checked)}
          />
        )}
        {param.type === 'number' && !('options' in param) && !('min' in param) && (
          <InputNumber
            style={{flex: 1}}
            value={value || param.initial}
            showButtons
            buttonLayout='horizontal'
            onValueChange={(e) => handleChange(param.name, e.value)}
          />
        )}
        {param.type === 'string' && !param.options && (
          <InputText
            style={{flex: 1}}
            value={value || param.initial}
            onChange={(e) => handleChange(param.name, e.target.value)}
          />
        )}
        {Array.isArray(param.initial) && 'min' in param && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
          }}>
            {param.initial.map((_, index) => (
              <InputNumber
                style={{flex: 1}}
                key={index}
                value={value?.[index] || (param.initial as any)[index]}
                min={param.min}
                max={param.max}
                showButtons
                buttonLayout='horizontal'
                step={param.step}
                onValueChange={(e) => {
                  const newArray = [...(value ?? param.initial)];
                  newArray[index] = e.value;
                  handleChange(param.name, newArray);
                }}
              />
            ))}
          </div>
        )}
        <Button
          onClick={() => handleChange(param.name, param.initial)}
          style={{
            visibility: value === undefined || (JSON.stringify(value) === JSON.stringify(param.initial)) ? 'hidden' : 'visible',
          }}
          icon='pi pi-refresh'
          className='p-button-text'/>
      </div>
    </div>
  );
}