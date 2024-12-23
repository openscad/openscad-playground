export type Vertex = {
    x: number;
    y: number;
    z: number;
}

export type Color = [number, number, number, number];

export type Face = {
    vertices: [number, number, number];
    colorIndex: number;
}

export type IndexedPolyhedron = {
    vertices: Vertex[];
    faces: Face[];
    colors: Color[];
}

export const DEFAULT_FACE_COLOR: Color = [0xf9 / 255, 0xd7 / 255, 0x2c / 255, 1];
