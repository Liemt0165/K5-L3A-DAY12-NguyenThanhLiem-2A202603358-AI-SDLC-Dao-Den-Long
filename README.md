# Đảo Đèn Lồng — 3 Đêm Cổ Tích (v1.0.0)

> **Video Demo:** [Đính kèm tại GitHub Release v1.0.0](https://github.com/Liemt0165/K5-L3A-DAY12-NguyenThanhLiem-2A202603358-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0)

Game 3D góc nhìn thứ ba xây dựng bằng **TypeScript + Three.js (Vite)** với lõi mô phỏng **60 tick/s tất định** tách lớp hoàn toàn cho chế độ headless, đạt chuẩn **Test Contract v1.3**.

---

## Cài đặt & Chạy nhanh (≤ 3 lệnh)

**Yêu cầu hệ thống:** Node.js `>= 20` và trình duyệt hỗ trợ WebGL (Chrome / Edge / Firefox / Safari).

```bash
git clone https://github.com/Liemt0165/K5-L3A-DAY12-NguyenThanhLiem-2A202603358-AI-SDLC-Dao-Den-Long.git && cd K5-L3A-DAY12-NguyenThanhLiem-2A202603358-AI-SDLC-Dao-Den-Long
npm install && npm run build
node dist-headless/src/headless/run.js
```

Mở trình duyệt tại `http://localhost:4173` để chơi ngay!

---

## Điều khiển & Luật chơi

| Phím mặc định | Hành động |
|---|---|
| `W / A / S / D` hoặc `Mũi tên` | Di chuyển trên đảo |
| `Space` | Nhảy (nhảy lên các tầng hoặc bục nhảy) |
| `Shift` | Lướt nhanh (14 m/s trong 0.2s, hồi chiêu 1.5s) |
| `E` / `F` | Nạp ánh sáng vào Đèn Lồng Lớn hoặc châm thêm dầu |
| `Q` | Tỏa Sáng (tiêu hao 3 đom đóm, đẩy lùi và làm choáng Bóng Mực) |
| `Esc` / `P` | Tạm dừng / Mở menu |
| `Kéo chuột` hoặc `J / L` | Xoay góc nhìn camera |

*(Toàn bộ phím đều có thể tùy chỉnh trong mục **Cài đặt → Đổi phím điều khiển**, có phát hiện trùng phím và khôi phục mặc định.)*

### Cơ chế cốt lõi (Contract v1.3)
- **Đèn cạn dầu:** Đèn đã thắp có nhiên liệu `100.0`, hao `1.0/s`. Đứng gần nhấn `E` để châm dầu (`+10` mỗi đom đóm) hoặc thắp lại đèn đã tắt (`5` đom đóm).
- **Bóng Mực hút dầu (`drain`):** Đèn có `fuel < 30` mất vùng an toàn; Bóng Mực tiến vào hút `5.0/s`. Dùng **Tỏa Sáng (`Q`)** đánh trúng Bóng Mực đang hút nhận `+15` điểm.
- **Chiến thắng:** Sống sót đến bình minh (`dawn_survived`) với ít nhất $\lceil 0.6 \times \text{tổng đèn} \rceil$ đèn đang sáng qua cả **3 Đêm** (Đảo Bến → Đảo Cau → Đảo Chuông).
- **Sức chứa túi:** `10 + 2 * số lần thắp/thắp lại thành công` (tối đa 20 đom đóm).

---

## Kiểm thử, Headless, Benchmark & Soak Test

```bash
# 1. Chạy Typecheck + Bộ test hồi quy Phase 1–4
npm test

# 2. Chạy chế độ Headless CLI (Test Contract v1.3)
node dist-headless/src/headless/cli.js --seed 42 --night 1 --ticks 3600 --out out.jsonl

# 3. Chạy Benchmark 3D (1280x720, tắt vsync, 200 Bóng Mực, 100 đom đóm)
node dist-headless/src/headless/bench.js --seed 42 --duration 30 --out bench.json

# 4. Chạy Soak test (10 Đêm liên tiếp)
node dist-headless/src/headless/soak.js --seed 7 --nights 10 --out soak.json

# 5. Xuất Bảng xếp hạng Top 10
node dist-headless/src/headless/run.js --export-leaderboard out.json
```

*(Lưu ý về VSync: `bench_cmd` khởi chạy trình duyệt với cờ `--disable-gpu-vsync --disable-frame-rate-limit` để đo FPS tối đa không bị khóa tần số quét màn hình.)*

---

## Sáng tạo của tôi

1. **Tổng hợp âm thanh 100% Web Audio API (`src/game/audio.ts`)**: Toàn bộ 10 hiệu ứng âm thanh và nhạc nền Đêm được tổng hợp trực tiếp bằng sóng sin/triangle/noise mà không cần tải file `.mp3/.wav` bên ngoài.
2. **Đồ họa Procedural & Đình Chuông 4 cột Đêm 3**: Tự dựng hình khối Mây (nón lá, khăn quàng đỏ `#C8102E`, đèn lồng nhỏ), vành khăn tầng 1 bằng `THREE.Shape` + `ExtrudeGeometry` và tháp chuông 4 cột thông thoáng.
3. **Trợ năng toàn diện (Accessibility)**: Hỗ trợ 3 chế độ mù màu (Protanopia, Deuteranopia, Tritanopia) qua SVG `<feColorMatrix>`, phụ đề trực quan + mũi tên chỉ hướng Bóng Mực vừa xuất hiện, **Giảm chuyển động** và **Chữ lớn (×1.25)**.

---

## Tài liệu dự án
- [CHANGELOG.md](CHANGELOG.md) · [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE)
- [AGENTS.md](AGENTS.md) · [docs/notes/retro.md](docs/notes/retro.md) · [docs/notes/adr-001-lantern-fuel.md](docs/notes/adr-001-lantern-fuel.md)
- Bằng chứng kiểm thử: [phase-2-proof.md](docs/proof/phase-2-proof.md) · [phase-3-proof.md](docs/proof/phase-3-proof.md) · [phase-4-proof.md](docs/proof/phase-4-proof.md)
