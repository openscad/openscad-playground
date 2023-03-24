// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

export interface State {
  source: {
    content: string
  },
  output?: {
    path: string,
    timestamp: number,
    sizeBytes: number,
    formattedSize: string,
  },
};

