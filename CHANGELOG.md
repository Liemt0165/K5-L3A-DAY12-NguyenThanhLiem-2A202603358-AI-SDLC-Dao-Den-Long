# Changelog

## [v1.0.0] - Phase 4: "Bình minh: phát hành v1.0.0" (Contract v1.3)

### Added
- **Chế độ Benchmark (`bench_cmd`)**: Mở cửa sổ 1280×720, tắt vsync (`--disable-gpu-vsync`), tải Đêm 1 với 200 Bóng Mực (`wander`), 100 đom đóm, L1–L3 sáng, camera quay vòng 30m/15s, khởi động 3s và đo `--duration` giây, xuất `bench.json` chuẩn Contract v1.3 (`avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`).
- **Soak test (`soak_cmd`)**: Chạy headless 10 Đêm liên tiếp theo seed với input ngẫu nhiên, theo dõi `mem_start_mb` → `mem_end_mb` và `crashes`, xuất `soak.json`.
- **Bảng xếp hạng cục bộ**: Lưu top 10 (`name`, `score`, `nights_won`, `achieved_at` ISO 8601 có múi giờ, `seed`), giao diện xem từ Menu chính và nhập tên sau màn hình Bình Minh / Thua, hỗ trợ `--export-leaderboard out.json`.
- **Dễ tiếp cận (Accessibility)**:
  - Đổi phím điều khiển cho toàn bộ 9 hành động, cảnh báo trùng phím, khôi phục mặc định.
  - Phụ đề & chỉ báo hình ảnh cho Bóng Mực xuất hiện (kèm mũi tên mép màn hình), gió sắp thổi, 10s cuối, đèn `< 30` nhiên liệu.
  - Tùy chọn **Giảm chuyển động** (tắt rung camera và chớp màn hình) và **Chữ lớn (×1.25)**, cỡ chữ tối thiểu 18px ở 1280×720.
- **Đóng gói & Tài liệu**: Hoàn thiện `README.md`, `LICENSE`, `CREDITS.md`, `docs/notes/retro.md`, `docs/proof/phase-4-proof.md`.

---

## [v1.2.0] - Phase 3: "Đèn cạn dầu" (Breaking Changes)

### Breaking Changes (Thay đổi phá vỡ tương thích so với v1.1)
- **Test Contract nâng lên `1.2`:**
  - `game.contract.json` bổ sung: `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`.
  - Thời lượng Đêm 1 / 2 / 3 đổi từ `300 / 330 / 360 s` thành `240 / 270 / 300 s`.
- **Luật thắng thay đổi:**
  - Bỏ thắng sớm `all_lit`. Thắp đủ đèn không kết thúc Đêm.
  - Thắng mới (`reason: "dawn_survived"`): sống sót hết giờ và có ít nhất `ceil(0.6 * tổng đèn)` đèn đang sáng (3/5, 4/6, 5/7).
- **Nhiên liệu đèn & châm dầu:**
  - Đèn đã thắp có `fuel = 100`, hao `1.0/s`. Khi `fuel <= 0` đèn tắt (`lantern_out`), thắp lại tốn `5` đom đóm (`ever_lit = true`).
  - Cho phép châm dầu đèn đang sáng chưa đầy (`refuel`).
- **Bóng Mực hút dầu (`drain`):**
  - Đèn sáng có `fuel < 30` mất vùng an toàn; Bóng Mực `wander` có thể vào `<= 2m` để chuyển `drain` (hút `5/s`, phát `fuel_drain` mỗi 60 tick).
- **Công thức điểm mới:**
  - Nạp đom đóm vào đèn: `+5` mỗi con (thay vì `+10` khi nhặt).
  - Thắp lần đầu: `+100`; Thắp lại: `+40`.
  - Pulse trúng Bóng Mực: `+5` (hoặc `+15` nếu đang `drain`).
  - Thưởng bình minh (chỉ khi thắng): `+50 + floor(fuel)` mỗi đèn sáng, `+50` mỗi Ngọn Lửa còn lại. Bỏ thưởng `per_second_left`.
- **Snapshot & Event v1.2:**
  - Snapshot `lanterns[]` thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity` (tăng `+2` mỗi lần thắp, tối đa `20`).
  - Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight: boolean`.

### Added
- Chế độ màu dễ phân biệt (Colorblind mode) trong Cài đặt (`localStorage`) + phân biệt hình dạng không cần màu cho đèn tắt và đèn sắp hết dầu.

---

## [v1.1.0] - Phase 2: "Ba Đêm trên Đảo" (Contract v1.1)

### Added
- **Chuỗi 3 Đêm**: Đêm 1 (Đảo Bến, 5 đèn), Đêm 2 (Đảo Cau 2 đảo + cầu tre + 2 bục nhảy, 6 đèn), Đêm 3 (Đảo Chuông 3 tầng + 2 dốc + bục nhảy + gió mạnh, 7 đèn).
- **Kỹ năng Lướt (Dash)** (`Shift`, 14 m/s trong 12 ticks, hồi chiêu 90 ticks) & **Bùa Gió** (tốc chạy 7.2 m/s, Lướt không hồi chiêu trong 600 ticks).
- **Gió Lạc (Drifter)**: Dải lụa xám xanh bay 7 m/s cướp tối đa 3 đom đóm, bị Tỏa Sáng đánh rơi lại đồ.
- **Tạm dừng (`Esc`/`P`)**, **Âm thanh Web Audio Synthesizer**, và **HUD 10 ô đom đóm + mũi tên chỉ đèn**.

---

## [v1.0.0-alpha] - Phase 1: "Ánh sáng đầu tiên" (Contract v1.0)

### Added
- Lõi mô phỏng tách lớp hoàn toàn khỏi Three.js/DOM (`src/core/`), chạy 60 tick/s tất định với `SeededRng`.
- Bản 3D Three.js Đêm 1: nhân vật Mây (nón lá, khăn đỏ, đèn nhỏ), 5 Đèn Lồng Lớn, đom đóm, Bóng Mực, kỹ năng Tỏa Sáng (`Q`).
- Chế độ Headless CLI (`src/headless/cli.ts`) đọc `scenario` & `inputs`, xuất JSONL chuẩn Test Contract v1.0.
