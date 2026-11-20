# AGENTS.md — Đảo Đèn Lồng (AI SDLC Lab - Phase 2)

## 1. Tech Stack & Kiến trúc
- **Stack:** TypeScript + Three.js (Vite) cho bản 3D; Node.js/TypeScript cho chế độ headless.
- **Tách lớp bắt buộc:** Giữ toàn bộ logic game (simulation, physics, AI, va chạm, điểm số, RNG) độc lập hoàn toàn với Three.js/DOM để chạy được ở chế độ headless (không cửa sổ, không GPU).

## 2. Ràng buộc Test Contract v1.1 (Bắt buộc)
- **Tick cố định:** `60 tick/s`. Snapshot tick `0` là trạng thái sau dựng scenario, trước khi áp dụng input. Bước `k` đọc input tick `k`, tạo trạng thái `k+1`, sự kiện ghi `tick = k+1`.
- **Thứ tự 12 bước trong 1 tick:** Input/Pause -> Giảm timers -> Di chuyển Mây/rơi -> Nhặt đom đóm/bùa -> Tương tác đèn -> Cập nhật safe_radius -> Tỏa Sáng -> Di chuyển Bóng Mực/Gió Lạc -> Chạm (Gió Lạc cướp trước, Bóng Mực hit sau) -> Sinh theo lịch -> Xét thắng/thua -> Snapshot.
- **Tọa độ & khoảng cách:** Đơn vị mét, trục Y hướng lên. Khoảng cách đo trên mặt phẳng ngang **XZ** (`<= r`). Làm tròn tọa độ 3 chữ số thập phân (`round3`).
- **Trạng thái Bóng Mực chuẩn v1.1:** `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- **Tính năng v1.1:** Lướt (Dash 14m/s, 12 ticks, cd 90 ticks), Gió Lạc (Drifter 7m/s cướp đom đóm), Bùa Gió (Charm 600 ticks chạy 7.2m/s & no-cd dash), Rơi khỏi đảo (Y < -10, mất 1 flame & motes, chờ 60 ticks rồi respawn tại 0,0,0), Pause.
- **Tính tất định:** Mọi ngẫu nhiên dùng PRNG có seed (`--seed`). Cùng seed, scenario, inputs phải ra JSONL giống hệt nhau.
- **Exit codes:** `0` khi chạy xong/kết thúc game; `2` khi `inputs` hoặc `scenario` sai định dạng; khác `0` cho lỗi khác (ghi `stderr`).
- **`game.contract.json`:** Mọi hằng số `tuning` trong code phải khớp 100% với `game.contract.json`.

## 3. Quy tắc làm việc với Agent
- Luôn kiểm tra yêu cầu mới trong `TICKET-02.md` / `NOTES.md` trước khi code.
- Sau khi sửa logic: chạy typecheck, unit test và kiểm tra lại headless + tính tất định.
- Không sửa tay output để làm giả bằng chứng; không commit `.env`, API key hay token. Giữ nguyên các file harness trong git.
