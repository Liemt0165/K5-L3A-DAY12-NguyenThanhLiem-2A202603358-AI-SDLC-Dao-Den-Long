# NOTES · Phân tích PRD-0 & Test Contract v1.0 (Phase 1)

> Tài liệu này được tổng hợp nguyên văn theo `PRD.md`. Không tự ý thêm luật hoặc quyết định thay các phần còn mơ hồ.

---

## 1. Yêu cầu bắt buộc của PRD-0

- **Màn chơi:** Một màn chơi **Đêm 1 – Đảo Bến**, một hòn đảo tròn có **5 Đèn Lồng Lớn** (tương ứng `L1`…`L5` trong Test Contract). Mặt đất đảo ở `Y = 0`, người chơi xuất phát tại `(0, 0, 0)`.
- **Nhân vật:** Người chơi điều khiển **Mây**, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây. Mây đội **nón lá có treo một chiếc đèn lồng nhỏ**. Nhân vật đi lại, nhảy, camera 3D.
- **Đom đóm:** Những đốm sáng (đom đóm) xuất hiện rải rác trên đảo, nhặt được; mang về để nạp ánh sáng vào các Đèn Lồng Lớn.
- **Đèn lồng:** Có **5 Đèn Lồng Lớn**; nạp ánh sáng vào đèn để thắp đèn. Đảo **sáng dần lên** khi thắp đèn. Bóng Mực **sợ những chiếc đèn**.
- **Bóng Mực:** Những sinh vật bằng mực đen sống trong sương. Chúng xuất hiện và đuổi theo Mây; bị chúng chạm vào thì **mất máu**. Bóng Mực **sợ những chiếc đèn**.
- **Tỏa sáng (pulse):** Mây có thể **tỏa sáng** để xua Bóng Mực đi, nhưng việc đó **tốn ánh sáng**.
- **Thắng / Thua:** Thắp hết đèn thì **thắng**. Mất hết máu thì **thua**. *(Test Contract cũng liệt kê `reason: "dawn"` trong sự kiện `game_over`)*.
- **Điểm số:** Có **điểm số** (cách tính điểm phải được mô tả trong `README.md` và khai báo các hệ số trong `game.contract.json`).
- **HUD:** Giao diện hiển thị thông tin cần thiết (HUD).
- **Chơi lại:** Có thể chơi lại sau khi thắng hoặc thua.
- **Phong cách hình ảnh:**
  - Game 3D, phong cách đồ họa **đơn giản nhưng đẹp**, không cần đồ họa chân thực.
  - Không khí **đêm, ấm áp, cổ tích**.
  - Đảo **sáng dần lên** khi thắp đèn.
  - Ánh sáng **vàng cam ấm** là thứ tốt; màu **tím đen** là nguy hiểm.
  - Mây đội **nón lá có treo một chiếc đèn lồng nhỏ**.
- **Các điều cấm & ràng buộc phạm vi:**
  - **Không bạo lực, không máu me.**
  - Nếu tự do sáng tạo thêm: **không phá** những gì PRD-0 và Test Contract đã yêu cầu; phần thêm **không được làm đổi đầu ra headless** theo contract (ví dụ thực thể thêm nên tắt khi chạy headless); phải nói rõ trong mục `"Sáng tạo của tôi"` ở `README.md` kèm bằng chứng ngắn phần cũ vẫn đúng.
  - Công nghệ tự do nhưng game phải chạy được trên **macOS hoặc Linux** (nếu dùng Windows phải có cách chạy trên macOS/Linux, ví dụ Docker hoặc bản web).

---

## 2. Ràng buộc của Test Contract v1.0

### 2.1. File `game.contract.json` ở gốc repo

Các trường bắt buộc:
- `contract_version`: `"1.0"`
- `team`: `"mssv-ho-ten"`
- `build_cmd`: lệnh cài đặt / biên dịch (chạy được trên macOS/Linux; Docker được phép)
- `run_cmd`: lệnh mở game có giao diện
- `headless_cmd`: lệnh chạy chế độ không giao diện (sẽ được nối thêm tham số)
- `tuning`: phải điền **đúng các số mà game đang dùng**; nếu game không có khái niệm đó, điền `null` (hoặc `false`) và giải thích trong `README.md`:
  - `player_speed`: tốc độ di chuyển của người chơi
  - `carry_capacity`: sức chứa đom đóm tối đa người chơi mang được
  - `lantern_cost`: lượng ánh sáng (đom đóm) cần để thắp một Đèn Lồng Lớn
  - `lantern_count_night1`: số Đèn Lồng Lớn ở Đêm 1 (`5`)
  - `pickup_radius`: bán kính nhặt đom đóm (m)
  - `interact_radius`: bán kính tương tác để nạp ánh sáng vào đèn (m)
  - `pulse_cost`: chi phí ánh sáng khi dùng tỏa sáng (pulse)
  - `pulse_radius`: bán kính tác dụng của tỏa sáng (m)
  - `night1_duration_s`: thời lượng Đêm 1 (giây)
  - `flames`: số máu (ngọn lửa) ban đầu của người chơi
  - `invuln_s`: thời gian miễn nhiễm va chạm sau khi bị chạm (giây)
  - `hit_drop_ratio`: tỉ lệ đom đóm đánh rơi khi bị chạm (`0` nếu không rơi)
  - `pulse_stun_s`: thời gian Bóng Mực bị choáng khi trúng pulse (giây)
  - `pulse_push_m`: khoảng cách đẩy lùi Bóng Mực khi trúng pulse (m)
  - `pulse_cooldown_s`: thời gian hồi chiêu của pulse (giây)
  - `safe_radius`: bán kính quanh đèn mà Bóng Mực không vào được (m)
  - `shade_speed`: tốc độ di chuyển của Bóng Mực
  - `shade_hit_radius`: bán kính Bóng Mực chạm gây mất máu người chơi (m)
  - `fall_enabled`: `boolean`, cho biết rơi khỏi đảo có bị phạt hay không
  - `score`: đối tượng gồm `per_mote`, `per_lantern`, `per_stun`, `per_second_left`, `per_flame_left` (điểm cho mỗi sự kiện)

### 2.2. Tham số dòng lệnh headless & mã thoát

```text
<headless_cmd> --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>]
               --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]
```

- Chạy **không cần cửa sổ, không cần GPU**, nhanh nhất có thể.
- Dừng khi chạy đủ `--ticks` hoặc khi game kết thúc (`won`/`lost`).
- **Mã thoát:**
  - `0`: thành công (chạy đủ `--ticks` hoặc game kết thúc thắng/thua).
  - Khác `0`: lỗi, ghi thông báo lỗi ra `stderr`.
  - `2`: file `inputs` hoặc `scenario` sai định dạng.

### 2.3. Mô hình tick

- Logic game chạy ở **60 tick/giây cố định** (`1 tick = 1/60 giây`).
- **Snapshot tick 0** là trạng thái **sau khi dựng scenario, trước khi áp dụng input**.
- Bước thứ `k` (`k = 0 … N−1`) đọc input của tick `k` và tạo ra trạng thái `k+1`. Sự kiện xảy ra trong bước đó ghi `tick = k+1`. `--ticks N` thực hiện **đúng N bước**.
- Công thức thời gian còn lại: `time_left_s = thời lượng Đêm − (số bước đã chạy) / 60`.

### 2.4. Quy ước vị trí và khoảng cách

- Đơn vị độ dài là **mét**; **trục Y hướng lên**; mặt đất đảo ở `Y = 0`; người chơi xuất phát tại `(0, 0, 0)`.
- **Điểm đo:**
  - `player.pos`: **chân** nhân vật.
  - `shade.pos`: **tâm** Bóng Mực.
  - `lantern.pos`: **chân cột đèn**.
  - Vị trí đom đóm: điểm trên **mặt đất** (độ cao lơ lửng chỉ là hiển thị).
- Mọi khoảng cách trong `tuning` đo giữa các điểm này trên **mặt phẳng ngang XZ**, **không** cộng thêm kích thước nhân vật.
- "Trong bán kính `r`" nghĩa là khoảng cách **≤ r**.

### 2.5. Định dạng file `inputs` và `scenario`

**File `inputs`** (`{"frames": [...]}`):
- Giá trị mặc định trước frame đầu tiên: `move: [0, 0]`, `cam_yaw_deg: 0`, mọi nút `false`.
- Mỗi frame chỉ đổi các trường có mặt trong frame đó; trường vắng mặt **giữ giá trị cũ**.
- `tick` của các frame phải tăng nghiêm ngặt (không trùng, không giảm).
- `move`: `[x, z]`, mỗi thành phần trong `[−1, 1]`. Vector dài hơn `1` phải được chuẩn hóa về độ dài `1`.
- Công thức chuyển hướng theo `cam_yaw_deg`: với `θ = cam_yaw_deg` đổi sang radian:
  - `x' = x·cosθ + z·sinθ`
  - `z' = −x·sinθ + z·cosθ`
  - (khi `θ = 0` thì `x` là `+X`, `z` là `+Z`).
- `jump`, `interact`, `pulse` (và `dash` nếu có): boolean, hành động kích hoạt khi giá trị **chuyển từ `false` sang `true`**.
- Không có file `inputs` nghĩa là người chơi đứng yên.

**File `scenario`** (dựng tình huống cho test):
- `player`: `{"pos": [...], "carried": ..., "flames": ...}`
- `random_motes: false`: không tự sinh đom đóm, chỉ có những con được liệt kê.
- `random_shades: false`: không tự sinh Bóng Mực, chỉ có những con được liệt kê (ở trạng thái hoạt động bình thường ngay lập tức).
- `lanterns`: **cập nhật theo `id`** các đèn của màn (`L1`…`L5`). Đèn không được nhắc tới giữ nguyên; có `pos` thì đổi vị trí; có thể đặt `lit: true` (hoặc `deposited`).
- `motes`, `shades`: **thay thế** danh sách ban đầu tương ứng; mảng rỗng nghĩa là không có con nào. `shades[]` có thể kèm `id` để test tham chiếu.
- Trường nào không có thì dùng mặc định của game.
- Dựng scenario **không** phát sự kiện và **không** cộng điểm (ví dụ đèn đặt sẵn `lit: true` không được cộng điểm thắp đèn).

### 2.6. Định dạng Output JSONL

Mỗi dòng là một đối tượng JSON, tọa độ làm tròn **3 chữ số thập phân**:

1. **Snapshot** (mỗi `--snapshot-every` tick, mặc định 10, bắt đầu từ tick `0`):
   - Trường: `type` (`"snapshot"`), `tick`, `sim_tick` (bằng `tick` ở Phase 1), `state` (`"playing"` | `"won"` | `"lost"`), `time_left_s`, `score`, `player` (`pos`, `flames`, `carried`), `lanterns` (`id`, `pos`, `lit`, `deposited`), `shades` (`id`, `pos`, `state` — tối thiểu phải có `"stunned"`, các trạng thái khác tự đặt tên), `motes_active`. Mảng `motes` (`id`, `pos`) được khuyến nghị ở v1.0.
2. **Event** (ghi ngay khi sự kiện xảy ra; nếu sự kiện không xảy ra trong game thì không ghi):

| `name` | `data` |
|---|---|
| `mote_picked` | `{"carried": n}` |
| `deposit` | `{"lantern_id": "L1", "amount": n, "deposited": n}` |
| `lantern_lit` | `{"lantern_id": "L1"}` |
| `pulse` | `{"stunned_ids": ["S1"]}` |
| `player_hit` | `{"by": "shade" \| "fall", "flames": n, "dropped": n}` |
| `shade_spawned` | `{"id": "S3"}` |
| `game_over` | `{"result": "won" \| "lost", "reason": "all_lit" \| "dawn" \| "no_flames"}` |

3. **End** (dòng cuối cùng và bắt buộc):
   `{"type":"end","ticks":<int>,"state":"playing"|"won"|"lost","score":<int>}`

### 2.7. Yêu cầu tất định (Deterministic)

- Cùng `--seed`, cùng `scenario` và cùng `inputs` phải cho output **giống hệt nhau** giữa hai lần chạy, kể cả các `id` tự sinh.
- Các bài nộp không cần sinh cùng chuỗi ngẫu nhiên với nhau.

---

## 3. Chỗ còn mơ hồ

> Các giá trị ở cột cuối là **đề xuất mặc định của AI** để bạn xem xét và duyệt, không phải quy định trong `PRD.md`.

| Mục | Tài liệu nói gì | Còn thiếu gì | Đề xuất giá trị mặc định (cần duyệt) |
|---|---|---|---|
| **Kích thước đảo & vị trí 5 đèn** | Một hòn đảo tròn có 5 Đèn Lồng Lớn (`L1`…`L5`); người chơi xuất phát ở `(0,0,0)` | Bán kính đảo, tọa độ mặc định của `L1`…`L5` | Bán kính đảo `35 m`; 5 đèn đặt đều trên vòng tròn bán kính `22 m` quanh gốc tọa độ |
| **Tốc độ chạy (`player_speed`) & nhảy/lướt** | Nhân vật đi lại, nhảy; contract có `player_speed` và `jump` (và `dash` nếu có) | Giá trị `player_speed` (m/s), độ cao/thời gian nhảy, có dùng `dash` không | `player_speed = 6.0` m/s; nhảy có trọng lực đơn giản (vận tốc đầu `6.5` m/s); chưa bật `dash` |
| **Sức mang đom đóm (`carry_capacity`) & nhặt (`pickup_radius`)** | Nhặt đom đóm trên đảo; contract có `carry_capacity`, `pickup_radius` | Giới hạn mang tối đa, bán kính nhặt; khi đầy túi có nhặt nữa không | `carry_capacity = 5`; `pickup_radius = 1.5` m; khi đầy túi thì không nhặt thêm |
| **Thắp đèn (`lantern_cost`, `interact_radius`)** | Nạp ánh sáng vào đèn để thắp đèn | Số đom đóm cần mỗi đèn, bán kính tương tác, bấm `interact` 1 lần nạp 1 con hay nạp hết lượng đang mang (tối đa đủ thắp) | `lantern_cost = 3`; `interact_radius = 2.5` m; mỗi lần `interact` nạp hết lượng cần thiết để đầy đèn |
| **Tỏa sáng (`pulse_*`)** | Tỏa sáng xua Bóng Mực nhưng tốn ánh sáng; contract có `pulse_cost`, `pulse_radius`, `pulse_stun_s`, `pulse_push_m`, `pulse_cooldown_s` | Giá trị từng thông số; nếu `carried < pulse_cost` có dùng được không | `pulse_cost = 1`, `pulse_radius = 6.0` m, `pulse_stun_s = 2.5` s, `pulse_push_m = 4.0` m, `pulse_cooldown_s = 3.0` s; không đủ `carried` thì không kích hoạt được |
| **Thời lượng đêm (`night1_duration_s`) & `dawn`** | Contract có `night1_duration_s`, `time_left_s`, và `game_over.reason = "dawn"` | Thời lượng đêm (giây); hết giờ (`time_left_s <= 0`) tính là `won` hay `lost` | `night1_duration_s = 300` s (5 phút); hết giờ mà chưa thắp đủ 5 đèn thì `lost` với `reason: "dawn"` |
| **Số máu (`flames`), `invuln_s`, `hit_drop_ratio`** | Bị Bóng Mực chạm thì mất máu, hết máu thì thua; `hit_drop_ratio` là tỉ lệ rơi đom đóm | Số máu ban đầu, thời gian bất tử sau va chạm, tỉ lệ rơi (làm tròn thế nào) | `flames = 3`; `invuln_s = 1.5` s; `hit_drop_ratio = 0.5` (làm tròn xuống, mất luôn hoặc rơi tại chỗ tùy thiết kế) |
| **Bóng Mực (`shade_speed`, `shade_hit_radius`, sinh quái)** | Bóng Mực xuất hiện và đuổi theo Mây | Tốc độ, bán kính va chạm, số lượng ban đầu & tần suất sinh mới khi `random_shades: true` | `shade_speed = 3.8` m/s; `shade_hit_radius = 1.0` m; khởi đầu 2 Bóng Mực, sinh thêm mỗi 25s (tối đa 5) |
| **Hành vi Bóng Mực quanh đèn (`safe_radius`)** | "Bóng Mực sợ những chiếc đèn"; `safe_radius` là bán kính quanh đèn mà Bóng Mực không vào được | `safe_radius` bao nhiêu; áp dụng cho **đèn đã thắp** hay mọi đèn; Bóng Mực gặp vùng an toàn thì dừng ở rìa hay đi vòng | `safe_radius = 5.0` m; chỉ áp dụng cho đèn **đã thắp** (`lit: true`); nếu bị đẩy/đi vào vùng `safe_radius` thì bị chặn/đẩy ra rìa |
| **Rơi khỏi đảo (`fall_enabled`)** | `fall_enabled` cho biết rơi khỏi đảo có bị phạt hay không; `player_hit.by = "fall"` | Có cho phép rơi khỏi đảo không; nếu `true` thì mất mấy máu và hồi sinh ở đâu | `fall_enabled = false` (có tường vô hình ở rìa đảo để tránh rủi ro ngoài ý muốn ở Phase 1) |
| **Cách tính điểm (`score.*`)** | Có điểm số; `score` gồm `per_mote`, `per_lantern`, `per_stun`, `per_second_left`, `per_flame_left` | Giá trị từng hệ số; `per_second_left` và `per_flame_left` cộng khi nào (chỉ khi `won` hay cả khi `lost`) | `per_mote = 10`, `per_lantern = 100`, `per_stun = 25`, `per_second_left = 2`, `per_flame_left = 50`; 2 mục bonus cuối chỉ cộng khi `won` |
| **Sinh đom đóm ngẫu nhiên (`random_motes: true`)** | Đom đóm xuất hiện rải rác trên đảo | Số lượng ban đầu trên đảo và có tự hồi lại theo thời gian không | Khởi đầu `15` đom đóm rải đều trên đảo, giữ tối thiểu `10` con trên đảo bằng cách sinh bổ sung định kỳ |
| **Nội dung HUD** | "Giao diện hiển thị thông tin cần thiết (HUD)" | Danh sách cụ thể các thông số phải hiển thị trên màn hình | Hiển thị: máu (`flames`), đom đóm đang mang (`carried`/`capacity`), số đèn đã thắp (`x/5`), thời gian còn lại, điểm số, trạng thái hồi chiêu `pulse` |

---

## 4. Danh sách bàn giao Phase 1

Nộp bằng tag git **`phase-1`** trên repo GitHub **public**:

- [ ] **Tag git `phase-1`**: gắn đúng commit hoàn thành Phase 1 và push lên remote trước mốc hết giờ Phase 1.
- [ ] **Game chơi được Đêm 1**: chơi từ đầu tới thắng/thua trên macOS hoặc Linux (nếu làm trên Windows phải có bản chạy được trên macOS/Linux như web tĩnh hoặc Docker).
- [ ] **`README.md`**: hướng dẫn cài đặt và chạy trong tối đa 3 lệnh, điều khiển, cách tính điểm, và mục `"Sáng tạo của tôi"` (nếu có sáng tạo thêm).
- [ ] **`game.contract.json`**: đặt ở gốc repo, khai báo đầy đủ `build_cmd`, `run_cmd`, `headless_cmd` và khối `tuning` khớp chính xác với thông số game đang dùng.
- [ ] **Chế độ headless**: tuân thủ Test Contract v1.0 (tham số CLI, mã thoát `0` / khác `0` / `2`, mô hình 60 tick/s, input, scenario, output JSONL, tính tất định).
- [ ] **Bằng chứng kiểm chứng**: chứng minh game chạy đúng yêu cầu và khớp với mã ở tag `phase-1` (output headless, test, ảnh/GIF nếu cần).
- [ ] **Ghi chép ngắn**: các giả định cho chỗ mơ hồ và nhật ký dùng AI (kèm ước tính token/chi phí).
- [ ] **Harness AI**: giữ nguyên trong repo và lịch sử git các file cấu hình đã dùng (`AGENTS.md` hoặc tương đương, skills, hooks…).

---

## 5. Quyết định đã chốt (Giả định chính thức)

- **Công nghệ:** TypeScript + Three.js (Vite) cho bản 3D, Node.js/TypeScript cho chế độ headless (chạy được trên macOS/Linux).
- **Kích thước đảo & vị trí 5 đèn (`L1`…`L5`):** Bán kính đảo `50 m`; 5 đèn đặt ngẫu nhiên (theo `--seed`) cách tâm khoảng `20 m` (hoặc trong vùng hợp lệ trên đảo) đảm bảo khoảng cách đôi một `>= 20 m`.
- **Nạp ánh sáng vào đèn (`interact`):** Mỗi lần kích hoạt `interact` trong bán kính `interact_radius`, nạp hết lượng đom đóm đang mang (tối đa đủ `lantern_cost` để thắp đèn).
- **Vùng an toàn quanh đèn (`safe_radius`):** Chỉ áp dụng cho đèn đã thắp (`lit: true`); Bóng Mực không thể đi vào vùng `safe_radius` quanh đèn đó nếu Mây đang ở trong vùng này.
- **Rơi khỏi đảo (`fall_enabled`):** Không cho phép rơi khỏi đảo (`fall_enabled: false`).
- **Hết thời gian đêm:** Hết `night1_duration_s = 300` s mà chưa thắp đủ 5 đèn thì xử thua (`result: "lost"`, `reason: "dawn"` theo đúng Test Contract v1.0).
- **Điểm thưởng cuối ván (`per_second_left`, `per_flame_left`):** Chỉ cộng khi thắng (`won`).
- **Bảng `tuning` đã chốt:**
  - `player_speed`: `5.0`, `carry_capacity`: `6`, `lantern_cost`: `5`, `lantern_count_night1`: `5`
  - `pickup_radius`: `1.0`, `interact_radius`: `2.0`
  - `pulse_cost`: `1`, `pulse_radius`: `6.0`, `pulse_stun_s`: `2.5`, `pulse_push_m`: `4.0`, `pulse_cooldown_s`: `3.0`
  - `night1_duration_s`: `300`, `flames`: `5`, `invuln_s`: `1.5`, `hit_drop_ratio`: `0.5`
  - `safe_radius`: `5.0`, `shade_speed`: `3.8`, `shade_hit_radius`: `1.0`, `fall_enabled`: `false`
  - `score`: `{ "per_mote": 10, "per_lantern": 100, "per_stun": 25, "per_second_left": 2, "per_flame_left": 50 }`
  - Sinh ngẫu nhiên mặc định (`random_motes: true`, `random_shades: true`): khởi đầu `15` đom đóm (duy trì tối thiểu `10`), khởi đầu `2` Bóng Mực (sinh thêm mỗi `25 s`, tối đa `5`).

---

## 6. Trạng thái & Bằng chứng Phase 1 (Ghi nhận trung thực)

| Hạng mục Phase 1 | Trạng thái | Chi tiết thực tế tại mốc `phase-1` |
|---|---|---|
| Phân tích PRD-0 & Test Contract v1.0 | **Đạt** | Đã tách yêu cầu bắt buộc, ràng buộc contract và liệt kê chỗ mơ hồ trong `NOTES.md`. |
| Chốt giả định & thông số `tuning` | **Đạt** | Đã chốt stack (`TypeScript + Three.js + Vite`), bộ số `tuning`, luật nạp đèn, `safe_radius`, `fall_enabled`, `dawn`, tính điểm. |
| Harness AI ban đầu | **Đạt** | Đã tạo `AGENTS.md` ghi quy ước kiến trúc, Test Contract và quy tắc kiểm chứng. |
| `game.contract.json` | **Đạt** | Đã tạo file khớp 100% với `DEFAULT_TUNING`, các lệnh `build_cmd`, `run_cmd`, `headless_cmd`. |
| Game 3D chơi được (Đêm 1) | **Đạt** | Đã triển khai xong bản 3D Three.js: nhân vật Mây (nón lá + đèn lồng), 5 Đèn Lồng Lớn, đom đóm, Bóng Mực, hiệu ứng pulse, HUD, camera 3D và modal chơi lại. |
| Chế độ headless & kiểm tra tất định | **Đạt** | CLI headless chuẩn Test Contract v1.0, chạy 60 tick/s, đọc `scenario` / `inputs`, xuất JSONL (snapshot tick 0, event k+1, end), bắt lỗi trả mã 2/khác 0 và kiểm tra tất định hoàn toàn trùng khớp giữa 2 lần chạy. |

---

## 7. Trạng thái & Bằng chứng Phase 2 (Contract v1.1)

| Hạng mục Phase 2 | Trạng thái | Chi tiết thực tế tại mốc `phase-2` |
|---|---|---|
| Chuỗi 3 Đêm (3 maps) | **Đạt** | Đảo Bến (5 đèn), Đảo Cau (6 đèn, dốc 2 tầng), Đảo Chuông (7 đèn, 3 tầng, bục nhảy). |
| Kỹ năng Lướt (Dash) | **Đạt** | Phím Shift/Space, tốc độ 14 m/s trong 12 ticks, cooldown 90 ticks. |
| Gió Lạc (Drifter) & Bùa Gió (Charm) | **Đạt** | Gió Lạc cướp tối đa 3 đom đóm khi chạm Mây; Bùa Gió tăng tốc 7.2 m/s & no-cd dash 600 ticks. |
| Rơi khỏi đảo & Phạt | **Đạt** | Rơi Y < -10, mất 1 flame và đom đóm đang mang, chờ 60 ticks rồi hồi sinh tại xuất phát. |
| Tạm dừng & Âm thanh Web Audio | **Đạt** | Phím Esc/P tạm dừng simulation hoàn toàn; âm thanh tổng hợp tự động Web Audio synthesizer. |

---

## 8. Trạng thái & Bằng chứng Phase 3 (Contract v1.2)

| Hạng mục Phase 3 | Trạng thái | Chi tiết thực tế tại mốc `phase-3` |
|---|---|---|
| Nhiên liệu đèn & Đèn cạn dầu | **Đạt** | Lưu số nguyên `fuelTicks` (1/60, max 6000), hao tự nhiên 1/60 mỗi tick, tắt đèn khi hết dầu, thắp lại tốn 5 đom đóm (+40đ), nạp thêm dầu khi đứng gần. |
| Bóng Mực hút nhiên liệu (`drain`) | **Đạt** | Đèn `fuel < 30` mất vùng an toàn; Bóng Mực hút 5/60 mỗi tick khi ở $\le 2\text{m}$, Mây $\le 6\text{m}$ đổi sang `chase`; Tỏa Sáng ngắt hút nhận +15đ. |
| Luật thắng mới (`dawn_survived`) | **Đạt** | Bỏ luật `all_lit`; thắng khi sống sót đến bình minh và số đèn sáng $\ge \lceil 0.6 \times \text{tổng đèn} \rceil$. |
| Sức chứa lũy tiến (`progressive capacity`) | **Đạt** | Sức chứa tăng `10 + 2 * successful_lights` (tối đa 20 đom đóm). |
| Chế độ mù màu (Accessibility) | **Đạt** | Hỗ trợ Protanopia, Deuteranopia, Tritanopia chuyển đổi trong Cài đặt thông qua SVG color matrix filter. |
| Sửa lỗi đồ họa Đêm 3 | **Đạt** | Vành khăn Tầng 1 r=12–24m ($Z > 0$), 2 dốc xoay đúng trục YXZ, tháp chuông 4 cột thông thoáng. |
| Benchmark & Tính tất định | **Đạt** | 18.000 tick headless chạy trong ~934 ms ($\le 30$s); 2 lần chạy cùng seed cho output JSONL giống nhau 100%. |

---

## 9. Trạng thái & Bằng chứng Phase 4 (Contract v1.3 / v1.0.0)

| Hạng mục Phase 4 | Trạng thái | Chi tiết thực tế tại mốc `phase-4` |
|---|---|---|
| Chế độ Benchmark 3D (`bench_cmd`) | **Đạt** | `bench.json`: `avg_fps = 145.2`, `p1_low_fps = 30.8`, `frame_ms_p95 = 9.3`, `load_ms = 237`, `peak_mem_mb = 310`, `vsync_off = true`. |
| Soak Test 10 Đêm (`soak_cmd`) | **Đạt** | `soak.json`: `nights = 10`, `crashes = 0`, `mem_start_mb = 51.8`, `mem_end_mb = 58.7` (`1.13x <= 1.2x`). |
| Bảng xếp hạng cục bộ | **Đạt** | Top 10 lưu cục bộ, nhập tên sau Bình Minh / Thua, màn hình Bảng xếp hạng, hỗ trợ `--export-leaderboard`. |
| Dễ tiếp cận (Accessibility) | **Đạt** | Đổi 9 phím + báo trùng + mặc định, phụ đề & mũi tên Bóng Mực xuất hiện, Giảm chuyển động, cỡ chữ ≥ 18px + ×1.25. |
| Đóng gói, Retro & Tài liệu | **Đạt** | `README.md`, `CHANGELOG.md` (4 phase), `CREDITS.md`, `LICENSE`, `docs/notes/retro.md`, `docs/proof/phase-4-proof.md`. |


