# ADR-001: Mô hình nhiên liệu đèn lồng & Luật thắng sinh tồn tới bình minh (Phase 3)

## Bối cảnh
Theo `TICKET-03.md`, luật cũ "thắp hết đèn là thắng ngay" khiến game kết thúc quá sớm. Mục tiêu mới chuyển sang giữ đảo sáng tới bình minh, đồng thời đèn đã thắp bị hao hụt dầu theo thời gian và có thể bị Bóng Mực hút dầu.

## Quyết định thiết kế
1. **Biểu diễn nhiên liệu bằng số nguyên (`fuelTicks`):**
   - Lưu `fuelTicks` theo đơn vị nguyên `1/60` (tối đa `6000` tương ứng `100.0` fuel) để loại bỏ hoàn toàn sai số dấu phẩy động giữa 60 tick/s.
   - Chỉ làm tròn 1 chữ số thập phân (`round1(fuelTicks / 60)`) khi xuất snapshot và sự kiện `refuel` / `fuel_drain`.
2. **Mô hình trạng thái đèn (`lit`, `fuelTicks`, `everLit`, `relitCount`):**
   - Đèn sáng giảm `1` đơn vị/tick tự nhiên và `-5` đơn vị/tick cho mỗi Bóng Mực đang ở trạng thái `drain`.
   - Khi `fuelTicks <= 0`: đèn tắt (`lit = false`, `deposited = 0`, `everLit = true`) và phát `lantern_out`. Lần thắp lại chỉ tốn `5` đom đóm (`relight_cost`) và cộng `+40` điểm.
   - Đèn đang sáng có `fuel < 100` nhận châm dầu (`used = min(carried, ceil((100 - fuel) / 10))`).
   - Đèn có `fuel < 30` (`fuelTicks < 1800`) mất vùng an toàn `6m`, cho phép Bóng Mực `wander` tiến vào `<= 2m` để chuyển sang `drain`.
3. **Luật thắng/thua tại bình minh:**
   - Bỏ điều kiện thắng sớm `all_lit`. Thắp đủ đèn không kết thúc Đêm.
   - Khi hết giờ (`time_left_s <= 0`), sau khi kiểm tra `playerFlames <= 0` (`no_flames`), nếu số đèn đang sáng `>= ceil(0.6 * totalLanterns)` thì thắng với lý do `dawn_survived` và cộng điểm thưởng từng đèn sáng (`50 + floor(fuel)`) + ngọn lửa còn lại (`50 * flames`); ngược lại thua với lý do `dawn`.

## Hệ quả với Test cũ
- Test `all_lit` ở Phase 1–2 bị thay thế bằng test `dawn_survived` (thắng khi giữ đủ `>= 60%` đèn sáng tới hết giờ) và test `no_early_win` (thắp đủ 5/5 đèn không kết thúc game).
- Thời lượng Đêm 1/2/3 giảm từ `300/330/360` xuống `240/270/300` giây và công thức điểm thay đổi hoàn toàn.
