# Quick Start Guide

## Running the Application

### Method 1: Direct (Recommended)
```bash
./start.sh
```
Then open your browser to: **http://localhost:8080**

### Method 2: Manual
Just open `index.html` directly in your browser (Chrome, Firefox, or Safari)

## What You'll See

When you open the application, you'll see:
- **Left**: 3D viewport with the robot model (sample walking animation already loaded)
- **Right**: Control panel (will show sliders when you select a keyframe)
- **Bottom**: Timeline editor with 10 tracks showing keyframes as orange diamonds

## First Steps

1. **Watch the animation**: Click the **Play** button (▶) to see the sample walking animation
2. **Pause it**: Click the **Pause** button (⏸) to stop and edit
3. **Select a keyframe**: Click any orange diamond to see its values in the right panel
4. **Edit values**: Use the sliders to adjust rotation and translation
5. **Add new keyframes**: Click on any empty space in a track OR click directly on a body part in 3D
6. **Delete keyframes**: Select a keyframe and press **Delete** or **Backspace**

## Camera Controls (Works Anytime)

- **Rotate view**: Click and drag anywhere on the 3D viewport
- **Pan**: Hold **Space** and drag
- **Zoom**: Use mouse wheel

## Sample Animation Available

A sample walking animation is included as `walking_animation.json`:
- Click the **Load** button and select this file to see it in action
- **Body**: Bounces up and down
- **Legs**: Alternate movement (diagonal pairs move together)
- **Duration**: 5 seconds (adjustable)

## Creating Your Own Animation

**Method 1: Using Timeline**
1. **Pause** the animation (if playing)
2. **Click** on any track at any time position to add a keyframe
3. **Adjust** the sliders on the right for your desired pose
4. Add more keyframes at different times
5. **Click Play** to see your animation!

**Method 2: Using 3D Picking & Gizmo**
1. **Pause** the animation
2. **Click directly on a body part** in the 3D viewport
3. This creates a keyframe for that part at the current time
4. A **3D gizmo** appears with colored arrows (Red=X, Green=Y, Blue=Z)
5. **Hold Shift + Click** to toggle between translate/rotate mode
6. **Adjust** the sliders to edit the pose
7. Move the timeline and click other parts to build your animation!

## Save & Load

- **Save**: Exports all keyframes to a `.json` file
- **Load**: Imports keyframes from a `.json` file

## Tips

- The robot has 10 parts: Body, Head, 4 Upper Legs, 4 Lower Legs
- Lower legs are children of upper legs (hierarchical!)
- When you move the body, everything moves with it
- Rotations are in **radians** (π ≈ 3.14 = 180°)
- Animation loops seamlessly

## Troubleshooting

**Models not showing?**
- Make sure you're using a local server (./start.sh)
- Check browser console (F12) for errors

**Textures not loading?**
- Use ./start.sh instead of opening index.html directly
- Some browsers block local file access

**Animation not smooth?**
- Add more keyframes between poses
- Try shorter duration with fewer keyframes

## Assignment Requirements Met

✅ Raw WebGL (no Three.js or libraries)
✅ GLSL shaders with diffuse/specular lighting  
✅ OBJ/MTL loader with texture support
✅ Hierarchical rendering with matrix stack
✅ Proper push/pop for child transforms
✅ Keyframe animation with interpolation
✅ Interactive timeline editor
✅ Orbit camera controls
✅ Save/Load functionality
✅ 10 body part tracks
✅ Red tint for selected parts

Enjoy animating! 🤖

