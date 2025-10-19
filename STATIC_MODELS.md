# Static 3D Model Support

## Overview

The OpenSCAD Playground supports displaying pre-rendered static 3D models alongside OpenSCAD projects. This feature uses Google's [Model Viewer](https://modelviewer.dev/) web component, which provides:

- Interactive 3D viewing with pan, zoom, and rotate
- Augmented Reality (AR) support on compatible devices
- Support for multiple 3D formats (GLTF, GLB, STL, OBJ, PLY, OFF, etc.)
- Consistent viewing experience for both OpenSCAD renders and static models

## Architecture

### Key Components

1. **ViewerPanel** (`src/components/ViewerPanel.tsx`)
   - Uses `<model-viewer>` web component for rendering
   - Prioritizes static models: `state.staticModel?.objectUrl ?? state.output?.displayFileURL`
   - Handles camera controls and predefined view angles
   - Supports blurhash/thumbhash placeholders during loading

2. **ProjectGalleryDialog** (`src/components/ProjectGalleryDialog.tsx`)
   - Scans Models directory for both SCAD and static projects
   - Reads `project.json` to determine project type
   - Displays static models with a "static" type badge in the gallery

3. **Model State** (`src/state/model.ts`)
   - `openStaticProject()` method loads static models
   - Creates blob URLs from file system data
   - Sets `staticModel` state with object URL and metadata
   - Disables editor and customizer for static projects

4. **App** (`src/components/App.tsx`)
   - Automatically detects static projects from URL parameters
   - Hides editor and customizer UI for static models
   - Maintains consistent viewer-only experience

## Creating Static Model Projects

### Directory Structure
```
Models/
└── Your Project Name/
    ├── project.json          # Required: project metadata
    ├── model.gltf           # Your 3D model file
    └── thumbnail.png        # Optional: gallery preview image
```

### project.json Format
```json
{
  "title": "Project Title",
  "entry": "model.gltf",
  "type": "static",
  "description": "Project description for gallery",
  "category": "Category Name",
  "tags": ["tag1", "tag2"],
  "author": "Author Name"
}
```

### Supported Formats

| Format | Extension | MIME Type | Notes |
|--------|-----------|-----------|-------|
| GLTF | `.gltf` | `model/gltf+json` | JSON-based, recommended |
| GLB | `.glb` | `model/gltf-binary` | Binary GLTF, more compact |
| STL | `.stl` | `model/stl` | Common 3D printing format |
| OBJ | `.obj` | `model/obj` | Wavefront object |
| PLY | `.ply` | `model/ply` | Polygon file format |
| OFF | `.off` | `model/off` | Object file format |

## Examples

### Atmospheric Sampler
Pre-existing example demonstrating a complex GLTF model with textures and materials.
- Location: `Models/Atmospheric Sampler/`
- Entry: `model.gltf`

### Simple Cube Example
Minimal example demonstrating a basic GLTF cube with embedded geometry.
- Location: `Models/Simple Cube Example/`
- Entry: `cube.gltf`

## Implementation Details

### Model Loading Flow

1. User selects project from gallery or URL with `?model=ProjectName`
2. App.tsx reads `Models/ProjectName/project.json`
3. If `type: "static"`, calls `model.openStaticProject(entryPath)`
4. `openStaticProject()` reads file from virtual filesystem
5. Creates blob URL from file data
6. Sets `staticModel` state with URL and metadata
7. ViewerPanel renders using `<model-viewer src={staticModel.objectUrl}>`

### Editor Behavior

Static projects automatically:
- Disable the Monaco code editor
- Hide the editor toggle button
- Hide the customizer panel
- Show viewer in full-screen single-panel mode
- Prevent rendering, syntax checking, and parameter updates

### Gallery Integration

The gallery shows static projects with:
- Type badge indicating "static"
- Same thumbnail support as SCAD projects
- Category and tag filtering
- Seamless navigation between SCAD and static models

## Future Enhancements

Potential improvements:
- [ ] Drag-and-drop support for adding static models
- [ ] Model format conversion utilities
- [ ] Metadata extraction from GLTF files
- [ ] Support for USDZ format (already present in Atmospheric Sampler)
- [ ] Model animation playback controls
- [ ] Comparison view: side-by-side SCAD vs static render
