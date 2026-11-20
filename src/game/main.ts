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
const hudCarriedText = document.getElementById('hud-carried-text')!;
const moteSlotsWrap = document.getElementById('mote-slots-wrap')!;
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
const colorblindToggle = document.getElementById('colorblind-toggle') as HTMLInputElement;
const reduceMotionToggle = document.getElementById('reduce-motion-toggle') as HTMLInputElement;
const largeTextToggle = document.getElementById('large-text-toggle') as HTMLInputElement;
const keybindGrid = document.getElementById('keybind-grid')!;
const keybindWarning = document.getElementById('keybind-warning')!;
const resetKeysBtn = document.getElementById('reset-keys-btn')!;

const leaderboardBtn = document.getElementById('leaderboard-btn')!;
const leaderboardOverlay = document.getElementById('leaderboard-overlay')!;
const closeLbBtn = document.getElementById('close-lb-btn')!;
const lbTbody = document.getElementById('lb-tbody')!;
const lbSubmitBox = document.getElementById('lb-submit-box')!;
const lbNameInput = document.getElementById('lb-name-input') as HTMLInputElement;
const lbSaveBtn = document.getElementById('lb-save-btn')!;
const lbSaveMsg = document.getElementById('lb-save-msg')!;
const a11ySubtitle = document.getElementById('a11y-subtitle')!;
const shadeSpawnArrow = document.getElementById('shade-spawn-arrow')!;
const flashOverlay = document.getElementById('flash-overlay')!;

const mainMenuOverlay = document.getElementById('main-menu-overlay')!;
const menuPlayBtn = document.getElementById('menu-play-btn')!;
const menuN2Btn = document.getElementById('menu-n2-btn')!;
const menuN3Btn = document.getElementById('menu-n3-btn')!;
const menuLbBtn = document.getElementById('menu-lb-btn')!;
const menuSettingsBtn = document.getElementById('menu-settings-btn')!;
const backMenuBtn = document.getElementById('back-menu-btn')!;
const hudEl = document.getElementById('hud')!;
const moteBarEl = document.getElementById('mote-bar-container')!;
const skillsPanelEl = document.getElementById('skills-panel')!;
const controlsHintEl = document.getElementById('controls-hint')!;

let mouseSens = parseFloat(localStorage.getItem('ddl_sens') || '1.0');
let savedVol = parseFloat(localStorage.getItem('ddl_vol') || '0.5');
let colorblindMode = localStorage.getItem('ddl_colorblind') === 'true';
let reduceMotion = localStorage.getItem('ddl_reduce_motion') === 'true';
let largeText = localStorage.getItem('ddl_large_text') === 'true';
document.body.classList.toggle('colorblind', colorblindMode);
document.body.classList.toggle('large-text', largeText);
sounds.setVolume(savedVol);

type ActionKey = 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'jump' | 'dash' | 'interact' | 'pulse' | 'pause';
const ACTION_LABELS: Record<ActionKey, string> = {
  moveUp: 'Đi tiến',
  moveDown: 'Đi lùi',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Nạp đèn',
  pulse: 'Tỏa Sáng',
  pause: 'Tạm dừng'
};
const DEFAULT_KEYBINDS: Record<ActionKey, string> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyQ',
  pause: 'Escape'
};

function loadKeybinds(): Record<ActionKey, string> {
  try {
    const raw = localStorage.getItem('ddl_keybinds');
    if (raw) {
      return { ...DEFAULT_KEYBINDS, ...(JSON.parse(raw) as Partial<Record<ActionKey, string>>) };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_KEYBINDS };
}

let keybinds: Record<ActionKey, string> = loadKeybinds();
let listeningAction: ActionKey | null = null;

function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'Space') return 'Space';
  if (code === 'Escape') return 'Esc';
  return code;
}

function renderKeybindsUI(): void {
  if (!keybindGrid) return;
  keybindGrid.innerHTML = '';
  const counts = new Map<string, number>();
  for (const val of Object.values(keybinds)) {
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  let hasDuplicate = false;

  (Object.keys(ACTION_LABELS) as ActionKey[]).forEach((action) => {
    const label = document.createElement('span');
    label.textContent = ACTION_LABELS[action];
    const btn = document.createElement('button');
    const code = keybinds[action];
    const isDup = (counts.get(code) ?? 0) > 1;
    if (isDup) hasDuplicate = true;
    btn.className = `key-btn${listeningAction === action ? ' listening' : ''}${isDup ? ' conflict' : ''}`;
    btn.textContent = listeningAction === action ? 'Nhấn phím...' : formatKeyCode(code);
    btn.addEventListener('click', () => {
      listeningAction = action;
      renderKeybindsUI();
    });
    keybindGrid.appendChild(label);
    keybindGrid.appendChild(btn);
  });

  if (keybindWarning) {
    keybindWarning.textContent = hasDuplicate ? 'Cảnh báo: Có phím bị gán trùng cho nhiều hành động!' : '';
  }
}

renderKeybindsUI();

resetKeysBtn?.addEventListener('click', () => {
  keybinds = { ...DEFAULT_KEYBINDS };
  listeningAction = null;
  localStorage.setItem('ddl_keybinds', JSON.stringify(keybinds));
  renderKeybindsUI();
});

if (reduceMotionToggle) {
  reduceMotionToggle.checked = reduceMotion;
  reduceMotionToggle.addEventListener('change', () => {
    reduceMotion = reduceMotionToggle.checked;
    localStorage.setItem('ddl_reduce_motion', String(reduceMotion));
  });
}

if (largeTextToggle) {
  largeTextToggle.checked = largeText;
  largeTextToggle.addEventListener('change', () => {
    largeText = largeTextToggle.checked;
    document.body.classList.toggle('large-text', largeText);
    localStorage.setItem('ddl_large_text', String(largeText));
  });
}

if (colorblindToggle) {
  colorblindToggle.checked = colorblindMode;
  colorblindToggle.addEventListener('change', () => {
    colorblindMode = colorblindToggle.checked;
    document.body.classList.toggle('colorblind', colorblindMode);
    localStorage.setItem('ddl_colorblind', String(colorblindMode));
  });
}

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

    // Tier 1 (Y=3): annular half-ring r=12..24 for z > 0
    const ringShape = new THREE.Shape();
    ringShape.absarc(0, 0, 24, 0, Math.PI, false);
    ringShape.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1Geo = new THREE.ExtrudeGeometry(ringShape, { depth: 3, bevelEnabled: false, curveSegments: 48 });
    const tier1 = new THREE.Mesh(tier1Geo, sandMat);
    tier1.rotation.x = Math.PI / 2;
    tier1.position.y = 3;
    tier1.receiveShadow = true;

    // Ramps at 30 deg and 150 deg (width 3m, r in [24, 30], from Y=0 to Y=3)
    const rampAnglePitch = Math.atan2(3, 6);
    const rampLen = Math.hypot(6, 3);
    for (const rampAngle of [Math.PI / 6, (5 * Math.PI) / 6]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.36, rampLen), woodMat);
      const midR = 27;
      ramp.position.set(Math.cos(rampAngle) * midR, 1.32, Math.sin(rampAngle) * midR);
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = Math.atan2(Math.cos(rampAngle), Math.sin(rampAngle));
      ramp.rotation.x = rampAnglePitch;
      ramp.receiveShadow = true;
      terrainGroup.add(ramp);
    }

    // Tier 2 (Y=6): center disc r=8 (grounded down to Y=0)
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 32), woodMat);
    tier2.position.set(0, 3, 0);
    tier2.receiveShadow = true;

    // Bell Tower in center (Y=6 to 14, r=2): 4-pillar pavilion + roof so May at (0,6,0) stays visible
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x5b5f6e, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const pa = (i * Math.PI) / 2 + Math.PI / 4;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 6, 8), towerMat);
      pillar.position.set(Math.cos(pa) * 1.7, 9, Math.sin(pa) * 1.7);
      pillar.castShadow = true;
      terrainGroup.add(pillar);
    }
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 8), towerMat);
    towerRoof.position.set(0, 13.1, 0);
    towerRoof.castShadow = true;

    // Jump pad on tier 1 at (0, 3, 13)
    const padGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.25, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xffae42, emissiveIntensity: 0.8 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 3.1, 13);

    terrainGroup.add(tier0, tier1, tier2, towerRoof, pad);
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
  coreMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  tearBand: THREE.Mesh;
  fuelBar: THREE.Mesh;
  fuelBarMat: THREE.MeshBasicMaterial;
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
  const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), coreMat);
  coreMesh.position.y = 2.2;
  group.add(coreMesh);

  // Non-color distinction: dark tear band visible when unlit
  const tearBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.05, 6, 12),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
  );
  tearBand.position.y = 2.2;
  tearBand.rotation.x = Math.PI / 3;
  group.add(tearBand);

  // Fuel bar above lit lantern
  const fuelBarMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const fuelBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.14), fuelBarMat);
  fuelBar.position.y = 3.2;
  group.add(fuelBar);

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
  const vis: LanternVisual = { group, coreMesh, coreMat, tearBand, fuelBar, fuelBarMat, light, safeRingMat };
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
let currentSeed = (Date.now() & 0x7fffffff) || 42;
let runWonScoreTotal = 0;
let runNightsWon = 0;
let scoreSubmittedThisRun = false;

const urlParams = new URLSearchParams(window.location.search);
const isBenchMode = urlParams.get('bench') === '1';
const benchSeed = Number(urlParams.get('seed') ?? '42') || 42;
const benchDuration = Number(urlParams.get('duration') ?? '30') || 30;
if (isBenchMode) {
  currentSeed = benchSeed;
}

let inMainMenu = !isBenchMode;

function setMenuVisible(visible: boolean): void {
  inMainMenu = visible;
  mainMenuOverlay.style.display = visible ? 'flex' : 'none';
  hudEl.style.display = visible ? 'none' : 'flex';
  moteBarEl.style.display = visible ? 'none' : 'flex';
  skillsPanelEl.style.display = visible ? 'none' : 'flex';
  controlsHintEl.style.display = visible ? 'none' : 'block';
  if (visible) {
    overlay.classList.remove('visible');
    promptBanner.classList.remove('visible');
    lanternArrow.style.display = 'none';
  }
}

setMenuVisible(inMainMenu);

let sim = new GameSimulation(
  currentSeed,
  currentNight,
  isBenchMode ? { bench_mode: true } : undefined
);
buildTerrain(currentNight);
let camYawDeg = 0;
let camPitch = 0.36;

interface WebLbEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

function isoNowWithTz(): string {
  const d = new Date();
  const tzOffsetMin = -d.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const hh = pad(tzOffsetMin / 60);
  const mm = pad(tzOffsetMin % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`;
}

function getLocalLeaderboard(): WebLbEntry[] {
  try {
    const raw = localStorage.getItem('ddl_leaderboard');
    if (raw) {
      const arr = JSON.parse(raw) as WebLbEntry[];
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    // ignore
  }
  return [];
}

function sortLeaderboard(entries: WebLbEntry[]): WebLbEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
    })
    .slice(0, 10);
}

async function saveLeaderboardEntry(name: string): Promise<void> {
  if (scoreSubmittedThisRun) return;
  const cleanName = name.trim();
  if (!/^[\p{L}0-9_]{3,12}$/u.test(cleanName)) {
    lbSaveMsg.textContent = 'Tên phải dài 3–12 ký tự (chữ, số hoặc _).';
    return;
  }
  const entry: WebLbEntry = {
    name: cleanName,
    score: runWonScoreTotal,
    nights_won: runNightsWon,
    achieved_at: isoNowWithTz(),
    seed: currentSeed
  };
  const updated = sortLeaderboard([...getLocalLeaderboard(), entry]);
  localStorage.setItem('ddl_leaderboard', JSON.stringify(updated));
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  } catch {
    // Static preview without API server
  }
  scoreSubmittedThisRun = true;
  lbSaveMsg.style.color = '#ffe58a';
  lbSaveMsg.textContent = 'Đã lưu vào Bảng Xếp Hạng!';
  lbSaveBtn.setAttribute('disabled', 'true');
}

async function openLeaderboardModal(): Promise<void> {
  let entries = getLocalLeaderboard();
  try {
    const resp = await fetch('/api/leaderboard');
    if (resp.ok) {
      const json = (await resp.json()) as { entries: WebLbEntry[] };
      if (Array.isArray(json.entries) && json.entries.length > 0) {
        entries = json.entries;
      }
    }
  } catch {
    // use localStorage
  }
  const sorted = sortLeaderboard(entries);
  lbTbody.innerHTML =
    sorted.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:#8fa3b8;">Chưa có dữ liệu xếp hạng.</td></tr>'
      : sorted
          .map(
            (e, idx) =>
              `<tr><td>${idx + 1}</td><td>${e.name}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${e.seed}</td></tr>`
          )
          .join('');
  leaderboardOverlay.style.display = 'flex';
}

leaderboardBtn?.addEventListener('click', () => {
  void openLeaderboardModal();
});
closeLbBtn?.addEventListener('click', () => {
  leaderboardOverlay.style.display = 'none';
});
lbSaveBtn?.addEventListener('click', () => {
  void saveLeaderboardEntry(lbNameInput.value);
});

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

function startNight(night: number, resetRun = false): void {
  setMenuVisible(false);
  if (resetRun || night === 1) {
    runWonScoreTotal = 0;
    runNightsWon = 0;
  }
  scoreSubmittedThisRun = false;
  lbSaveBtn?.removeAttribute('disabled');
  if (lbSaveMsg) {
    lbSaveMsg.textContent = '';
    lbSaveMsg.style.color = '#ff9fa2';
  }
  currentNight = night;
  currentSeed = (Date.now() & 0x7fffffff) || 42;
  clearDynamicVisuals();
  sim = new GameSimulation(currentSeed, currentNight);
  buildTerrain(currentNight);
  camYawDeg = 0;
  nightNameEl.textContent = currentNight === 1 ? 'Đêm 1 · Đảo Bến' : currentNight === 2 ? 'Đêm 2 · Đảo Cau' : 'Đêm 3 · Đảo Chuông';
  overlay.classList.remove('visible');
}

restartBtn.addEventListener('click', () => startNight(currentNight, currentNight === 1));
resumeBtn.addEventListener('click', () => { pauseTriggered = true; });
nextNightBtn.addEventListener('click', () => {
  if (currentNight < 3) startNight(currentNight + 1, false);
  else startNight(1, true);
});
selectNightBtn.addEventListener('click', () => {
  const nextN = currentNight === 1 ? 2 : currentNight === 2 ? 3 : 1;
  startNight(nextN, true);
});
backMenuBtn?.addEventListener('click', () => setMenuVisible(true));
menuPlayBtn?.addEventListener('click', () => {
  sounds.startBGM();
  startNight(1, true);
});
menuN2Btn?.addEventListener('click', () => {
  sounds.startBGM();
  startNight(2, true);
});
menuN3Btn?.addEventListener('click', () => {
  sounds.startBGM();
  startNight(3, true);
});
menuLbBtn?.addEventListener('click', () => {
  void openLeaderboardModal();
});
menuSettingsBtn?.addEventListener('click', () => {
  settingsOverlay.style.display = 'flex';
});

// Input tracking
const keys = new Set<string>();
let pauseTriggered = false;
window.addEventListener('keydown', (e) => {
  if (listeningAction) {
    e.preventDefault();
    keybinds[listeningAction] = e.code;
    listeningAction = null;
    localStorage.setItem('ddl_keybinds', JSON.stringify(keybinds));
    renderKeybindsUI();
    return;
  }
  if (inMainMenu || document.activeElement === lbNameInput) return;
  sounds.startBGM();
  keys.add(e.code);
  if (e.code === keybinds.pause || e.code === 'KeyP') {
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
  if (isBenchMode) {
    return {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false
    };
  }
  let mx = 0;
  let mz = 0;
  if (keys.has(keybinds.moveUp) || keys.has('ArrowUp')) mz += 1;
  if (keys.has(keybinds.moveDown) || keys.has('ArrowDown')) mz -= 1;
  if (keys.has(keybinds.moveLeft) || keys.has('ArrowLeft')) mx += 1;
  if (keys.has(keybinds.moveRight) || keys.has('ArrowRight')) mx -= 1;

  if (keys.has('KeyJ')) camYawDeg += 1.8;
  if (keys.has('KeyL')) camYawDeg -= 1.8;

  const doPause = pauseTriggered;
  pauseTriggered = false;

  return {
    move: [mx, mz],
    cam_yaw_deg: camYawDeg,
    jump: keys.has(keybinds.jump),
    interact: keys.has(keybinds.interact) || keys.has('KeyF'),
    pulse: keys.has(keybinds.pulse),
    dash: keys.has(keybinds.dash) || keys.has('ShiftRight'),
    pause: doPause
  };
}

let recentShadeSpawnPos: [number, number, number] | null = null;
let recentShadeSpawnUntilMs = 0;
let flashUntilMs = 0;
let flashColor = 'rgba(255, 90, 95, 0.35)';
let lastGameOverRecordedSimTick = -1;

const benchBootMs = performance.now();
let benchFirstFrameMs = -1;
let benchMeasureStarted = false;
let benchMeasureStartMs = 0;
let benchFinished = false;
const benchDts: number[] = [];

function updateA11yIndicators(nowMs: number): void {
  if (isBenchMode) {
    a11ySubtitle.innerHTML = '';
    shadeSpawnArrow.style.display = 'none';
    flashOverlay.style.opacity = '0';
    return;
  }

  const pills: Array<{ text: string; danger?: boolean }> = [];
  if (nowMs < recentShadeSpawnUntilMs) {
    pills.push({ text: '⚠ Bóng Mực vừa xuất hiện!', danger: true });
  }
  if (sim.night === 3 && sim.windEnabled && !sim.windActive && sim.windTimer % 1800 >= 1380 && sim.windTimer % 1800 < 1500) {
    pills.push({ text: '🍃 Gió mạnh sắp thổi!' });
  }
  if (sim.state === 'playing' && sim.timeLeftS <= 10 && sim.timeLeftS > 0) {
    pills.push({ text: `⏳ ${Math.ceil(sim.timeLeftS)} giây cuối trước bình minh!`, danger: true });
  }
  const lowFuelIds = sim.lanterns.filter((l) => l.lit && l.fuelTicks < 1800).map((l) => l.id);
  if (lowFuelIds.length > 0) {
    pills.push({ text: `🔥 Đèn ${lowFuelIds.join(', ')} sắp cạn dầu (< 30%)!`, danger: true });
  }

  a11ySubtitle.innerHTML = pills
    .map((p) => `<div class="subtitle-pill${p.danger ? ' danger' : ''}">${p.text}</div>`)
    .join('');

  if (recentShadeSpawnPos && nowMs < recentShadeSpawnUntilMs && sim.state === 'playing') {
    const sPos3D = new THREE.Vector3(recentShadeSpawnPos[0], recentShadeSpawnPos[1] + 1, recentShadeSpawnPos[2]);
    const screenPos = sPos3D.project(camera);
    let sx = screenPos.x;
    let sy = screenPos.y;
    if (screenPos.z > 1) {
      sx = -sx;
      sy = -sy;
    }
    const angleRad = Math.atan2(sy, sx);
    const distFromCenter = Math.min(window.innerWidth, window.innerHeight) * 0.44;
    shadeSpawnArrow.style.display = 'block';
    shadeSpawnArrow.style.left = `${window.innerWidth / 2 + Math.cos(angleRad) * distFromCenter}px`;
    shadeSpawnArrow.style.top = `${window.innerHeight / 2 - Math.sin(angleRad) * distFromCenter}px`;
    shadeSpawnArrow.style.transform = `rotate(${-angleRad + Math.PI / 2}rad)`;
  } else {
    shadeSpawnArrow.style.display = 'none';
  }

  if (!reduceMotion && nowMs < flashUntilMs) {
    flashOverlay.style.background = flashColor;
    flashOverlay.style.opacity = '1';
  } else {
    flashOverlay.style.opacity = '0';
  }
}

function syncVisuals(elapsedSec: number): void {
  const nowMs = elapsedSec * 1000;
  playerGroup.position.set(sim.playerPos[0], sim.playerPos[1], sim.playerPos[2]);
  const theta = (camYawDeg * Math.PI) / 180;
  playerGroup.rotation.y = theta;

  const blink = !reduceMotion && sim.invulnTicks > 0 && Math.floor(elapsedSec * 14) % 2 === 0;
  playerGroup.visible = !blink;

  let litCount = 0;
  let nearLantern: (typeof sim.lanterns)[number] | null = null;
  for (const lantern of sim.lanterns) {
    if (lantern.lit) litCount += 1;
    const d = Math.hypot(sim.playerPos[0] - lantern.pos[0], sim.playerPos[2] - lantern.pos[2]);
    const eligible = !lantern.lit || lantern.fuelTicks < 6000;
    if (eligible && d <= DEFAULT_TUNING.interact_radius) {
      nearLantern = lantern;
    }

    const vis = lanternVisuals.get(lantern.id) ?? createLanternVisual(lantern.id);
    vis.group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);

    const fuel = lantern.fuelTicks / 60;
    const lowFuelBlink =
      !reduceMotion && lantern.lit && fuel < 30 ? (Math.sin(elapsedSec * Math.PI * 2) > 0 ? 1 : 0.25) : 1;

    if (lantern.lit) {
      vis.coreMesh.scale.set(1, 1, 1);
      vis.tearBand.visible = false;
      vis.coreMat.color.setHex(0xffb347);
      vis.coreMat.emissiveIntensity = 2.4 * lowFuelBlink;
      vis.light.intensity = 26 * lowFuelBlink;
      vis.safeRingMat.opacity = fuel >= 30 ? 0.38 : 0.08;
      vis.fuelBar.visible = true;
      vis.fuelBar.scale.x = Math.max(0.05, fuel / 100);
      vis.fuelBarMat.color.setHex(fuel < 30 ? (colorblindMode ? 0xffffff : 0xff5a5f) : 0xffb347);
      vis.fuelBarMat.opacity = lowFuelBlink;
    } else {
      const cost = lantern.everLit ? DEFAULT_TUNING.relight_cost : DEFAULT_TUNING.lantern_cost;
      const ratio = lantern.deposited / cost;
      vis.coreMesh.scale.set(1, 0.8, 1);
      vis.tearBand.visible = true;
      vis.fuelBar.visible = false;
      vis.coreMat.color.setHex(ratio > 0 ? 0xffb347 : 0x5b5f6e);
      vis.coreMat.emissiveIntensity = 0.25 + ratio * 0.9;
      vis.light.intensity = 1.5 + ratio * 8;
      vis.safeRingMat.opacity = 0;
    }
  }

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
    entry.bodyMat.emissive.setHex(colorblindMode ? 0x00b3ff : 0x7a3cff);
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

  // Camera
  if (isBenchMode) {
    const angle = ((elapsedSec - benchBootMs / 1000) / 15.0) * Math.PI * 2;
    camera.position.set(Math.cos(angle) * 30.0, 15.0, -Math.sin(angle) * 30.0);
    camera.lookAt(0, 0, 0);
  } else if (inMainMenu) {
    const angle = elapsedSec * 0.15;
    camera.position.set(Math.cos(angle) * 28.0, 14.0, Math.sin(angle) * 28.0);
    camera.lookAt(0, 1, 0);
  } else {
    const camDist = 9.5;
    const horiz = Math.cos(camPitch) * camDist;
    const vert = Math.sin(camPitch) * camDist + 1.5;
    const fwdX = Math.sin(theta);
    const fwdZ = Math.cos(theta);
    let shakeX = 0;
    let shakeY = 0;
    if (!reduceMotion && sim.simTick - sim.lastHitTick < 18) {
      shakeX = (Math.random() - 0.5) * 0.4;
      shakeY = (Math.random() - 0.5) * 0.4;
    }
    camera.position.set(
      sim.playerPos[0] - fwdX * horiz + shakeX,
      sim.playerPos[1] + vert + shakeY,
      sim.playerPos[2] - fwdZ * horiz
    );
    camera.lookAt(sim.playerPos[0], sim.playerPos[1] + 1.1, sim.playerPos[2]);
  }

  updateA11yIndicators(nowMs);

  // HUD updates
  hudFlames.textContent = '🔥'.repeat(sim.playerFlames) || '0';
  hudLanterns.textContent = `${litCount}/${sim.lanterns.length}`;
  hudCharm.textContent = sim.charmTicks > 0 ? `${(sim.charmTicks / 60).toFixed(1)}s` : 'Không';

  const cap = sim.getCapacity();
  hudCarriedText.textContent = `${sim.playerCarried}/${cap}`;
  if (moteSlotsWrap.children.length !== cap) {
    moteSlotsWrap.innerHTML = '';
    for (let i = 0; i < cap; i++) {
      const div = document.createElement('div');
      div.className = 'mote-slot';
      moteSlotsWrap.appendChild(div);
    }
  }
  Array.from(moteSlotsWrap.children).forEach((slot, idx) => {
    slot.classList.toggle('filled', idx < sim.playerCarried);
  });

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
  hudTime.textContent = secs <= 30 && colorblindMode ? `⚠ ${mm}:${ss}` : `${mm}:${ss}`;
  hudTime.classList.toggle('warning', secs <= 30);
  hudScore.textContent = String(sim.score);

  if (nearLantern && sim.playerCarried > 0 && sim.state === 'playing' && !isBenchMode) {
    if (nearLantern.lit) {
      promptBanner.textContent = `Nhấn ${formatKeyCode(keybinds.interact)} để châm dầu (${Math.round(nearLantern.fuelTicks / 60)}/100)`;
    } else {
      const cost = nearLantern.everLit ? DEFAULT_TUNING.relight_cost : DEFAULT_TUNING.lantern_cost;
      promptBanner.textContent = `Nhấn ${formatKeyCode(keybinds.interact)} để nạp ánh sáng (${nearLantern.deposited}/${cost})`;
    }
    promptBanner.classList.add('visible');
  } else {
    promptBanner.classList.remove('visible');
  }

  // Arrow pointing to nearest unlit lantern
  const unlitLanterns = sim.lanterns.filter((l) => !l.lit);
  if (unlitLanterns.length > 0 && sim.state === 'playing' && !isBenchMode) {
    let nearestL = unlitLanterns[0];
    let minDist = Infinity;
    for (const l of unlitLanterns) {
      const d = Math.hypot(sim.playerPos[0] - l.pos[0], sim.playerPos[2] - l.pos[2]);
      if (d < minDist) {
        minDist = d;
        nearestL = l;
      }
    }

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
  if (isBenchMode || inMainMenu) {
    overlay.classList.remove('visible');
    return;
  }

  if (sim.state === 'paused') {
    overlayTitle.textContent = 'Tạm dừng';
    overlayDesc.textContent = 'Trò chơi đang tạm dừng. Nhấn Tiếp tục hoặc phím tạm dừng để trở lại đảo.';
    resumeBtn.style.display = 'inline-block';
    nextNightBtn.style.display = 'none';
    lbSubmitBox.style.display = 'none';
    overlay.classList.add('visible');
  } else if (sim.state === 'won') {
    if (lastGameOverRecordedSimTick !== sim.simTick) {
      lastGameOverRecordedSimTick = sim.simTick;
      runWonScoreTotal += sim.score;
      runNightsWon = currentNight;
    }
    overlayTitle.textContent = currentNight === 3 ? 'Bình Minh Trên Đảo!' : 'Ánh sáng trở lại!';
    overlayDesc.textContent =
      currentNight === 3
        ? `Chúc mừng Mây! Bạn đã hoàn thành trọn vẹn cả 3 Đêm! Tổng điểm tích lũy: ${runWonScoreTotal}.`
        : `Mây đã thắp sáng đủ Đèn Lồng Đêm ${currentNight}! Điểm Đêm ${currentNight}: ${sim.score}. Sẵn sàng cho Đêm tiếp theo?`;
    resumeBtn.style.display = 'none';
    nextNightBtn.style.display = 'inline-block';
    nextNightBtn.textContent = currentNight === 3 ? 'Chơi lại từ Đêm 1' : `Sang Đêm ${currentNight + 1}`;
    lbSubmitBox.style.display = currentNight === 3 ? 'block' : 'none';
    overlay.classList.add('visible');
  } else if (sim.state === 'lost') {
    if (lastGameOverRecordedSimTick !== sim.simTick) {
      lastGameOverRecordedSimTick = sim.simTick;
    }
    overlayTitle.textContent = 'Sương đen bao phủ...';
    overlayDesc.textContent = `Mây chưa thể xua tan bóng tối Đêm ${currentNight}. Tổng điểm các Đêm thắng: ${runWonScoreTotal}. Hãy lưu điểm hoặc thử lại!`;
    resumeBtn.style.display = 'none';
    nextNightBtn.style.display = 'none';
    lbSubmitBox.style.display = 'block';
    overlay.classList.add('visible');
  } else {
    overlay.classList.remove('visible');
    lbSubmitBox.style.display = 'none';
  }
}

let lastFrameMs = performance.now();
let accumulator = 0;
let lastCountdownSecond = -1;

function finishBench(): void {
  if (benchFinished || benchDts.length === 0) return;
  benchFinished = true;
  const n = benchDts.length;
  const sumDt = benchDts.reduce((a, b) => a + b, 0);
  const avgFps = Math.round(((1000 * n) / sumDt) * 10) / 10;

  const sortedDesc = [...benchDts].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const topKMean = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const p1LowFps = Math.round((1000 / topKMean) * 10) / 10;

  const sortedAsc = [...benchDts].sort((a, b) => a - b);
  const p95Idx = Math.min(n - 1, Math.floor(0.95 * (n - 1)));
  const frameMsP95 = Math.round(sortedAsc[p95Idx] * 10) / 10;

  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));

  void fetch('/api/bench-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avg_fps: avgFps,
      p1_low_fps: p1LowFps,
      frame_ms_p95: frameMsP95,
      frames: n,
      first_frame_rel_ms: Math.round(benchFirstFrameMs - benchBootMs),
      renderer: `Three.js r170 / ${gpu}`
    })
  });
}

function animate(nowMs: number): void {
  requestAnimationFrame(animate);
  const rawFrameMs = nowMs - lastFrameMs;
  const frameDt = Math.min(0.1, rawFrameMs / 1000);
  lastFrameMs = nowMs;
  accumulator += frameDt;

  while (accumulator >= DT) {
    if (!inMainMenu) {
      const input = buildCurrentInput();
      const events = sim.step(input);

      if (!isBenchMode) {
        for (const ev of events) {
          if (ev.name === 'mote_picked') sounds.playMote();
          else if (ev.name === 'lantern_lit') sounds.playLantern();
          else if (ev.name === 'dash') sounds.playDash();
          else if (ev.name === 'pulse') {
            sounds.playPulse();
            flashColor = 'rgba(255, 229, 138, 0.28)';
            flashUntilMs = nowMs + 160;
          } else if (ev.name === 'player_hit') {
            sounds.playHit();
            flashColor = 'rgba(255, 90, 95, 0.38)';
            flashUntilMs = nowMs + 220;
          } else if (ev.name === 'shade_spawned') {
            sounds.playShadeSpawn();
            const spawned = sim.shades.find((s) => s.id === ev.data.id);
            if (spawned) {
              recentShadeSpawnPos = [spawned.pos[0], spawned.pos[1], spawned.pos[2]];
              recentShadeSpawnUntilMs = nowMs + 3500;
            }
          } else if (ev.name === 'game_over') {
            if (ev.data.result === 'won') sounds.playWin();
            else sounds.playLoss();
          }
        }
        if (input.jump && sim.playerGrounded) sounds.playJump();

        if (sim.state === 'playing' && sim.timeLeftS <= 10 && sim.timeLeftS > 0) {
          const curSec = Math.floor(sim.timeLeftS);
          if (curSec !== lastCountdownSecond) {
            lastCountdownSecond = curSec;
            sounds.playCountdownBeep();
          }
        }
      }
    }

    accumulator -= DT;
  }

  syncVisuals(nowMs / 1000);
  renderer.render(scene, camera);

  if (isBenchMode && !benchFinished) {
    if (benchFirstFrameMs < 0) {
      benchFirstFrameMs = performance.now();
    }
    const elapsedSinceFirstMs = performance.now() - benchFirstFrameMs;
    if (elapsedSinceFirstMs >= 3000) {
      if (!benchMeasureStarted) {
        benchMeasureStarted = true;
        benchMeasureStartMs = performance.now();
      } else {
        benchDts.push(Math.max(0.01, rawFrameMs));
        if (performance.now() - benchMeasureStartMs >= benchDuration * 1000) {
          finishBench();
        }
      }
    }
  }
}

requestAnimationFrame(animate);
