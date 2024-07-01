// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext } from 'react';
import { ModelContext, FSContext } from './contexts';

import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { Parameter } from '../state/customizer-types';

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
  // const groupNames = groups.map(([group]) => group);
  // const activeTabIndices = (state.view.customizerExpandedTabs ?? []).map(n => groupNames.indexOf(n)).filter(i => i >= 0);

  // const setTabOpen = (index: number, open: boolean) => {
  //   const newTabs = new Set(state.view.customizerExpandedTabs ?? []);
  //   if (open) {
  //     newTabs.add(groupNames[index])
  //   } else {
  //     newTabs.delete(groupNames[index]);
  //   }
  //   model.mutate(s => s.view.customizerExpandedTabs = Array.from(newTabs));
  // }

  return (
    <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'scroll',
        }}>
      <Accordion
          style={{
            flex: 1,
            backgroundColor: 'transparent'
          }}
          multiple={true}
          // activeIndex={activeTabIndices}
          // onTabOpen={(e) => setTabOpen(e.index, true)}
          // onTabClose={(e) => setTabOpen(e.index, false)}
          // activeIndex={groupNames.length ? groupNames.length - 1 : undefined}
        >
        {groups.map(([group, params]) => (
          <AccordionTab key={group} header={group}>
            {params.map((param) => (
              <ParameterInput
                key={param.name}
                value={(state.params.vars ?? {})[param.name]}
                param={param}
                handleChange={handleChange} />
            ))}
          </AccordionTab>
        ))}
      </Accordion>
    </div>
  );
};

function ParameterInput({param, value, className, style, handleChange}: {param: Parameter, value: any, className?: string, style?: CSSProperties, handleChange: (key: string, value: any) => void}) {
  return (
    <div style={{
      ...style,
      padding: '5px',
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
        flex: 1,
        margin: '10px'
      }}>
        {param.type === 'number' && 'options' in param && (
          <Dropdown
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
        {!Array.isArray(param.initial) && param.type === 'number' && param.min !== undefined && (
          <Slider
            value={value || param.initial}
            min={param.min}
            max={param.max}
            step={param.step}
            onChange={(e) => handleChange(param.name, e.value)}
          />
        )}
        {param.type === 'boolean' && (
          <Checkbox
            checked={value ?? param.initial}
            onChange={(e) => handleChange(param.name, e.checked)}
          />
        )}
        {param.type === 'number' && !('options' in param) && !('min' in param) && (
          <InputNumber
            value={value || param.initial}
            onValueChange={(e) => handleChange(param.name, e.value)}
          />
        )}
        {param.type === 'string' && !param.options && (
          <InputText
            value={value || param.initial}
            onChange={(e) => handleChange(param.name, e.target.value)}
          />
        )}
        {Array.isArray(param.initial) && 'min' in param && (
          <div>
            {param.initial.map((_, index) => (
              <InputNumber
                key={index}
                value={value?.[index] || (param.initial as any)[index]}
                min={param.min}
                max={param.max}
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
      </div>
    </div>
  );
}