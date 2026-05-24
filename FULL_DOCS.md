# Unitree G1 Humanoid - MuJoCo Simulator Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Robot Specifications](#robot-specifications)
4. [Joint & Actuator Reference](#joint--actuator-reference)
5. [How Position Actuators Work](#how-position-actuators-work)
6. [Animation Guide](#animation-guide)
7. [Mesh Loading & Bundle System](#mesh-loading--bundle-system)
8. [GUI Controls](#gui-controls)
9. [Physics Simulation Loop](#physics-simulation-loop)
10. [Coordinate System](#coordinate-system)
11. [Customization Guide](#customization-guide)
12. [Troubleshooting](#troubleshooting)
13. [Performance Optimization](#performance-optimization)

---

## Overview

This is a **WebAssembly-based MuJoCo physics simulator** for the **Unitree G1 humanoid robot** (29-DOF with dexterous hands, 43 total actuators). It runs entirely in the browser with no server-side physics computation.

**Stack:**
- **MuJoCo 2.3.1 WebAssembly** - Physics engine compiled to WASM
- **Three.js** - 3D rendering
- **lil-gui** - GUI control panel
- **Unitree G1 Model** - 43 position-controlled actuators, 51 STL mesh files

**Key Features:**
- Real-time physics with position-controlled actuators
- 43 individually controllable joints (legs, waist, arms, hands)
- Fixed pelvis for stable animation (full-body dynamics optional)
- Mesh bundle loading for fast startup (51MB -> 22MB compressed, single request)
- Dark themed ROBA UI with actuator sliders

---

## Architecture

### File Structure
```
project/
├── index.html                    # Entry point with GUI styling
├── package.json                  # Dependencies (three, mujoco-js, esbuild)
├── FULL_DOCS.md                  # This documentation
├── README.md                     # Quick start guide
├── src/
│   ├── main.js                   # Main Three.js + MuJoCo setup, render loop, animation code
│   └── mujocoUtils.js            # Asset loading, GUI setup, scene management
│   └── utils/
│       ├── DragStateManager.js   # Mouse drag interaction
│       ├── Debug.js              # Debug utilities
│       └── Reflector.js          # Floor reflections
├── assets/
│   ├── favicon.png               # ROBA logo
│   └── scenes/
│       ├── unitree_g1.xml        # Robot model definition (joints, meshes, actuators)
│       ├── empty_room.xml        # Fallback empty scene
│       ├── index.json            # Scene file manifest for loader
│       ├── meshes_bundle.gz      # Compressed mesh bundle (all STL files)
│       └── meshes/               # Individual STL mesh files (51 files)
│           ├── pelvis.STL
│           ├── torso_link.STL
│           ├── head_link.STL
│           ├── left_shoulder_pitch_link.STL
│           ├── ...               # 51 total mesh files
│           └── right_hand_index_1_link.STL
```

### Data Flow
```
index.html
  └── src/main.js (MuJoCoDemo class)
        ├── Loads MuJoCo WASM module
        ├── Downloads scene assets via mujocoUtils.js
        │     ├── Fetches index.json (file manifest)
        │     ├── Loads meshes_bundle.gz (compressed STL bundle)
        │     │     └── Decompresses via DecompressionStream API
        │     └── Loads XML scene files
        ├── Creates MuJoCo model from XML
        ├── Builds Three.js scene from MuJoCo bodies
        └── Render loop:
              ├── Read actuator GUI values → data.ctrl[]
              ├── Execute animation code (your code goes here)
              ├── mujoco.mj_step() (physics step)
              └── Sync Three.js meshes from MuJoCo body positions
```

---

## Robot Specifications

### Unitree G1 Humanoid
- **Model:** g1_29dof_with_hand
- **Total Actuators:** 43 (all position-controlled)
- **Degrees of Freedom:** 29 body joints + 14 hand joints
- **Height:** ~1.2m (pelvis at 0.793m)
- **Mesh Files:** 51 STL files (~51MB uncompressed, ~22MB bundled+gzipped)
- **Actuator Type:** Position-controlled (PD controller with kp gains)
- **Pelvis:** Fixed in space for stable animation (free joint available via XML comment)

### Body Groups
| Group | Joints | Actuator Indices |
|-------|--------|-----------------|
| Left Leg | 6 joints (hip pitch/roll/yaw, knee, ankle pitch/roll) | 0-5 |
| Right Leg | 6 joints (hip pitch/roll/yaw, knee, ankle pitch/roll) | 6-11 |
| Waist | 3 joints (yaw, roll, pitch) | 12-14 |
| Left Arm | 7 joints (shoulder pitch/roll/yaw, elbow, wrist roll/pitch/yaw) | 15-21 |
| Left Hand | 7 joints (thumb x3, middle x2, index x2) | 22-28 |
| Right Arm | 7 joints (shoulder pitch/roll/yaw, elbow, wrist roll/pitch/yaw) | 29-35 |
| Right Hand | 7 joints (thumb x3, middle x2, index x2) | 36-42 |

---

## Joint & Actuator Reference

### POSITION ACTUATORS - ctrl = target angle in RADIANS

All actuators use `<position>` type with internal PD controllers. Setting `data.ctrl[i] = angle` means "move joint i to this target angle." The actuator generates force automatically. `ctrl = 0` for all joints = default standing pose.

### Complete Actuator Index Map (data.ctrl[i]) - EMPIRICALLY VERIFIED

```
LEGS (12 actuators):
 0: left_hip_pitch     [-2.53, 2.88]  kp=200  — NEGATIVE = leg forward, POSITIVE = leg back
 1: left_hip_roll      [-0.52, 2.97]  kp=200  — POSITIVE = leg outward (left)
 2: left_hip_yaw       [-2.76, 2.76]  kp=200  — leg twist around vertical axis
 3: left_knee          [-0.09, 2.88]  kp=300  — POSITIVE = bend knee
 4: left_ankle_pitch   [-0.87, 0.52]  kp=100  — NEGATIVE = toes up, POSITIVE = toes down
 5: left_ankle_roll    [-0.26, 0.26]  kp=100  — ankle side tilt
 6: right_hip_pitch    [-2.53, 2.88]  kp=200  — same as left
 7: right_hip_roll     [-2.97, 0.52]  kp=200  — NEGATIVE = leg outward (right) [opposite of left!]
 8: right_hip_yaw      [-2.76, 2.76]  kp=200  — leg twist
 9: right_knee         [-0.09, 2.88]  kp=300  — POSITIVE = bend knee
10: right_ankle_pitch  [-0.87, 0.52]  kp=100  — NEGATIVE = toes up, POSITIVE = toes down
11: right_ankle_roll   [-0.26, 0.26]  kp=100  — ankle side tilt

WAIST (3 actuators):
12: waist_yaw    [-2.62, 2.62]  kp=150  — POSITIVE = turn torso LEFT, NEGATIVE = turn RIGHT
13: waist_roll   [-0.52, 0.52]  kp=100  — tilt torso sideways
14: waist_pitch  [-0.52, 0.52]  kp=100  — NEGATIVE = lean forward (bow), POSITIVE = lean back

LEFT ARM (7 actuators) - EMPIRICALLY TESTED with displacement measurements:
15: left_shoulder_pitch  [-3.09, 2.67]  kp=80   — NEGATIVE = arm FORWARD+UP, POSITIVE = arm BACK+DOWN
     -1.0 rad → hand moves forward +0.14m and up +0.21m from rest
     +1.0 rad → hand moves back -0.25m and down -0.04m from rest
16: left_shoulder_roll   [-1.59, 2.25]  kp=80   — POSITIVE = arm OUT to LEFT side
     +1.0 rad → hand moves left +0.16m and up +0.07m
17: left_shoulder_yaw    [-2.62, 2.62]  kp=60   — ROTATES upper arm (twist inward/outward)
18: left_elbow           [-1.05, 2.09]  kp=80   — NEGATIVE = STRAIGHTEN, POSITIVE = BEND
     -1.0 rad → hand moves up +0.18m (arm straightens)
     +1.0 rad → hand moves back -0.10m and down -0.12m (arm bends tighter)
19: left_wrist_roll      [-1.97, 1.97]  kp=20   — forearm rotation (pronation/supination)
20: left_wrist_pitch     [-1.61, 1.61]  kp=10   — NEGATIVE = hand UP, POSITIVE = hand DOWN
21: left_wrist_yaw       [-1.61, 1.61]  kp=10   — hand side-to-side rotation

LEFT HAND (7 actuators):
22: left_thumb_0   [-1.05, 1.05]  kp=5  — thumb base rotation
23: left_thumb_1   [-0.72, 1.05]  kp=5  — thumb middle joint
24: left_thumb_2   [0, 1.75]      kp=5  — thumb tip (POSITIVE = close/curl)
25: left_middle_0  [-1.57, 0]     kp=5  — middle finger base (NEGATIVE = close)
26: left_middle_1  [-1.75, 0]     kp=5  — middle finger tip (NEGATIVE = close)
27: left_index_0   [-1.57, 0]     kp=5  — index finger base (NEGATIVE = close)
28: left_index_1   [-1.75, 0]     kp=5  — index finger tip (NEGATIVE = close)

RIGHT ARM (7 actuators) - MIRRORS LEFT:
29: right_shoulder_pitch [-3.09, 2.67]  kp=80   — NEGATIVE = arm FORWARD+UP (same as left!)
     -1.0 rad → hand moves forward +0.14m and up +0.21m
30: right_shoulder_roll  [-2.25, 1.59]  kp=80   — NEGATIVE = arm OUT to RIGHT side [opposite of left!]
     -1.0 rad → hand moves right -0.16m and up +0.07m
31: right_shoulder_yaw   [-2.62, 2.62]  kp=60   — upper arm twist
32: right_elbow          [-1.05, 2.09]  kp=80   — NEGATIVE = STRAIGHTEN, POSITIVE = BEND (same as left)
33: right_wrist_roll     [-1.97, 1.97]  kp=20   — forearm rotation
34: right_wrist_pitch    [-1.61, 1.61]  kp=10   — NEGATIVE = hand UP, POSITIVE = hand DOWN
35: right_wrist_yaw      [-1.61, 1.61]  kp=10   — hand side-to-side

RIGHT HAND (7 actuators) - OPPOSITE sign convention from left hand:
36: right_thumb_0  [-1.05, 1.05]  kp=5  — thumb base rotation
37: right_thumb_1  [-1.05, 0.72]  kp=5  — thumb middle
38: right_thumb_2  [-1.75, 0]     kp=5  — thumb tip (NEGATIVE = close) [opposite of left!]
39: right_middle_0 [0, 1.57]      kp=5  — middle finger (POSITIVE = close) [opposite of left!]
40: right_middle_1 [0, 1.75]      kp=5  — middle finger tip (POSITIVE = close)
41: right_index_0  [0, 1.57]      kp=5  — index finger (POSITIVE = close) [opposite of left!]
42: right_index_1  [0, 1.75]      kp=5  — index finger tip (POSITIVE = close)
```

### 5 CRITICAL DIRECTION RULES

1. **Shoulder pitch**: NEGATIVE = forward+up for BOTH arms
2. **Shoulder roll**: LEFT uses POSITIVE to go outward, RIGHT uses NEGATIVE to go outward
3. **Elbow**: NEGATIVE = straighten, POSITIVE = bend -- for BOTH arms
4. **Wrist pitch**: NEGATIVE = hand tilts up, POSITIVE = hand tilts down -- both arms
5. **Fingers**: LEFT hand closes with NEGATIVE, RIGHT hand closes with POSITIVE (except thumbs which are reversed)

---

## How Position Actuators Work

Unlike motor/torque actuators (which apply raw force), **position actuators** use a PD controller internally:

```
force = kp * (target_angle - current_angle) - kd * velocity
```

- `kp` (proportional gain) = stiffness. Higher kp = faster, stiffer response
- The target angle is what you set via `data.ctrl[i]`
- The actuator generates whatever force is needed to reach the target (within `forcerange` limits)
- This means you think in terms of **desired angles**, not forces

### Practical Implications
- Setting `data.ctrl[15] = -1.5` means "move left shoulder pitch to -1.5 radians"
- The joint will smoothly move to that angle with physics-accurate dynamics
- Heavier limbs (legs, kp=200-300) have higher gains than lighter ones (fingers, kp=5)
- All forces are clamped to `forcerange` to prevent unrealistic motion

### Fixed Pelvis Design
The pelvis is fixed in space (no free joint) so the robot stands stably without needing a balance controller. This is intentional for animation work -- you control poses and motions without worrying about falling.

To enable full free-body dynamics (robot can fall, needs balance), uncomment this line in `unitree_g1.xml`:
```xml
<joint name="floating_base_joint" type="free" limited="false" actuatorfrclimited="false" />
```

---

## Animation Guide

### Where to Put Animation Code

Add animation code inside the render loop in `src/main.js`, within the `if (!this.params["paused"])` block, **BEFORE** the `mujoco.mj_step()` call:

```javascript
// Inside the render loop in src/main.js
if (!this.params["paused"]) {
  // YOUR ANIMATION CODE GOES HERE
  if (this.params["scene"] === "unitree_g1.xml") {
    const t = this.data.time;
    // Set actuator targets...
    this.data.ctrl[15] = -1.2;  // left shoulder pitch forward
  }

  // Physics step (do not move this)
  mujoco.mj_step(this.model, this.data);
}
```

### Verified Pose Cheat Sheet

All values in radians. Always set ALL joints in a pose together for natural results.

**Standing neutral:** all ctrl = 0

**Wave right arm (friendly greeting):**
```javascript
this.data.ctrl[29] = -1.2;                        // shoulder pitch: arm forward+up
this.data.ctrl[30] = -0.5;                        // shoulder roll: arm out to right
this.data.ctrl[32] = 1.2;                         // elbow: bent
this.data.ctrl[34] = 0.4 * Math.sin(t * 4);       // wrist pitch: wave motion
// Optional: close hand, slight waist turn
this.data.ctrl[39] = 1.5; this.data.ctrl[40] = 1.7; // close middle finger
this.data.ctrl[41] = 1.5; this.data.ctrl[42] = 1.7; // close index finger
this.data.ctrl[12] = -0.15;                       // slight waist turn toward wave
```

**Wave left arm:**
```javascript
this.data.ctrl[15] = -1.2;                        // shoulder pitch forward+up
this.data.ctrl[16] = 0.5;                         // shoulder roll out to left
this.data.ctrl[18] = 1.2;                         // elbow bent
this.data.ctrl[20] = 0.4 * Math.sin(t * 4);       // wrist wave
```

**T-pose (both arms straight out):**
```javascript
this.data.ctrl[16] = 1.5;   // left shoulder roll out
this.data.ctrl[18] = -0.5;  // left elbow straight
this.data.ctrl[30] = -1.5;  // right shoulder roll out
this.data.ctrl[32] = -0.5;  // right elbow straight
```

**Both arms raised forward (reaching):**
```javascript
this.data.ctrl[15] = -1.5;  this.data.ctrl[18] = -0.3;  // left arm
this.data.ctrl[29] = -1.5;  this.data.ctrl[32] = -0.3;  // right arm
```

**Arms up (surrender/celebration):**
```javascript
this.data.ctrl[15] = -2.5;  this.data.ctrl[18] = -0.8;  // left arm up
this.data.ctrl[29] = -2.5;  this.data.ctrl[32] = -0.8;  // right arm up
```

**Pointing right arm forward:**
```javascript
this.data.ctrl[29] = -1.5;  // shoulder forward
this.data.ctrl[32] = -0.5;  // elbow straight
this.data.ctrl[41] = 1.5;   // extend index finger (close others)
this.data.ctrl[42] = 1.5;
this.data.ctrl[39] = 1.5;   // close middle
this.data.ctrl[40] = 1.7;
```

**Fist (left hand):**
```javascript
this.data.ctrl[24] = 1.5;   // thumb close
this.data.ctrl[25] = -1.5;  // middle base
this.data.ctrl[26] = -1.7;  // middle tip
this.data.ctrl[27] = -1.5;  // index base
this.data.ctrl[28] = -1.7;  // index tip
```

**Fist (right hand):**
```javascript
this.data.ctrl[38] = -1.5;  // thumb close
this.data.ctrl[39] = 1.5;   // middle base
this.data.ctrl[40] = 1.7;   // middle tip
this.data.ctrl[41] = 1.5;   // index base
this.data.ctrl[42] = 1.7;   // index tip
```

**Bow:** `this.data.ctrl[14] = -0.4;` (lean forward at waist)

**Turn torso left:** `this.data.ctrl[12] = 0.5;`
**Turn torso right:** `this.data.ctrl[12] = -0.5;`

**Natural idle breathing:** `this.data.ctrl[14] = 0.02 * Math.sin(t * 1.5);`

### Animation Best Practices for Natural Motion

1. **NEVER move a single joint alone** -- always engage shoulder + elbow + wrist together for arm motions
2. **Use smooth easing** for transitions: `(1 - Math.cos(phase * Math.PI)) / 2` (ease in-out)
3. **Add secondary motion**: slight waist sway (ctrl[12..14]) during arm movements
4. **Stagger timing**: don't start all joints simultaneously -- offset by 0.1-0.2s for organic feel
5. **Use `this.data.time`** for timing, not frame count
6. **Natural arm speeds**: raise takes 0.5-1.0s, wave frequency 2-4 Hz, gestures 0.3-0.8s
7. **Rest pose has slight bend**: ctrl[18]=0.2, ctrl[32]=0.2 looks more natural than perfectly straight
8. **Weight shift**: when raising one arm, add subtle opposite waist lean (ctrl[13]=+/-0.05)
9. **Finger detail**: close fingers progressively (base before tip) with slight delays
10. **Sequence pattern** for complex animations:

```javascript
const t = this.data.time;
const duration = 3.0;  // seconds per cycle
const phase = (t % duration) / duration;  // 0 -> 1 normalized
const ease = (1 - Math.cos(phase * Math.PI)) / 2;  // smooth ease in-out

// Interpolate between poses
const startAngle = 0;
const endAngle = -1.5;
this.data.ctrl[15] = startAngle + (endAngle - startAngle) * ease;
```

### Multi-Phase Animation Example

```javascript
if (this.params["scene"] === "unitree_g1.xml") {
  const t = this.data.time;
  const cycleDuration = 6.0;
  const phase = (t % cycleDuration) / cycleDuration;

  if (phase < 0.25) {
    // Phase 1: Raise right arm (0-1.5s)
    const p = phase / 0.25;
    const e = (1 - Math.cos(p * Math.PI)) / 2;
    this.data.ctrl[29] = -1.5 * e;   // shoulder forward
    this.data.ctrl[32] = 1.0 * e;    // elbow bend
  } else if (phase < 0.5) {
    // Phase 2: Wave (1.5-3.0s)
    this.data.ctrl[29] = -1.5;
    this.data.ctrl[32] = 1.0;
    this.data.ctrl[34] = 0.4 * Math.sin(t * 6);  // wrist wave
  } else if (phase < 0.75) {
    // Phase 3: Lower arm (3.0-4.5s)
    const p = (phase - 0.5) / 0.25;
    const e = (1 - Math.cos(p * Math.PI)) / 2;
    this.data.ctrl[29] = -1.5 * (1 - e);
    this.data.ctrl[32] = 1.0 * (1 - e);
    this.data.ctrl[34] = 0;
  } else {
    // Phase 4: Rest (4.5-6.0s)
    this.data.ctrl[29] = 0;
    this.data.ctrl[32] = 0;
  }

  // Subtle idle motion throughout
  this.data.ctrl[14] = 0.02 * Math.sin(t * 1.5);  // breathing
}
```

---

## Mesh Loading & Bundle System

### How Meshes are Loaded

The simulator uses a **mesh bundle system** for fast loading. Instead of 51 individual HTTP requests for STL files, all meshes are packed into a single gzip-compressed bundle.

**Bundle format:** `meshes_bundle.gz`
```
[4 bytes LE: header length][JSON manifest][concatenated binary data]
```

The manifest maps relative file paths to `{offset, size}` within the binary data section.

### Loading Process (mujocoUtils.js)

1. Fetch `index.json` to get list of non-mesh scene files (XML)
2. Try to fetch `meshes_bundle.gz`
3. If bundle exists: decompress with native `DecompressionStream`, parse manifest, write all mesh files to WASM virtual filesystem
4. If bundle doesn't exist: fall back to loading individual files listed in index.json
5. Load XML scene files
6. Initialize MuJoCo model from XML

### Adding New Meshes

1. Place new `.stl` or `.obj` files in `assets/scenes/meshes/`
2. Reference them in `unitree_g1.xml`:
```xml
<mesh name="my_mesh" file="my_mesh.stl" />
```
3. Use the mesh in a body:
```xml
<geom type="mesh" mesh="my_mesh" rgba="0.5 0.5 0.5 1" />
```
4. Regenerate the mesh bundle (or let individual file loading handle it)

---

## GUI Controls

The GUI panel (right side) provides:

- **Scene selector**: Switch between available scenes
- **Simulation**: Pause/Resume toggle
- **Actuators**: Individual sliders for all 43 joints, organized by body group:
  - Legs (12 sliders)
  - Waist (3 sliders)
  - Arms (14 sliders)
  - Hands (14 sliders)
- **Noise Settings**: Add control noise for testing robustness

### GUI Styling

The GUI uses a dark theme matching ROBA branding. Colors are defined in `index.html`:
```css
.lil-gui {
    --background-color: #0D0D0D;
    --title-text-color: #22C55E;
    --widget-color: #1a1a2e;
    --hover-color: #252540;
}
```

---

## Physics Simulation Loop

### Timestep
- Physics timestep: 0.002s (500 Hz)
- The render loop calls `mujoco.mj_step()` which advances the simulation by one timestep
- Multiple physics steps may run per render frame to maintain real-time

### Simulation Data Access
```javascript
// Read current time
const t = this.data.time;

// Set actuator targets (position actuators)
this.data.ctrl[0] = targetAngle;  // radians

// Read joint positions
const pos = this.data.qpos[jointIndex];

// Read joint velocities
const vel = this.data.qvel[jointIndex];

// Read sensor data (if sensors defined in XML)
const sensorValue = this.data.sensordata[sensorIndex];
```

### Sensor Data

The G1 model includes extensive sensors:
- **Joint position sensors** (43): `left_hip_pitch_pos`, etc.
- **Joint velocity sensors** (43): `left_hip_pitch_vel`, etc.
- **Joint actuator force sensors** (43): `left_hip_pitch_torque`, etc.
- **IMU** at pelvis: quaternion (`imu_quat`), gyroscope (`imu_gyro`), accelerometer (`imu_acc`)
- **Frame sensors**: position (`frame_pos`), linear velocity (`frame_vel`)

---

## Coordinate System

### MuJoCo Coordinate System
- **X**: Forward (robot facing direction)
- **Y**: Left
- **Z**: Up

### MuJoCo to Three.js Conversion
MuJoCo uses Z-up, Three.js uses Y-up. The conversion is handled automatically in `mujocoUtils.js`:
```javascript
// MuJoCo (x, y, z) → Three.js (x, z, -y)
threePos.set(mujocoPos[0], mujocoPos[2], -mujocoPos[1]);
```

### Robot Default Orientation
- Pelvis is at position (0, 0, 0.793) -- 79.3cm above ground
- Robot faces the +X direction
- Arms hang at sides in default pose (all ctrl = 0)

---

## Customization Guide

### Changing Visual Appearance

**Ground plane texture** (in `unitree_g1.xml`):
```xml
<texture type="2d" name="groundplane" builtin="checker" mark="edge"
    rgb1="0.2 0.3 0.4" rgb2="0.1 0.2 0.3" markrgb="0.8 0.8 0.8"
    width="300" height="300"/>
```

**Sky/background gradient** (in `unitree_g1.xml`):
```xml
<texture type="skybox" builtin="gradient" rgb1="0.3 0.5 0.7" rgb2="0 0 0"
    width="512" height="3072"/>
```

**Robot body color** - each `<geom>` has an `rgba` attribute:
```xml
<geom type="mesh" mesh="pelvis" rgba="0.2 0.2 0.2 1" />  <!-- dark gray -->
```

### Modifying Actuator Properties

In the `<actuator>` section of `unitree_g1.xml`:
```xml
<position name="left_shoulder_pitch"
    joint="left_shoulder_pitch_joint"
    kp="80"                          <!-- stiffness (higher = faster response) -->
    ctrlrange="-3.0892 2.6704"      <!-- min/max target angle in radians -->
    forcerange="-25 25"/>            <!-- max force in N -->
```

### Adding Objects to the Scene

Add new bodies inside `<worldbody>` in the XML:
```xml
<!-- Example: add a box -->
<body name="box" pos="0.5 0 0.1">
    <geom type="box" size="0.05 0.05 0.05" rgba="1 0 0 1" mass="0.1"/>
    <joint type="free"/>  <!-- allow it to move freely -->
</body>
```

### Camera Position

In `src/main.js`, the camera default is:
```javascript
this.camera.position.set(2.0, 1.7, 1.7);
```

---

## Troubleshooting

### Common Issues

**Robot collapses/explodes on start:**
- Check that all `ctrl` values are within `ctrlrange` bounds
- Ensure you're not setting ctrl values that conflict (e.g., opposite directions on coupled joints)
- The fixed pelvis should prevent falling -- if removed, the robot needs a balance controller

**Joints don't move:**
- Verify you're setting `this.data.ctrl[i]` not `this.data.qpos[i]` (ctrl = command, qpos = state)
- Check you're in the right scene: `if (this.params["scene"] === "unitree_g1.xml")`
- Ensure code is before `mujoco.mj_step()`, not after
- Check the simulation isn't paused: `if (!this.params["paused"])`

**Animation is jerky:**
- Use `this.data.time` for smooth timing, not frame-dependent counters
- Apply easing functions for transitions between poses
- Avoid setting ctrl to extreme values suddenly -- ramp gradually

**Meshes not loading / black screen:**
- Check browser console for network errors
- Ensure `assets/scenes/index.json` lists the correct files
- Verify `meshes_bundle.gz` exists and is valid, or individual STL files are present
- Check CORS headers if loading from a different domain

**GUI sliders don't match programmatic values:**
- GUI updates are one-way (GUI -> ctrl). Programmatic ctrl changes in the render loop override GUI values
- To see programmatic values reflected, the GUI callback updates happen in the render loop

### Performance Tips
- The mesh bundle reduces initial load from ~8s to ~2s on typical connections
- Reduce mesh polygon count if rendering is slow (re-export STL with decimation)
- Lower the number of physics substeps if simulation is slow
- Close browser dev tools during performance testing (they add overhead)

---

## Performance Optimization

### Bundle System Benefits
| Metric | Individual Files | Mesh Bundle |
|--------|-----------------|-------------|
| HTTP Requests | 65 | 1 |
| Transfer Size | 51 MB | 22 MB |
| Load Time (fast connection) | ~8s | ~2s |
| Load Time (slow connection) | ~30s+ | ~8s |

### Rendering Optimization
- Meshes use `contype="0" conaffinity="0"` for visual-only geometry (no collision overhead)
- Shadow mapping is enabled but can be disabled for performance
- The scene uses a single directional light to minimize shadow passes

### Memory Usage
- MuJoCo WASM: ~30MB
- STL meshes in memory: ~51MB (after decompression)
- Three.js scene graph: ~10-20MB depending on mesh complexity
- Total typical usage: ~100-120MB
