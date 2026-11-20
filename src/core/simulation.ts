import { DEFAULT_TUNING, DT, TICKS_PER_SECOND, round3 } from './contract.js';
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

  private initMap(night: number): void {
    if (night === 1) {
      this.lanterns = [
        { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0 },
        { id: 'L2', pos: [23.8, 0, 7.7], lit: false, deposited: 0 },
        { id: 'L3', pos: [14.7, 0, -20.2], lit: false, deposited: 0 },
        { id: 'L4', pos: [-14.7, 0, -20.2], lit: false, deposited: 0 },
        { id: 'L5', pos: [-23.8, 0, 7.7], lit: false, deposited: 0 }
      ];
      if (this.randomMotes) {
        this.spawnInitialMotesNight1();
      }
    } else if (night === 2) {
      this.lanterns = [
        { id: 'L1', pos: [0, 0, 20], lit: false, deposited: 0 },
        { id: 'L2', pos: [17, 0, -10], lit: false, deposited: 0 },
        { id: 'L3', pos: [-17, 0, -10], lit: false, deposited: 0 },
        { id: 'L4', pos: [70, 0, 20], lit: false, deposited: 0 },
        { id: 'L5', pos: [87, 0, -10], lit: false, deposited: 0 },
        { id: 'L6', pos: [53, 0, -10], lit: false, deposited: 0 }
      ];
      this.charms = [{ id: 'C1', pos: [35, 0, 0], available: true, respawnTicks: 0 }];
      if (this.randomMotes) {
        this.spawnInitialMotesNight2();
      }
    } else {
      this.lanterns = [
        { id: 'L1', pos: [0, 6, 6], lit: false, deposited: 0 },
        { id: 'L2', pos: [18, 3, 10], lit: false, deposited: 0 },
        { id: 'L3', pos: [-18, 3, 10], lit: false, deposited: 0 },
        { id: 'L4', pos: [35, 0, -10], lit: false, deposited: 0 },
        { id: 'L5', pos: [-35, 0, -10], lit: false, deposited: 0 },
        { id: 'L6', pos: [20, 0, -35], lit: false, deposited: 0 },
        { id: 'L7', pos: [-20, 0, -35], lit: false, deposited: 0 }
      ];
      this.charms = [
        { id: 'C1', pos: [30, 0, 25], available: true, respawnTicks: 0 },
        { id: 'C2', pos: [-30, 0, 25], available: true, respawnTicks: 0 }
      ];
      if (this.randomMotes) {
        this.spawnInitialMotesNight3();
      }
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
    // Pick 20 distinct points
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
    }

    if (scenario.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        if (patch.deposited !== undefined) target.deposited = patch.deposited;
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (patch.lit && patch.deposited === undefined) target.deposited = this.tuning.lantern_cost;
        } else if (target.deposited >= this.tuning.lantern_cost) {
          target.lit = true;
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
        recoilDir: [0, 0]
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

  // Get Island Height (Y) at position XZ
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
    // Night 3 (Tiered island)
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r <= 8) return 6; // Tier 2 (center disc r=8, Y=6)
    if (r >= 12 && r <= 24 && z > 0) return 3; // Tier 1
    // Ramps at 30 deg and 150 deg (width 3m, r in [24, 30])
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
    return 0; // Tier 0
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

    // Step 2: Decrement counters
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

      // Handle Dash start
      if (dashPressed && (this.dashCdTicks <= 0 || this.charmTicks > 0) && !this.isDashing) {
        this.isDashing = true;
        this.dashTicksLeft = 12; // 0.2s = 12 ticks
        if (this.charmTicks <= 0) {
          this.dashCdTicks = 90; // 1.5s
        }
        let mx = rawInput.move[0];
        let mz = rawInput.move[1];
        const moveLen = Math.hypot(mx, mz);
        if (moveLen > 0.01) {
          const theta = (rawInput.cam_yaw_deg * Math.PI) / 180;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          this.dashDir = [(mx * cosT + mz * sinT) / moveLen, (-mx * sinT + mz * cosT) / moveLen];
        } else {
          // Player facing direction from cam yaw
          const theta = (rawInput.cam_yaw_deg * Math.PI) / 180;
          this.dashDir = [Math.sin(theta), Math.cos(theta)];
        }
        events.push({ type: 'event', tick, name: 'dash', data: {} });
      }

      // Check Jump Pads in Night 2 & 3
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

      // Wind update in Night 3
      if (this.night === 3 && this.windEnabled) {
        this.windTimer += 1;
        if (this.windTimer % 1800 === 1500) {
          this.windActive = true;
          this.windDirDeg = this.rng.int(0, 359);
          this.windDurationTicks = 300; // 5s
        }
        if (this.windActive) {
          this.windDurationTicks -= 1;
          if (this.windDurationTicks <= 0) {
            this.windActive = false;
          }
        }
      }

      // Movement execution
      if (this.isDashing) {
        this.playerPos[0] += this.dashDir[0] * this.tuning.dash_speed * DT;
        this.playerPos[2] += this.dashDir[1] * this.tuning.dash_speed * DT;
        this.dashTicksLeft -= 1;
        if (this.dashTicksLeft <= 0) {
          this.isDashing = false;
        }
      } else if (this.isLaunched) {
        this.playerPos[0] += this.playerVel[0] * DT;
        this.playerPos[2] += this.playerVel[2] * DT;
        this.playerVel[1] -= 20.0 * DT;
        this.playerPos[1] += this.playerVel[1] * DT;
      } else {
        // Normal ground / air control
        let speed = this.tuning.player_speed;
        if (this.charmTicks > 0) speed = 7.2;
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
          const wx = mx * cosT + mz * sinT;
          const wz = -mx * sinT + mz * cosT;
          this.playerVel[0] = wx * speed;
          this.playerVel[2] = wz * speed;
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

        // In Night 3: Wall check between tiers (cannot walk uphill cliff)
        if (this.night === 3 && this.playerGrounded) {
          const nextGroundY = this.getGroundY(this.playerPos[0], this.playerPos[2]);
          if (nextGroundY !== null && nextGroundY > prevY + 0.1) {
            // Cannot walk up cliff, blocked
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

      // Check ground collision / landing
      const groundY = this.getGroundY(this.playerPos[0], this.playerPos[2]);
      if (groundY !== null) {
        // If landing on or walking on the surface
        if (this.playerPos[1] <= groundY) {
          this.playerPos[1] = groundY;
          this.playerVel[1] = 0;
          this.playerGrounded = true;
          this.isLaunched = false;
        } else {
          // In the air above the surface (e.g., stepped off a higher tier)
          this.playerGrounded = false;
        }
      } else {
        this.playerGrounded = false;
      }

      // Fall off island check (Y < -10)
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
    if (!this.isRespawning && this.playerCarried < this.tuning.carry_capacity) {
      for (let i = 0; i < this.motes.length; ) {
        if (this.playerCarried >= this.tuning.carry_capacity) break;
        const mote = this.motes[i];
        const dXZ = distXZ(this.playerPos, mote.pos);
        const dY = Math.abs(this.playerPos[1] - mote.pos[1]);
        if (dXZ <= this.tuning.pickup_radius && dY <= 1.5) {
          this.motes.splice(i, 1);
          this.playerCarried += 1;
          this.score += this.tuning.score.per_mote;
          events.push({
            type: 'event',
            tick,
            name: 'mote_picked',
            data: { carried: this.playerCarried }
          });
        } else {
          i += 1;
        }
      }
    }

    // Pick charms
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

    // Step 5: Lantern deposit (interact edge trigger)
    const interactPressed = !this.prevInput.interact && rawInput.interact;
    if (!this.isRespawning && interactPressed && this.playerCarried > 0) {
      let bestLantern: LanternEntity | null = null;
      let bestDist = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
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
        const needed = this.tuning.lantern_cost - bestLantern.deposited;
        const amount = Math.min(this.playerCarried, needed);
        if (amount > 0) {
          this.playerCarried -= amount;
          bestLantern.deposited += amount;
          events.push({
            type: 'event',
            tick,
            name: 'deposit',
            data: {
              lantern_id: bestLantern.id,
              amount,
              deposited: bestLantern.deposited
            }
          });
          if (bestLantern.deposited >= this.tuning.lantern_cost) {
            bestLantern.lit = true;
            this.score += this.tuning.score.per_lantern;
            events.push({
              type: 'event',
              tick,
              name: 'lantern_lit',
              data: { lantern_id: bestLantern.id }
            });

            // Push shades inside safe_radius at the moment lantern is lit
            for (const s of this.shades) {
              const ds = distXZ(s.pos, bestLantern.pos);
              if (ds < this.tuning.safe_radius) {
                let dx = s.pos[0] - bestLantern.pos[0];
                let dz = s.pos[2] - bestLantern.pos[2];
                const len = Math.hypot(dx, dz);
                if (len < 1e-4) {
                  dx = 1;
                  dz = 0;
                } else {
                  dx /= len;
                  dz /= len;
                }
                s.pos[0] = bestLantern.pos[0] + dx * this.tuning.safe_radius;
                s.pos[2] = bestLantern.pos[2] + dz * this.tuning.safe_radius;
              }
            }
          }
        }
      }
    }

    // Step 6: Update safe radius barrier
    for (const s of this.shades) {
      for (const l of this.lanterns) {
        if (l.lit) {
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
      this.pulseCdTicks = 180; // 3.0s = 180 ticks
      this.lastPulseTick = tick;

      const pulseCenter: Vec3 = [this.playerPos[0], this.playerPos[1] + 0.8, this.playerPos[2]];
      const stunnedIds: string[] = [];

      for (const s of this.shades) {
        if (dist3D(pulseCenter, s.pos) <= this.tuning.pulse_radius) {
          s.state = 'stunned';
          s.stateTicksLeft = 120;
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
          this.score += this.tuning.score.per_stun;
        }
      }

      for (const d of this.drifters) {
        if (dist3D(pulseCenter, d.pos) <= this.tuning.pulse_radius) {
          if (d.state === 'chase') {
            d.state = 'flee';
            d.stateTicksLeft = 240;
          } else if (d.state === 'flee' && d.stolen > 0) {
            // Drop all stolen motes
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
      } else {
        const d = distXZ(this.playerPos, s.pos);
        if (s.state === 'wander' && d <= 12.0) s.state = 'chase';
        if (s.state === 'chase' && d > 18.0) s.state = 'wander';

        if (!this.isRespawning) {
          const dx = this.playerPos[0] - s.pos[0];
          const dz = this.playerPos[2] - s.pos[2];
          if (s.state === 'chase') {
            if (d > 0.01) {
              s.pos[0] += (dx / d) * shadeSpeed * DT;
              s.pos[2] += (dz / d) * shadeSpeed * DT;
            }
          } else if (s.state === 'wander') {
            // Patrol/wander slowly toward island center or Mây (1.5 m/s)
            if (d > 0.01) {
              s.pos[0] += (dx / d) * 1.5 * DT;
              s.pos[2] += (dz / d) * 1.5 * DT;
            }
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
        if (!this.isRespawning && this.playerCarried >= 5 && distToPlayer <= 15.0) {
          d.state = 'chase';
        }
      } else if (d.state === 'chase') {
        if (this.isRespawning || this.playerCarried < 5 || distToPlayer > 15.0) {
          d.state = 'idle';
        } else {
          const dx = this.playerPos[0] - d.pos[0];
          const dz = this.playerPos[2] - d.pos[2];
          if (distToPlayer > 0.01) {
            d.pos[0] += (dx / distToPlayer) * 7.0 * DT;
            d.pos[2] += (dz / distToPlayer) * 7.0 * DT;
          }
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

            // Recoil shade 2m away
            let rdx = s.pos[0] - this.playerPos[0];
            let rdz = s.pos[2] - this.playerPos[2];
            const rlen = Math.hypot(rdx, rdz);
            if (rlen > 0.01) {
              s.recoilDir = [rdx / rlen, rdz / rlen];
            } else {
              s.recoilDir = [1, 0];
            }
            s.state = 'recoil';
            s.stateTicksLeft = 60;

            // Scatter dropped motes in 1.5 - 2.5m ring
            for (let k = 0; k < dropped; k++) {
              const angle = (k * 2 * Math.PI) / (dropped || 1);
              const r = 2.0;
              this.motes.push({
                id: `M${this.nextMoteSeq++}`,
                pos: [
                  round3(this.playerPos[0] + Math.cos(angle) * r),
                  this.playerPos[1],
                  round3(this.playerPos[2] + Math.sin(angle) * r)
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
            break; // Max 1 flame lost per tick
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

    // Shade Spawns
    if (this.randomShades) {
      const maxShades = this.night === 1 ? 6 : this.night === 2 ? 8 : 10;
      const intervalTicks = this.night === 1 ? 480 : this.night === 2 ? 420 : 360; // 8s, 7s, 6s

      if (tick === 300) {
        // Initial 2 shades at tick 300 (second 5)
        const s1 = `S${this.nextShadeSeq++}`;
        const s2 = `S${this.nextShadeSeq++}`;
        this.shades.push({ id: s1, pos: [37, 1, 0], state: 'chase', stateTicksLeft: 0, recoilDir: [0, 0] });
        this.shades.push({ id: s2, pos: [-37, 1, 0], state: 'chase', stateTicksLeft: 0, recoilDir: [0, 0] });
        events.push({ type: 'event', tick, name: 'shade_spawned', data: { id: s1 } });
        events.push({ type: 'event', tick, name: 'shade_spawned', data: { id: s2 } });
      } else if (tick > 300 && (tick - 300) % intervalTicks === 0 && this.shades.length < maxShades) {
        const sid = `S${this.nextShadeSeq++}`;
        const spawnAngle = (this.shades.length * Math.PI) / 3;
        const spawnRadius = this.night === 1 ? 37 : this.night === 2 ? 26 : 43;
        this.shades.push({
          id: sid,
          pos: [round3(Math.cos(spawnAngle) * spawnRadius), 1, round3(Math.sin(spawnAngle) * spawnRadius)],
          state: 'chase',
          stateTicksLeft: 0,
          recoilDir: [0, 0]
        });
        events.push({ type: 'event', tick, name: 'shade_spawned', data: { id: sid } });
      }
    }

    // Drifter Spawns (Night 2 & 3)
    if ((this.night === 2 || this.night === 3) && this.randomDrifters) {
      if (tick % 1200 === 0 && this.drifters.length < 2) {
        const did = `D${this.nextDrifterSeq++}`;
        this.drifters.push({ id: did, pos: [25, 1, 0], state: 'idle', stolen: 0, stateTicksLeft: 0 });
      }
    }

    // Step 11: Check Win / Loss
    if (this.lanterns.every((l) => l.lit)) {
      this.score +=
        Math.floor(this.timeLeftS) * this.tuning.score.per_second_left +
        this.playerFlames * this.tuning.score.per_flame_left;
      this.state = 'won';
      events.push({ type: 'event', tick, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
      this.prevInput = { ...rawInput };
      return events;
    }

    if (this.timeLeftS <= 1e-9) {
      this.timeLeftS = 0;
      this.state = 'lost';
      events.push({ type: 'event', tick, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
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
        carried: this.playerCarried
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited
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
