import chroma from 'chroma-js';
import React, { useContext, useState } from 'react';
import { ColorPicker, ColorPickerHSBType, ColorPickerRGBType } from 'primereact/colorpicker';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ModelContext } from './contexts';

export default function ExtruderColors() {
    const model = useContext(ModelContext);
    if (!model) throw new Error('No model');
    const state = model.state;

    const extruderColors = state.params.extruderColors ?? [];
    console.log(`extruderColors: ${JSON.stringify(extruderColors)}`);

    function changeColor(index: number, color: string) {
      model!.mutate(s => s.params.extruderColors = extruderColors.map((c, i) => i === index ? color : c));
    }
    function removeColor(index: number) {
      model!.mutate(s => s.params.extruderColors = extruderColors.filter((c, i) => i !== index));
    }
    function addColor() {
      model!.mutate(s => s.params.extruderColors = [...extruderColors, '#ffffff']);
    }
    function toString(color: string | ColorPickerRGBType | ColorPickerHSBType): string {
      if (typeof color === 'string') {
        try {
            const c = chroma(color);
            console.log(`color: ${color} -> ${c.hex()}`);
            return c.hex();
        } catch (e) { 
            return color;
        }
      }
      if ('r' in color) return `#${color.r.toString(16)}${color.g.toString(16)}${color.b.toString(16)}`;
      else return chroma.hsv(color.h, color.s, color.b).hex();
    }

    // vertical list of colors 
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Color List Picker</h2>
            
            <div className="flex flex-wrap gap-2" style={{
                flexDirection: 'column',
            }}>
                {extruderColors.map((color, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <InputText
                            value={color}
                            onChange={(e) => changeColor(index, toString(e.target.value))}
                        />
                        <ColorPicker
                            value={color}
                            onChange={(e) => e.value && changeColor(index, toString(e.value))}
                        />
                        <Button
                            icon="pi pi-times"
                            onClick={() => removeColor(index)}
                            className="p-button-rounded p-button-danger p-button-sm"
                        />
                    </div>
                ))}
                <div>
                    <Button label="Add Color" onClick={addColor} className="p-button-sm" />
                </div>
            </div>
        </div>
    );
}