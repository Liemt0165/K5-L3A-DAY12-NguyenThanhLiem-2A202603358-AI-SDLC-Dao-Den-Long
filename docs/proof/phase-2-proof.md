# Bằng chứng kiểm chứng Phase 2 — Đảo Đèn Lồng (Contract v1.1)

## 1. Môi trường kiểm chứng
- **OS:** Windows (chạy chuẩn Node.js / Vite, tương thích macOS & Linux qua `npm install && npm run build`)
- **Node.js:** `v26.13.1`
- **Test Contract:** `v1.1` ([game.contract.json](../../game.contract.json))

## 2. Kết quả chạy kiểm thử tự động (`npm run build:headless && npm test`)

Toàn bộ **9/9 bộ test** (bao gồm regression Phase 1 và scenario headless cho từng tính năng mới Phase 2) đều **PASS** trong `990ms`:

- `✔ game.contract.json tuning matches DEFAULT_TUNING v1.1` (`1.67ms`)
- `✔ Phase 1 regression (headless): mote pickup, deposit, win all_lit, safe_radius, dawn timeout, exit code 2` (`218.87ms`)
- `✔ Phase 2 headless scenario: Dash (14 m/s over 12 ticks, cooldown)` (`67.55ms`)
- `✔ Phase 2 headless scenario: Drifter steals & drops motes on pulse` (`82.85ms`)
- `✔ Phase 2 headless scenario: Charm pickup grants 600 ticks boost` (`77.62ms`)
- `✔ Phase 2 headless scenario: Falling off island (Y < -10) & respawn` (`80.45ms`)
- `✔ Phase 2 headless scenario: Pause and Resume halt sim_tick` (`60.80ms`)
- `✔ Phase 2 headless scenario: Night 2 Jump Pad & Night 3 Tiered Island` (`128.10ms`)
- `✔ headless CLI contract v1.1 determinism & 21,600 ticks <= 30s` (`188.33ms` cho 2 lần chạy 21.600 tick + so sánh JSONL giống hệt nhau)

## 3. Kết quả build bản 3D (`npm run build:web`)
- Vite build thành công (`dist/index.html` + bundle JS `515.09 kB`, gzip `131.49 kB` trong `680ms`).
- **FPS bản thường ở 1280×720:** *Chưa đo tự động bằng trình duyệt trong môi trường headless* — cần mở `npm run dev` hoặc `npm run preview` ở cửa sổ `1280×720` và ghi nhận số FPS thực tế trước khi chốt tag `phase-2`.

## 4. Truy vết DoD Phase 2
| Yêu cầu DoD | Trạng thái | Bằng chứng |
|---|---|---|
| Bằng chứng game chạy đúng yêu cầu | **Đạt** | File này + log `npm test` (9/9 PASS) |
| Regression test Phase 1 với số chuẩn | **Đạt** | `Phase 1 regression (headless)` trong [tests/simulation.test.ts](../../tests/simulation.test.ts) |
| Spec có acceptance criteria cho Phần 3 | **Đạt** | [docs/notes/phase-2-spec.md](../notes/phase-2-spec.md) |
| Cập nhật `AGENTS.md` và skill | **Đạt** | [AGENTS.md](../../AGENTS.md) và [SKILL.md](../../.agents/skills/verify-phase2/SKILL.md) |
| ≥ 1 scenario headless cho mỗi tính năng mới | **Đạt** | 6 scenario headless CLI riêng biệt cho Dash, Drifter, Charm, Fall, Pause, Đêm 2/3 |
| Bản thường ≥ 30 FPS ở 1280×720 | **Cần đo trên trình duyệt** | Đã tối ưu render Three.js (shadowMap 1024, pixelRatio ≤ 2); chờ bạn xác nhận FPS thực tế khi chạy `npm run dev` |
