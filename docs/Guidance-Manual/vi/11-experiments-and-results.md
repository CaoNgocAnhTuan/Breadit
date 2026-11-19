# 11 · Các thí nghiệm và ý nghĩa kết quả

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/11-experiments-and-results.md) · Tiếng Việt

**Đọc xong bạn sẽ:** nói được mỗi thí nghiệm hỏi câu gì và run nào trả lời nó; đọc được mọi cột của một file kết quả và của một bảng trong report; nêu được các con số chính và ý nghĩa của chúng; theo được một con số từ thứ hạng của một user tới macro trong thesis; và nói được thesis được phép kết luận gì, không được kết luận gì. Đây là kiến thức nền của Chương 5 và Chương 6 của thesis.

Nguồn: super-plan P7 (bảng thí nghiệm và trạng thái), `.docs/results/p7-report/results.md` (mọi bảng), các thư mục run trong `.docs/results/`, implementation-plan §2.7 (các file kết quả) và §3.3–§3.5 (Holm family, cách đọc H1, H0 gate), và ghi chú P7 gửi thầy (`.docs/works/2026-11-11-p7-offline-experiments/results-note.md`). Một con số được tạo ra thế nào: [05](05-evaluation-protocol.md). Khi nào một mức cải thiện là thật: [06](06-statistics.md). Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md).

**Trạng thái.** Các con số được chép từ `results.md` ngày 2026-11-19, sau task `p9-report-macros`. Ở đây chúng được gõ ra để bạn đọc; thesis không bao giờ gõ tay mà dùng macro. Nếu một run thay đổi, `results.md` đúng và file này được sửa theo.

---

## 1. Tổng quan các thí nghiệm

| ID | Câu hỏi | Dữ liệu | So sánh cái gì | Thư mục run |
|---|---|---|---|---|
| Tuning | α và β (và tham số duy nhất của mỗi baseline được tune) nào tốt nhất? | chỉ các item validation | các điểm của grid | `p7-tune-main`, `p7-tune-worlds` |
| H0 gate | Các follow term có thắng khi follow là ngẫu nhiên không? | `syn-W0-M` | H-follow với BL2 | `p7-h0` |
| E1 | Mọi phương pháp so với nhau ra sao? | `syn-W2M-M`, `digg2009` | chín phương pháp | `p7-main` |
| E2 | Hybrid có giúp user ít lịch sử không? (RQ1, H1) | hai dataset trên | H với BL2, theo nhóm lịch sử | `p7-main` |
| E3 | Gain có tăng theo mật độ social không? (RQ2, H2) | ba ô W2, `digg2009` | H với BL2, theo số followee | `p7-main`, `p7-e5-worlds` |
| E4 | Term nào quan trọng? | `syn-W2M-M`, `digg2009` | các ablation và prior strength `m` | `p7-e4-terms`, `p7-e4-m0`, `p7-e4-m2`, `p7-e4-m10` |
| E5 | Kết quả có bị "cài sẵn" trong dữ liệu không? | năm world và một bản bị xáo | H với BL2 trong từng world | `p7-e5-worlds`, `p7-e5-shuffle`, `p7-h0` |
| E6 | Hoà điểm có làm đổi kết quả không? | hai dataset chính | tie-break đảo ngược | `p7-e6-ties` |
| E7 | Feed mới tốn bao nhiêu? (Class R) | `syn-W2M-M` nạp vào Postgres | `chrono`, `engagement`, `social` trong app live | `p7-e7` |
| E8 | Kích thước pool có làm đổi kết quả không? | `syn-W2M-M` | H, BL2 và BL6 với pool lớn hơn | `p7-e8-pool` |

Thứ tự được cố định từ trước: tune trên các item validation, freeze các lựa chọn thành mười test config, chờ tác giả duyệt, rồi chạy test split **một lần**. E7 chạy sau đó trên backend live. `p7-report` biến tất cả thành macro và bảng.

## 2. Cách đọc một file kết quả

Mỗi thư mục run có một `manifest.json` (config, phiên bản Node, SHA-256 của từng file) và các file CSV của implementation-plan §2.7. Hai file bạn sẽ đọc nhiều nhất:

**`summary.csv`**: mỗi dòng là một phương pháp, một K và một nhóm lịch sử.

```
dataset,split,method,k,bucket,n_users,recall,ndcg
```
`n_users` là số user test trong nhóm sau khi đã bỏ các user bị loại (left out). `recall` và `ndcg` là trung bình trên các user đó.

**`compare.csv`**: mỗi dòng là một phép so sánh. Một dòng thật của `p7-main`:

```
dataset,family,method,ref,k,bucket,n,mean_diff,ci_low,ci_high,p_raw,p_holm
syn-W2M-M,F1,H,BL2,10,0-4,174,0.023061,-0.002358,0.051290,0.097190,0.680332
```

| Ô | Nghĩa |
|---|---|
| `F1` | family xác nhận (H − BL2 cho mỗi K và nhóm); `F2` là H so với các baseline khác; `none` không có p-value |
| `H`, `BL2`, `10`, `0-4` | H so với BL2, NDCG@10, user có 0–4 interaction trước đó |
| `174` | số user trong phép so sánh |
| `0.023061` | **gain**: trung bình trên các user của (NDCG của H − NDCG của BL2) |
| `-0.002358`, `0.051290` | khoảng paired bootstrap 95% của gain |
| `0.097190` | p-value của paired randomization test, khi đứng một mình |
| `0.680332` | cùng p đó sau khi hiệu chỉnh Holm trong family |

Các file khác: `coverage.csv` (Coverage@K của mỗi phương pháp), `leftout.csv` (số user test và số user bị loại theo nhóm), `density.csv` (gain theo nhóm số followee, cho E3) và `tuning.csv` (mỗi dòng là một điểm grid, `chosen` = 1 là điểm được chọn).

**Bảng và macro trong report** hiện 3 chữ số thập phân. Macro có tên kết thúc bằng `Full` giữ đủ 6 chữ số (ví dụ dòng Digg bên dưới). Giá trị tuning được in đúng như viết (`1024/1024`).

## 3. Trước khi chạy test split

**Tuning.** Mỗi phương pháp được tune lấy giá trị grid có NDCG@10 validation cao nhất; nếu hoà thì lấy giá trị nhỏ hơn (super-plan §5). Các lựa chọn:

| Dataset | H (α/β) | BL2t (age weight) | BL4 (divisor, giây) | BL5 (gravity) | BL6 (α) |
|---|---|---|---|---|---|
| `syn-W2M-M` | 1024/1024 | 0.125 | 720000 | 0.6 | 16 |
| `digg2009` | 1024/0 | 4 | 45000 | 1.5 | 1024 |

Ý nghĩa:
- **H chọn đỉnh của grid** trên `syn-W2M-M`. Giá trị tốt nhất có thể còn lớn hơn. Nhưng đường cong ở đó rất phẳng: NDCG@10 validation là 0.048086 ở 512/512 và 0.048342 ở 1024/1024. Đây là một giới hạn cần nêu, không phải lỗi.
- **Trên Digg, β = 0** chỉ vì Digg không có community: mọi β cho cùng một điểm, và khi hoà thì lấy giá trị nhỏ hơn.
- **BL2t trên Digg chọn age weight lớn nhất (4).** Dữ liệu cần time decay mạnh hơn nhiều so với bản production (0.25 mỗi giờ). Hãy nhớ điều này khi đọc E1.

**Hai thay đổi, chỉ dựa trên kết quả validation** (change log 0.25 của super-plan):
- **H0 gate chuyển sang H-follow.** Trên W0, H đầy đủ thắng BL2 ở validation, gần như chỉ nhờ community term. Trong generator, một community là một topic, nên term đó mang sở thích topic ngay cả khi không có influence. H-follow chỉ có các follow term, mà follow trong W0 là ngẫu nhiên, nên đó là phép thử null sạch.
- **Các grid được mở rộng**, vì các lựa chọn nằm ở mép: grid α và β từ đỉnh 16 lên 1,024, và mỗi grid baseline vượt qua mép của nó (super-plan §7).

## 4. H0 gate

**Kết quả:** trên W0, H-follow − BL2 = 0.001, khoảng −0.004 đến 0.006. **Gate pass.**

**Ý nghĩa:** khi follow là ngẫu nhiên, các follow term không mang lại gain. Vậy các feature follow không làm lộ đáp án, và các kết quả khác dùng được. (Leakage cũng được test trực tiếp ở P5: đổi mọi sự kiện sau thời điểm test của một user thì các dòng của user đó không đổi.)

## 5. E1: mọi phương pháp

NDCG@10, tất cả user (bảng e1):

| Phương pháp | `syn-W2M-M` | `digg2009` |
|---|---|---|
| BL0 (For You production) | 0.005 | 0.026 |
| BL2 (Explore production) | 0.009 | 0.024 |
| BL2t (BL2, age weight đã tune) | 0.011 | 0.027 |
| BL4 (Reddit hot) | 0.009 | **0.197** |
| BL5 (Hacker News) | 0.009 | **0.199** |
| BL6 (đếm follow đơn thuần) | 0.011 | 0.025 |
| H (hybrid) | **0.054** | 0.024 |

**Ý nghĩa:**
- **Synthetic:** H gấp khoảng sáu lần BL2 và cao hơn hẳn mọi baseline. Dữ liệu có influence và community theo topic, và H dùng cả hai.
- **Digg:** H bằng BL2, còn hai công thức "hot" tốt hơn khoảng tám lần. Mọi story của Digg đều là story trang nhất với rất nhiều vote; điều dự đoán được vote tiếp theo là story còn mới tới đâu. BL4 và BL5 chia cho một luỹ thừa của tuổi bài; BL2 chỉ trừ đi một term tuổi tuyến tính nhỏ.
- **Coverage@10:** trên `syn-W2M-M`, H phủ ít bài khác nhau hơn BL2 (0.210 so với 0.250); trên Digg cả hai là 0.144. Một điểm cá nhân hoá tập trung vào những gì mỗi user đã thích.

**Vì sao mọi giá trị đều nhỏ.** Mỗi user có một bài test, và phương pháp xếp hạng toàn bộ pool (tối đa 2,000 bài). NDCG@10 bằng 0 trừ khi bài đó nằm trong top 10. Hãy so các phương pháp với nhau, đừng bao giờ so với NDCG của các bài báo lấy mẫu 100 negative (tài liệu 05).

## 6. E2: user ít lịch sử (H1)

H1 chỉ pass trên một dataset nếu, ở dòng F1 cho NDCG@10 và nhóm 0–4, **cả hai** điều sau đều đúng: p Holm dưới 0.05 **và** đầu dưới của khoảng lớn hơn 0 (implementation-plan §3.4).

| Dataset | Nhóm | User | BL2 | H | Gain | Khoảng 95% | p (Holm) |
|---|---|---|---|---|---|---|---|
| `syn-W2M-M` | 0–4 | 174 | 0.012 | 0.035 | 0.023 | −0.002 đến 0.051 | 0.680 |
| `syn-W2M-M` | 5–19 | 177 | 0.013 | 0.043 | 0.031 | 0.003 đến 0.059 | 0.378 |
| `syn-W2M-M` | 20+ | 190 | 0.003 | 0.082 | 0.078 | 0.048 đến 0.112 | 0.002 |
| `digg2009` | 0–4 | 20,644 | 0.029 | 0.029 | 0.000117 | 0.000015 đến 0.000225 | 0.335 |

**Synthetic:** khoảng chứa 0 và p cao, nên **H1 fail**. Gain dương, nhưng với 174 user thì không phân biệt được nó với 0.

**Digg:** khoảng nằm trên 0, nhưng p Holm là 0.335, nên **H1 fail** ở điều kiện p. Hai bài học:
- **Holm có thể biến một p nhỏ thành p lớn.** p thô là 0.030. Holm sắp xếp 15 p-value của family; p này đứng thứ 5 từ nhỏ lên, nên bị nhân với 15 − 5 + 1 = 11: 0.030497 × 11 = 0.335. Trên `syn-W2M-M`, p thô 0.097190 đứng thứ 9 và bị nhân với 7: 0.680. (Tài liệu 06 giải thích Holm.)
- **Có ý nghĩa thống kê không có nghĩa là lớn.** Kể cả nếu gain trên Digg là "thật", nó chỉ khoảng 0.0001 NDCG: không user nào nhận ra (tài liệu 06, effect size).

**Điều bất ngờ:** trên `syn-W2M-M`, gain **tăng theo lịch sử**: 0.023 cho 0–4, 0.031 cho 5–19, 0.078 cho 20+. Dòng 20+ là dòng F1 duy nhất ở K = 10 mà cả hai điều kiện đều đúng. Khi lịch sử ít, smoothing cho mọi followee và community cùng một trọng số, nên điểm chưa thể cá nhân hoá; khi lịch sử nhiều hơn, các con số đếm thay thế prior (Chương 6).

## 7. E3: mật độ social (H2)

Gain của H so với BL2 theo số followee tại thời điểm test (bảng e3; dữ liệu hình `fig-e3-density.csv`):

| Followee | W2 thấp | W2 vừa | W2 cao | Digg |
|---|---|---|---|---|
| 0 | 0.032 | 0.044 | 0.076 | 0.000 |
| 5–19 | 0.051 | 0.056 | 0.079 | 0.000 |
| 20+ | 0.020 | 0.030 | 0.071 | 0.000 |

(Nhóm 1–4 chỉ có một user trong mỗi world synthetic, nên không đọc.)

**Ý nghĩa:** H2 nói gain tăng theo mật độ và gần bằng 0 với user không follow ai. Cả hai đều không đúng: gain đã có ngay ở 0 followee, vì community term không cần follow, và nó không tăng khi có nhiều followee hơn. **H2 không được ủng hộ.** Thí nghiệm này chỉ đo mật độ bằng số followee; H2 còn nêu lượng tương tác của bạn bè trong pool, phần này không được đo.

## 8. E4: term nào quan trọng

Gain so với BL2, tất cả user, `syn-W2M-M` (bảng e4):

| Biến thể | Gain |
|---|---|
| H (mọi term, `m` = 5) | 0.045 |
| H-comm (chỉ community term, α = 0) | 0.043 |
| H-follow (chỉ follow term, β = 0) | 0.007 |
| H bỏ author term | 0.046 |
| H bỏ engager term | 0.042 |
| `m` = 0, 2, 10 | 0.047, 0.051, 0.041 |

Trên `digg2009` mọi biến thể đều có gain 0.000 (không có dòng H-comm: không có community).

**Ý nghĩa:** gần như toàn bộ gain đến từ community term. Các follow term đóng góp ít, và author term không cần thiết trên các dữ liệu này. `m` = 2 tốt hơn một chút so với giá trị đã freeze là 5, nhưng `m` được cố định trước test split nên vẫn giữ (tune `m` là việc cho tương lai).

## 9. E5: kết quả có bị "cài sẵn" trong dữ liệu không?

| Run | Gain | Khoảng 95% |
|---|---|---|
| W0 (không influence, không homophily), tune riêng | 0.012 | 0.000 đến 0.024 |
| W1 (chỉ homophily) | 0.029 | 0.017 đến 0.041 |
| W2 influence thấp / vừa / cao | 0.035 / 0.045 / 0.076 | đều trên 0 |
| H0 gate: H-follow trên W0 | 0.001 | −0.004 đến 0.006 |
| H trên W0 với các giá trị của `syn-W2M-M` (tín hiệu topic) | 0.011 | −0.001 đến 0.023 |
| `syn-W2M-M` với thời điểm tương tác bị xáo trong mỗi bài | 0.042 | 0.026 đến 0.059 |

**Ý nghĩa:**
- **Gain tăng theo influence**, nên khi dữ liệu có influence thì H bắt được nó.
- **W0 và W1 vẫn có gain** dù không có influence. Nó đến từ tín hiệu topic của community term: user vẫn tiếp tục thích những topic họ đã thích. Đó là dự đoán, không phải influence.
- **Xáo thời điểm tương tác vẫn giữ phần lớn gain** (0.042 trên 0.045). Vậy gain không phụ thuộc vào việc ai tương tác trước. Điều này nghiêng về correlation (cùng sở thích) hơn là influence (làm theo người mình follow). Tách hai thứ này là một bài toán khó đã được biết (tài liệu tham khảo [23] trong super-plan §10).

## 10. E6 và E8: độ vững

- **E6, hoà điểm.** Với tie-break đảo ngược, NDCG@10 thay đổi nhiều nhất 0.001 (BL4: 0.009 → 0.008 trên `syn-W2M-M` và 0.197 → 0.196 trên `digg2009`; BL5 trên `syn-W2M-M`: 0.009 → 0.010; mọi giá trị khác bằng nhau ở 3 chữ số thập phân). Hoà điểm không làm đổi kết luận nào.
- **E8, pool lớn hơn** (14 ngày, 4,000 bài thay vì 7 ngày, 2,000 bài). Trên `syn-W2M-M`: H 0.054 → 0.048, BL2 0.009 → 0.008, BL6 0.011 → 0.010. Mọi phương pháp giảm nhẹ (nhiều bài cạnh tranh hơn), và thứ tự giữa chúng không đổi.

## 11. E7: chi phí của ba feed

E7 đo backend live, nên nó là **Class R**: lặp lại được, không giống hệt (tài liệu 07). Cách chạy đã được freeze (super-plan §7): một máy, một virtual user, 100 request mỗi run (trang 1 cho mỗi cặp trong 100 cặp parity), năm vòng bỏ vòng đầu, tắt page cache. Một run chỉ được tính nếu không có request nào lỗi, và không request nào lỗi.

| `algo` | Median trang 1 (ms) | Khoảng 95% | p95 (ms) | Số query Prisma mỗi request |
|---|---|---|---|---|
| `chrono` | 35.851 | 35.615 đến 36.005 | 40.011 | 19.65 (17 đến 21) |
| `engagement` | 35.879 | 34.634 đến 36.289 | 40.447 | 19.63 (17 đến 21) |
| `social` | 35.836 | 34.906 đến 36.102 | 39.766 | 19.70 (17 đến 21) |

**Ý nghĩa:** các khoảng chồng lên nhau, nên trên cách chạy này ba feed tốn như nhau. Điểm social thêm rất ít so với việc nạp pool. Các con số này so sánh các feed trên một máy cho một user; chúng không phải tốc độ của app khi chịu tải.

## 12. Một con số từ đầu đến cuối

🔜 Sẽ viết khi lần chạy `thesis:repro` đầy đủ ngày 2026-11-19 dựng lại xong `p7-main` (cần file `eval/results/p7-main/per_user.csv`, bị git-ignore). Mục này sẽ theo một user thật của `syn-W2M-M` từ bài test, qua thứ hạng của bài đó dưới BL2 và H và hai giá trị NDCG, tới trung bình trên 174 user, khoảng tin cậy, p-value, Holm, và macro `\eTwoWTwoMNdcgTenZeroFourGain`.

## 13. Thesis được phép kết luận gì, và không được kết luận gì

**Được kết luận:**
- Trên dữ liệu synthetic có influence, hybrid xếp hạng tốt hơn hẳn điểm Explore production trên tất cả user, chủ yếu nhờ lịch sử của user trong các community, và gain tăng theo độ mạnh của influence.
- Protocol không bị leak (H0 gate, leakage test), và mọi con số offline được dựng lại giống từng byte bằng một lệnh (tài liệu 07).
- Feed `social` trong app chạy đúng code đã được đánh giá (parity test) và tốn như các feed khác.

**Không được kết luận:**
- Rằng hybrid giúp user ít lịch sử (H1 fail trên cả hai dataset).
- Rằng follow graph giúp trên dữ liệu thật (Digg: gần 0), hay rằng community term hoạt động trên dữ liệu thật (không có dữ liệu thật nào có thời điểm tham gia community).
- Rằng NDCG cao hơn nghĩa là user hài lòng hơn: đánh giá là offline, mỗi user một bài test.

**Vì vậy feed mặc định giữ nguyên.** Luật được đặt trước test split: "For You" chỉ chuyển sang `social` nếu H1 pass trên cả hai test và H0 gate pass (super-plan P7). H1 fail, nên `FEED_DEFAULT_ALGO` để trống, và `social` là một lựa chọn.

## 14. Tự kiểm tra

1. Thư mục run và file nào chứa các con số của H1, và ở dòng nào?
2. Đọc dòng `syn-W2M-M,F1,H,BL2,10,0-4,174,0.023061,-0.002358,0.051290,0.097190,0.680332`: mỗi ô là gì?
3. Trên Digg, khoảng của gain H1 nằm trên 0. Vì sao H1 vẫn fail?
4. Vì sao một p thô 0.030 có thể thành 0.335 sau Holm?
5. Trên `syn-W2M-M`, user nào được lợi nhiều nhất từ H, và vì sao điều đó ngược với điều RQ1 mong đợi?
6. Vì sao gain trên W0 không có nghĩa là có bug, còn gain của H-follow trên W0 thì có?
7. Phép xáo thời điểm trong E5 cho bạn biết điều gì?
8. Vì sao các baseline "hot" trên Digg mạnh như vậy, và age weight đã tune của BL2t cho bạn biết điều gì?
9. E7 có nói được Breadit nhanh tới mức nào khi có 1,000 user cùng lúc không? Vì sao không?
