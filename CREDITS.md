# CREDITS — Đảo Đèn Lồng

Tất cả nhân vật, bối cảnh, mô hình 3D, hiệu ứng hình ảnh và âm thanh trong dự án là **tác phẩm gốc** được tạo lập trực tiếp cho bài Lab (không sử dụng asset có bản quyền từ game/phim khác).

## Thư viện & Công cụ mã nguồn mở
- **Three.js** (`^0.170.0`) — MIT License — Engine render WebGL 3D.
- **Vite** (`^6.0.5`) — MIT License — Build tool và dev server.
- **TypeScript** (`^5.7.2`) — Apache-2.0 License — Ngôn ngữ lập trình và kiểm tra kiểu tĩnh.
- **Node.js** (`>= 20`) — MIT License — Môi trường chạy headless simulation, benchmark và soak test.

## Mô hình 3D & Hình ảnh
- Toàn bộ hình khối 3D (Mây với nón lá và khăn đỏ, Đèn Lồng Lớn, Đom Đóm, Bóng Mực, Gió Lạc, Bùa Gió, Đảo Bến / Đảo Cau / Đảo Chuông, Tháp Chuông) được dựng **procedural bằng Three.js Geometry & StandardMaterial** trong `src/game/main.ts`.
- Bộ lọc màu hỗ trợ người khiếm thị màu sắc (Protanopia, Deuteranopia, Tritanopia) sử dụng SVG `<feColorMatrix>` chuẩn W3C trong `index.html`.

## Âm thanh
- Toàn bộ hiệu ứng âm thanh (nhặt đom đóm, thắp đèn, lướt, tỏa sáng, bị đánh, nhảy, Bóng Mực xuất hiện, đếm ngược 10s, thắng, thua) và nhạc nền Đêm được tổng hợp trực tiếp theo thời gian thực qua **Web Audio API Synthesizer** trong `src/game/audio.ts`.

## Công cụ AI hỗ trợ phát triển
- **Antigravity AI Agent** (Google Deepmind) — hỗ trợ phân tích yêu cầu, viết mã TypeScript/Three.js, kiểm thử headless và lập tài liệu SDLC qua 4 phase.
