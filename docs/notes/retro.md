# Báo cáo Retro (Phase 1 – Phase 4) — Đảo Đèn Lồng

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Mục tiêu chính | Kết quả | Điểm mạnh | Điểm cần rút kinh nghiệm |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** (`phase-1`) | Lõi game Đêm 1, Three.js 3D, Headless CLI, Test Contract v1.0 | **Đạt** | Kiến trúc tách lớp `core/` vs `game/` ngay từ đầu giúp headless chạy cực nhanh (~150ms). | Chưa có bộ test tự động cho tất cả edge case va chạm ngay từ đầu. |
| **Phase 2** (`phase-2`) | 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), Lướt, Gió Lạc, Bùa Gió, Âm thanh, HUD | **Đạt** | Chuỗi 3 Đêm hoàn chỉnh, Web Audio synthesizer không phụ thuộc file âm thanh ngoài. | AI ban đầu dựng sai hướng cung tròn tầng 1 Đêm 3 và thứ tự Euler dốc dẫn. |
| **Phase 3** (`phase-3`) | Đèn cạn dầu (`fuelTicks`), `drain`, `dawn_survived`, Sức chứa +2, Mù màu | **Đạt** | Giải quyết triệt để sai số dấu phẩy động bằng đơn vị nguyên `1/60` (`fuelTicks`). | Cần rà soát kỹ các test cũ khi luật thắng thay đổi (`all_lit` → `dawn_survived`). |
| **Phase 4** (`phase-4`, `v1.0.0`) | Benchmark 3D, Soak test, Leaderboard cục bộ, Accessibility, Đóng gói | **Đạt** | Benchmark tự động mở trình duyệt, đo FPS/P1-low/P95; Soak test 10 Đêm 0 crash. | Trên Windows sandbox chặn ghi `.git/`, cần chạy lệnh git ở terminal ngoài. |

---

## 2. Điều gì hiệu quả và không hiệu quả khi làm việc với AI

### Hiệu quả
- **Tách lớp kiến trúc rõ ràng trong `AGENTS.md`**: Nhờ quy tắc tách biệt `src/core/` (thuần TypeScript, 0 DOM/Three.js) khỏi `src/game/`, mọi logic game mới thêm vào đều được kiểm chứng bằng `node --test` và CLI headless trong chưa đầy 1 giây.
- **Lập Test Contract & ADR trước khi code**: Ghi rõ hợp đồng `game.contract.json` và `adr-001-lantern-fuel.md` giúp AI không tự suy diễn công thức nhiên liệu hay điều kiện thắng.
- **Skill kiểm thử lặp lại (`verify-phase2`, `verify-phase3`, `verify-phase4`)**: Gói gọn chuỗi `build:headless` → `test` → `build:web` → `soak` giúp phát hiện ngay lỗi TypeScript strict hoặc regression.

### Không hiệu quả
- **Dán khối yêu cầu dài nhưng thiếu kiểm tra trực quan**: Ở Đêm 3 (Đảo Chuông), AI tự viết `CylinderGeometry` với góc mặc định khiến nửa vành khăn nằm bên `+X` thay vì `+Z`, và tháp chuông đặc che mất nhân vật. Phải chạy thực tế trên trình duyệt mới phát hiện và sửa bằng `THREE.Shape` + `ExtrudeGeometry` và đình chuông 4 cột.
- **Lệnh chuỗi `&&` trên PowerShell**: AI đôi khi sinh lệnh bash `&&` gây lỗi cú pháp trên Windows PowerShell nếu không nhắc rõ dùng `;`.

---

## 3. Những lần AI sai và cách phát hiện

1. **Sai hình học tầng 1 & dốc Đêm 3**:
   - *Phát hiện*: Kiểm tra trực quan trên web 3D thấy tầng 1 là nửa đĩa đặc thay vì vành khăn, và dốc bị xoay lệch.
   - *Khắc phục*: Dùng `THREE.Shape` với `absarc` và `holes` để đục rỗng lõi `r = 12m`, đặt `rotation.order = 'YXZ'` cho 2 dốc.
2. **Mây rơi xuyên tầng 2 xuống tầng 0**:
   - *Phát hiện*: Test thực tế trên Đêm 3 khi nhảy từ tầng 2 xuống tầng 1 (`Y = 3`).
   - *Khắc phục*: Bỏ điều kiện giới hạn `playerPos[1] >= groundY - 1.5`, cho phép đáp xuống bất kỳ mặt sàn hợp lệ nào khi `playerPos[1] <= groundY`.
3. **Bóng Mực `wander` đứng yên ở rìa đảo**:
   - *Phát hiện*: Khi chạy scenario headless Phase 3, Bóng Mực sinh ở `r = 37m` không tiến vào đèn `fuel < 30`.
   - *Khắc phục*: Bổ sung logic tuần tra hướng về đèn yếu hoặc đèn chưa thắp gần nhất ở trạng thái `wander`.

---

## 4. Harness AI giúp ích nhiều nhất
- **`AGENTS.md`**: Là file hiệu quả nhất — đóng vai trò "bộ nhớ dài hạn" cho mọi quy tắc Contract v1.0 → v1.3, quy ước tọa độ XZ, đơn vị nguyên `fuelTicks`, và lệnh kiểm chứng.
- **Skills (`.agents/skills/verify-phase*`)**: Giúp chuẩn hóa quy trình nghiệm thu mỗi phase mà không cần nhắc lại từng lệnh.

---

## 5. Ước tính Token / Chi phí AI & Cách tiết kiệm
- **Tổng token ước tính qua 4 phase**: ~350K–450K tokens (tương đương ~$0.40–$0.80 với các model Flash/Medium).
- **Cách tiết kiệm token**:
  - Giữ `AGENTS.md` ngắn gọn (~25–30 dòng), chỉ ghi thông tin cố định.
  - Dùng `rg` / `Select-String` định vị dòng trước khi đọc file (`read_file` với `StartLine`/`EndLine`) thay vì đọc toàn bộ file lớn.
  - Gộp nhiều chỉnh sửa độc lập trong cùng một lượt gọi công cụ.

---

## 6. Nếu làm lại sẽ thay đổi gì?
- Viết sẵn **visual regression test** (chụp screenshot tự động các góc camera chuẩn của từng map Đêm 1/2/3) ngay từ Phase 2 để bắt lỗi hình học 3D tức thì.
- Tách `src/game/main.ts` thành các module nhỏ hơn (`terrain.ts`, `hud.ts`, `settings.ts`) ngay từ đầu để dễ bảo trì và giảm kích thước context khi AI đọc file.
