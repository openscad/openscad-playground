import chroma from 'chroma-js';
import React, { useContext, useState } from 'react';
import { ColorPicker } from 'primereact/colorpicker';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ModelContext } from './contexts.ts';
import { Dialog } from 'primereact/dialog';

export default function MultimaterialColorsDialog() {
    const model = useContext(ModelContext);
    if (!model) throw new Error('No model');
    const state = model.state;

    const [tempExtruderColors, setTempExtruderColors] = useState<string[]>(state.params.extruderColors ?? []);

    function setColor(index: number, color: string) {
        setTempExtruderColors(tempExtruderColors.map((c, i) => i === index ? color : c));
    }
    function removeColor(index: number) {
        setTempExtruderColors(tempExtruderColors.filter((c, i) => i !== index));
    }
    function addColor() {
        setTempExtruderColors([...tempExtruderColors, '']);
    }

    const cancelExtruderPicker = () => {
        setTempExtruderColors(state.params.extruderColors ?? []);
        model!.mutate(s => s.view.extruderPickerVisibility = undefined);
    };
    const canAddColor = !tempExtruderColors.some(c => c.trim() === '');
    
    return (
        <Dialog 
            header="Multimaterial Color Picker" 
            visible={!!state.view.extruderPickerVisibility} 
            onHide={cancelExtruderPicker}
            footer={
                <div>
                    <Button label="Cancel" icon="pi pi-times" onClick={cancelExtruderPicker} className="p-button-text" />
                    <Button 
                    label={state.view.extruderPickerVisibility == 'exporting' ? "Export" : "Save"}
                    icon="pi pi-check"
                    disabled={!tempExtruderColors.every(c => chroma.valid(c) || c.trim() === '')}
                    autoFocus
                    onClick={e => {
                        model!.mutate(s => {
                            s.params.extruderColors = tempExtruderColors.filter(c => c.trim() !== '');
                            s.view.extruderPickerVisibility = undefined;
                        });
                        if (state.view.extruderPickerVisibility === 'exporting') {
                            model!.export();
                        }
                    }} />
                </div>
            }
        >
            <div className="flex flex-column align-items-center">
                <div>
                To print on a multimaterial printer using PrusaSlicer, BambuSlicer or OrcaSlicer, we map the model's colors to the closest match in the list of extruder colors.
                </div>
                <div>
                Please define the colors of your extruders below.
                </div>
                
                <div className="p-4">

                    <div className="flex flex-wrap gap-2" style={{
                        flexDirection: 'column',
                    }}>
                        {tempExtruderColors.map((color, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <ColorPicker
                                    value={chroma.valid(color) ? chroma(color).hex() : 'black'}
                                    onChange={(e) => e.value && setColor(index, chroma(e.value.toString()).name())}
                                />
                                <InputText
                                    value={color}
                                    autoFocus={color === ''}
                                    invalid={color.trim() === '' || !chroma.valid(color)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && canAddColor) {
                                            e.preventDefault();
                                            addColor();
                                        }
                                    }}
                                    onChange={(e) => {
                                        let color = e.target.value.trim();
                                        try {
                                            color = chroma(color).name();
                                            console.log(`color: ${e.target.value} -> ${color}`);
                                        } catch (e) {
                                            // ignore
                                            console.error(e);
                                        }
                                        setColor(index, color);
                                    }}
                                />
                                <Button
                                    icon="pi pi-times"
                                    text
                                    onClick={() => removeColor(index)}
                                    className="p-button-danger p-button-sm"
                                />
                            </div>
                        ))}
                        <div>
                            <Button
                                label="Add Color" 
                                disabled={!canAddColor}
                                icon="pi pi-plus"
                                text
                                onClick={addColor} className="p-button-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}