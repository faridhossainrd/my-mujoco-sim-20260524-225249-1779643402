
import * as THREE           from 'three';
import { GUI              } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls    } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './utils/DragStateManager.js';
import { setupGUI, downloadExampleScenesFolder, loadSceneFromURL, drawTendonsAndFlex, getPosition, getQuaternion, toMujocoPos, standardNormal } from './mujocoUtils.js';
import { SaluteActivity  } from './activities/salute.js';
import   load_mujoco        from '../node_modules/mujoco-js/dist/mujoco_wasm.js';

// Load the MuJoCo Module
const mujoco = await load_mujoco();

// Set up Emscripten's Virtual File System
var initialScene = "unitree_g1.xml";
mujoco.FS.mkdir('/working');
mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');
mujoco.FS.writeFile("/working/" + initialScene, await(await fetch("./assets/scenes/" + initialScene)).text());

export class MuJoCoDemo {
  constructor() {
    this.mujoco = mujoco;

    // Model will be loaded in init() after assets are downloaded
    this.model = null;
    this.data  = null;

    // Define Random State Variables
    this.params = { scene: initialScene, paused: false, help: false, ctrlnoiserate: 0.0, ctrlnoisestd: 0.0, keyframeNumber: 0 };
    this.mujoco_time = 0.0;
    this.bodies  = {}, this.lights = {};
    this.tmpVec  = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.updateGUICallbacks = [];
    
    // Initialize activities
    this.salute = new SaluteActivity(this);

    this.container = document.createElement( 'div' );
    document.body.appendChild( this.container );

    this.scene = new THREE.Scene();

    // Setup GUI with salute button
    this.setupGUI();
    this.scene.name = 'scene';

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.001, 100 );
    this.camera.name = 'PerspectiveCamera';
    this.camera.position.set(2.0, 1.7, 1.7);
    this.scene.add(this.camera);

    this.scene.background = new THREE.Color(0.15, 0.25, 0.35);
      this.sunlight = new THREE.DirectionalLight(0xffffff, 1.0 * 3.14 * 4.0);
  
      const brightness = 40; // 0..100
      const intensity = (brightness / 100) * 12.56; // 12.56 ≈ 4 * 3.14
      this.sunlight.intensity = intensity;
  
      this.sunlight.castShadow = true;
      this.sunlight.shadow.mapSize.width = 1024;
      this.sunlight.shadow.mapSize.height = 1024;
      this.sunlight.shadow.camera.near = 0.1;
      this.sunlight.shadow.camera.far = 100;
      this.sunlight.position.set(3, 6, 3);
      const targetObject = new THREE.Object3D();
      this.scene.add(targetObject);
      this.sunlight.target = targetObject;
      targetObject.position.set(0, 1, 0);
      this.scene.add(this.sunlight);

    const logoWidth = 3220;
      const logoHeight = 678;
      const floorHeight = 2.0;
      const floorWidth = (floorHeight * (logoWidth / logoHeight))+0.0;
      this.floorTexture = new THREE.TextureLoader().load('./assets/roba_logo.png');
      this.floorTexture.wrapS = THREE.ClampToEdgeWrapping;
      this.floorTexture.wrapT = THREE.ClampToEdgeWrapping;
      this.floorTexture.generateMipmaps = true;
      this.floorTexture.minFilter = THREE.LinearMipmapLinearFilter;
      this.floorTexture.magFilter = THREE.LinearFilter;
      this.floorTexture.colorSpace = THREE.SRGBColorSpace;
      const floorMaterial = new THREE.MeshStandardMaterial({
        map: this.floorTexture,
        side: THREE.DoubleSide,
        roughness: 1.5,
        metalness: 1.0,
        transparent: true,
        alphaTest: 0.01
      });
      const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
      const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = 0.03;
      floorMesh.position.z = -3.0;
      floorMesh.receiveShadow = true;
      this.scene.add(floorMesh);


    this.renderer = new THREE.WebGLRenderer( { antialias: true } );
    this.renderer.setPixelRatio(1.0);////window.devicePixelRatio );
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    //this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    //this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    //this.renderer.toneMappingExposure = 2.0;
    this.renderer.useLegacyLights = true;

    this.renderer.setAnimationLoop( this.render.bind(this) );

    this.container.appendChild( this.renderer.domElement );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.7, 0);
    this.controls.panSpeed = 2;
    this.controls.zoomSpeed = 1;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.10;
    this.controls.screenSpacePanning = true;
    this.controls.update();

    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Initialize the Drag State Manager.
    this.dragStateManager = new DragStateManager(this.scene, this.renderer, this.camera, this.container.parentElement, this.controls);
  }

  async init() {
    // Show loading indicator
    let loadingDiv = document.createElement('div');
    loadingDiv.id = 'mujoco-loading';
    loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.7);font:14px -apple-system,sans-serif;text-align:center;z-index:99999;';
    loadingDiv.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:rgba(255,255,255,0.6);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>Loading simulation...<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(loadingDiv);

    try {
      // Download the the examples to MuJoCo's virtual file system
      this.sceneFiles = await downloadExampleScenesFolder(mujoco);

      // Initialize the three.js Scene using the .xml Model in initialScene
      [this.model, this.data, this.bodies, this.lights] =
        await loadSceneFromURL(mujoco, initialScene, this);

      this.gui = new GUI();
      setupGUI(this);
    } catch (e) {
      console.error("[MuJoCo] Failed to initialize:", e);
      loadingDiv.style.color = '#ff4444';
      loadingDiv.innerHTML = '<b>MuJoCo Error</b><br><br>' + (e.message || e);
      return;
    }
    loadingDiv.remove();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
  }

  render(timeMS) {
    this.controls.update();

    // Don't render until model is loaded
    if (!this.model || !this.data) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.params["paused"]) {
      let timestep = this.model.opt.timestep;
      if (timeMS - this.mujoco_time > 35.0) { this.mujoco_time = timeMS; }
      while (this.mujoco_time < timeMS) {

        // Automatic car animation for car scene
        if (this.params["scene"] === "car.xml") {
          const cycleTime = 6.0; // Total cycle time in seconds
          const phase = (this.data.time % cycleTime);

          if (phase < 0.5) {
            // Start: stationary
            this.data.ctrl[0] = 0;
          } else if (phase < 2.5) {
            // Backward phase (reverse first)
            this.data.ctrl[0] = -0.8;
          } else if (phase < 3.0) {
            // Slow down
            this.data.ctrl[0] = 0;
          } else if (phase < 3.5) {
            // Brief pause
            this.data.ctrl[0] = 0;
          } else if (phase < 5.5) {
            // Forward phase
            this.data.ctrl[0] = 0.8;
          } else {
            // Stop
            this.data.ctrl[0] = 0;
          }
          // Keep steering at 0
          if (this.data.ctrl.length > 1) {
            this.data.ctrl[1] = 0;
          }
        }

        // Jitter the control state with gaussian random noise
        if (this.params["ctrlnoisestd"] > 0.0) {
          let rate  = Math.exp(-timestep / Math.max(1e-10, this.params["ctrlnoiserate"]));
          let scale = this.params["ctrlnoisestd"] * Math.sqrt(1 - rate * rate);
          let currentCtrl = this.data.ctrl;
          for (let i = 0; i < currentCtrl.length; i++) {
            currentCtrl[i] = rate * currentCtrl[i] + scale * standardNormal();
            this.params["Actuator " + i] = currentCtrl[i];
          }
        }

        // Clear old perturbations, apply new ones.
        for (let i = 0; i < this.data.qfrc_applied.length; i++) { this.data.qfrc_applied[i] = 0.0; }
        let dragged = this.dragStateManager.physicsObject;
        if (dragged && dragged.bodyID) {
          for (let b = 0; b < this.model.nbody; b++) {
            if (this.bodies[b]) {
              getPosition  (this.data.xpos , b, this.bodies[b].position);
              getQuaternion(this.data.xquat, b, this.bodies[b].quaternion);
              this.bodies[b].updateWorldMatrix();
            }
          }
          let bodyID = dragged.bodyID;
          this.dragStateManager.update(); // Update the world-space force origin
          let force = toMujocoPos(this.dragStateManager.currentWorld.clone().sub(this.dragStateManager.worldHit).multiplyScalar(this.model.body_mass[bodyID] * 250));
          let point = toMujocoPos(this.dragStateManager.worldHit.clone());
          mujoco.mj_applyFT(this.model, this.data, [force.x, force.y, force.z], [0, 0, 0], [point.x, point.y, point.z], bodyID, this.data.qfrc_applied);

          // TODO: Apply pose perturbations (mocap bodies only).
        }

        mujoco.mj_step(this.model, this.data);

        // Update activities
        this.salute.update();

        this.mujoco_time += timestep * 1000.0;
      }

    } else if (this.params["paused"]) {
      this.dragStateManager.update(); // Update the world-space force origin
      let dragged = this.dragStateManager.physicsObject;
      if (dragged && dragged.bodyID) {
        let b = dragged.bodyID;
        getPosition  (this.data.xpos , b, this.tmpVec , false); // Get raw coordinate from MuJoCo
        getQuaternion(this.data.xquat, b, this.tmpQuat, false); // Get raw coordinate from MuJoCo

        let offset = toMujocoPos(this.dragStateManager.currentWorld.clone()
          .sub(this.dragStateManager.worldHit).multiplyScalar(0.3));
        if (this.model.body_mocapid[b] >= 0) {
          // Set the root body's mocap position...
          console.log("Trying to move mocap body", b);
          let addr = this.model.body_mocapid[b] * 3;
          let pos  = this.data.mocap_pos;
          pos[addr+0] += offset.x;
          pos[addr+1] += offset.y;
          pos[addr+2] += offset.z;
        } else {
          // Set the root body's position directly...
          let root = this.model.body_rootid[b];
          let addr = this.model.jnt_qposadr[this.model.body_jntadr[root]];
          let pos  = this.data.qpos;
          pos[addr+0] += offset.x;
          pos[addr+1] += offset.y;
          pos[addr+2] += offset.z;
        }
      }

      mujoco.mj_forward(this.model, this.data);
    }

    // Update body transforms.
    for (let b = 0; b < this.model.nbody; b++) {
      if (this.bodies[b]) {
        getPosition  (this.data.xpos , b, this.bodies[b].position);
        getQuaternion(this.data.xquat, b, this.bodies[b].quaternion);
        this.bodies[b].updateWorldMatrix();
      }
    }

    // Update light transforms.
    for (let l = 0; l < this.model.nlight; l++) {
      if (this.lights[l]) {
        getPosition(this.data.light_xpos, l, this.lights[l].position);
        getPosition(this.data.light_xdir, l, this.tmpVec);
        this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
      }
    }

    // Draw Tendons and Flex verts
    drawTendonsAndFlex(this.mujocoRoot, this.model, this.data);

    // Render!
    this.renderer.render( this.scene, this.camera );
  }
}

let demo = new MuJoCoDemo();
await demo.init();
