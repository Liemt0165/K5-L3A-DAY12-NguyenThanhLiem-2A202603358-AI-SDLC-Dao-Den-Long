---
name: verify-phase2
description: Run Phase 2 verification suite (typecheck, unit & regression tests, headless CLI scenario checks for all new features, determinism check, and 21,600-tick benchmark).
---

# Verify Phase 2 (Test Contract v1.1)

1. Build headless CLI and TypeScript tests:
   ```bash
   npm run build:headless
   ```
2. Run typecheck and full test suite (includes Phase 1 regression, headless CLI scenarios for Dash, Drifter, Charm, Fall, Pause, Night 2/3, determinism, and 21,600-tick speed check):
   ```bash
   npm test
   ```
3. Build production web bundle:
   ```bash
   npm run build:web
   ```
4. Verify `game.contract.json` matches `src/core/contract.ts` (`DEFAULT_TUNING`) — covered automatically by `npm test`.
5. Record actual command outputs in `docs/proof/phase-2-proof.md`. Never fabricate or hand-edit outputs.
