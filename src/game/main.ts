import * as THREE from 'three';
import { DEFAULT_TUNING, DT, ISLAND_RADIUS } from '../core/contract.js';
import { GameSimulation } from '../core/simulation.js';
import type { InputState } from '../core/types.js';

const container = document.getElementById('canvas-container')!;
const hudFlames = document.getElementById('hud-flames')!;
const hudCarried = document.getElementById('hud-carried')!;
const hudLanterns = document.getElementById('hud-lanterns')!;
const hudPulse = document.getElementById('hud-pulse')!;
const hudTime = document.getElementById('hud-time')!;
const hudScore = document.getElementById('hud-score')!;
const promptBanner = document.getElementById('prompt-banner')!;
const overlay = document.getElementById('overlay')!;
const overlayTitle = document.getElementById('overlay-title')!;
const overlayDesc = document.getElementById('overlay-desc')!;
const restartBtn = document.getElementById('restart-btn')!;

// Renderer & Scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const nightFogColor = new THREE.Color(0x221838);
const warmFogColor = new THREE.Color(0x3e284d);
const fog = new THREE.FogExp2(nightFogColor.getHex(), 0.009);
scene.fog = fog;
scene.background = nightFogColor.clone();

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 260);

// Lighting - boosted ambient & moonlight for clear visibility
const hemiLight = new THREE.HemisphereLight(0xa59bd4, 0x3d3052, 1.25);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xdbe0ff, 1.35);
moonLight.position.set(-28, 45, -20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 140;
moonLight.shadow.camera.left = -55;
moonLight.shadow.camera.right = 55;
moonLight.shadow.camera.top = 55;
moonLight.shadow.camera.bottom = -55;
scene.add(moonLight);

// Island & Sea of Clouds
const islandGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.96, 2.4, 64);
const islandMat = new THREE.MeshStandardMaterial({
  color: 0x3e3959,
  roughness: 0.85,
  metalness: 0.05
});
const islandMesh = new THREE.Mesh(islandGeo, islandMat);
islandMesh.position.y = -1.2;
islandMesh.receiveShadow = true;
scene.add(islandMesh);

// Decorative border stones around the island edge (visual only)
const stoneGeo = new THREE.DodecahedronGeometry(0.9, 0);
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3b3554, roughness: 0.9 });
for (let i = 0; i < 40; i++) {
  const angle = (i / 40) * Math.PI * 2;
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.set(
    Math.cos(angle) * (ISLAND_RADIUS + 0.3),
    0.15,
    Math.sin(angle) * (ISLAND_RADIUS + 0.3)
  );
  stone.scale.set(1.2, 0.7 + (i % 3) * 0.25, 1.1);
  stone.rotation.y = angle;
  scene.add(stone);
}

// Sea of clouds below island
const cloudSeaGeo = new THREE.CircleGeometry(180, 48);
const cloudSeaMat = new THREE.MeshBasicMaterial({ color: 0x1b1130, transparent: true, opacity: 0.9 });
const cloudSea = new THREE.Mesh(cloudSeaGeo, cloudSeaMat);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -3.8;
scene.add(cloudSea);

// Subtle stars in night sky
const starCount = 300;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = (i * 2.399963) % (Math.PI * 2);
  const phi = Math.acos(0.15 + 0.85 * ((i % 97) / 97));
  const r = 135;
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.cos(phi);
  starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffe6b3, size: 0.7 });
scene.add(new THREE.Points(starGeo, starMat));

// Build May (Player) with non la + hanging small lantern
const playerGroup = new THREE.Group();
const cloakMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.42, 1.15, 12),
  new THREE.MeshStandardMaterial({ color: 0x456990, roughness: 0.75 })
);
cloakMesh.position.y = 0.58;
cloakMesh.castShadow = true;
playerGroup.add(cloakMesh);

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
  new THREE.MeshStandardMaterial({ color: 0xd9b36c, roughness: 0.85 })
);
hatMesh.position.y = 1.44;
hatMesh.castShadow = true;
playerGroup.add(hatMesh);

// Small lantern hanging from the rim of non la
const miniLanternPivot = new THREE.Group();
miniLanternPivot.position.set(0.42, 1.32, 0.24);
const miniLanternBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.08, 0.07, 0.16, 8),
  new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xff8c1a,
    emissiveIntensity: 2.2
  })
);
miniLanternBody.position.y = -0.1;
miniLanternPivot.add(miniLanternBody);
const miniLanternLight = new THREE.PointLight(0xffb755, 3.2, 14, 1.2);
miniLanternLight.position.y = -0.1;
miniLanternPivot.add(miniLanternLight);
playerGroup.add(miniLanternPivot);

scene.add(playerGroup);

// Pulse visual wave ring
const pulseRingGeo = new THREE.RingGeometry(0.4, 0.75, 48);
const pulseRingMat = new THREE.MeshBasicMaterial({
  color: 0xffc864,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0
});
const pulseRingMesh = new THREE.Mesh(pulseRingGeo, pulseRingMat);
pulseRingMesh.rotation.x = -Math.PI / 2;
pulseRingMesh.position.y = 0.08;
scene.add(pulseRingMesh);

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

function createLanternVisual(id: string): LanternVisual {
  const group = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.9 })
  );
  post.position.y = 1.1;
  post.castShadow = true;
  group.add(post);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x3f2d26, roughness: 0.85 })
  );
  roof.position.y = 2.65;
  roof.castShadow = true;
  group.add(roof);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x61546e,
    emissive: 0xff9a2e,
    emissiveIntensity: 0.25,
    roughness: 0.35
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), coreMat);
  core.position.y = 2.2;
  group.add(core);

  const light = new THREE.PointLight(0xffa940, 1.5, 22, 1.2);
  light.position.y = 2.3;
  group.add(light);

  const safeRingGeo = new THREE.RingGeometry(
    DEFAULT_TUNING.safe_radius - 0.14,
    DEFAULT_TUNING.safe_radius,
    48
  );
  const safeRingMat = new THREE.MeshBasicMaterial({
    color: 0xffba5c,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0
  });
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
const moteMat = new THREE.MeshStandardMaterial({
  color: 0xffe07d,
  emissive: 0xffaa2b,
  emissiveIntensity: 1.8,
  roughness: 0.2
});

function createShadeVisual(id: string): { group: THREE.Group; bodyMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1b0b2b,
    emissive: 0x3b1263,
    emissiveIntensity: 0.7,
    roughness: 0.5
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 14), bodyMat);
  body.scale.set(1, 1.35, 1);
  body.castShadow = true;
  group.add(body);

  const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd97dff });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.16, 0.18, 0.45);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.16, 0.18, 0.45);
  group.add(leftEye, rightEye);

  scene.add(group);
  const entry = { group, bodyMat };
  shadeVisuals.set(id, entry);
  return entry;
}

// Simulation state + reset
let sim = new GameSimulation(Date.now() & 0x7fffffff, 1);
let camYawDeg = 0;
let camPitch = 0.36;
let pulseVisualAge = 99;
let lastRenderedPulseTick = -1000;

function clearDynamicVisuals(): void {
  for (const v of lanternVisuals.values()) scene.remove(v.group);
  lanternVisuals.clear();
  for (const m of moteVisuals.values()) scene.remove(m);
  moteVisuals.clear();
  for (const s of shadeVisuals.values()) scene.remove(s.group);
  shadeVisuals.clear();
}

function resetGame(): void {
  clearDynamicVisuals();
  sim = new GameSimulation(Date.now() & 0x7fffffff, 1);
  camYawDeg = 0;
  pulseVisualAge = 99;
  lastRenderedPulseTick = -1000;
  overlay.classList.remove('visible');
}

restartBtn.addEventListener('click', resetGame);

// Input tracking
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
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
window.addEventListener('mouseup', () => {
  dragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  camYawDeg -= dx * 0.32;
  camPitch = Math.max(0.14, Math.min(0.85, camPitch + dy * 0.004));
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

  return {
    move: [mx, mz],
    cam_yaw_deg: camYawDeg,
    jump: keys.has('Space'),
    interact: keys.has('KeyE') || keys.has('KeyF'),
    pulse: keys.has('KeyQ') || keys.has('ShiftLeft') || keys.has('ShiftRight'),
    dash: false
  };
}

function syncVisuals(elapsedSec: number): void {
  // Player
  playerGroup.position.set(sim.playerPos[0], sim.playerPos[1], sim.playerPos[2]);
  const theta = (camYawDeg * Math.PI) / 180;
  playerGroup.rotation.y = theta;
  miniLanternPivot.rotation.z = Math.sin(elapsedSec * 4.5) * 0.14;

  // Flash when invulnerable after hit
  const blink = sim.invulnTimer > 0 && Math.floor(elapsedSec * 14) % 2 === 0;
  playerGroup.visible = !blink;

  // Pulse wave animation
  if (sim.lastPulseTick !== lastRenderedPulseTick && sim.lastPulseTick >= 0) {
    lastRenderedPulseTick = sim.lastPulseTick;
    pulseVisualAge = 0;
    pulseRingMesh.position.set(sim.playerPos[0], 0.1, sim.playerPos[2]);
  }
  if (pulseVisualAge < 0.45) {
    pulseVisualAge += DT;
    const progress = Math.min(1, pulseVisualAge / 0.45);
    const radiusScale = 1 + progress * (DEFAULT_TUNING.pulse_radius / 0.65);
    pulseRingMesh.scale.set(radiusScale, radiusScale, 1);
    pulseRingMat.opacity = (1 - progress) * 0.85;
  } else {
    pulseRingMat.opacity = 0;
  }

  // Lanterns
  let litCount = 0;
  let nearUnlit = false;
  for (const lantern of sim.lanterns) {
    if (lantern.lit) litCount += 1;
    const d = Math.hypot(sim.playerPos[0] - lantern.pos[0], sim.playerPos[2] - lantern.pos[2]);
    if (!lantern.lit && d <= DEFAULT_TUNING.interact_radius) {
      nearUnlit = true;
    }

    const vis = lanternVisuals.get(lantern.id) ?? createLanternVisual(lantern.id);
    vis.group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);

    if (lantern.lit) {
      vis.coreMat.color.setHex(0xffd27a);
      vis.coreMat.emissiveIntensity = 2.4 + Math.sin(elapsedSec * 3.5) * 0.2;
      vis.light.intensity = 26;
      vis.safeRingMat.opacity = 0.38;
    } else {
      const ratio = lantern.deposited / DEFAULT_TUNING.lantern_cost;
      vis.coreMat.color.setHex(ratio > 0 ? 0xbaa478 : 0x61546e);
      vis.coreMat.emissiveIntensity = 0.25 + ratio * 0.9;
      vis.light.intensity = 1.5 + ratio * 8;
      vis.safeRingMat.opacity = 0;
    }
  }

  // Island gets warmer and brighter as lanterns are lit
  const brightnessRatio = litCount / DEFAULT_TUNING.lantern_count_night1;
  hemiLight.intensity = 1.25 + brightnessRatio * 0.9;
  const blended = nightFogColor.clone().lerp(warmFogColor, brightnessRatio);
  scene.background = blended;
  fog.color.copy(blended);
  fog.density = 0.009 - brightnessRatio * 0.0035;

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
    mesh.position.set(mote.pos[0], 0.75 + Math.sin(elapsedSec * 3.2 + idx) * 0.18, mote.pos[2]);
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
    entry.group.position.set(
      shade.pos[0],
      shade.pos[1] + Math.sin(elapsedSec * 4) * 0.1,
      shade.pos[2]
    );
    const dx = sim.playerPos[0] - shade.pos[0];
    const dz = sim.playerPos[2] - shade.pos[2];
    entry.group.rotation.y = Math.atan2(dx, dz);
    if (shade.state === 'stunned') {
      entry.bodyMat.color.setHex(0x6e548c);
      entry.bodyMat.emissive.setHex(0xc99eff);
      entry.group.rotation.z = Math.sin(elapsedSec * 22) * 0.28;
    } else {
      entry.bodyMat.color.setHex(0x1b0b2b);
      entry.bodyMat.emissive.setHex(0x3b1263);
      entry.group.rotation.z = 0;
    }
  }

  // Camera follow (matches cam_yaw_deg world direction so W moves forward)
  const camDist = 9.5;
  const horiz = Math.cos(camPitch) * camDist;
  const vert = Math.sin(camPitch) * camDist + 1.5;
  const fwdX = Math.sin(theta);
  const fwdZ = Math.cos(theta);
  camera.position.set(
    sim.playerPos[0] - fwdX * horiz,
    sim.playerPos[1] + vert,
    sim.playerPos[2] - fwdZ * horiz
  );
  camera.lookAt(sim.playerPos[0], sim.playerPos[1] + 1.1, sim.playerPos[2]);

  // HUD updates
  hudFlames.textContent = '🔥'.repeat(sim.playerFlames) || '0';
  hudCarried.textContent = `${sim.playerCarried}/${DEFAULT_TUNING.carry_capacity}`;
  hudLanterns.textContent = `${litCount}/${DEFAULT_TUNING.lantern_count_night1}`;
  hudPulse.textContent =
    sim.pulseCooldownTimer > 0
      ? `${sim.pulseCooldownTimer.toFixed(1)}s`
      : sim.playerCarried >= DEFAULT_TUNING.pulse_cost
        ? 'Sẵn sàng'
        : 'Thiếu đom đóm';

  const secs = Math.ceil(sim.timeLeftS);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  hudTime.textContent = `${mm}:${ss}`;
  hudScore.textContent = String(sim.score);

  promptBanner.classList.toggle('visible', nearUnlit && sim.playerCarried > 0 && sim.state === 'playing');

  if (sim.state !== 'playing' && !overlay.classList.contains('visible')) {
    overlayTitle.textContent = sim.state === 'won' ? 'Ánh sáng trở lại!' : 'Sương đen bao phủ...';
    overlayDesc.textContent =
      sim.state === 'won'
        ? `Mây đã thắp sáng cả 5 Đèn Lồng Lớn! Điểm số: ${sim.score}.`
        : sim.playerFlames <= 0
          ? `Mây đã mất hết ngọn lửa trước Bóng Mực. Điểm số: ${sim.score}.`
          : `Đêm đã tàn trước khi thắp đủ 5 Đèn Lồng Lớn. Điểm số: ${sim.score}.`;
    overlay.classList.add('visible');
  }
}

// Fixed 60Hz accumulator loop
let lastFrameMs = performance.now();
let accumulator = 0;

function animate(nowMs: number): void {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;
  accumulator += frameDt;

  while (accumulator >= DT) {
    if (sim.state === 'playing') {
      sim.step(buildCurrentInput());
    }
    accumulator -= DT;
  }

  syncVisuals(nowMs / 1000);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
