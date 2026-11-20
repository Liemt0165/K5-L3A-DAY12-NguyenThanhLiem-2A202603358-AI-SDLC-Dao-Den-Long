import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_TUNING } from '../src/core/contract.js';
import { GameSimulation, defaultInputState } from '../src/core/simulation.js';
import type { GameContract, SnapshotRecord } from '../src/core/types.js';

function distXZ(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

test('game.contract.json tuning matches DEFAULT_TUNING', () => {
  const raw = fs.readFileSync(path.resolve('game.contract.json'), 'utf8');
  const contract = JSON.parse(raw) as GameContract;
  assert.equal(contract.contract_version, '1.0');
  assert.deepEqual(contract.tuning, DEFAULT_TUNING);
});

test('5 lanterns spawn within 20m of center and >= 20m apart', () => {
  for (const seed of [1, 7, 42, 999]) {
    const sim = new GameSimulation(seed, 1);
    assert.equal(sim.lanterns.length, 5);
    for (let i = 0; i < sim.lanterns.length; i++) {
      const dCenter = distXZ(sim.lanterns[i].pos, [0, 0, 0]);
      assert.ok(dCenter <= 20.001, `Lantern ${i} distance from center ${dCenter} > 20`);
      for (let j = i + 1; j < sim.lanterns.length; j++) {
        const dPair = distXZ(sim.lanterns[i].pos, sim.lanterns[j].pos);
        assert.ok(dPair >= 19.999, `Pair (${i},${j}) distance ${dPair} < 20`);
      }
    }
  }
});

test('mote pickup, deposit-all, and win condition', () => {
  const sim = new GameSimulation(1, 1, {
    player: { pos: [0, 0, 0], carried: 0, flames: 5 },
    random_motes: false,
    random_shades: false,
    motes: [[0, 0, 1], [0, 0, 2], [0, 0, 3], [0, 0, 4], [0, 0, 5]],
    shades: [],
    lanterns: [
      { id: 'L1', pos: [0, 0, 6], deposited: 0 },
      { id: 'L2', pos: [20, 0, 0], lit: true },
      { id: 'L3', pos: [-20, 0, 0], lit: true },
      { id: 'L4', pos: [0, 0, -20], lit: true },
      { id: 'L5', pos: [14, 0, 14], lit: true }
    ]
  });

  // Setup should not award points
  assert.equal(sim.score, 0);

  // Move +Z for 60 ticks (5.0 m/s * 60/60 = 5.0m) to pick all 5 motes and reach L1 at z=6
  const input = defaultInputState();
  input.move = [0, 1];
  let pickedCount = 0;
  for (let i = 0; i < 60; i++) {
    const events = sim.step(input);
    pickedCount += events.filter((e) => e.name === 'mote_picked').length;
  }
  assert.equal(pickedCount, 5);
  assert.equal(sim.playerCarried, 5);

  // Edge trigger interact: deposits all 5 carried motes and wins!
  input.move = [0, 0];
  input.interact = true;
  const winEvents = sim.step(input);
  assert.equal(sim.state, 'won');
  assert.ok(winEvents.some((e) => e.name === 'deposit' && e.data.amount === 5));
  assert.ok(winEvents.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(winEvents.some((e) => e.name === 'game_over' && e.data.reason === 'all_lit'));
});

test('pulse stuns & pushes shades and safe_radius blocks shade when May is inside lit lantern', () => {
  const sim = new GameSimulation(5, 1, {
    player: { pos: [0, 0, 0], carried: 3, flames: 5 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [0, 0, 3] }],
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }]
  });

  // Step 1: Shade tries to chase player inside L1 safe_radius (5m), should be kept > 5m away
  sim.step(defaultInputState());
  const dAfterStep = distXZ(sim.shades[0].pos, [0, 0, 0]);
  assert.ok(dAfterStep >= 5.0, `Shade entered safe_radius: ${dAfterStep}`);

  // Move shade within pulse radius (6m) via scenario without safe lantern
  const simPulse = new GameSimulation(5, 1, {
    player: { pos: [0, 0, 0], carried: 2, flames: 5 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [0, 0, 4] }],
    lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: false }]
  });

  const inp = defaultInputState();
  inp.pulse = true;
  const events = simPulse.step(inp);
  assert.ok(events.some((e) => e.name === 'pulse'));
  assert.equal(simPulse.playerCarried, 1);
  assert.equal(simPulse.shades[0].state, 'stunned');
  assert.ok(simPulse.shades[0].pos[2] > 7.5);
});

test('dawn timeout emits lost with reason dawn and awards no bonus', () => {
  const sim = new GameSimulation(1, 1, {
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    time_left_s: 0.5
  });
  let gameOverReason: unknown;
  for (let k = 0; k < 60; k++) {
    const events = sim.step(defaultInputState());
    const go = events.find((e) => e.name === 'game_over');
    if (go) {
      gameOverReason = go.data.reason;
      break;
    }
  }
  assert.equal(sim.state, 'lost');
  assert.equal(gameOverReason, 'dawn');
  assert.equal(sim.score, 0);
});

test('headless CLI produces identical JSONL across runs and exits 2 on invalid inputs/scenario', () => {
  const cliPath = path.resolve('dist-headless/src/headless/cli.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-test-'));
  const out1 = path.join(tmpDir, 'run1.jsonl');
  const out2 = path.join(tmpDir, 'run2.jsonl');

  execFileSync('node', [
    cliPath,
    '--seed',
    '42',
    '--night',
    '1',
    '--ticks',
    '120',
    '--out',
    out1
  ]);
  execFileSync('node', [
    cliPath,
    '--seed',
    '42',
    '--night',
    '1',
    '--ticks',
    '120',
    '--out',
    out2
  ]);

  const content1 = fs.readFileSync(out1, 'utf8');
  const content2 = fs.readFileSync(out2, 'utf8');
  assert.equal(content1, content2);

  const lines = content1.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].type, 'snapshot');
  assert.equal((lines[0] as SnapshotRecord).tick, 0);
  assert.equal(lines[lines.length - 1].type, 'end');
  assert.equal(lines[lines.length - 1].ticks, 120);

  // Invalid inputs file -> exit code 2
  const badInputs = path.join(tmpDir, 'bad_inputs.json');
  fs.writeFileSync(badInputs, '{"frames":[{"tick":10},{"tick":5}]}');
  let exitCode = 0;
  try {
    execFileSync('node', [
      cliPath,
      '--seed',
      '42',
      '--night',
      '1',
      '--inputs',
      badInputs,
      '--ticks',
      '20',
      '--out',
      path.join(tmpDir, 'bad.jsonl')
    ]);
  } catch (err) {
    exitCode = (err as { status: number }).status;
  }
  assert.equal(exitCode, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
