# Ghi chú & Đặc tả nghiệm thu Phase 2 (Ticket-02)

## 1. Chuẩn hóa thông số Test Contract v1.1
- Toàn bộ hằng số trong `game.contract.json` được cập nhật đồng bộ với Phần 1 của `TICKET-02.md`:
  - `player_speed`: `6.0` m/s
  - `dash_speed`: `14.0` m/s, `dash_duration_s`: `0.2` s (`12` ticks), `dash_cooldown_s`: `1.5` s (`90` ticks)
  - `carry_capacity`: `10`
  - `lantern_cost`: `10`, `safe_radius`: `6.0` m (đẩy bóng trong vùng khi vừa thắp trong ≤ 30 tick)
  - `pulse_cost`: `3`, `pulse_radius`: `5.0` m, `pulse_cooldown_s`: `3.0` s, choáng `120` ticks, đẩy lùi `4` m trong `15` tick đầu
  - `flames`: `3`
  - `night1_duration_s`: `300`, `night2_duration_s`: `330`, `night3_duration_s`: `360`
  - `fall_enabled`: `true` (rơi `Y < -10`: mất 1 flame, mất hết đom đóm, chờ 60 ticks rồi hồi sinh tại `(0,0,0)` với 90 ticks bất tử)

## 2. Tiêu chí nghiệm thu (Acceptance Criteria) cho từng mục Phần 3

1. **Lướt (Dash):**
   - Kích hoạt khi `dash` chuyển `false -> true` và `dash_cd_ticks == 0` (hoặc có Bùa Gió).
   - Vận tốc `14 m/s` duy trì `12` ticks (`2.8 m`), giữ nguyên cao độ khi lướt trên không, không bất tử; hồi chiêu `90` ticks.
2. **Gió Lạc (Drifter — Đêm 2 & 3):**
   - Tối đa 2 con, sinh tại tick `1200, 2400, ...`, ID `D1, D2, ...`.
   - Trạng thái `idle` (2 m/s) → `chase` (7 m/s) khi Mây mang `>= 5` đom đóm và cách `<= 15 m`.
   - Chạm (`XZ <= 1.2 m`): cướp `min(3, carried)` đom đóm, phát `drifter_steal`, chuyển `flee` `240` ticks rồi `removed`.
   - Trúng Tỏa Sáng khi `chase` → chuyển `flee`; trúng khi `flee` có đồ → thả lại toàn bộ đom đóm rơi tại chỗ (`drifter_drop`), biến mất sau `120` ticks.
3. **Bùa Gió (Charm):**
   - Vị trí Đêm 2: `(35,0,0)`; Đêm 3: `(30,0,25)` và `(-30,0,25)`.
   - Nhặt phát `charm_picked`: hiệu lực `600` ticks (tốc độ chạy `7.2 m/s`, Lướt không hồi chiêu); hồi lại sau `2700` ticks.
4. **Chuỗi 3 Đêm:**
   - Hoàn thành Đêm 1 (Đảo Bến) → chuyển tiếp sang Đêm 2 (Đảo Cau) → Đêm 3 (Đảo Chuông).
   - Thắng Đêm 3 hiển thị màn hình Bình Minh với tổng điểm; thua cho phép chơi lại Đêm hiện tại.
5. **Tạm dừng (`Esc` / `P`):**
   - Chuyển đổi giữa `playing` và `paused`; khi tạm dừng, `sim_tick`, thời gian, hồi chiêu, spawn và TTL đứng yên, snapshot ghi `state: "paused"`.
   - Modal tạm dừng có nút Tiếp tục, Chơi lại, Cài đặt, Đổi Đêm.
6. **Cài đặt:**
   - Thanh chỉnh âm lượng và độ nhạy chuột hoạt động ngay và được lưu qua `localStorage` giữa các lần mở game.
7. **Âm thanh:**
   - Có nhạc nền đêm và hiệu ứng âm thanh cho: nhặt đom đóm, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 giây cuối.
8. **HUD đầy đủ:**
   - Ngọn Lửa (trên trái), đồng hồ `mm:ss` (trên giữa, đổi đỏ + nhấp nháy khi `<= 30 s`), đèn `k/n` & điểm (trên phải), thanh đom đóm 10 ô (dưới giữa), hồi chiêu Lướt & Tỏa Sáng (dưới phải), nhắc `"Nhấn E để nạp ánh sáng (x/10)"` khi gần đèn, mũi tên chỉ tới đèn chưa sáng gần nhất khi nằm ngoài màn hình.
9. **Bảng màu chuẩn & Ánh sáng môi trường:**
   - Sử dụng đúng mã màu hex quy định (trời `#0E1430`, cỏ `#2F5D50`, cát `#C9B48A`, gỗ `#6B4A2F`, biển mây `#12384A`, đèn `#FFB347`/`#5B5F6E`, đom đóm `#FFF6C2`/`#FFE58A`, Bóng Mực `#120A1A`/`#7A3CFF`/`#3A3450`, Mây `#E8E2D0`/`#C8102E`, Gió Lạc `#8FA3B8`, UI `#FF5A5F`/`#F5F1E6`).
   - Cường độ ánh sáng môi trường tăng theo tiến độ: `0.15 + 0.55 × (đèn sáng / tổng đèn)`.
10. **Rơi khỏi đảo (`Y < -10`):**
    - Mất 1 Ngọn Lửa, mất toàn bộ đom đóm đang mang, phát `player_hit` (`by: "fall", lost: true`), chờ `60` ticks rồi hồi sinh tại `(0,0,0)` với `90` ticks bất tử.
