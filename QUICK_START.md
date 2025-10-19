# Quick Start Guide: Static 3D Models

This guide will help you quickly add static 3D models to the OpenSCAD Playground gallery.

## What Are Static Models?

Static models are pre-rendered 3D files (GLTF, GLB, STL, etc.) that display instantly without requiring OpenSCAD compilation. They're perfect for:
- Showcasing complex designs
- Displaying models from other CAD software
- Creating instant-loading demos
- Sharing models that don't need editing

## 5-Minute Setup

### Step 1: Prepare Your Model

Export your 3D model to one of these formats:
- **GLTF** (`.gltf`) - Recommended for models with materials
- **GLB** (`.glb`) - Compact binary version of GLTF
- **STL** (`.stl`) - Common 3D printing format
- **OBJ** (`.obj`) - Wavefront format

### Step 2: Create Project Directory

```bash
cd Models
mkdir "My Awesome Model"
cd "My Awesome Model"
```

### Step 3: Add Your Files

Copy your model file:
```bash
cp /path/to/your/model.gltf .
```

Optionally add a thumbnail:
```bash
cp /path/to/thumbnail.png .
```

### Step 4: Create project.json

Create a file named `project.json` with this content:

```json
{
  "title": "My Awesome Model",
  "entry": "model.gltf",
  "type": "static",
  "description": "A brief description of your model",
  "category": "Examples",
  "tags": ["3d", "demo"],
  "author": "Your Name"
}
```

**Important**: Set `"type": "static"` - this tells the system to use the static model renderer.

### Step 5: Rebuild and View

```bash
# From project root
npm run build:libs
npm start
```

Visit: `http://localhost:4000/?model=My%20Awesome%20Model`

## Example Directory Structure

```
Models/
└── My Awesome Model/
    ├── project.json          # Required: metadata
    ├── model.gltf           # Required: your 3D model
    └── thumbnail.png        # Optional: preview image
```

## Example project.json

Here's a complete example with all optional fields:

```json
{
  "title": "Futuristic Drone",
  "entry": "drone.glb",
  "type": "static",
  "description": "A detailed drone model with PBR materials and animations",
  "category": "Technology",
  "tags": ["drone", "vehicle", "animated", "pbr"],
  "author": "Jane Designer",
  "created": "2024-01-15",
  "image": "thumbnail.jpg"
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Display name in gallery |
| `entry` | Yes | Model filename |
| `type` | Yes | Must be "static" |
| `description` | No | Gallery description |
| `category` | No | Gallery category |
| `tags` | No | Array of search tags |
| `author` | No | Creator name |
| `created` | No | Creation date |
| `image` | No | Custom thumbnail filename |

## Viewing Your Model

### From Gallery
1. Click "Gallery" button in the UI
2. Find your model in the grid
3. Click to open

### Direct URL
Visit: `http://localhost:4000/?model=Your%20Model%20Name`

(Spaces are encoded as %20)

## Troubleshooting

### Model doesn't appear in gallery
- Check `project.json` has `"type": "static"`
- Verify entry filename matches actual file
- Rebuild libraries: `npm run build:libs`

### Model doesn't load
- Check file format is supported
- Verify file isn't corrupted
- Check browser console for errors

### No thumbnail showing
- Add thumbnail.png, thumbnail.jpg, or thumbnail.svg
- Or specify custom image in project.json
- Default formats checked: png, jpg, jpeg, webp, svg

## Best Practices

### File Formats
- Use **GLB** for production (compact, fast loading)
- Use **GLTF** for development (human-readable, easy debugging)
- Optimize geometry (remove unnecessary vertices)
- Compress textures to reasonable sizes

### Model Optimization
- Keep file size under 10MB for fast loading
- Use power-of-2 texture sizes (512, 1024, 2048)
- Bake lighting when possible
- Remove hidden geometry

### Project Organization
- Use clear, descriptive titles
- Add meaningful tags for searchability
- Include good thumbnails
- Write helpful descriptions

## Examples to Study

The repository includes these example static models:

### Atmospheric Sampler
```
Models/Atmospheric Sampler/
├── project.json
├── model.gltf
└── Atmospheric Sampler Project v81.usdz
```
A complex model with materials showing professional-grade rendering.

### Simple Cube Example
```
Models/Simple Cube Example/
├── project.json
├── cube.gltf
└── thumbnail.svg
```
A minimal example perfect for learning the basics.

## Advanced: GLTF with Embedded Textures

For GLB/GLTF with textures, you can embed them or reference external files:

**Embedded (recommended):**
```json
{
  "images": [
    {
      "uri": "data:image/png;base64,iVBORw0KG..."
    }
  ]
}
```

**External:**
```json
{
  "images": [
    {
      "uri": "texture.png"
    }
  ]
}
```

## Need Help?

- See [STATIC_MODELS.md](./STATIC_MODELS.md) for technical details
- See [STATIC_MODELS_VISUAL_GUIDE.md](./STATIC_MODELS_VISUAL_GUIDE.md) for diagrams
- Check existing examples in `Models/` directory

## Next Steps

1. Try the Simple Cube Example first
2. Export a model from your favorite 3D software
3. Follow this guide to add it
4. Share your creations!

Happy modeling! 🎨
