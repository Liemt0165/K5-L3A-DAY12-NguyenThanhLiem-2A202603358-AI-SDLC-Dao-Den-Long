import { DEFAULT_TUNING, DT, FUEL_MAX_TICKS, TICKS_PER_SECOND, round1, round3 } from './contract.js';
import { SeededRng } from './rng.js';
import type {
  CharmEntity,
  DrifterEntity,
  EndRecord,
  EventRecord,
  GamePhaseState,
  InputState,
  LanternEntity,
  MoteEntity,
  ScenarioConfig,
  ShadeEntity,
  SnapshotRecord,
  TuningConfig,
  Vec3
} from './types.js';

export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function dist3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function defaultInputState(): InputState {
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

export class GameSimulation {
  readonly tuning: TuningConfig;
  readonly rng: SeededRng;
  readonly night: number;

  simTick = 0;
  rawTick = 0;
  state: GamePhaseState = 'playing';
  score = 0;
  initialTimeLeftS: number;
  timeLeftS: number;

  playerPos: Vec3 = [0, 0, 0];
  playerVel: Vec3 = [0, 0, 0];
  playerGrounded = true;
  playerFlames: number;
  playerCarried = 0;
  successfulLights = 0;

  // Timers (ticks)
  invulnTicks = 0;
  dashCdTicks = 0;
  pulseCdTicks = 0;
  charmTicks = 0;

  // Dash state
  isDashing = false;
  dashTicksLeft = 0;
  dashDir: [number, number] = [0, 1];

  // Jump pad launch lock
  isLaunched = false;

  // Respawn wait after falling
  isRespawning = false;
  respawnTicksLeft = 0;

  // Wind state
  windActive = false;
  windDirDeg = 0;
  windTimer = 0;
  windDurationTicks = 0;
  windEnabled = true;

  // Entities
  lanterns: LanternEntity[] = [];
  shades: ShadeEntity[] = [];
  drifters: DrifterEntity[] = [];
  charms: CharmEntity[] = [];
  motes: MoteEntity[] = [];

  private randomMotes: boolean;
  private randomShades: boolean;
  private randomDrifters: boolean;
  private nextMoteSeq = 1;
  private nextShadeSeq = 1;
  private nextDrifterSeq = 1;
  private prevInput: InputState = defaultInputState();

  // Visual helper
  lastPulseTick = -1000;
  lastHitTick = -1000;

  constructor(
    seed: number,
    night = 1,
    scenario?: ScenarioConfig,
    tuning: TuningConfig = DEFAULT_TUNING
  ) {
    this.tuning = tuning;
    this.night = night;
    this.rng = new SeededRng(seed);
    this.playerFlames = tuning.flames;

    if (night === 1) this.initialTimeLeftS = tuning.night1_duration_s;
    else if (night === 2) this.initialTimeLeftS = tuning.night2_duration_s;
    else this.initialTimeLeftS = tuning.night3_duration_s;
    this.timeLeftS = this.initialTimeLeftS;

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;
    this.randomDrifters = scenario?.random_drifters ?? true;
    this.windEnabled = scenario?.wind_enabled ?? (night === 3);

    this.initMap(night);
    const initGroundY = this.getGroundY(this.playerPos[0], this.playerPos[2]);
    if (initGroundY !== null) {
      this.playerPos[1] = initGroundY;
      this.playerGrounded = true;
    }
    this.applyScenario(scenario);
  }

  getCapacity(): number {
    return Math.min(this.tuning.capacity_max, this.tuning.carry_capacity + 2 * this.successfulLights);
  }

  private makeLantern(id: string, pos: Vec3): LanternEntity {
    return {
      id,
      pos,
      lit: false,
      deposited: 0,
      fuelTicks: 0,
      everLit: false,
      relitCount: 0
    };
  }

  private initMap(night: number): void {
    if (night === 1) {
      this.lanterns = [
        this.makeLantern('L1', [0, 0, 25]),
        this.makeLantern('L2', [23.8, 0, 7.7]),
        this.makeLantern('L3', [14.7, 0, -20.2]),
        this.makeLantern('L4', [-14.7, 0, -20.2]),
        this.makeLantern('L5', [-23.8, 0, 7.7])
      ];
      if (this.randomMotes) this.spawnInitialMotesNight1();
    } else if (night === 2) {
      this.lanterns = [
        this.makeLantern('L1', [0, 0, 20]),
        this.makeLantern('L2', [17, 0, -10]),
        this.makeLantern('L3', [-17, 0, -10]),
        this.makeLantern('L4', [70, 0, 20]),
        this.makeLantern('L5', [87, 0, -10]),
        this.makeLantern('L6', [53, 0, -10])
      ];
      this.charms = [{ id: 'C1', pos: [35, 0, 0], available: true, respawnTicks: 0 }];
      if (this.randomMotes) this.spawnInitialMotesNight2();
    } else {
      this.lanterns = [
        this.makeLantern('L1', [0, 6, 6]),
        this.makeLantern('L2', [18, 3, 10]),
        this.makeLantern('L3', [-18, 3, 10]),
        this.makeLantern('L4', [35, 0, -10]),
        this.makeLantern('L5', [-35, 0, -10]),
        this.makeLantern('L6', [20, 0, -35]),
        this.makeLantern('L7', [-20, 0, -35])
      ];
      this.charms = [
        { id: 'C1', pos: [30, 0, 25], available: true, respawnTicks: 0 },
        { id: 'C2', pos: [-30, 0, 25], available: true, respawnTicks: 0 }
      ];
      if (this.randomMotes) this.spawnInitialMotesNight3();
    }
  }

  private spawnInitialMotesNight1(): void {
    const pts: Vec3[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      pts.push([round3(Math.cos(a) * 12), 0, round3(Math.sin(a) * 12)]);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      pts.push([round3(Math.cos(a) * 33), 0, round3(Math.sin(a) * 33)]);
    }
    for (let i = 0; i < 20 && pts.length > 0; i++) {
      const idx = this.rng.int(0, pts.length - 1);
      const [pos] = pts.splice(idx, 1);
      this.motes.push({ id: `M${this.nextMoteSeq++}`, pos, kind: 'random', ttlTicks: -1 });
    }
  }

  private spawnInitialMotesNight2(): void {
    const pts: Vec3[] = [];
    const centers: Vec3[] = [[0, 0, 0], [70, 0, 0]];
    for (const c of centers) {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        pts.push([round3(c[0] + Math.cos(a) * 10), 0, round3(c[2] + Math.sin(a) * 10)]);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        pts.push([round3(c[0] + Math.cos(a) * 22), 0, round3(c[2] + Math.sin(a) * 22)]);
      }
    }
    for (let i = 0; i < 20 && pts.length > 0; i++) {
      const idx = this.rng.int(0, pts.length - 1);
      const [pos] = pts.splice(idx, 1);
      this.motes.push({ id: `M${this.nextMoteSeq++}`, pos, kind: 'random', ttlTicks: -1 });
    }
  }

  private spawnInitialMotesNight3(): void {
    const pts: Vec3[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i * 20 * Math.PI) / 180;
      pts.push([round3(Math.cos(a) * 34), 0, round3(Math.sin(a) * 34)]);
    }
    for (let i = 0; i < 8; i++) {
      const a = ((20 + i * 20) * Math.PI) / 180;
      pts.push([round3(Math.cos(a) * 18), 3, round3(Math.sin(a) * 18)]);
    }
    for (let i = 0; i < 4; i++) {
      const a = ((45 + i * 90) * Math.PI) / 180;
      pts.push([round3(Math.cos(a) * 5), 6, round3(Math.sin(a) * 5)]);
    }
    for (let i = 0; i < 20 && pts.length > 0; i++) {
      const idx = this.rng.int(0, pts.length - 1);
      const [pos] = pts.splice(idx, 1);
      this.motes.push({ id: `M${this.nextMoteSeq++}`, pos, kind: 'random', ttlTicks: -1 });
    }
  }

  private applyScenario(scenario?: ScenarioConfig): void {
    if (!scenario) return;
    if (scenario.player) {
      if (scenario.player.pos) {
        this.playerPos = [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]];
        const gy = this.getGroundY(this.playerPos[0], this.playerPos[2]);
        this.playerGrounded = gy !== null && Math.abs(this.playerPos[1] - gy) <= 0.01;
      }
      if (scenario.player.carried !== undefined) this.playerCarried = scenario.player.carried;
      if (scenario.player.flames !== undefined) this.playerFlames = scenario.player.flames;
      if (scenario.player.invuln_ticks !== undefined) this.invulnTicks = scenario.player.invuln_ticks;
      if (scenario.player.dash_cd_ticks !== undefined) this.dashCdTicks = scenario.player.dash_cd_ticks;
      if (scenario.player.pulse_cd_ticks !== undefined) this.pulseCdTicks = scenario.player.pulse_cd_ticks;
      if (scenario.player.charm_ticks !== undefined) this.charmTicks = scenario.player.charm_ticks;
      if (scenario.player.successful_lights !== undefined) {
        this.successfulLights = scenario.player.successful_lights;
      }
    }

    if (scenario.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        if (patch.deposited !== undefined) target.deposited = patch.deposited;
        if (patch.ever_lit !== undefined) target.everLit = patch.ever_lit;

        const cost = target.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (patch.lit) {
            target.everLit = patch.ever_lit ?? true;
            if (patch.deposited === undefined) target.deposited = cost;
            target.fuelTicks =
              patch.fuel !== undefined ? Math.round(patch.fuel * TICKS_PER_SECOND) : FUEL_MAX_TICKS;
          } else {
            target.fuelTicks = 0;
          }
        } else if (target.deposited >= cost) {
          target.lit = true;
          target.everLit = true;
          target.fuelTicks =
            patch.fuel !== undefined ? Math.round(patch.fuel * TICKS_PER_SECOND) : FUEL_MAX_TICKS;
        }
      }
    }

    if (scenario.motes !== undefined) {
      this.motes = scenario.motes.map((entry) => {
        const rawPos = Array.isArray(entry) ? entry : entry.pos;
        const id = Array.isArray(entry) || !entry.id ? `M${this.nextMoteSeq++}` : entry.id;
        const kind = !Array.isArray(entry) && entry.kind ? entry.kind : 'random';
        const ttl = !Array.isArray(entry) && entry.ttl_s ? Math.round(entry.ttl_s * TICKS_PER_SECOND) : -1;
        return { id, pos: [rawPos[0], rawPos[1], rawPos[2]], kind, ttlTicks: ttl };
      });
    }

    if (scenario.shades !== undefined) {
      this.shades = scenario.shades.map((s) => ({
        id: s.id ?? `S${this.nextShadeSeq++}`,
        pos: [s.pos[0], s.pos[1], s.pos[2]],
        state: s.state ?? 'wander',
        stateTicksLeft: s.state_ticks_left ?? 0,
        recoilDir: [0, 0],
        targetLanternId: s.target_lantern_id,
        drainTickCounter: 0
      }));
    }

    if (scenario.drifters !== undefined) {
      this.drifters = scenario.drifters.map((d) => ({
        id: d.id ?? `D${this.nextDrifterSeq++}`,
        pos: [d.pos[0], d.pos[1], d.pos[2]],
        state: d.state ?? 'idle',
        stolen: d.stolen ?? 0,
        stateTicksLeft: 0
      }));
    }

    if (scenario.charms !== undefined) {
      this.charms = scenario.charms.map((c) => ({
        id: c.id,
        pos: c.pos ?? (this.charms.find((x) => x.id === c.id)?.pos || [0, 0, 0]),
        available: c.available ?? true,
        respawnTicks: c.respawn_s ? Math.round(c.respawn_s * TICKS_PER_SECOND) : 0
      }));
    }

    if (scenario.time_left_s !== undefined) {
      this.initialTimeLeftS = scenario.time_left_s;
      this.timeLeftS = scenario.time_left_s;
    }
  }

  getGroundY(x: number, z: number): number | null {
    if (this.night === 1) {
      return Math.hypot(x, z) <= 40 ? 0 : null;
    }
    if (this.night === 2) {
      if (Math.hypot(x, z) <= 28) return 0;
      if (Math.hypot(x - 70, z) <= 28) return 0;
      if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
      return null;
    }
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r <= 8) return 6;
    if (r >= 12 && r <= 24 && z > 0) return 3;
    for (const rampAngle of [Math.PI / 6, (5 * Math.PI) / 6]) {
      const rx = Math.cos(rampAngle);
      const rz = Math.sin(rampAngle);
      const dot = x * rx + z * rz;
      const perp = Math.abs(-x * rz + z * rx);
      if (perp <= 1.5 && dot >= 24 && dot <= 30) {
        const t = (30 - dot) / 6;
        return t * 3;
      }
    }
    return 0;
  }

  private pushShadesFromLantern(lantern: LanternEntity): void {
    for (const s of this.shades) {
      const ds = distXZ(s.pos, lantern.pos);
      if (ds < this.tuning.safe_radius) {
        let dx = s.pos[0] - lantern.pos[0];
        let dz = s.pos[2] - lantern.pos[2];
        const len = Math.hypot(dx, dz);
        if (len < 1e-4) {
          dx = 1;
          dz = 0;
        } else {
          dx /= len;
          dz /= len;
        }
        s.pos[0] = lantern.pos[0] + dx * this.tuning.safe_radius;
        s.pos[2] = lantern.pos[2] + dz * this.tuning.safe_radius;
        if (s.state === 'drain' && s.targetLanternId === lantern.id) {
          s.state = 'wander';
          s.targetLanternId = undefined;
        }
      }
    }
  }

  step(rawInput: InputState): EventRecord[] {
    this.rawTick += 1;
    const events: EventRecord[] = [];

    // Step 1: Read input & handle pause
    const pausePressed = !this.prevInput.pause && rawInput.pause;
    if (pausePressed) {
      if (this.state === 'playing') {
        this.state = 'paused';
        events.push({ type: 'event', tick: this.rawTick, name: 'paused', data: {} });
      } else if (this.state === 'paused') {
        this.state = 'playing';
        events.push({ type: 'event', tick: this.rawTick, name: 'resumed', data: {} });
      }
    }

    if (this.state === 'paused') {
      this.prevInput = { ...rawInput };
      return events;
    }

    if (this.state !== 'playing') {
      return events;
    }

    this.simTick += 1;
    const tick = this.simTick;
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick / TICKS_PER_SECOND);

    // Step 2: Decrement counters & lantern fuel (natural decay + shade drain)
    this.invulnTicks = Math.max(0, this.invulnTicks - 1);
    this.dashCdTicks = Math.max(0, this.dashCdTicks - 1);
    this.pulseCdTicks = Math.max(0, this.pulseCdTicks - 1);
    this.charmTicks = Math.max(0, this.charmTicks - 1);

    for (let i = 0; i < this.motes.length; ) {
      const m = this.motes[i];
      if (m.kind === 'dropped' && m.ttlTicks > 0) {
        m.ttlTicks -= 1;
        if (m.ttlTicks <= 0) {
          this.motes.splice(i, 1);
          continue;
        }
      }
      i += 1;
    }

    for (const c of this.charms) {
      if (!c.available) {
        c.respawnTicks -= 1;
        if (c.respawnTicks <= 0) {
          c.available = true;
          c.respawnTicks = 0;
        }
      }
    }

    // Fuel decay & shade drain (integer 1/60 units)
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      l.fuelTicks = Math.max(0, l.fuelTicks - 1); // 1.0 fuel/s

      const drainingShades = this.shades.filter(
        (s) => s.state === 'drain' && s.targetLanternId === l.id
      );
      for (const s of drainingShades) {
        l.fuelTicks = Math.max(0, l.fuelTicks - this.tuning.drain_per_s); // 5/60 per tick
        s.drainTickCounter += 1;
        if (s.drainTickCounter % 60 === 0) {
          events.push({
            type: 'event',
            tick,
            name: 'fuel_drain',
            data: { lantern_id: l.id, shade_id: s.id, fuel: round1(l.fuelTicks / TICKS_PER_SECOND) }
          });
        }
      }

      if (l.fuelTicks <= 0) {
        l.lit = false;
        l.fuelTicks = 0;
        l.deposited = 0;
        l.everLit = true;
        events.push({ type: 'event', tick, name: 'lantern_out', data: { lantern_id: l.id } });
        for (const s of drainingShades) {
          s.state = 'wander';
          s.targetLanternId = undefined;
          s.drainTickCounter = 0;
        }
      }
    }

    // Step 3: Move May (jump, dash, jump pad, wind) & Island fall check
    if (this.isRespawning) {
      this.respawnTicksLeft -= 1;
      if (this.respawnTicksLeft <= 0) {
        this.isRespawning = false;
        this.playerPos = [0, 0, 0];
        this.playerVel = [0, 0, 0];
        this.playerGrounded = true;
        this.invulnTicks = 90;
      }
    } else {
      const jumpPressed = !this.prevInput.jump && rawInput.jump;
      const dashPressed = !this.prevInput.dash && rawInput.dash;

      if (dashPressed && (this.dashCdTicks <= 0 || this.charmTicks > 0) && !this.isDashing) {
        this.isDashing = true;
        this.dashTicksLeft = 12;
        if (this.charmTicks <= 0) {
          this.dashCdTicks = 90;
        }
        const mx = rawInput.move[0];
        const mz = rawInput.move[1];
        const moveLen = Math.hypot(mx, mz);
        const theta = (rawInput.cam_yaw_deg * Math.PI) / 180;
        if (moveLen > 0.01) {
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          this.dashDir = [(mx * cosT + mz * sinT) / moveLen, (-mx * sinT + mz * cosT) / moveLen];
        } else {
          this.dashDir = [Math.sin(theta), Math.cos(theta)];
        }
        events.push({ type: 'event', tick, name: 'dash', data: {} });
      }

      if (this.night === 2 && this.playerGrounded) {
        const pads: Array<{ pos: Vec3; target: Vec3 }> = [
          { pos: [20, 0, 18], target: [70, 0, 0] },
          { pos: [50, 0, -18], target: [0, 0, 0] }
        ];
        for (const pad of pads) {
          if (distXZ(this.playerPos, pad.pos) <= 1.0) {
            this.isLaunched = true;
            this.playerGrounded = false;
            this.playerVel[1] = 14.0;
            const dx = pad.target[0] - pad.pos[0];
            const dz = pad.target[2] - pad.pos[2];
            const d = Math.hypot(dx, dz);
            this.playerVel[0] = (dx / d) * 24.0;
            this.playerVel[2] = (dz / d) * 24.0;
            break;
          }
        }
      } else if (this.night === 3 && this.playerGrounded) {
        if (distXZ(this.playerPos, [0, 3, 13]) <= 1.0 && Math.abs(this.playerPos[1] - 3) <= 0.2) {
          this.isLaunched = true;
          this.playerGrounded = false;
          this.playerVel[1] = 12.0;
          this.playerVel[0] = 0;
          this.playerVel[2] = -8.0;
        }
      }

      if (this.night === 3 && this.windEnabled) {
        this.windTimer += 1;
        if (this.windTimer % 1800 === 1500) {
          this.windActive = true;
          this.windDirDeg = this.rng.int(0, 359);
          this.windDurationTicks = 300;
        }
        if (this.windActive) {
          this.windDurationTicks -= 1;
          if (this.windDurationTicks <= 0) this.windActive = false;
        }
      }

      if (this.isDashing) {
        this.playerPos[0] += this.dashDir[0] * this.tuning.dash_speed * DT;
        this.playerPos[2] += this.dashDir[1] * this.tuning.dash_speed * DT;
        this.dashTicksLeft -= 1;
        if (this.dashTicksLeft <= 0) this.isDashing = false;
      } else if (this.isLaunched) {
        this.playerPos[0] += this.playerVel[0] * DT;
        this.playerPos[2] += this.playerVel[2] * DT;
        this.playerVel[1] -= 20.0 * DT;
        this.playerPos[1] += this.playerVel[1] * DT;
      } else {
        const speed = this.charmTicks > 0 ? 7.2 : this.tuning.player_speed;
        let mx = rawInput.move[0];
        let mz = rawInput.move[1];
        const moveLen = Math.hypot(mx, mz);
        if (moveLen > 1) {
          mx /= moveLen;
          mz /= moveLen;
        }
        if (moveLen > 0) {
          const theta = (rawInput.cam_yaw_deg * Math.PI) / 180;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          this.playerVel[0] = (mx * cosT + mz * sinT) * speed;
          this.playerVel[2] = (-mx * sinT + mz * cosT) * speed;
        } else {
          this.playerVel[0] = 0;
          this.playerVel[2] = 0;
        }

        if (this.windActive) {
          const rad = (this.windDirDeg * Math.PI) / 180;
          this.playerVel[0] += Math.cos(rad) * 2.0;
          this.playerVel[2] += Math.sin(rad) * 2.0;
        }

        const prevX = this.playerPos[0];
        const prevZ = this.playerPos[2];
        const prevY = this.playerPos[1];

        this.playerPos[0] += this.playerVel[0] * DT;
        this.playerPos[2] += this.playerVel[2] * DT;

        if (this.night === 3 && this.playerGrounded) {
          const nextGroundY = this.getGroundY(this.playerPos[0], this.playerPos[2]);
          if (nextGroundY !== null && nextGroundY > prevY + 0.1) {
            this.playerPos[0] = prevX;
            this.playerPos[2] = prevZ;
          }
        }

        if (jumpPressed && this.playerGrounded) {
          this.playerVel[1] = 7.0;
          this.playerGrounded = false;
        }

        if (!this.playerGrounded) {
          this.playerVel[1] -= 20.0 * DT;
          this.playerPos[1] += this.playerVel[1] * DT;
        }
      }

      const groundY = this.getGroundY(this.playerPos[0], this.playerPos[2]);
      if (groundY !== null) {
        if (this.playerPos[1] <= groundY) {
          this.playerPos[1] = groundY;
          this.playerVel[1] = 0;
          this.playerGrounded = true;
          this.isLaunched = false;
        } else {
          this.playerGrounded = false;
        }
      } else {
        this.playerGrounded = false;
      }

      if (this.playerPos[1] < -10) {
        this.playerFlames = Math.max(0, this.playerFlames - 1);
        const lostMotes = this.playerCarried;
        this.playerCarried = 0;
        this.isDashing = false;
        this.isLaunched = false;
        events.push({
          type: 'event',
          tick,
          name: 'player_hit',
          data: { by: 'fall', flames: this.playerFlames, dropped: lostMotes, lost: true }
        });
        if (this.playerFlames <= 0) {
          this.state = 'lost';
          events.push({ type: 'event', tick, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
          this.prevInput = { ...rawInput };
          return events;
        }
        this.isRespawning = true;
        this.respawnTicksLeft = 60;
      }
    }

    // Step 4: Pick motes & charms
    const capacity = this.getCapacity();
    if (!this.isRespawning && this.playerCarried < capacity) {
      for (let i = 0; i < this.motes.length; ) {
        if (this.playerCarried >= capacity) break;
        const mote = this.motes[i];
        const dXZ = distXZ(this.playerPos, mote.pos);
        const dY = Math.abs(this.playerPos[1] - mote.pos[1]);
        if (dXZ <= this.tuning.pickup_radius && dY <= 1.5) {
          this.motes.splice(i, 1);
          this.playerCarried += 1;
          events.push({ type: 'event', tick, name: 'mote_picked', data: { carried: this.playerCarried } });
        } else {
          i += 1;
        }
      }
    }

    if (!this.isRespawning) {
      for (const charm of this.charms) {
        if (charm.available) {
          const dXZ = distXZ(this.playerPos, charm.pos);
          const dY = Math.abs(this.playerPos[1] - charm.pos[1]);
          if (dXZ <= this.tuning.pickup_radius && dY <= 1.5) {
            charm.available = false;
            charm.respawnTicks = 2700;
            this.charmTicks = 600;
            events.push({
              type: 'event',
              tick,
              name: 'charm_picked',
              data: { charm_id: charm.id, charm_ticks: 600 }
            });
          }
        }
      }
    }

    // Step 5: Lantern deposit or refuel
    const interactPressed = !this.prevInput.interact && rawInput.interact;
    if (!this.isRespawning && interactPressed && this.playerCarried > 0) {
      let bestLantern: LanternEntity | null = null;
      let bestDist = Infinity;
      for (const l of this.lanterns) {
        if (l.lit && l.fuelTicks >= FUEL_MAX_TICKS) continue; // Full fuel -> ineligible
        const d = distXZ(this.playerPos, l.pos);
        if (d <= this.tuning.interact_radius) {
          if (d < bestDist - 1e-4) {
            bestDist = d;
            bestLantern = l;
          } else if (Math.abs(d - bestDist) <= 1e-4 && bestLantern && l.id < bestLantern.id) {
            bestLantern = l;
          }
        }
      }

      if (bestLantern) {
        if (!bestLantern.lit) {
          const cost = bestLantern.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
          const needed = Math.max(0, cost - bestLantern.deposited);
          const amount = Math.min(this.playerCarried, needed);
          if (amount > 0) {
            this.playerCarried -= amount;
            bestLantern.deposited += amount;
            this.score += amount * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick,
              name: 'deposit',
              data: { lantern_id: bestLantern.id, amount, deposited: bestLantern.deposited }
            });
            if (bestLantern.deposited >= cost) {
              const isRelight = bestLantern.everLit;
              bestLantern.lit = true;
              bestLantern.fuelTicks = FUEL_MAX_TICKS;
              bestLantern.everLit = true;
              if (isRelight) {
                bestLantern.relitCount += 1;
                this.score += 40;
              } else {
                this.score += 100;
              }
              this.successfulLights += 1;
              events.push({
                type: 'event',
                tick,
                name: 'lantern_lit',
                data: { lantern_id: bestLantern.id, relight: isRelight }
              });
              this.pushShadesFromLantern(bestLantern);
            }
          }
        } else {
          // Refuel lit lantern
          const currentFuel = bestLantern.fuelTicks / TICKS_PER_SECOND;
          const used = Math.min(this.playerCarried, Math.ceil((100 - currentFuel) / 10));
          if (used > 0) {
            const wasLowFuel = bestLantern.fuelTicks < this.tuning.low_fuel_threshold * TICKS_PER_SECOND;
            this.playerCarried -= used;
            bestLantern.fuelTicks = Math.min(
              FUEL_MAX_TICKS,
              bestLantern.fuelTicks + used * 10 * TICKS_PER_SECOND
            );
            this.score += used * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick,
              name: 'refuel',
              data: {
                lantern_id: bestLantern.id,
                amount: used,
                fuel: round1(bestLantern.fuelTicks / TICKS_PER_SECOND)
              }
            });
            if (wasLowFuel && bestLantern.fuelTicks >= this.tuning.low_fuel_threshold * TICKS_PER_SECOND) {
              this.pushShadesFromLantern(bestLantern);
            }
          }
        }
      }
    }

    // Step 6: Update safe radius barrier (only for lit lanterns with fuel >= 30)
    const lowFuelThresholdTicks = this.tuning.low_fuel_threshold * TICKS_PER_SECOND;
    for (const s of this.shades) {
      for (const l of this.lanterns) {
        if (l.lit && l.fuelTicks >= lowFuelThresholdTicks) {
          const ds = distXZ(s.pos, l.pos);
          if (ds < this.tuning.safe_radius) {
            let dx = s.pos[0] - l.pos[0];
            let dz = s.pos[2] - l.pos[2];
            const len = Math.hypot(dx, dz);
            if (len < 1e-4) {
              dx = 1;
              dz = 0;
            } else {
              dx /= len;
              dz /= len;
            }
            s.pos[0] = l.pos[0] + dx * this.tuning.safe_radius;
            s.pos[2] = l.pos[2] + dz * this.tuning.safe_radius;
          }
        }
      }
    }

    // Step 7: Pulse
    const pulsePressed = !this.prevInput.pulse && rawInput.pulse;
    if (
      !this.isRespawning &&
      pulsePressed &&
      this.pulseCdTicks <= 0 &&
      this.playerCarried >= this.tuning.pulse_cost
    ) {
      this.playerCarried -= this.tuning.pulse_cost;
      this.pulseCdTicks = 180;
      this.lastPulseTick = tick;

      const pulseCenter: Vec3 = [this.playerPos[0], this.playerPos[1] + 0.8, this.playerPos[2]];
      const stunnedIds: string[] = [];

      for (const s of this.shades) {
        if (dist3D(pulseCenter, s.pos) <= this.tuning.pulse_radius) {
          const wasDraining = s.state === 'drain';
          s.state = 'stunned';
          s.stateTicksLeft = 120;
          s.targetLanternId = undefined;
          s.drainTickCounter = 0;
          let dx = s.pos[0] - this.playerPos[0];
          let dz = s.pos[2] - this.playerPos[2];
          const len = Math.hypot(dx, dz);
          if (len < 1e-4) {
            dx = 1;
            dz = 0;
          } else {
            dx /= len;
            dz /= len;
          }
          s.pos[0] += dx * this.tuning.pulse_push_m;
          s.pos[2] += dz * this.tuning.pulse_push_m;
          stunnedIds.push(s.id);
          this.score += wasDraining ? 15 : 5;
        }
      }

      for (const d of this.drifters) {
        if (dist3D(pulseCenter, d.pos) <= this.tuning.pulse_radius) {
          if (d.state === 'chase') {
            d.state = 'flee';
            d.stateTicksLeft = 240;
          } else if (d.state === 'flee' && d.stolen > 0) {
            for (let i = 0; i < d.stolen; i++) {
              this.motes.push({
                id: `M${this.nextMoteSeq++}`,
                pos: [d.pos[0], d.pos[1], d.pos[2]],
                kind: 'dropped',
                ttlTicks: 480
              });
            }
            events.push({
              type: 'event',
              tick,
              name: 'drifter_drop',
              data: { drifter_id: d.id, amount: d.stolen }
            });
            d.stolen = 0;
            d.stateTicksLeft = 120;
          }
        }
      }

      events.push({ type: 'event', tick, name: 'pulse', data: { stunned_ids: stunnedIds } });
    }

    // Step 8: Move Shades & Drifters
    const shadeSpeed = this.night === 3 ? 4.5 : this.tuning.shade_speed;
    for (const s of this.shades) {
      if (s.state === 'stunned') {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft <= 0) s.state = 'wander';
      } else if (s.state === 'recoil') {
        s.pos[0] += s.recoilDir[0] * (2.0 / 60);
        s.pos[2] += s.recoilDir[1] * (2.0 / 60);
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft <= 0) s.state = 'chase';
      } else if (s.state === 'drain') {
        const dPlayer = distXZ(this.playerPos, s.pos);
        const target = this.lanterns.find((l) => l.id === s.targetLanternId);
        if (!this.isRespawning && dPlayer <= 6.0) {
          s.state = 'chase';
          s.targetLanternId = undefined;
          s.drainTickCounter = 0;
        } else if (
          !target ||
          !target.lit ||
          target.fuelTicks >= lowFuelThresholdTicks ||
          distXZ(s.pos, target.pos) > 2.0
        ) {
          s.state = 'wander';
          s.targetLanternId = undefined;
          s.drainTickCounter = 0;
        }
      } else {
        const dPlayer = distXZ(this.playerPos, s.pos);
        if (s.state === 'wander' && dPlayer <= 12.0) s.state = 'chase';
        if (s.state === 'chase' && dPlayer > 18.0) s.state = 'wander';

        if (s.state === 'chase' && !this.isRespawning) {
          const dx = this.playerPos[0] - s.pos[0];
          const dz = this.playerPos[2] - s.pos[2];
          if (dPlayer > 0.01) {
            s.pos[0] += (dx / dPlayer) * shadeSpeed * DT;
            s.pos[2] += (dz / dPlayer) * shadeSpeed * DT;
          }
        } else if (s.state === 'wander') {
          // Prefer nearest lit lantern with fuel < 30; else nearest unlit lantern
          const weakLit = this.lanterns.filter((l) => l.lit && l.fuelTicks < lowFuelThresholdTicks);
          const pool = weakLit.length > 0 ? weakLit : this.lanterns.filter((l) => !l.lit);

          if (pool.length > 0) {
            let bestL = pool[0];
            let bestD = distXZ(s.pos, bestL.pos);
            for (const l of pool) {
              const dl = distXZ(s.pos, l.pos);
              if (dl < bestD - 1e-4 || (Math.abs(dl - bestD) <= 1e-4 && l.id < bestL.id)) {
                bestD = dl;
                bestL = l;
              }
            }
            if (weakLit.length > 0 && bestD <= 2.0) {
              s.state = 'drain';
              s.targetLanternId = bestL.id;
              s.drainTickCounter = 0;
            } else if (bestD > 0.01) {
              const speed = weakLit.length > 0 ? shadeSpeed : 1.5;
              s.pos[0] += ((bestL.pos[0] - s.pos[0]) / bestD) * speed * DT;
              s.pos[2] += ((bestL.pos[2] - s.pos[2]) / bestD) * speed * DT;
            }
          } else if (!this.isRespawning && dPlayer > 0.01) {
            s.pos[0] += ((this.playerPos[0] - s.pos[0]) / dPlayer) * 1.5 * DT;
            s.pos[2] += ((this.playerPos[2] - s.pos[2]) / dPlayer) * 1.5 * DT;
          }
        }
      }
    }

    // Move Drifters
    for (let i = 0; i < this.drifters.length; ) {
      const d = this.drifters[i];
      if (d.state === 'removed') {
        this.drifters.splice(i, 1);
        continue;
      }
      const distToPlayer = distXZ(this.playerPos, d.pos);
      if (d.state === 'idle') {
        if (!this.isRespawning && this.playerCarried >= 5 && distToPlayer <= 15.0) d.state = 'chase';
      } else if (d.state === 'chase') {
        if (this.isRespawning || this.playerCarried < 5 || distToPlayer > 15.0) {
          d.state = 'idle';
        } else if (distToPlayer > 0.01) {
          d.pos[0] += ((this.playerPos[0] - d.pos[0]) / distToPlayer) * 7.0 * DT;
          d.pos[2] += ((this.playerPos[2] - d.pos[2]) / distToPlayer) * 7.0 * DT;
        }
      } else if (d.state === 'flee') {
        const dx = d.pos[0] - this.playerPos[0];
        const dz = d.pos[2] - this.playerPos[2];
        const len = Math.hypot(dx, dz);
        if (len > 0.01) {
          d.pos[0] += (dx / len) * 7.0 * DT;
          d.pos[2] += (dz / len) * 7.0 * DT;
        }
        d.stateTicksLeft -= 1;
        if (d.stateTicksLeft <= 0) {
          d.state = 'removed';
          this.drifters.splice(i, 1);
          continue;
        }
      }
      i += 1;
    }

    // Step 9: Collisions (Drifters steal first, then Shades hit)
    if (!this.isRespawning) {
      for (const d of this.drifters) {
        if (d.state === 'chase' && distXZ(this.playerPos, d.pos) <= 1.2) {
          const stealCount = Math.min(3, this.playerCarried);
          this.playerCarried -= stealCount;
          d.stolen += stealCount;
          d.state = 'flee';
          d.stateTicksLeft = 240;
          events.push({
            type: 'event',
            tick,
            name: 'drifter_steal',
            data: { drifter_id: d.id, amount: stealCount, carried: this.playerCarried }
          });
        }
      }

      if (this.invulnTicks <= 0) {
        const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
        for (const s of sortedShades) {
          if (s.state === 'stunned') continue;
          const dXZ = distXZ(this.playerPos, s.pos);
          const dY = Math.abs(this.playerPos[1] - s.pos[1]);
          if (dXZ <= this.tuning.shade_hit_radius && dY <= 1.5) {
            this.playerFlames = Math.max(0, this.playerFlames - 1);
            const dropped = Math.floor(this.playerCarried * this.tuning.hit_drop_ratio);
            this.playerCarried -= dropped;
            this.invulnTicks = 90;
            this.lastHitTick = tick;

            let rdx = s.pos[0] - this.playerPos[0];
            let rdz = s.pos[2] - this.playerPos[2];
            const rlen = Math.hypot(rdx, rdz);
            s.recoilDir = rlen > 0.01 ? [rdx / rlen, rdz / rlen] : [1, 0];
            s.state = 'recoil';
            s.stateTicksLeft = 60;
            s.targetLanternId = undefined;
            s.drainTickCounter = 0;

            for (let k = 0; k < dropped; k++) {
              const angle = (k * 2 * Math.PI) / (dropped || 1);
              this.motes.push({
                id: `M${this.nextMoteSeq++}`,
                pos: [
                  round3(this.playerPos[0] + Math.cos(angle) * 2.0),
                  this.playerPos[1],
                  round3(this.playerPos[2] + Math.sin(angle) * 2.0)
                ],
                kind: 'dropped',
                ttlTicks: 480
              });
            }

            events.push({
              type: 'event',
              tick,
              name: 'player_hit',
              data: { by: 'shade', flames: this.playerFlames, dropped, lost: false }
            });

            if (this.playerFlames <= 0) {
              this.state = 'lost';
              events.push({
                type: 'event',
                tick,
                name: 'game_over',
                data: { result: 'lost', reason: 'no_flames' }
              });
              this.prevInput = { ...rawInput };
              return events;
            }
            break;
          }
        }
      }
    }

    // Step 10: Scheduled Spawns
    if (this.randomMotes && tick % 240 === 0 && this.motes.length < 30) {
      this.motes.push({
        id: `M${this.nextMoteSeq++}`,
        pos: [this.rng.int(-20, 20), 0, this.rng.int(-20, 20)],
        kind: 'random',
        ttlTicks: -1
      });
    }

    if (this.randomShades) {
      const maxShades = this.night === 1 ? 6 : this.night === 2 ? 8 : 10;
      const intervalTicks = this.night === 1 ? 480 : this.night === 2 ? 420 : 360;
      if (tick === 300) {
        const s1 = `S${this.nextShadeSeq++}`;
        const s2 = `S${this.nextShadeSeq++}`;
        this.shades.push({ id: s1, pos: [37, 1, 0], state: 'wander', stateTicksLeft: 0, recoilDir: [0, 0], drainTickCounter: 0 });
        this.shades.push({ id: s2, pos: [-37, 1, 0], state: 'wander', stateTicksLeft: 0, recoilDir: [0, 0], drainTickCounter: 0 });
        events.push({ type: 'event', tick, name: 'shade_spawned', data: { id: s1 } });
        events.push({ type: 'event', tick, name: 'shade_spawned', data: { id: s2 } });
      } else if (tick > 300 && (tick - 300) % intervalTicks === 0 && this.shades.length < maxShades) {
        const sid = `S${this.nextShadeSeq++}`;
        const spawnAngle = (this.shades.length * Math.PI) / 3;
        const spawnRadius = this.night === 1 ? 37 : this.night === 2 ? 26 : 43;
        this.shades.push({
          id: sid,
          pos: [round3(Math.cos(spawnAngle) * spawnRadius), 1, round3(Math.sin(spawnAngle) * spawnRadius)],
          state: 'wander',
          stateTicksLeft: 0,
          recoilDir: [0, 0],
          drainTickCounter: 0
        });
        events.push({ type: 'event', tick, name: 'shade_spawned', data: { id: sid } });
      }
    }

    if ((this.night === 2 || this.night === 3) && this.randomDrifters) {
      if (tick % 1200 === 0 && this.drifters.length < 2) {
        const did = `D${this.nextDrifterSeq++}`;
        this.drifters.push({ id: did, pos: [25, 1, 0], state: 'idle', stolen: 0, stateTicksLeft: 0 });
      }
    }

    // Step 11: Win/Loss at Dawn (no early win!)
    if (this.timeLeftS <= 1e-9) {
      this.timeLeftS = 0;
      const litLanterns = this.lanterns.filter((l) => l.lit);
      const threshold = Math.ceil(this.tuning.win_ratio * this.lanterns.length);
      if (litLanterns.length >= threshold) {
        for (const l of litLanterns) {
          this.score += 50 + Math.floor(l.fuelTicks / TICKS_PER_SECOND);
        }
        this.score += 50 * this.playerFlames;
        this.state = 'won';
        events.push({
          type: 'event',
          tick,
          name: 'game_over',
          data: { result: 'won', reason: 'dawn_survived' }
        });
      } else {
        this.state = 'lost';
        events.push({
          type: 'event',
          tick,
          name: 'game_over',
          data: { result: 'lost', reason: 'dawn' }
        });
      }
    }

    this.prevInput = { ...rawInput };
    return events;
  }

  getSnapshot(tick: number = this.rawTick): SnapshotRecord {
    return {
      type: 'snapshot',
      tick,
      sim_tick: this.simTick,
      state: this.state,
      night: this.night,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: {
        active: this.windActive,
        dir_deg: this.windDirDeg
      },
      player: {
        pos: [round3(this.playerPos[0]), round3(this.playerPos[1]), round3(this.playerPos[2])],
        vel: [round3(this.playerVel[0]), round3(this.playerVel[1]), round3(this.playerVel[2])],
        grounded: this.playerGrounded,
        invuln: this.invulnTicks > 0,
        dash_cd_s: round3(this.dashCdTicks / TICKS_PER_SECOND),
        pulse_cd_s: round3(this.pulseCdTicks / TICKS_PER_SECOND),
        charm_s: round3(this.charmTicks / TICKS_PER_SECOND),
        flames: this.playerFlames,
        carried: this.playerCarried,
        capacity: this.getCapacity()
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuelTicks / TICKS_PER_SECOND) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: [round3(d.pos[0]), round3(d.pos[1]), round3(d.pos[2])],
        state: d.state,
        stolen: d.stolen
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICKS_PER_SECOND)
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])],
        kind: m.kind,
        ttl_s: m.ttlTicks > 0 ? round3(m.ttlTicks / TICKS_PER_SECOND) : -1
      }))
    };
  }

  getEndRecord(): EndRecord {
    return {
      type: 'end',
      ticks: this.rawTick,
      state: this.state,
      score: this.score
    };
  }
}
