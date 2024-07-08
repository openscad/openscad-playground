export type ParameterOption = {
  name: string;
  value: number | string;
};

export type BaseParameter = {
  caption: string;
  group: string;
  name: string;
  type: 'number' | 'string' | 'boolean';
};

export type NumberParameter = BaseParameter & {
  type: 'number';
  initial: number;
  min?: number;
  max?: number;
  step?: number;
  options?: ParameterOption[];
};

export type StringParameter = BaseParameter & {
  type: 'string';
  initial: string;
  options?: ParameterOption[];
};

export type BooleanParameter = BaseParameter & {
  type: 'boolean';
  initial: boolean;
};

export type VectorParameter = BaseParameter & {
  type: 'number';
  initial: number[];
  min: number;
  max: number;
  step: number;
};

export type Parameter = NumberParameter | StringParameter | BooleanParameter | VectorParameter;

export type ParameterSet = {
  parameters: Parameter[];
  title: string;
};
