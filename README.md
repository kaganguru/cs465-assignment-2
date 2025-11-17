# CS465 Robot Animation Assignment

A 3D hierarchical robot model viewer and animator built with raw WebGL.

## Features

- **WebGL Rendering**: Custom GLSL shaders with diffuse and specular lighting
- **Hierarchical Model**: Robot with body, head, and 4 legs (each with upper and lower segments)
- **OBJ/MTL Loading**: Loads 3D models with textures from assets folder
- **Matrix Stack**: Proper hierarchical transformations using push/pop
- **Keyframe Animation**: Timeline-based animation system with linear interpolation
- **Interactive Timeline**: Visual keyframe editor with 10 tracks (one per body part)
- **3D Picking**: Click directly on body parts in the viewport to select and animate them
- **Camera Controls**: Orbit camera (click+drag) and pan (space+drag)
- **Save/Load**: Export and import animations as JSON

## How to Run

Simply open `index.html` in a modern web browser:

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (recommended for better texture loading)
python3 -m http.server 8000
# Then open http://localhost:8000 in your browser
```

## Controls

### Timeline Controls
- **Play Button (▶)**: Start the animation
- **Pause Button (⏸)**: Pause the animation
- **Reset Button (⏹)**: Reset to frame 0
- **Duration Input**: Change animation duration (default: 5 seconds)
- **Save Button**: Export keyframes to JSON file
- **Load Button**: Import keyframes from JSON file

### Adding/Editing Keyframes
1. **Pause** the animation first (you cannot edit while playing)
2. **Add keyframes** using either method:
   - Click on any track at any position in the timeline, OR
   - Click directly on a body part in the 3D viewport
3. The keyframe will appear as an orange diamond
4. **Click a keyframe** to select it (turns red) and edit its values in the right panel
5. Use the **sliders** in the right panel to adjust translation and rotation
6. Press **Delete** or **Backspace** key to remove the selected keyframe
7. **Reset buttons** restore keyframe to its initial values

### 3D Picking & Gizmo
- **Click on body parts** in the viewport to select them (when paused)
- Automatically creates a keyframe at the current time
- Selected parts turn red
- **Transform Gizmo** appears showing:
  - 3 colored arrows (Red=X, Green=Y, Blue=Z) for translation
  - Hold **Shift** and click to toggle rotation rings
  - Drag gizmo handles to transform parts visually (coming soon)
- Works great for intuitive posing!

### Timeline Navigation
- **Click the ruler** at the top to scrub through the animation
- Keyframes automatically loop from end to start

### Camera Controls
- **Click + Drag**: Orbit camera around the robot
- **Space + Drag**: Pan the camera (move the orbit center)
- **Mouse Wheel**: Zoom in/out

## Architecture

### Hierarchical Structure
```
Body (root)
 ├─ Head
 ├─ UpperLegFL → LowerLegFL
 ├─ UpperLegFR → LowerLegFR
 ├─ UpperLegBL → LowerLegBL
 └─ UpperLegBR → LowerLegBR
```

### Key Components

1. **Matrix Stack**: Implements push/pop for hierarchical transformations
2. **Shader Program**: Vertex and fragment shaders with Phong lighting
3. **OBJ Parser**: Loads vertices, normals, and texture coordinates
4. **MTL Parser**: Loads materials and textures
5. **Animation System**: Keyframe-based with linear interpolation
6. **UI System**: Timeline editor with visual keyframes

### Rendering Pipeline

1. Load OBJ/MTL files and create WebGL buffers
2. For each frame:
   - Clear framebuffer
   - Set up projection and view matrices
   - Initialize matrix stack with view matrix
   - Recursively draw robot hierarchy:
     - Push current matrix
     - Apply part transform (from keyframes or defaults)
     - Draw part mesh
     - Recursively draw children
     - Pop matrix
3. Update animation time if playing

## File Structure

```
cs465/
├── index.html          # Main HTML file
├── app.js              # WebGL application
├── README.md           # This file
└── assets/             # 3D models and textures
    ├── body.obj/mtl
    ├── head.obj/mtl
    ├── upper_leg.obj/mtl
    ├── lower_leg.obj/mtl
    └── Textures/       # PNG texture files
```

## Sample Animation

The application includes a sample walking animation with:
- Body bounce (up and down)
- Alternating leg movements for natural walk cycle
- 4 legs moving in pairs (diagonal coordination)

You can modify or delete these keyframes and create your own!

## Technical Details

- **No third-party WebGL libraries** (no Three.js, Babylon.js, etc.)
- Pure WebGL with custom matrix math
- GLSL shaders for lighting (directional light with diffuse + specular)
- Proper hierarchical rendering with matrix stack
- Linear interpolation between keyframes with looping support

## Browser Compatibility

Tested on modern browsers with WebGL support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Notes

- Red tint indicates the selected body part
- Keyframes store both translation (x,y,z) and rotation (x,y,z) in radians
- Animation loops seamlessly from 100% back to 0%
- Each body part inherits transforms from its parent in the hierarchy

