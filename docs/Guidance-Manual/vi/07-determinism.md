# 07 · Tính tất định và tái lập kết quả

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/07-determinism.md) · Tiếng Việt

**Đọc xong bạn sẽ:** giải thích được vì sao mọi con số trong thesis đều ra giống nhau ở mọi lần chạy, kể được các luật làm điều đó, và chỉ cho người đọc cách tự kiểm tra.

Nguồn: super-plan §2, implementation-plan §2.3 và §2.4, `eval/src/rng.ts`, `.claude/rules/determinism.md`. Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md).

---

## 1. Luật chính

**Mọi con số trong thesis phải đến từ một lệnh cho cùng kết quả ở mọi lần chạy.**

Vì sao khắt khe vậy? Report pre-thesis có những con số không truy được nguồn: abstract và chương 5 nói khác nhau, và một file kết quả k6 không đến từ đúng script nó ghi. Nếu mọi con số được dựng lại bằng một lệnh và kiểm bằng một hash, chuyện đó không thể xảy ra nữa.

## 2. Hai loại kết quả

| Loại | Gồm gì | Cam kết | Cách báo cáo |
|---|---|---|---|
| **D**, giống hệt từng byte | dataset, feature, xếp hạng, metric, thống kê, dữ liệu của bảng | chạy lại cho cùng các file, tới từng byte | SHA-256 của từng file trong một manifest |
| **R**, lặp lại được | độ trễ, thông lượng (E7) | chạy lại cho con số tương tự | 5 lần chạy, bỏ lần đầu, trung vị kèm khoảng tin cậy |

Thời gian chạy phụ thuộc máy và thời điểm, nên không bao giờ giống hệt được. Thesis nói "repeatable" (lặp lại được), không bao giờ nói "identical" (giống hệt) cho loại R.

## 3. Các luật giữ cho loại D

**Không dùng đồng hồ.** `Date.now()` và `Math.random()` bị cấm trong `packages/ranking/` và `eval/`. Thời gian luôn là một tham số (`asOf`). Một test grep code để tìm chúng, và một hook của editor cảnh báo sau mỗi lần sửa.

**Một bộ sinh ngẫu nhiên có seed.** Mọi sự ngẫu nhiên đến từ master seed **20261014**:

```
rng(masterSeed, stage) = sfc32 seeded from sha256("20261014:<stage>"), first 12 outputs dropped
```

- **sfc32** là một bộ sinh nhỏ, nhanh, đã được kiểm kỹ, với 128 bit trạng thái.
- **Mỗi bước một luồng**: `users`, `follows`, `communities`, `posts`, `interactions`, `bootstrap`, `permutation`, `parity`, `shuffle`. Thêm một bước không bao giờ làm đổi số của bước khác. Tên không bao giờ được dùng lại.
- Không dùng `mulberry32` của `seed.ts`: nó chỉ có 32 bit trạng thái.

**Điểm số nguyên.** Mọi điểm là `floor(score × 100)`. Các phép cộng chạy theo thứ tự cố định. File 03 cho thấy lý do: 9,7 có thể thành 9,6999…, và bước làm tròn nguyên khiến điều đó vô hại vì lần chạy nào cũng giống nhau.

**Tie-break toàn phần.** Sắp theo `(scoreFixed desc, postId desc)`. Hai bài không bao giờ "bằng nhau", nên thứ tự không bao giờ phụ thuộc thứ tự dòng trong database hay tính ổn định của thuật toán sắp xếp.

**File canonical.** CSV, UTF-8, xuống dòng LF, có dòng tiêu đề, thứ tự cột cố định, các dòng đã sắp xếp, metric in 6 chữ số thập phân, số 0 âm (−0) in thành 0. Hai lần chạy tính ra cùng giá trị sẽ ghi ra cùng các byte.

**Môi trường được ghim.** Node v22.23.4 trong `.nvmrc`, bật `engine-strict`, image Docker ghim theo digest, `npm ci`. Phiên bản Node được ghi vào mọi manifest, vì các hàm toán như `Math.log2` có thể khác nhau giữa các engine.

**Không cache, không HTTP.** Phần evaluation đọc file trực tiếp. Nó không bao giờ đi qua Redis, bộ giới hạn request hay API, vì trạng thái của chúng có thể làm đổi kết quả.

## 4. Manifest và hash

Mỗi thư mục đầu ra có một `manifest.json`:

```
schemaVersion, datasetId or runId, source (config path + SHA-256, or zip URLs + SHA-256),
masterSeed, epoch, node, files: { name: { rows, sha256 } }
```

**SHA-256** là dấu vân tay: đổi một byte của file là hash đổi hoàn toàn. Vì vậy so hai manifest là so mọi file cùng lúc.

## 5. Các test chứng minh điều đó

| Test | Cho thấy gì |
|---|---|
| Generator chạy hai lần | sinh dữ liệu hai lần cho manifest giống hệt (P3) |
| Adapter chạy hai lần | chuyển đổi Digg hai lần cho file giống hệt (P4) |
| Golden test | một dataset nhỏ đã kiểm tay cho ra đúng file CSV đã commit (P5) |
| Leakage test | đổi mọi sự kiện sau t_u không làm đổi các dòng kết quả của u (P5) |
| Harness chạy hai lần | hai lần chạy đầy đủ cho kết quả giống hệt từng byte (P5) |
| Parity test 🔜 | app thật và harness cho cùng thứ tự (task 8) |
| `thesis:repro` 🔜 | một lệnh dựng lại mọi thứ và so mọi hash với `.docs/results/manifest.json` (task 11) |

## 6. Các giá trị frozen

Một số giá trị phải được cố định **trước** khi chạy split test, nếu không chúng có thể bị chỉnh để kết quả trông đẹp: seed, K, các bucket, lưới α và β, m, cửa sổ thời gian và giới hạn pool, cut time T, lưới của baseline, tham số synthetic. Chúng nằm trong super-plan §7. Đổi một giá trị cần config version mới và một dòng có ngày trong change log. `eval/config/frozen-v1.json` giữ các giá trị này cho code, và harness dừng lại nếu T nó tự tính khác với T frozen.

## 7. Từ một con số trong thesis truy ngược về nguồn

Kế hoạch cho phần văn bản thesis (P9): một script report biến các CSV kết quả thành macro LaTeX (`results-macros.tex`) và một file `macros.csv` ghi lại, với mỗi macro, nó đến từ file nào và dòng nào. Văn bản chỉ dùng macro, không bao giờ gõ tay con số. Vậy:

```
number in the PDF → macro name → macros.csv row → results CSV cell → manifest hash → command that made it
```

(Con số trong PDF → tên macro → dòng trong macros.csv → ô trong CSV kết quả → hash trong manifest → lệnh đã tạo ra nó.)

## 8. Reviewer kiểm tra thế nào

1. Clone, `nvm use`, `npm ci`.
2. `npm run gen -w @breadit/eval` rồi so các manifest của dataset.
3. Chạy một harness config rồi so `.docs/results/<runId>/manifest.json`.
4. Về sau: `npm run thesis:repro` làm tất cả trong một bước.

## 9. Tự kiểm tra

1. Vì sao độ trễ thuộc loại R mà không thuộc loại D?
2. Vì sao mỗi bước có luồng ngẫu nhiên riêng?
3. Không có tie-break toàn phần thì điều gì có thể sai?
4. Vì sao phiên bản Node được ghi vào manifest?
5. Vì sao các giá trị frozen phải được cố định trước khi chạy split test?
