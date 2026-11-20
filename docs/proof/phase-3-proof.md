# Bằng chứng kiểm chứng Phase 3 — "Đèn cạn dầu" (Contract v1.2)

## 1. Kết quả kiểm thử tự động (`npm run build:headless && npm test`)
Chạy **6/6 bộ test PASS** trong `1036.60 ms`:
- `✔ game.contract.json tuning matches DEFAULT_TUNING v1.2` (`2.32 ms`)
- `✔ Phase 1-3 regression (headless): mote pickup, deposit, no early win, dawn_survived, dawn loss, exit code 2` (`196.63 ms`)
- `✔ Phase 3 headless scenario: lantern fuel decay, lantern_out, relight (5 motes), refuel, and capacity +2` (`68.68 ms`)
- `✔ Phase 3 headless scenario: Shade drains low-fuel lantern (< 30), pulse on draining shade gives +15 score` (`126.51 ms`)
- `✔ Phase 2 features regression (headless): Dash, Drifter, Charm, Fall, Pause` (`176.56 ms`)
- `✔ headless CLI contract v1.2 determinism & 18,000 ticks <= 30s` (`376.98 ms` cho 2 lần chạy 18.000 tick + so sánh JSONL giống hệt nhau)

## 2. Kết quả build web (`npm run build:web`)
- `vite build` thành công (`dist/index.html` `11.27 kB`, `dist/assets/index-CtVIW_aK.js` `519.62 kB` trong `835 ms`).

## 3. Truy vết DoD Phase 3
| Yêu cầu DoD | Trạng thái | Bằng chứng |
|---|---|---|
| Bằng chứng game chạy đúng yêu cầu | **Đạt** | File này + log `npm test` (6/6 PASS) |
| ADR mô tả thay đổi trạng thái đèn & luật thắng | **Đạt** | [docs/notes/adr-001-lantern-fuel.md](../notes/adr-001-lantern-fuel.md) |
| Cập nhật/xóa test cũ có ghi lý do | **Đạt** | [tests/simulation.test.ts](../../tests/simulation.test.ts) (ghi chú thay `all_lit` bằng `dawn_survived`) |
| Changelog liệt kê breaking changes Phase 3 | **Đạt** | [CHANGELOG.md](../../CHANGELOG.md) |
| Regression Phase 1–2 không bị thay thế vẫn đạt | **Đạt** | 2 suite regression trong `npm test` đều PASS |
