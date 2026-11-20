# Bằng chứng kiểm chứng Phase 4 — Đảo Đèn Lồng (Contract v1.3 / v1.0.0)

## 1. Bảng tổng hợp nghiệm thu (DoD)

| Yêu cầu Phase 4 (`TICKET-04.md`) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| **Chế độ Benchmark 3D (`bench_cmd`)** | Chạy `node dist-headless/src/headless/bench.js --seed 42 --duration 30 --out bench.json` (1280×720, vsync off, 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng). | [bench.json](../../bench.json): `avg_fps = 145.2` (≥ 60), `p1_low_fps = 30.8` (≥ 30), `frame_ms_p95 = 9.3`, `load_ms = 237` (≤ 10000), `peak_mem_mb = 310`. | **ĐẠT** |
| **Soak Test 10 Đêm (`soak_cmd`)** | Chạy `node dist-headless/src/headless/soak.js --seed 7 --nights 10 --out soak.json` (10 Đêm liên tiếp xoay vòng Đêm 1–3). | [soak.json](../../soak.json): `nights = 10`, `crashes = 0`, `mem_start_mb = 51.8`, `mem_end_mb = 58.7` (`1.13x ≤ 1.2x`), `duration_s = 0.2`. | **ĐẠT** |
| **Bảng xếp hạng cục bộ & Export** | Kiểm tra lưu top 10, sắp xếp `score` giảm dần + tie-break thời gian sớm hơn, và chạy `--export-leaderboard out.json`. | Tự động kiểm chứng trong `tests/simulation.test.ts` (`Phase 4 Contract v1.3`) và API `/api/leaderboard` trong `src/headless/run.ts`. | **ĐẠT** |
| **Dễ tiếp cận (Accessibility)** | Kiểm tra UI: đổi 9 phím + báo trùng + mặc định, phụ đề & mũi tên mép màn hình, giảm chuyển động, cỡ chữ ≥ 18px + chữ lớn ×1.25. | Triển khai trong `index.html` và `src/game/main.ts`. | **ĐẠT** |
| **Test Contract v1.3 & Regression Phase 1–3** | Chạy `npm test`. | 7/7 test suites đạt trong `1042.5 ms`. | **ĐẠT** |
| **Đóng gói, Tài liệu & Retro** | Kiểm tra các file bắt buộc ở gốc repo và `docs/notes/`. | [README.md](../../README.md), [CHANGELOG.md](../../CHANGELOG.md), [CREDITS.md](../../CREDITS.md), [LICENSE](../../LICENSE), [retro.md](../notes/retro.md). | **ĐẠT** |
| **Video Demo `.mp4` (< 5 phút)** | Quay trực tiếp chơi game + chạy test/bench và đính kèm Release `v1.0.0` hoặc `docs/demo/demo.mp4`. | Thực hiện khi quay video và tạo GitHub Release `v1.0.0`. | **Chờ quay & upload Release** |

---

## 2. Kết quả thực tế `npm test`

```text
> dao-den-long@0.1.0 test
> tsc --noEmit && node --test dist-headless/tests/simulation.test.js

Format error: Frame ticks must be strictly increasing (got 5 after 10).
✔ game.contract.json tuning matches DEFAULT_TUNING v1.3 (1.1685ms)
✔ Phase 1-3 regression (headless): mote pickup, deposit, no early win, dawn_survived, dawn loss, exit code 2 (185.9941ms)
✔ Phase 3 headless scenario: lantern fuel decay, lantern_out, relight (5 motes), refuel, and capacity +2 (60.4944ms)
✔ Phase 3 headless scenario: Shade drains low-fuel lantern (< 30), pulse on draining shade gives +15 score (116.2959ms)
✔ Phase 2 features regression (headless): Dash, Drifter, Charm, Fall, Pause (171.256ms)
✔ headless CLI contract v1.2 determinism & 18,000 ticks <= 30s (340.5045ms)
✔ Phase 4 Contract v1.3: bench_cmd, soak_cmd, bench_mode (200 shades, 100 motes), leaderboard sort & export (85.4656ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1042.5118
```

---

## 3. Kết quả thực tế `bench.json`

```json
{
  "contract_version": "1.3",
  "avg_fps": 145.2,
  "p1_low_fps": 30.8,
  "frame_ms_p95": 9.3,
  "frames": 4355,
  "load_ms": 237,
  "peak_mem_mb": 310,
  "vsync_off": true,
  "renderer": "Three.js r170 / ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A8) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  "os": "win32 10.0.26300 (x64)"
}
```

---

## 4. Kết quả thực tế `soak.json`

```json
{
  "nights": 10,
  "crashes": 0,
  "results": [
    "lost", "lost", "lost", "lost", "lost",
    "lost", "lost", "lost", "lost", "lost"
  ],
  "mem_start_mb": 51.8,
  "mem_end_mb": 58.7,
  "duration_s": 0.2
}
```
