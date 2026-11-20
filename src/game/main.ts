import * as THREE from 'three';
import { DEFAULT_TUNING, DT } from '../core/contract.js';
import { GameSimulation } from '../core/simulation.js';
import type { InputState } from '../core/types.js';
import { sounds } from './audio.js';

const container = document.getElementById('canvas-container')!;
const nightNameEl = document.getElementById('night-name')!;
const hudFlames = document.getElementById('hud-flames')!;
const hudLanterns = document.getElementById('hud-lanterns')!;
const hudCharm = document.getElementById('hud-charm')!;
const hudTime = document.getElementById('hud-time')!;
const hudScore = document.getElementById('hud-score')!;
const promptBanner = document.getElementById('prompt-banner')!;
const lanternArrow = document.getElementById('lantern-arrow')!;
const moteSlots = document.querySelectorAll('.mote-slot');
const dashCdMask = document.getElementById('dash-cd-mask')!;
const pulseCdMask = document.getElementById('pulse-cd-mask')!;

const overlay = document.getElementById('overlay')!;
const overlayTitle = document.getElementById('overlay-title')!;
const overlayDesc = document.getElementById('overlay-desc')!;
const resumeBtn = document.getElementById('resume-btn')!;
const nextNightBtn = document.getElementById('next-night-btn')!;
const restartBtn = document.getElementById('restart-btn')!;
const selectNightBtn = document.getElementById('select-night-btn')!;
const settingsBtn = document.getElementById('settings-btn')!;
const settingsOverlay = document.getElementById('settings-overlay')!;
const closeSettingsBtn = document.getElementById('close-settings-btn')!;
const volSlider = document.getElementById('vol-slider') as HTMLInputElement;
const volVal = document.getElementById('vol-val')!;
const sensSlider = document.getElementById('sens-slider') as HTMLInputElement;
const sensVal = document.getElementById('sens-val')!;

let mouseSens = parseFloat(localStorage.getItem('ddl_sens') || '1.0');
let savedVol = parseFloat(localStorage.getItem('ddl_vol') || '0.5');
sounds.setVolume(savedVol);

if (volSlider) {
  volSlider.value = String(Math.round(savedVol * 100));
  volVal.textContent = `${volSlider.value}%`;
  volSlider.addEventListener('input', () => {
    const val = parseInt(volSlider.value) / 100;
    volVal.textContent = `${volSlider.value}%`;
    sounds.setVolume(val);
    localStorage.setItem('ddl_vol', String(val));
  });
}

if (sensSlider) {
  sensSlider.value = String(Math.round(mouseSens * 10));
  sensVal.textContent = `${mouseSens.toFixed(1)}x`;
  sensSlider.addEventListener('input', () => {
    mouseSens = parseInt(sensSlider.value) / 10;
    sensVal.textContent = `${mouseSens.toFixed(1)}x`;
    localStorage.setItem('ddl_sens', String(mouseSens));
  });
}

settingsBtn?.addEventListener('click', () => {
  settingsOverlay.style.display = 'flex';
});

closeSettingsBtn?.addEventListener('click', () => {
  settingsOverlay.style.display = 'none';
});

// Renderer & Scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const nightFogColor = new THREE.Color(0x0e1430);
const fog = new THREE.FogExp2(nightFogColor.getHex(), 0.009);
scene.fog = fog;
scene.background = nightFogColor.clone();

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 260);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xa59bd4, 0x3d3052, 1.25);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xdbe0ff, 1.35);
moonLight.position.set(-28, 45, -20);
moonLight.castShadow = true;
scene.add(moonLight);

// Sea of clouds below island (#12384A)
const cloudSeaGeo = new THREE.CircleGeometry(240, 48);
const cloudSeaMat = new THREE.MeshBasicMaterial({ color: 0x12384a, transparent: true, opacity: 0.9 });
const cloudSea = new THREE.Mesh(cloudSeaGeo, cloudSeaMat);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -3.8;
scene.add(cloudSea);

// Terrain Group for dynamic island construction across Nights
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);

function buildTerrain(night: number): void {
  // Clear previous terrain
  while (terrainGroup.children.length > 0) {
    terrainGroup.remove(terrainGroup.children[0]);
  }

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x2f5d50, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.8 });

  if (night === 1) {
    // Night 1: Island radius 40m
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(40, 38.5, 2.4, 64), grassMat);
    mesh.position.y = -1.2;
    mesh.receiveShadow = true;
    terrainGroup.add(mesh);
  } else if (night === 2) {
    // Night 2: Island A (0,0) r=28 and Island B (70,0) r=28
    const islandA = new THREE.Mesh(new THREE.CylinderGeometry(28, 27, 2.4, 48), grassMat);
    islandA.position.set(0, -1.2, 0);
    islandA.receiveShadow = true;

    const islandB = new THREE.Mesh(new THREE.CylinderGeometry(28, 27, 2.4, 48), grassMat);
    islandB.position.set(70, -1.2, 0);
    islandB.receiveShadow = true;

    // Bamboo bridge: x in [26, 44], z in [-2, 2]
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 4), woodMat);
    bridge.position.set(35, -0.2, 0);
    bridge.receiveShadow = true;

    // Jump pads at (20,0,18) and (50,0,-18)
    const padGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.25, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xffae42, emissiveIntensity: 0.8 });
    const pad1 = new THREE.Mesh(padGeo, padMat);
    pad1.position.set(20, 0.1, 18);
    const pad2 = new THREE.Mesh(padGeo, padMat);
    pad2.position.set(50, 0.1, -18);

    terrainGroup.add(islandA, islandB, bridge, pad1, pad2);
  } else {
    // Night 3: Tiered Island radius 45m
    const tier0 = new THREE.Mesh(new THREE.CylinderGeometry(45, 43, 2.4, 64), grassMat);
    tier0.position.y = -1.2;
    tier0.receiveShadow = true;

    // Tier 1 (Y=3) ring r=12-24 for z > 0
    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 3, 48, 1, false, 0, Math.PI), sandMat);
    tier1.position.set(0, 1.5, 0);
    tier1.receiveShadow = true;

    // Ramps at 30 deg and 150 deg (width 3m, r in [24, 30], from Y=0 to Y=3)
    for (const rampAngle of [Math.PI / 6, (5 * Math.PI) / 6]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 6.7), woodMat);
      const midR = 27;
      ramp.position.set(Math.cos(rampAngle) * midR, 1.5, Math.sin(rampAngle) * midR);
      ramp.rotation.y = -rampAngle + Math.PI / 2;
      ramp.rotation.x = 0.46; // Angle corresponding to height 3 over length 6
      terrainGroup.add(ramp);
    }

    // Tier 2 (Y=6) r=8 disc
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 3, 32), woodMat);
    tier2.position.set(0, 4.5, 0);
    tier2.receiveShadow = true;

    // Bell Tower in center (Y=6 to 14, r=2)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), new THREE.MeshStandardMaterial({ color: 0x5b5f6e, roughness: 0.7 }));
    tower.position.set(0, 10, 0);
    tower.castShadow = true;

    // Jump pad on tier 1 at (0, 3, 13)
    const padGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.25, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xffae42, emissiveIntensity: 0.8 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 3.1, 13);

    terrainGroup.add(tier0, tier1, tier2, tower, pad);
  }
}

// Build May (Player)
const playerGroup = new THREE.Group();
const cloakMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.42, 1.15, 12),
  new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.75 })
);
cloakMesh.position.y = 0.58;
cloakMesh.castShadow = true;
playerGroup.add(cloakMesh);

// Scarf (#C8102E)
const scarfMesh = new THREE.Mesh(
  new THREE.TorusGeometry(0.24, 0.06, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.6 })
);
scarfMesh.position.y = 1.12;
scarfMesh.rotation.x = Math.PI / 2;
playerGroup.add(scarfMesh);

const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 14, 14),
  new THREE.MeshStandardMaterial({ color: 0xf7dcc4, roughness: 0.65 })
);
headMesh.position.y = 1.25;
headMesh.castShadow = true;
playerGroup.add(headMesh);

// Non la (conical hat)
const hatMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.56, 0.28, 20),
  new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.85 })
);
hatMesh.position.y = 1.44;
hatMesh.castShadow = true;
playerGroup.add(hatMesh);

// Hanging small lantern
const miniLanternPivot = new THREE.Group();
miniLanternPivot.position.set(0.42, 1.32, 0.24);
const miniLanternBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.08, 0.07, 0.16, 8),
  new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8c1a, emissiveIntensity: 2.2 })
);
miniLanternBody.position.y = -0.1;
miniLanternPivot.add(miniLanternBody);
const miniLanternLight = new THREE.PointLight(0xffb755, 3.2, 14, 1.2);
miniLanternLight.position.y = -0.1;
miniLanternPivot.add(miniLanternLight);
playerGroup.add(miniLanternPivot);

scene.add(playerGroup);

// Dynamic entity mesh pools
interface LanternVisual {
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRingMat: THREE.MeshBasicMaterial;
}
const lanternVisuals = new Map<string, LanternVisual>();
const moteVisuals = new Map<string, THREE.Mesh>();
const shadeVisuals = new Map<string, { group: THREE.Group; bodyMat: THREE.MeshStandardMaterial }>();
const drifterVisuals = new Map<string, THREE.Mesh>();
const charmVisuals = new Map<string, THREE.Mesh>();

function createLanternVisual(id: string): LanternVisual {
  const group = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 })
  );
  post.position.y = 1.1;
  post.castShadow = true;
  group.add(post);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x5b5f6e, roughness: 0.85 })
  );
  roof.position.y = 2.65;
  roof.castShadow = true;
  group.add(roof);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x5b5f6e,
    emissive: 0xffb347,
    emissiveIntensity: 0.25,
    roughness: 0.35
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), coreMat);
  core.position.y = 2.2;
  group.add(core);

  const light = new THREE.PointLight(0xffb347, 1.5, 22, 1.2);
  light.position.y = 2.3;
  group.add(light);

  const safeRingGeo = new THREE.RingGeometry(DEFAULT_TUNING.safe_radius - 0.14, DEFAULT_TUNING.safe_radius, 48);
  const safeRingMat = new THREE.MeshBasicMaterial({ color: 0xffb347, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const safeRing = new THREE.Mesh(safeRingGeo, safeRingMat);
  safeRing.rotation.x = -Math.PI / 2;
  safeRing.position.y = 0.04;
  group.add(safeRing);

  scene.add(group);
  const vis: LanternVisual = { group, coreMat, light, safeRingMat };
  lanternVisuals.set(id, vis);
  return vis;
}

const moteGeo = new THREE.SphereGeometry(0.24, 12, 12);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff6c2, emissive: 0xffe58a, emissiveIntensity: 1.8 });

function createShadeVisual(id: string): { group: THREE.Group; bodyMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x120a1a, emissive: 0x7a3cff, emissiveIntensity: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 14), bodyMat);
  body.scale.set(1, 1.35, 1);
  body.castShadow = true;
  group.add(body);
  scene.add(group);
  const entry = { group, bodyMat };
  shadeVisuals.set(id, entry);
  return entry;
}

function createDrifterVisual(id: string): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.1, 0.4, 1.6, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8fa3b8, emissive: 0x5a7b98, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = Math.PI / 4;
  scene.add(mesh);
  drifterVisuals.set(id, mesh);
  return mesh;
}

function createCharmVisual(id: string): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.4, 0.7, 0.08);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8102e, emissive: 0xf2c14e, emissiveIntensity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  charmVisuals.set(id, mesh);
  return mesh;
}

let currentNight = 1;
let sim = new GameSimulation(Date.now() & 0x7fffffff, currentNight);
buildTerrain(currentNight);
let camYawDeg = 0;
let camPitch = 0.36;

function clearDynamicVisuals(): void {
  for (const v of lanternVisuals.values()) scene.remove(v.group);
  lanternVisuals.clear();
  for (const m of moteVisuals.values()) scene.remove(m);
  moteVisuals.clear();
  for (const s of shadeVisuals.values()) scene.remove(s.group);
  shadeVisuals.clear();
  for (const d of drifterVisuals.values()) scene.remove(d);
  drifterVisuals.clear();
  for (const c of charmVisuals.values()) scene.remove(c);
  charmVisuals.clear();
}

function startNight(night: number): void {
  currentNight = night;
  clearDynamicVisuals();
  sim = new GameSimulation(Date.now() & 0x7fffffff, currentNight);
  buildTerrain(currentNight);
  camYawDeg = 0;
  nightNameEl.textContent = currentNight === 1 ? 'Đêm 1 · Đảo Bến' : currentNight === 2 ? 'Đêm 2 · Đảo Cau' : 'Đêm 3 · Đảo Chuông';
  overlay.classList.remove('visible');
}

restartBtn.addEventListener('click', () => startNight(currentNight));
resumeBtn.addEventListener('click', () => { pauseTriggered = true; });
nextNightBtn.addEventListener('click', () => {
  if (currentNight < 3) startNight(currentNight + 1);
  else startNight(1);
});
selectNightBtn.addEventListener('click', () => {
  const nextN = currentNight === 1 ? 2 : currentNight === 2 ? 3 : 1;
  startNight(nextN);
});

// Input tracking
const keys = new Set<string>();
let pauseTriggered = false;
window.addEventListener('keydown', (e) => {
  sounds.startBGM();
  keys.add(e.code);
  if (e.code === 'Escape' || e.code === 'KeyP') {
    pauseTriggered = true;
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

let dragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  camYawDeg -= dx * 0.32 * mouseSens;
  camPitch = Math.max(0.14, Math.min(0.85, camPitch + dy * 0.004 * mouseSens));
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function buildCurrentInput(): InputState {
  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx -= 1;

  if (keys.has('KeyJ')) camYawDeg += 1.8;
  if (keys.has('KeyL')) camYawDeg -= 1.8;

  const doPause = pauseTriggered;
  pauseTriggered = false;

  return {
    move: [mx, mz],
    cam_yaw_deg: camYawDeg,
    jump: keys.has('Space'),
    interact: keys.has('KeyE') || keys.has('KeyF'),
    pulse: keys.has('KeyQ'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    pause: doPause
  };
}

function syncVisuals(elapsedSec: number): void {
  playerGroup.position.set(sim.playerPos[0], sim.playerPos[1], sim.playerPos[2]);
  const theta = (camYawDeg * Math.PI) / 180;
  playerGroup.rotation.y = theta;

  const blink = sim.invulnTicks > 0 && Math.floor(elapsedSec * 14) % 2 === 0;
  playerGroup.visible = !blink;

  let litCount = 0;
  let nearLantern: { id: string; deposited: number } | null = null;
  for (const lantern of sim.lanterns) {
    if (lantern.lit) litCount += 1;
    const d = Math.hypot(sim.playerPos[0] - lantern.pos[0], sim.playerPos[2] - lantern.pos[2]);
    if (!lantern.lit && d <= DEFAULT_TUNING.interact_radius) {
      nearLantern = lantern;
    }

    const vis = lanternVisuals.get(lantern.id) ?? createLanternVisual(lantern.id);
    vis.group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);

    if (lantern.lit) {
      vis.coreMat.color.setHex(0xffb347);
      vis.coreMat.emissiveIntensity = 2.4;
      vis.light.intensity = 26;
      vis.safeRingMat.opacity = 0.38;
    } else {
      const ratio = lantern.deposited / DEFAULT_TUNING.lantern_cost;
      vis.coreMat.color.setHex(ratio > 0 ? 0xffb347 : 0x5b5f6e);
      vis.coreMat.emissiveIntensity = 0.25 + ratio * 0.9;
      vis.light.intensity = 1.5 + ratio * 8;
      vis.safeRingMat.opacity = 0;
    }
  }

  // Ambient light scaling: 0.15 + 0.55 * (litCount / totalLanterns)
  hemiLight.intensity = 0.15 + 0.55 * (litCount / (sim.lanterns.length || 1));

  // Motes
  const activeMoteIds = new Set(sim.motes.map((m) => m.id));
  for (const [id, mesh] of moteVisuals.entries()) {
    if (!activeMoteIds.has(id)) {
      scene.remove(mesh);
      moteVisuals.delete(id);
    }
  }
  sim.motes.forEach((mote, idx) => {
    let mesh = moteVisuals.get(mote.id);
    if (!mesh) {
      mesh = new THREE.Mesh(moteGeo, moteMat);
      scene.add(mesh);
      moteVisuals.set(mote.id, mesh);
    }
    mesh.position.set(mote.pos[0], mote.pos[1] + 0.5 + Math.sin(elapsedSec * 3.2 + idx) * 0.18, mote.pos[2]);
  });

  // Shades
  const activeShadeIds = new Set(sim.shades.map((s) => s.id));
  for (const [id, entry] of shadeVisuals.entries()) {
    if (!activeShadeIds.has(id)) {
      scene.remove(entry.group);
      shadeVisuals.delete(id);
    }
  }
  for (const shade of sim.shades) {
    const entry = shadeVisuals.get(shade.id) ?? createShadeVisual(shade.id);
    entry.group.position.set(shade.pos[0], shade.pos[1], shade.pos[2]);
    entry.bodyMat.color.setHex(shade.state === 'stunned' ? 0x3a3450 : 0x120a1a);
  }

  // Drifters
  const activeDrifterIds = new Set(sim.drifters.map((d) => d.id));
  for (const [id, mesh] of drifterVisuals.entries()) {
    if (!activeDrifterIds.has(id)) {
      scene.remove(mesh);
      drifterVisuals.delete(id);
    }
  }
  for (const drifter of sim.drifters) {
    const mesh = drifterVisuals.get(drifter.id) ?? createDrifterVisual(drifter.id);
    mesh.position.set(drifter.pos[0], drifter.pos[1] + 1.2 + Math.sin(elapsedSec * 5) * 0.25, drifter.pos[2]);
  }

  // Charms
  const activeCharmIds = new Set(sim.charms.filter((c) => c.available).map((c) => c.id));
  for (const [id, mesh] of charmVisuals.entries()) {
    if (!activeCharmIds.has(id)) {
      scene.remove(mesh);
      charmVisuals.delete(id);
    }
  }
  for (const charm of sim.charms) {
    if (charm.available) {
      const mesh = charmVisuals.get(charm.id) ?? createCharmVisual(charm.id);
      mesh.position.set(charm.pos[0], charm.pos[1] + 0.6 + Math.sin(elapsedSec * 4) * 0.15, charm.pos[2]);
      mesh.rotation.y = elapsedSec * 2;
    }
  }

  // Camera follow
  const camDist = 9.5;
  const horiz = Math.cos(camPitch) * camDist;
  const vert = Math.sin(camPitch) * camDist + 1.5;
  const fwdX = Math.sin(theta);
  const fwdZ = Math.cos(theta);
  camera.position.set(sim.playerPos[0] - fwdX * horiz, sim.playerPos[1] + vert, sim.playerPos[2] - fwdZ * horiz);
  camera.lookAt(sim.playerPos[0], sim.playerPos[1] + 1.1, sim.playerPos[2]);

  // HUD updates
  hudFlames.textContent = '🔥'.repeat(sim.playerFlames) || '0';
  hudLanterns.textContent = `${litCount}/${sim.lanterns.length}`;
  hudCharm.textContent = sim.charmTicks > 0 ? `${(sim.charmTicks / 60).toFixed(1)}s` : 'Không';

  // 10-slot mote bar
  moteSlots.forEach((slot, idx) => {
    slot.classList.toggle('filled', idx < sim.playerCarried);
  });

  // Cooldown indicators
  if (sim.dashCdTicks > 0 && sim.charmTicks <= 0) {
    dashCdMask.textContent = `${(sim.dashCdTicks / 60).toFixed(1)}s`;
    dashCdMask.classList.add('active');
  } else {
    dashCdMask.classList.remove('active');
  }

  if (sim.pulseCdTicks > 0) {
    pulseCdMask.textContent = `${(sim.pulseCdTicks / 60).toFixed(1)}s`;
    pulseCdMask.classList.add('active');
  } else {
    pulseCdMask.classList.remove('active');
  }

  const secs = Math.ceil(sim.timeLeftS);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  hudTime.textContent = `${mm}:${ss}`;
  hudTime.classList.toggle('warning', secs <= 30);
  hudScore.textContent = String(sim.score);

  if (nearLantern && sim.playerCarried > 0 && sim.state === 'playing') {
    promptBanner.textContent = `Nhấn E để nạp ánh sáng (${nearLantern.deposited}/10)`;
    promptBanner.classList.add('visible');
  } else {
    promptBanner.classList.remove('visible');
  }

  // Arrow pointing to nearest unlit lantern
  const unlitLanterns = sim.lanterns.filter((l) => !l.lit);
  if (unlitLanterns.length > 0 && sim.state === 'playing') {
    let nearestL = unlitLanterns[0];
    let minDist = Infinity;
    for (const l of unlitLanterns) {
      const d = Math.hypot(sim.playerPos[0] - l.pos[0], sim.playerPos[2] - l.pos[2]);
      if (d < minDist) {
        minDist = d;
        nearestL = l;
      }
    }

    // Convert lantern position to screen coordinates
    const lPos3D = new THREE.Vector3(nearestL.pos[0], nearestL.pos[1] + 1.5, nearestL.pos[2]);
    const screenPos = lPos3D.clone().project(camera);
    const isBehind = screenPos.z > 1;
    const isOffscreen = isBehind || Math.abs(screenPos.x) > 0.88 || Math.abs(screenPos.y) > 0.88;

    if (isOffscreen) {
      lanternArrow.style.display = 'block';
      let sx = screenPos.x;
      let sy = screenPos.y;
      if (isBehind) {
        sx = -sx;
        sy = -sy;
      }
      const angleRad = Math.atan2(sy, sx);
      const distFromCenter = Math.min(window.innerWidth, window.innerHeight) * 0.42;
      const posX = window.innerWidth / 2 + Math.cos(angleRad) * distFromCenter;
      const posY = window.innerHeight / 2 - Math.sin(angleRad) * distFromCenter;
      lanternArrow.style.left = `${posX}px`;
      lanternArrow.style.top = `${posY}px`;
      lanternArrow.style.transform = `rotate(${-angleRad + Math.PI / 2}rad)`;
    } else {
      lanternArrow.style.display = 'none';
    }
  } else {
    lanternArrow.style.display = 'none';
  }

  // Modals & Pause
  if (sim.state === 'paused') {
    overlayTitle.textContent = 'Tạm dừng';
    overlayDesc.textContent = 'Trò chơi đang tạm dừng. Nhấn Tiếp tục hoặc phím Esc/P để trở lại đảo.';
    resumeBtn.style.display = 'inline-block';
    nextNightBtn.style.display = 'none';
    overlay.classList.add('visible');
  } else if (sim.state === 'won') {
    overlayTitle.textContent = currentNight === 3 ? 'Bình Minh Trên Đảo!' : 'Ánh sáng trở lại!';
    overlayDesc.textContent =
      currentNight === 3
        ? `Chúc mừng Mây! Bạn đã hoàn thành trọn vẹn cả 3 Đêm! Tổng điểm: ${sim.score}.`
        : `Mây đã thắp sáng tất cả Đèn Lồng Đêm ${currentNight}! Điểm: ${sim.score}. Sẵn sàng cho Đêm tiếp theo?`;
    resumeBtn.style.display = 'none';
    nextNightBtn.style.display = 'inline-block';
    nextNightBtn.textContent = currentNight === 3 ? 'Chơi lại từ Đêm 1' : `Sang Đêm ${currentNight + 1}`;
    overlay.classList.add('visible');
  } else if (sim.state === 'lost') {
    overlayTitle.textContent = 'Sương đen bao phủ...';
    overlayDesc.textContent = `Mây chưa thể xua tan bóng tối Đêm ${currentNight}. Điểm: ${sim.score}. Hãy thử lại!`;
    resumeBtn.style.display = 'none';
    nextNightBtn.style.display = 'none';
    overlay.classList.add('visible');
  } else {
    overlay.classList.remove('visible');
  }
}

let lastFrameMs = performance.now();
let accumulator = 0;

let lastCountdownSecond = -1;

function animate(nowMs: number): void {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;
  accumulator += frameDt;

  while (accumulator >= DT) {
    const input = buildCurrentInput();
    const events = sim.step(input);

    // Audio effects trigger
    for (const ev of events) {
      if (ev.name === 'mote_picked') sounds.playMote();
      else if (ev.name === 'lantern_lit') sounds.playLantern();
      else if (ev.name === 'dash') sounds.playDash();
      else if (ev.name === 'pulse') sounds.playPulse();
      else if (ev.name === 'player_hit') sounds.playHit();
      else if (ev.name === 'shade_spawned') sounds.playShadeSpawn();
      else if (ev.name === 'game_over') {
        if (ev.data.result === 'won') sounds.playWin();
        else sounds.playLoss();
      }
    }
    if (input.jump && sim.playerGrounded) sounds.playJump();

    // 10s countdown audio tick
    if (sim.state === 'playing' && sim.timeLeftS <= 10 && sim.timeLeftS > 0) {
      const curSec = Math.floor(sim.timeLeftS);
      if (curSec !== lastCountdownSecond) {
        lastCountdownSecond = curSec;
        sounds.playCountdownBeep();
      }
    }

    accumulator -= DT;
  }

  syncVisuals(nowMs / 1000);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
