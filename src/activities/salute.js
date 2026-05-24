/**
 * Salute Activity for Unitree G1
 * Orchestrates a military-style salute gesture using arm joints
 */

export class SaluteActivity {
  constructor(demo) {
    this.demo = demo;
    this.isActive = false;
    this.startTime = 0;
    this.duration = 2.0; // Total salute duration in seconds
    this.phase = 'idle'; // idle, raising, holding, lowering
    
    // Joint indices cache
    this.jointIndices = null;
  }

  /**
   * Initialize joint indices (called on first use)
   */
  _initJointIndices() {
    if (this.jointIndices) return;
    
    this.jointIndices = {};
    const model = this.demo.model;
    const mujoco = this.demo.mujoco;
    
    const targetJoints = [
      'right_shoulder_pitch_joint',
      'right_shoulder_roll_joint',
      'right_elbow_joint',
      'right_wrist_pitch_joint',
    ];

    for (let i = 0; i < model.njnt; i++) {
      const nameAddr = model.name_jntadr[i];
      let jname = this._readString(mujoco, nameAddr);
      
      if (targetJoints.includes(jname)) {
        this.jointIndices[jname] = i;
      }
    }
  }

  /**
   * Read null-terminated string from WASM memory
   */
  _readString(mujoco, addr) {
    let str = '';
    let offset = 0;
    while (mujoco.HEAPU8[addr + offset] !== 0) {
      str += String.fromCharCode(mujoco.HEAPU8[addr + offset]);
      offset++;
    }
    return str;
  }

  /**
   * Start the salute activity
   */
  start() {
    if (this.isActive) return;
    this._initJointIndices();
    this.isActive = true;
    this.startTime = this.demo.mujoco_time;
    this.phase = 'raising';
    console.log('[Salute] Starting salute activity...');
  }

  /**
   * Stop the salute activity
   */
  stop() {
    this.isActive = false;
    this.phase = 'idle';
    console.log('[Salute] Salute activity stopped.');
  }

  /**
   * Update the salute pose based on elapsed time
   */
  update() {
    if (!this.isActive) return;

    const elapsed = (this.demo.mujoco_time - this.startTime) / 1000.0; // Convert to seconds
    const progress = Math.min(elapsed / this.duration, 1.0);

    // Phase timings (relative to total duration)
    const raiseEnd = 0.3;   // Raise arm over 30% of duration
    const holdEnd = 0.7;    // Hold for 40% of duration
    const lowerEnd = 1.0;   // Lower arm over final 30%

    if (progress < raiseEnd) {
      this.phase = 'raising';
      this._raiseArm(progress / raiseEnd);
    } else if (progress < holdEnd) {
      this.phase = 'holding';
      this._holdArm();
    } else if (progress < lowerEnd) {
      this.phase = 'lowering';
      this._lowerArm((progress - holdEnd) / (lowerEnd - holdEnd));
    } else {
      this.phase = 'idle';
      this.isActive = false;
      this._resetArm();
    }
  }

  /**
   * Raise right arm to salute position
   * @param {number} t - Progress 0-1
   */
  _raiseArm(t) {
    const model = this.demo.model;
    const data = this.demo.data;

    // Right arm joints for salute - smooth easing
    const joints = {
      'right_shoulder_pitch_joint': -Math.PI / 3 * this._easeInOutQuad(t),
      'right_shoulder_roll_joint': 0.2 * this._easeInOutQuad(t),
      'right_elbow_joint': Math.PI / 4 * this._easeInOutQuad(t),
      'right_wrist_pitch_joint': -Math.PI / 6 * this._easeInOutQuad(t),
    };

    this._setJointTargets(model, data, joints);
  }

  /**
   * Hold arm in salute position
   */
  _holdArm() {
    const model = this.demo.model;
    const data = this.demo.data;

    // Right arm held at salute
    const joints = {
      'right_shoulder_pitch_joint': -Math.PI / 3,
      'right_shoulder_roll_joint': 0.2,
      'right_elbow_joint': Math.PI / 4,
      'right_wrist_pitch_joint': -Math.PI / 6,
    };

    this._setJointTargets(model, data, joints);
  }

  /**
   * Lower right arm from salute position
   * @param {number} t - Progress 0-1
   */
  _lowerArm(t) {
    const model = this.demo.model;
    const data = this.demo.data;

    // Smoothly lower arm back to resting position
    const joints = {
      'right_shoulder_pitch_joint': -Math.PI / 3 * (1 - this._easeInOutQuad(t)),
      'right_shoulder_roll_joint': 0.2 * (1 - this._easeInOutQuad(t)),
      'right_elbow_joint': Math.PI / 4 * (1 - this._easeInOutQuad(t)),
      'right_wrist_pitch_joint': -Math.PI / 6 * (1 - this._easeInOutQuad(t)),
    };

    this._setJointTargets(model, data, joints);
  }

  /**
   * Reset arm to neutral position
   */
  _resetArm() {
    const model = this.demo.model;
    const data = this.demo.data;

    const joints = {
      'right_shoulder_pitch_joint': 0,
      'right_shoulder_roll_joint': 0,
      'right_elbow_joint': 0,
      'right_wrist_pitch_joint': 0,
    };

    this._setJointTargets(model, data, joints);
  }

  /**
   * Set joint positions using control inputs (safer method)
   * @param {object} model - MuJoCo model
   * @param {object} data - MuJoCo data
   * @param {object} joints - Map of joint names to target positions
   */
  _setJointTargets(model, data, joints) {
    if (!this.jointIndices) return;

    for (const [jointName, targetPos] of Object.entries(joints)) {
      const jointIdx = this.jointIndices[jointName];
      if (jointIdx !== undefined) {
        const qposAddr = model.jnt_qposadr[jointIdx];
        if (qposAddr >= 0 && qposAddr < data.qpos.length) {
          // Apply with soft damping to smooth motion
          const currentPos = data.qpos[qposAddr];
          const dampFactor = 0.85;
          data.qpos[qposAddr] = currentPos * dampFactor + targetPos * (1 - dampFactor);
        }
      }
    }
  }

  /**
   * Easing function: smoothstep
   */
  _easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Get activity status
   */
  getStatus() {
    return {
      active: this.isActive,
      phase: this.phase,
      duration: this.duration,
    };
  }
}
