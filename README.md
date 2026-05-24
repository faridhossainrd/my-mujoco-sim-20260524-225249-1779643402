# Unitree G1 Humanoid - MuJoCo Simulator

A MuJoCo WebAssembly-based physics simulator for the **Unitree G1 humanoid robot** (29-DOF with dexterous hands).

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the local server:
```bash
python3 -m http.server 8100
```

3. Open your browser:
```
http://localhost:8100
```

## Robot Overview

- **Model:** Unitree G1 (g1_29dof_with_hand)
- **Total Actuators:** 43 position-controlled joints
- **Body Groups:** Legs (12), Waist (3), Arms (14), Hands (14)
- **Mesh Files:** 51 STL files loaded via compressed bundle
- **Pelvis:** Fixed in space for stable animation

## Project Structure

```
project/
├── src/
│   ├── main.js           # Main setup + render loop (add animation code here)
│   └── mujocoUtils.js    # Asset loading & GUI setup
├── assets/scenes/
│   ├── unitree_g1.xml    # Robot model (joints, meshes, actuators)
│   ├── meshes/           # 51 STL mesh files
│   └── meshes_bundle.gz  # Compressed mesh bundle for fast loading
├── index.html            # Entry point
├── FULL_DOCS.md          # Complete technical documentation
└── package.json          # Dependencies
```

## How to Animate

Add animation code in `src/main.js` inside the render loop, before `mujoco.mj_step()`:

```javascript
if (this.params["scene"] === "unitree_g1.xml") {
  const t = this.data.time;

  // Wave right arm
  this.data.ctrl[29] = -1.2;                        // shoulder forward+up
  this.data.ctrl[30] = -0.5;                        // shoulder out to right
  this.data.ctrl[32] = 1.2;                         // elbow bent
  this.data.ctrl[34] = 0.4 * Math.sin(t * 4);       // wrist wave

  // Subtle breathing
  this.data.ctrl[14] = 0.02 * Math.sin(t * 1.5);
}
```

## Key Actuator Indices

| Joint | Index | Direction |
|-------|-------|-----------|
| Left shoulder pitch | 15 | NEGATIVE = forward+up |
| Left shoulder roll | 16 | POSITIVE = out to left |
| Left elbow | 18 | NEGATIVE = straighten, POSITIVE = bend |
| Right shoulder pitch | 29 | NEGATIVE = forward+up |
| Right shoulder roll | 30 | NEGATIVE = out to right |
| Right elbow | 32 | NEGATIVE = straighten, POSITIVE = bend |
| Waist yaw | 12 | POSITIVE = turn left |
| Waist pitch | 14 | NEGATIVE = bow forward |

All actuators use **position control** -- set `data.ctrl[i]` to a target angle in radians. The physics engine handles the force generation.

See `FULL_DOCS.md` for the complete 43-actuator reference with ranges, kp gains, and pose examples.

## Controls

The GUI panel (right side) provides:
- **Scene selector** and pause/resume
- **43 actuator sliders** organized by body group
- **Noise settings** for robustness testing

## Technical Details

- **MuJoCo:** 2.3.1 (WebAssembly)
- **Three.js:** 3D rendering with WebGL
- **Physics Timestep:** 0.002s (500 Hz)
- **Actuator Type:** Position-controlled with PD gains

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari (WebAssembly support required)
