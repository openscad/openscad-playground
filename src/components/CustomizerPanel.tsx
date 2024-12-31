// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext } from 'react';
import { ModelContext } from './contexts.ts';

import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Fieldset } from 'primereact/fieldset';
import { Parameter } from '../state/customizer-types.ts';
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
  const collapsedTabSet = new Set(state.view.collapsedCustomizerTabs ?? []);
  const setTabOpen = (name: string, open: boolean) => {
    if (open) {
      collapsedTabSet.delete(name);
    } else {
      collapsedTabSet.add(name)
    }
    model.mutate(s => s.view.collapsedCustomizerTabs = Array.from(collapsedTabSet));
  }

  return (
    <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
          overflow: 'scroll',
          ...style,
          bottom: 'unset',
        }}>
      {groups.map(([group, params]) => (
        <Fieldset 
            style={{
              margin: '5px 10px 5px 10px',
              // backgroundColor: 'transparent',
              backgroundColor: 'rgba(255,255,255,0.4)',
            }}
            onCollapse={() => setTabOpen(group, false)}
            onExpand={() => setTabOpen(group, true)}
            collapsed={collapsedTabSet.has(group)}
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
    <div 
      style={{
        flex: 1,
        ...style,
        display: 'flex',
        flexDirection: 'column',
      }}>
      <div 
        style={{
          flex: 1,
          display: 'flex',
          margin: '10px -10px 10px 5px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <div 
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
          <label><b>{param.name}</b></label>
          <div>{param.caption}</div>
        </div>
        <div 
          style={{
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
              value={value || param.initial}
              options={param.options}
              onChange={(e) => handleChange(param.name, e.value)}
              optionLabel="name"
              optionValue="value"
            />
          )}
          {param.type === 'boolean' && (
            <Checkbox
              checked={value ?? param.initial}
              onChange={(e) => handleChange(param.name, e.checked)}
            />
          )}
          {!Array.isArray(param.initial) && param.type === 'number' && !('options' in param) && (
            <InputNumber
              value={value || param.initial}
              showButtons
              size={5}
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
                  value={value?.[index] ?? (param.initial as any)[index]}
                  min={param.min}
                  max={param.max}
                  showButtons
                  size={5}
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
              marginRight: '0',
              visibility: value === undefined || (JSON.stringify(value) === JSON.stringify(param.initial)) ? 'hidden' : 'visible',
            }}
            tooltipOptions={{position: 'left'}}
            icon='pi pi-refresh'
            className='p-button-text'/>
        </div>
      </div>
      {!Array.isArray(param.initial) && param.type === 'number' && param.min !== undefined && (
        <Slider
          style={{
            flex: 1,
            minHeight: '5px',
            margin: '5px 40px 5px 5px',
          }}
          value={value || param.initial}
          min={param.min}
          max={param.max}
          step={param.step}
          onChange={(e) => handleChange(param.name, e.value)}
        />
      )}
    </div>
  );
}