# AGENTS.md — Đảo Đèn Lồng (AI SDLC Lab - Phase 4)

## 1. Tech Stack & Kiến trúc
- **Stack:** TypeScript + Three.js (Vite) cho bản 3D; Node.js/TypeScript cho chế độ headless, benchmark, soak test và server chạy cục bộ.
- **Tách lớp bắt buộc:** Giữ toàn bộ logic game (simulation, physics, AI, va chạm, điểm số, RNG) độc lập hoàn toàn với Three.js/DOM để chạy được ở chế độ headless (không cửa sổ, không GPU).
- **Lệnh cốt lõi:**
  - Build toàn bộ: `npm run build` (`build:headless` + `build:web`)
  - Chạy game: `node dist-headless/src/headless/run.js` (hỗ trợ `--export-leaderboard <file>`)
  - Chạy Headless CLI: `node dist-headless/src/headless/cli.js --scenario <file> --inputs <file> --out <file>`
  - Benchmark & Soak: `node dist-headless/src/headless/bench.js --seed 42 --duration 30 --out bench.json` / `node dist-headless/src/headless/soak.js --seed 7 --nights 10 --out soak.json`
  - Kiểm thử & Typecheck: `npm test`

## 2. Ràng buộc Test Contract v1.3 (Bắt buộc)
- **Tick cố định:** `60 tick/s`. Bước `k` đọc input tick `k`, tạo trạng thái `k+1`, sự kiện ghi `tick = k+1`.
- **Nhiên liệu đèn:** Lưu theo đơn vị nguyên `1/60` (`fuelTicks`, max `6000` = `100.0`). Hao tự nhiên `1/60` mỗi tick; mỗi Bóng Mực `drain` hút `5/60` mỗi tick (trừ ở bước 2 trước khi xét tắt đèn `lantern_out`).
- **Vùng an toàn & `drain`:** Đèn `fuel < 30` mất vùng an toàn. Bóng Mực `drain` hút tối đa `2m` quanh đèn, chuyển `chase` khi Mây vào `<= 6m`.
- **Luật thắng v1.3:** Không còn `all_lit`. Thắng khi hết giờ (`dawn_survived`) còn sống và số đèn sáng `>= ceil(0.6 * total)`. Hết Ngọn Lửa luôn thua `no_flames` trước.
- **Sức chứa:** `10 + 2 * successful_lights` (tối đa `20`).
- **Trạng thái Bóng Mực chuẩn v1.3:** `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`.
- **Tính tất định & Exit codes:** Mọi ngẫu nhiên dùng PRNG có seed (`--seed`). Exit `0` khi xong, `2` khi `inputs`/`scenario` sai định dạng, khác `0` cho lỗi khác.
- **`game.contract.json`:** Mọi hằng số `tuning` trong code phải khớp 100% với `game.contract.json` (`contract_version: "1.3"`), gồm đủ `bench_cmd` và `soak_cmd`.

## 3. Quy tắc làm việc với Agent
- Luôn kiểm tra yêu cầu (`TICKET-03.md` / `TICKET-04.md`) và ADR (`docs/notes/`) trước khi sửa logic; không tự ý thêm luật ngoài yêu cầu.
- Sau khi sửa: chạy `npm run build:headless && npm test && npm run build:web` (hoặc dùng skill `.agents/skills/verify-phase4`).
- Kiểm tra tính tất định: cùng `--seed`, scenario và inputs phải cho kết quả JSONL giống hệt nhau giữa 2 lần chạy.
- Liêm chính học thuật: Không sửa tay output để làm giả bằng chứng; phần chưa xong phải ghi trung thực "chưa đạt".
- Tuyệt đối không commit `.env`, API key, token hay thông tin nhạy cảm.
- Giữ nguyên các file harness (`AGENTS.md`, `.agents/`) trong repo và lịch sử git, không được xóa sau khi dùng.
