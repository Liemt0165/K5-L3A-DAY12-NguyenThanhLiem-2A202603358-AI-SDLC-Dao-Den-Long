---
name: verify-phase4
description: Run Phase 4 verification suite (typecheck, headless unit & regression tests, soak test 10 nights, web build, and 3D benchmark).
---

# Verify Phase 4 (Test Contract v1.3)

1. Build headless CLI and TypeScript code:
   ```bash
   npm run build:headless
   ```
2. Run typecheck and full test suite (Contract v1.3, Phase 1–3 regression, Phase 4 bench_mode & leaderboard):
   ```bash
   npm test
   ```
3. Build production web bundle:
   ```bash
   npm run build:web
   ```
4. Run 10-Night headless soak test:
   ```bash
   node dist-headless/src/headless/soak.js --seed 7 --nights 10 --out soak.json
   ```
5. Run 3D benchmark (1280x720, 200 shades, 100 motes):
   ```bash
   node dist-headless/src/headless/bench.js --seed 42 --duration 30 --out bench.json
   ```
6. Record real command outputs in `docs/proof/phase-4-proof.md`. Never fabricate or hand-edit outputs.
