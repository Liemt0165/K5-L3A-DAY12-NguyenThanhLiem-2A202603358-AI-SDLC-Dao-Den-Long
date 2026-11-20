# AGENTS.md — Đảo Đèn Lồng (AI SDLC Lab)

## 1. Tech Stack & Kiến trúc
- **Stack:** TypeScript + Three.js (Vite) cho bản 3D; Node.js/TypeScript cho chế độ headless.
- **Tách lớp bắt buộc:** Giữ toàn bộ logic game (simulation, physics, AI, va chạm, điểm số, RNG) độc lập hoàn toàn với Three.js/DOM để chạy được ở chế độ headless (không cửa sổ, không GPU).

## 2. Ràng buộc Test Contract (Bắt buộc)
- **Tick cố định:** `60 tick/s`. Snapshot tick `0` là trạng thái sau dựng scenario, trước khi áp dụng input. Bước `k` đọc input tick `k`, tạo trạng thái `k+1`, sự kiện ghi `tick = k+1`.
- **Tọa độ & khoảng cách:** Đơn vị mét, trục Y hướng lên, mặt đất `Y = 0`, xuất phát `(0,0,0)`. Khoảng cách trong `tuning` đo trên mặt phẳng ngang **XZ** giữa các tâm/chân (`<= r`). Làm tròn tọa độ 3 chữ số thập phân.
- **Tính tất định:** Mọi ngẫu nhiên phải dùng PRNG có seed (`--seed`). Cùng seed, scenario, inputs phải ra JSONL giống hệt nhau (kể cả ID tự sinh).
- **Exit codes:** `0` khi chạy xong/kết thúc game; `2` khi `inputs` hoặc `scenario` sai định dạng; khác `0` cho lỗi khác (ghi `stderr`).
- **`game.contract.json`:** Mọi hằng số `tuning` trong code phải khớp 100% với `game.contract.json`.

## 3. Quy tắc làm việc với Agent
- Luôn kiểm tra yêu cầu mới trong `NOTES.md` / `PRD.md` trước khi code; không tự ý thêm luật ngoài yêu cầu.
- Sau khi sửa logic: chạy typecheck, unit test và kiểm tra lại headless + tính tất định (chạy 2 lần cùng input, diff output).
- Không sửa tay output để làm giả bằng chứng; lỗi hoặc phần chưa xong phải ghi trung thực.
- Không commit `.env`, API key hay token. Giữ nguyên các file harness (`AGENTS.md`, `.agents/`) trong lịch sử git.
