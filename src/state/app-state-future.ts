export type CustomizerValues = {name: string, value: string|number|boolean}[]
export type CustomizerSchema = {
  presets: {
    // No name = default preset
    name?: string,
    values: CustomizerValues
  },
  variables: ({
    type: 'string'
    default: string
  } | {
    type: 'boolean'
    default: boolean
  } | {
    type: 'enum',
    default: number | string
    values: number[] | string[]
    labels?: string[]
  } | {
    type: 'range',
    default: number,
    start?: number, // Thingiverse supports foo = 10; // [50]
    end: number,
    step?: number
  })
}

export interface SourceLocation {
  path: string,
  row?: number,
  column?: number,
}
export interface PlaygroundState {
  fs: {
    inputRoot: string,
    resources: {
      path: string,
      lastModified: number,
      type: 'file' | 'mounted-zip',
      mimeType: string,
      // If mimeType ends w/ ;base64, this is a base64 encoded string
      content: string,
    }[],
  },
  fileExplorerPath?: string,
  scadInputPath?: string,
  outputLogs?: {
    stdout: string,
    stderr: string,
    errors: {
      message: string,
      loc: SourceLocation
    }[],
    warnings: {
      message: string,
      loc: SourceLocation
    }[],
  },

  viewer: {
    mode: 'normal' | 'maximized' | 'full-screen'
    // TODO: camera, zoom...
  },

  output?: {
    path: string,
    timestamp: number,
    sizeBytes: number,
    formattedSize: string,
  },

  customizer: {
    visible?: boolean,
    schema?: CustomizerSchema,
    values: CustomizerValues,
  },
};

export {}