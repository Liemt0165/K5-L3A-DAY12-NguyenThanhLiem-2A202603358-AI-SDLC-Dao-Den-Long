import {
  DEFAULT_TUNING,
  DT,
  INITIAL_RANDOM_MOTES,
  INITIAL_RANDOM_SHADES,
  ISLAND_RADIUS,
  LANTERN_MIN_SEPARATION,
  LANTERN_PLACEMENT_RADIUS,
  MAX_RANDOM_SHADES,
  MIN_RANDOM_MOTES,
  MOTE_RESPAWN_INTERVAL_TICKS,
  SHADE_SPAWN_INTERVAL_TICKS,
  TICKS_PER_SECOND,
  round3
} from './contract.js';
import { SeededRng } from './rng.js';
import type {
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

function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function clampToIsland(pos: Vec3, radiusLimit: number): void {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > radiusLimit && d > 0) {
    const scale = radiusLimit / d;
    pos[0] *= scale;
    pos[2] *= scale;
  }
}

export function defaultInputState(): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false
  };
}

/**
 * Pure deterministic 60Hz game simulation for Dao Den Long (Night 1).
 * Independent of Three.js / DOM so headless and 3D share identical rules.
 */
export class GameSimulation {
  readonly tuning: TuningConfig;
  readonly rng: SeededRng;
  readonly night: number;

  simTick = 0;
  state: GamePhaseState = 'playing';
  score = 0;
  initialTimeLeftS: number;
  timeLeftS: number;

  playerPos: Vec3 = [0, 0, 0];
  playerVy = 0;
  playerFlames: number;
  playerCarried = 0;
  invulnTimer = 0;
  pulseCooldownTimer = 0;

  lanterns: LanternEntity[] = [];
  shades: ShadeEntity[] = [];
  motes: MoteEntity[] = [];

  private randomMotes: boolean;
  private randomShades: boolean;
  private nextMoteSeq = 1;
  private nextShadeSeq = 1;
  private moteRespawnCounter = 0;
  private shadeSpawnCounter = 0;
  private prevInput: InputState = defaultInputState();

  // Visual hints for the 3D client (do not affect simulation or JSONL output)
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
    this.initialTimeLeftS = tuning.night1_duration_s;
    this.timeLeftS = this.initialTimeLeftS;

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;

    this.lanterns = this.generateLanterns(tuning.lantern_count_night1);
    this.applyScenario(scenario);
  }

  private generateLanterns(count: number): LanternEntity[] {
    const positions: Vec3[] = [];
    const baseAngle = this.rng.range(0, Math.PI * 2);

    // Sample in [18.5, 20.0] around 5 angular sectors so all pairs satisfy >= 20m inside r <= 20m.
    for (let attempt = 0; attempt < 250; attempt++) {
      positions.length = 0;
      let valid = true;
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i * Math.PI * 2) / count + this.rng.range(-0.08, 0.08);
        const r = this.rng.range(18.5, LANTERN_PLACEMENT_RADIUS);
        const candidate: Vec3 = [round3(Math.cos(angle) * r), 0, round3(Math.sin(angle) * r)];
        for (const existing of positions) {
          if (distXZ(candidate, existing) < LANTERN_MIN_SEPARATION) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
        positions.push(candidate);
      }
      if (valid) break;
    }

    // Deterministic fallback on the exact 20m circle (regular pentagon chord = 23.51m >= 20m)
    if (positions.length !== count) {
      positions.length = 0;
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i * Math.PI * 2) / count;
        positions.push([
          round3(Math.cos(angle) * LANTERN_PLACEMENT_RADIUS),
          0,
          round3(Math.sin(angle) * LANTERN_PLACEMENT_RADIUS)
        ]);
      }
    }

    return positions.map((pos, idx) => ({
      id: `L${idx + 1}`,
      pos,
      lit: false,
      deposited: 0
    }));
  }

  private applyScenario(scenario?: ScenarioConfig): void {
    if (scenario?.player) {
      if (scenario.player.pos) {
        this.playerPos = [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]];
      }
      if (scenario.player.carried !== undefined) {
        this.playerCarried = scenario.player.carried;
      }
      if (scenario.player.flames !== undefined) {
        this.playerFlames = scenario.player.flames;
      }
    }

    if (scenario?.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) {
          target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        }
        if (patch.deposited !== undefined) {
          target.deposited = patch.deposited;
        }
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (patch.lit && patch.deposited === undefined) {
            target.deposited = this.tuning.lantern_cost;
          }
        } else if (target.deposited >= this.tuning.lantern_cost) {
          target.lit = true;
        }
      }
    }

    if (scenario?.motes !== undefined) {
      this.motes = scenario.motes.map((entry) => {
        const rawPos = Array.isArray(entry) ? entry : entry.pos;
        const id = Array.isArray(entry) || !entry.id ? `M${this.nextMoteSeq++}` : entry.id;
        return { id, pos: [rawPos[0], rawPos[1], rawPos[2]] };
      });
    } else if (this.randomMotes) {
      for (let i = 0; i < INITIAL_RANDOM_MOTES; i++) {
        this.spawnRandomMote();
      }
    }

    if (scenario?.shades !== undefined) {
      this.shades = scenario.shades.map((entry) => ({
        id: entry.id ?? `S${this.nextShadeSeq++}`,
        pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
        state: entry.state ?? 'chase',
        stunTimer: 0
      }));
    } else if (this.randomShades) {
      for (let i = 0; i < INITIAL_RANDOM_SHADES; i++) {
        this.spawnRandomShade();
      }
    }

    if (scenario?.time_left_s !== undefined) {
      this.initialTimeLeftS = scenario.time_left_s;
      this.timeLeftS = scenario.time_left_s;
    }
  }

  private spawnRandomMote(): MoteEntity {
    let pos: Vec3 = [0, 0, 5];
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const r = Math.sqrt(this.rng.next()) * (ISLAND_RADIUS - 4);
      const candidate: Vec3 = [round3(Math.cos(angle) * r), 0, round3(Math.sin(angle) * r)];
      if (distXZ(candidate, this.playerPos) >= 2.5) {
        pos = candidate;
        break;
      }
    }
    const mote: MoteEntity = { id: `M${this.nextMoteSeq++}`, pos };
    this.motes.push(mote);
    return mote;
  }

  private spawnRandomShade(): ShadeEntity {
    let pos: Vec3 = [35, 1, 0];
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(30, ISLAND_RADIUS - 3);
      const candidate: Vec3 = [round3(Math.cos(angle) * r), 1, round3(Math.sin(angle) * r)];
      const farFromPlayer = distXZ(candidate, this.playerPos) >= 12;
      const outsideLitLanterns = this.lanterns.every(
        (l) => !l.lit || distXZ(candidate, l.pos) > this.tuning.safe_radius
      );
      if (farFromPlayer && outsideLitLanterns) {
        pos = candidate;
        break;
      }
    }
    const shade: ShadeEntity = {
      id: `S${this.nextShadeSeq++}`,
      pos,
      state: 'chase',
      stunTimer: 0
    };
    this.shades.push(shade);
    return shade;
  }

  /** Advances the simulation by one fixed 1/60s step and returns events emitted at tick k+1. */
  step(rawInput: InputState): EventRecord[] {
    if (this.state !== 'playing') {
      return [];
    }

    const events: EventRecord[] = [];
    this.simTick += 1;
    const tick = this.simTick;
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick / TICKS_PER_SECOND);

    // 1. Timers
    this.invulnTimer = Math.max(0, this.invulnTimer - DT);
    this.pulseCooldownTimer = Math.max(0, this.pulseCooldownTimer - DT);
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer -= DT;
        if (shade.stunTimer <= 0) {
          shade.stunTimer = 0;
          shade.state = 'chase';
        }
      }
    }

    // 2. Edge triggers (false -> true)
    const jumpPressed = !this.prevInput.jump && rawInput.jump;
    const interactPressed = !this.prevInput.interact && rawInput.interact;
    const pulsePressed = !this.prevInput.pulse && rawInput.pulse;
    this.prevInput = {
      move: [rawInput.move[0], rawInput.move[1]],
      cam_yaw_deg: rawInput.cam_yaw_deg,
      jump: rawInput.jump,
      interact: rawInput.interact,
      pulse: rawInput.pulse,
      dash: rawInput.dash
    };

    // 3. Player horizontal movement (camera-relative XZ) & jump
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
      this.playerPos[0] += wx * this.tuning.player_speed * DT;
      this.playerPos[2] += wz * this.tuning.player_speed * DT;
      clampToIsland(this.playerPos, ISLAND_RADIUS);
    }

    if (jumpPressed && this.playerPos[1] <= 0.0001) {
      this.playerVy = 6.5;
    }
    if (this.playerPos[1] > 0 || this.playerVy > 0) {
      this.playerVy -= 18.0 * DT;
      this.playerPos[1] += this.playerVy * DT;
      if (this.playerPos[1] <= 0) {
        this.playerPos[1] = 0;
        this.playerVy = 0;
      }
    }

    // 4. Mote pickup (<= pickup_radius)
    if (this.playerCarried < this.tuning.carry_capacity) {
      for (let i = 0; i < this.motes.length; ) {
        if (this.playerCarried >= this.tuning.carry_capacity) break;
        const mote = this.motes[i];
        if (distXZ(this.playerPos, mote.pos) <= this.tuning.pickup_radius) {
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

    // 5. Lantern deposit (interact edge trigger)
    if (interactPressed && this.playerCarried > 0) {
      let bestLantern: LanternEntity | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.playerPos, lantern.pos);
        if (d <= this.tuning.interact_radius && d < bestDist) {
          bestDist = d;
          bestLantern = lantern;
        }
      }

      if (bestLantern) {
        const needed = Math.max(0, this.tuning.lantern_cost - bestLantern.deposited);
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
          }
        }
      }
    }

    // 6. Check win condition (all lanterns lit)
    if (this.lanterns.every((l) => l.lit)) {
      this.score +=
        Math.floor(this.timeLeftS) * this.tuning.score.per_second_left +
        this.playerFlames * this.tuning.score.per_flame_left;
      this.state = 'won';
      events.push({
        type: 'event',
        tick,
        name: 'game_over',
        data: { result: 'won', reason: 'all_lit' }
      });
      return events;
    }

    // 7. Pulse (pulse edge trigger)
    if (
      pulsePressed &&
      this.pulseCooldownTimer <= 0 &&
      this.playerCarried >= this.tuning.pulse_cost
    ) {
      this.playerCarried -= this.tuning.pulse_cost;
      this.pulseCooldownTimer = this.tuning.pulse_cooldown_s;
      this.lastPulseTick = tick;

      const stunnedIds: string[] = [];
      for (const shade of this.shades) {
        const d = distXZ(this.playerPos, shade.pos);
        if (d <= this.tuning.pulse_radius) {
          let dirX = 0;
          let dirZ = 1;
          if (d > 1e-6) {
            dirX = (shade.pos[0] - this.playerPos[0]) / d;
            dirZ = (shade.pos[2] - this.playerPos[2]) / d;
          }
          shade.pos[0] += dirX * this.tuning.pulse_push_m;
          shade.pos[2] += dirZ * this.tuning.pulse_push_m;
          clampToIsland(shade.pos, ISLAND_RADIUS);
          shade.state = 'stunned';
          shade.stunTimer = this.tuning.pulse_stun_s;
          stunnedIds.push(shade.id);
          this.score += this.tuning.score.per_stun;
        }
      }
      events.push({
        type: 'event',
        tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 8. Random spawning (when enabled)
    if (this.randomMotes) {
      if (this.motes.length < MIN_RANDOM_MOTES) {
        this.moteRespawnCounter += 1;
        if (this.moteRespawnCounter >= MOTE_RESPAWN_INTERVAL_TICKS) {
          this.moteRespawnCounter = 0;
          this.spawnRandomMote();
        }
      } else {
        this.moteRespawnCounter = 0;
      }
    }

    if (this.randomShades && this.shades.length < MAX_RANDOM_SHADES) {
      this.shadeSpawnCounter += 1;
      if (this.shadeSpawnCounter >= SHADE_SPAWN_INTERVAL_TICKS) {
        this.shadeSpawnCounter = 0;
        const spawned = this.spawnRandomShade();
        events.push({
          type: 'event',
          tick,
          name: 'shade_spawned',
          data: { id: spawned.id }
        });
      }
    }

    // 9. Shade movement & safe_radius around lit lanterns when player is inside
    const activeSafeLanterns = this.lanterns.filter(
      (l) => l.lit && distXZ(this.playerPos, l.pos) <= this.tuning.safe_radius
    );

    for (const shade of this.shades) {
      if (shade.state === 'stunned') continue;
      const d = distXZ(this.playerPos, shade.pos);
      if (d > 1e-6) {
        const stepDist = Math.min(d, this.tuning.shade_speed * DT);
        const dirX = (this.playerPos[0] - shade.pos[0]) / d;
        const dirZ = (this.playerPos[2] - shade.pos[2]) / d;
        shade.pos[0] += dirX * stepDist;
        shade.pos[2] += dirZ * stepDist;
      }

      // Enforce safe_radius barrier for lit lanterns containing May
      for (const lantern of activeSafeLanterns) {
        const dl = distXZ(shade.pos, lantern.pos);
        if (dl <= this.tuning.safe_radius) {
          let outX = 0;
          let outZ = 1;
          if (dl > 1e-6) {
            outX = (shade.pos[0] - lantern.pos[0]) / dl;
            outZ = (shade.pos[2] - lantern.pos[2]) / dl;
          }
          const barrierRadius = this.tuning.safe_radius + 0.01;
          shade.pos[0] = lantern.pos[0] + outX * barrierRadius;
          shade.pos[2] = lantern.pos[2] + outZ * barrierRadius;
        }
      }
      clampToIsland(shade.pos, ISLAND_RADIUS);
    }

    // 10. Shade collision with player
    if (this.invulnTimer <= 0) {
      const hitShade = this.shades.find(
        (s) => s.state !== 'stunned' && distXZ(this.playerPos, s.pos) <= this.tuning.shade_hit_radius
      );
      if (hitShade) {
        this.playerFlames = Math.max(0, this.playerFlames - 1);
        const dropped = Math.floor(this.playerCarried * this.tuning.hit_drop_ratio);
        this.playerCarried -= dropped;
        this.invulnTimer = this.tuning.invuln_s;
        this.lastHitTick = tick;

        events.push({
          type: 'event',
          tick,
          name: 'player_hit',
          data: {
            by: 'shade',
            flames: this.playerFlames,
            dropped
          }
        });

        if (this.playerFlames <= 0) {
          this.state = 'lost';
          events.push({
            type: 'event',
            tick,
            name: 'game_over',
            data: { result: 'lost', reason: 'no_flames' }
          });
          return events;
        }
      }
    }

    // 11. Night timeout (dawn)
    if (this.timeLeftS <= 1e-9) {
      this.timeLeftS = 0;
      this.state = 'lost';
      events.push({
        type: 'event',
        tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' }
      });
    }

    return events;
  }

  getSnapshot(tick: number = this.simTick): SnapshotRecord {
    return {
      type: 'snapshot',
      tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: [round3(this.playerPos[0]), round3(this.playerPos[1]), round3(this.playerPos[2])],
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
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])]
      }))
    };
  }

  getEndRecord(): EndRecord {
    return {
      type: 'end',
      ticks: this.simTick,
      state: this.state,
      score: this.score
    };
  }
}
