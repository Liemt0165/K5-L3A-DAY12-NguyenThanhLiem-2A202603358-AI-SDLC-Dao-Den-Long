import type { TuningConfig } from './types.js';

export const TICKS_PER_SECOND = 60;
export const DT = 1 / TICKS_PER_SECOND;
export const ISLAND_RADIUS = 50;
export const LANTERN_PLACEMENT_RADIUS = 20;
export const LANTERN_MIN_SEPARATION = 20;

export const INITIAL_RANDOM_MOTES = 15;
export const MIN_RANDOM_MOTES = 10;
export const MOTE_RESPAWN_INTERVAL_TICKS = 5 * TICKS_PER_SECOND;

export const INITIAL_RANDOM_SHADES = 2;
export const MAX_RANDOM_SHADES = 5;
export const SHADE_SPAWN_INTERVAL_TICKS = 25 * TICKS_PER_SECOND;

export const DEFAULT_TUNING: TuningConfig = {
  player_speed: 5.0,
  carry_capacity: 6,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 1,
  pulse_radius: 6.0,
  night1_duration_s: 300,
  flames: 5,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.5,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 5.0,
  shade_speed: 3.8,
  shade_hit_radius: 1.0,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 2,
    per_flame_left: 50
  }
};

export function round3(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
