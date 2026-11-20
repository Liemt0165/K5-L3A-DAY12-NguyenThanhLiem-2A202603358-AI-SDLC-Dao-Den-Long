# Changelog

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
