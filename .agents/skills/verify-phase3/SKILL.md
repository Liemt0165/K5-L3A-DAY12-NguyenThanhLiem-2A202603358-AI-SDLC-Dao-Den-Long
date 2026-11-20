---
name: verify-phase3
description: Run Phase 3 verification suite (typecheck, headless CLI scenario checks for fuel decay, relight, refuel, shade drain, colorblind mode, determinism check, and 18,000-tick benchmark).
---

# Verify Phase 3 (Test Contract v1.2)

1. Build headless CLI and TypeScript code:
   ```bash
   npm run build:headless
   ```
2. Run typecheck and full test suite (Contract v1.2, fuel decay, relight/refuel, shade drain, dawn_survived win rule, capacity expansion, determinism, and 18,000-tick benchmark):
   ```bash
   npm test
   ```
3. Build production web bundle:
   ```bash
   npm run build:web
   ```
4. Verify `game.contract.json` matches `src/core/contract.ts` (`DEFAULT_TUNING` v1.2) — verified automatically in `npm test`.
5. Record real command outputs in `docs/proof/phase-3-proof.md`. Never fabricate or hand-edit outputs.
