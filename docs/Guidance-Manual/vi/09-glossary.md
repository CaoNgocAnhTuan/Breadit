# 09 · Bảng thuật ngữ

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/09-glossary.md) · Tiếng Việt

Mọi thuật ngữ và ký hiệu dùng trong thesis, gom về một chỗ. Mỗi mục có một hai câu giải thích và chỗ đọc thêm. Các giá trị ghi "frozen" lấy từ super-plan §7 và không bao giờ đổi nếu không có một dòng trong change log.

Thuật ngữ chuyên ngành được giữ nguyên tiếng Anh, vì thesis và hội đồng dùng đúng các từ đó.

---

## A. Nghiên cứu

| Thuật ngữ | Nghĩa |
|---|---|
| **Direction A** (Hướng A) | Hướng đi đã thống nhất với thầy: feed "For You" hybrid có dùng social graph (`.docs/Thesis_Orientation.md`). |
| **Gap 1** | Feed "For You" thời pre-thesis không được cá nhân hoá bằng gì ngoài danh sách người bạn follow; nó chỉ xếp mới nhất trước. Thesis bắt đầu từ đây. |
| **RQ1** | Thêm tín hiệu social graph (follow trust, community affinity) có làm "For You" tốt hơn heuristic hiện tại không, nhất là với user có ít lịch sử? |
| **RQ2** | Mức độ tương tác xã hội ảnh hưởng thế nào tới chất lượng xếp hạng? Từ mức nào thì tín hiệu social bắt đầu có ích? |
| **H0** (kiểm tra tỉnh táo) | Trong thế giới null W0, hybrid **không được** thắng BL2. Nếu thắng thì có bug hoặc leak. Đây là một cổng chặn: kiểm tra đầu tiên. |
| **H1** | Với user có 0–4 tương tác trước đó, H có NDCG@10 cao hơn BL2. Kiểm định hai lần: trên `syn-W2M-M` và trên `digg2009`. |
| **H2** | Mức cải thiện của H so với BL2 tăng theo mật độ social, và gần bằng 0 với user không follow ai và không ở community nào. |
| **Co-primary tests** (hai kiểm định chính) | Hai kiểm định H1 (synthetic và Digg). Mỗi cái có luật pass riêng và được báo cáo riêng. |
| **Cold-start user** | User có ít hoặc chưa có lịch sử. Trong thesis này: history bucket 0–4. |
| **Default feed rule** (luật đổi feed mặc định) | Sau P7, "For You" chỉ chuyển sang `social` nếu H1 pass trên cả hai kiểm định chính **và** H0 pass. Nếu không thì giữ như hiện tại. |

## B. Xếp hạng

| Thuật ngữ | Nghĩa |
|---|---|
| **Candidate pool** | Tập bài viết mà một phương pháp được phép xếp hạng cho một user tại một thời điểm. Tạo bởi `buildPool`, cùng một hàm cho app và cho evaluation. |
| **Window W** | Một bài chỉ vào pool nếu được tạo trong khoảng W trước thời điểm t. Frozen: 7 ngày. |
| **Pool cap N_max** | Pool chỉ giữ tối đa N_max bài mới nhất. Frozen: 2.000. |
| **Larger pool (W_L, N_L)** | 14 ngày và 4.000 bài. Chỉ dùng trong thí nghiệm E8. Frozen. |
| **Positive** | Một lượt like, comment hoặc repost. Đây là loại phản hồi duy nhất được dùng. Unlike và unfollow không được mô hình hoá. |
| **Implicit feedback** | Phản hồi user đưa ra bằng hành động (like), không phải bằng chấm điểm. Positive là implicit feedback. |
| **Engagement** | `likes + 2·comments + 3·reposts − 0.25·ageHours`, đếm tại thời điểm t. Chính là điểm Explore của production. |
| **Trust** | Hành vi trước đây của u hướng về followee f nhiều tới đâu: `(n_uf + m/|F_u|) / (N_u + m)`. Xem file 03. |
| **Community affinity** | Cùng ý tưởng đó cho một community c: `(c_u,c + m·[là thành viên]/|M_u|) / (N_u + m)`. |
| **Social term** | Trust của tác giả bài (nếu u follow họ) cộng trust của mọi followee đã tương tác với bài trước t. |
| **Author term / engager term** | Hai phần của social term. Hai ablation H-noauthor và H-noengager tắt từng phần. |
| **α (alpha)** | Trọng số của social term, tính bằng điểm engagement. Tune trên lưới 0, 1, 2, 4, 8, 16 (lưới frozen). |
| **β (beta)** | Trọng số của community term. Cùng lưới. |
| **m** (prior strength) | Prior có giá trị bằng bao nhiêu tương tác "giả định". Frozen bằng 5; E4 thử thêm 0, 2, 5, 10. |
| **m-estimate smoothing** | Trộn một tỉ lệ quan sát được với một prior: `(count + m·prior) / (total + m)`. Tránh phép chia 0/0 cho user mới (Cestnik 1990). |
| **Prior** | Điều ta giả định khi chưa thấy lịch sử nào: trust chia đều cho các followee và các community. |
| **scoreFixed** | Điểm số nguyên `floor(score × 100)`. Mọi phương pháp đều trả về số này. |
| **Tie-break** | Các bài cùng điểm được xếp theo `postId` giảm dần. Nhờ vậy thứ tự là toàn phần: không bao giờ phụ thuộc thứ tự dòng trong database. |
| **Ablation** | Một phiên bản của H có một phần bị tắt, để xem phần đó đóng góp gì (H-follow, H-comm, H-noauthor, H-noengager). |

## C. Các phương pháp

| Id | Nghĩa |
|---|---|
| **BL0** | "For You" của production: bài của followee trước, mới nhất trước, sau đó tới các bài còn lại. |
| **BL1** | Mới nhất trước. |
| **BL2** | Điểm Explore của production (= engagement). **Phương pháp tham chiếu của H1.** |
| **BL2t** | BL2 với trọng số tuổi bài được tune (lưới 0,0625 … 1, production là 0,25). |
| **BL3** | Độ phổ biến toàn cục: nhiều like nhất trước. |
| **BL4** | Công thức "hot" của Reddit, like coi như upvote. Tune hệ số chia thời gian (bản công bố là 45.000 s). |
| **BL5** | Công thức xếp hạng của Hacker News. Tune gravity (bản công bố là 1,8). Baseline mạnh nhất trong bảng P5. |
| **BL6** | Engagement + α × (số followee có liên quan tới bài). Tức là hybrid nhưng không có trọng số trust. |
| **H** | Hybrid: engagement + α·social + β·community. |
| **H-follow / H-comm** | H chỉ có social term / chỉ có community term. |
| **H-noauthor / H-noengager** | H bỏ phần author / bỏ phần engager của social term. |
| **`algo`** | Tham số API dự kiến của feed thật: `chrono`, `engagement`, `social` (task 8). |

## D. Đánh giá

| Thuật ngữ | Nghĩa |
|---|---|
| **Offline evaluation** | Đo chất lượng xếp hạng trên dữ liệu đã ghi lại, bằng cách tua lại quá khứ, không cần user thật. |
| **asOf** | Thời điểm mà một lần xếp hạng được tính cho. Mọi feature chỉ dùng các sự kiện trước thời điểm đó. |
| **As-of rule** | Một sự kiện nhìn thấy được tại asOf nếu `t < asOf.t`, hoặc `t = asOf.t` và event id nhỏ hơn. Follow và membership cần `t < asOf.t`. |
| **Leakage** (rò rỉ) | Dùng thông tin từ sau thời điểm test. Làm kết quả trông tốt hơn thực tế. Được chặn bằng as-of rule và kiểm bằng leakage test. |
| **Cut time T** | Một mốc thời gian chung cho cả dataset. Item validation ở tại hoặc trước T, item test ở sau T. T là thời điểm của sự kiện thứ `ceil(q·n)` trong n positive, với q = 0,8 (frozen). |
| **Test item** | Positive cuối cùng của user sau T, trên một bài họ chưa từng tương tác. Mỗi user một item. |
| **Validation item** | Giống vậy nhưng là cái cuối cùng tại hoặc trước T. Chỉ dùng để tune. |
| **t_u** | Thời điểm của item được giữ lại (held-out) của user u. Mọi feature của u được tính tại t_u. |
| **History** | Số positive của u trước t_u. |
| **History bucket** | 0, 1–4, 5–19, 20+ (frozen). "0–4" là hợp của 0 và 1–4. |
| **Kept / left out** | User được giữ (kept) nếu bài held-out nằm trong pool của họ. Nếu không thì bị loại (left out) và được đếm trong `leftout.csv`. |
| **Full ranking** | Phương pháp xếp hạng toàn bộ pool. Không lấy mẫu negative (metric trên mẫu có thể đổi phương pháp thắng). |
| **Rank r** | Vị trí của bài held-out trong pool đã xếp hạng, bắt đầu từ 1. |
| **K** | Độ dài danh sách để tính metric: 5, 10, 20 (frozen). |
| **Recall@K = HitRate@K** | 1 nếu r ≤ K, ngược lại 0. Hai cái bằng nhau vì mỗi user chỉ có một item. |
| **NDCG@K** | `1 / log2(r + 1)` nếu r ≤ K, ngược lại 0. Thưởng nhiều hơn cho vị trí cao. Metric chính: NDCG@10. |
| **Coverage@K** | Số bài khác nhau xuất hiện trong mọi top-K ÷ số bài khác nhau trong mọi pool. Cho thấy phương pháp đưa ra nhiều bài hay chỉ vài bài giống nhau. |
| **Tuning** | Chọn tham số (α, β, tham số của baseline) chỉ trên item validation, theo NDCG@10, hoà thì chọn giá trị nhỏ hơn. Sau đó frozen. |
| **Golden test** | Một dataset nhỏ đã kiểm tay phải cho ra đúng file CSV đã commit. |
| **Leakage test** | Sửa hoặc xoá mọi sự kiện sau t_u: các dòng kết quả của u không được thay đổi. |
| **Double-run test** | Hai lần chạy đầy đủ phải cho ra file giống hệt nhau từng byte. |
| **Parity test** | Endpoint thật và harness phải cho cùng thứ tự với 100 cặp (user, asOf) lấy mẫu (task 8). |

## E. Thống kê

| Thuật ngữ | Nghĩa |
|---|---|
| **Paired difference** (hiệu theo cặp) | Với mỗi user: NDCG của H trừ NDCG của phương pháp tham chiếu. Ghép cặp giúp loại bỏ khác biệt giữa các user. |
| **Paired bootstrap** | Lấy mẫu lại các user có hoàn lại 10.000 lần, mỗi lần tính hiệu trung bình. Khoảng 95% ở giữa là khoảng tin cậy (CI). |
| **Randomization test** | Với mỗi user, đổi chỗ ngẫu nhiên điểm của hai phương pháp (đổi dấu hiệu số), 10.000 lần. p hai phía = (1 + số lần xáo có \|trung bình\| ≥ \|trung bình thật\|) / 10.001. |
| **p-value** | Hiệu quan sát được sẽ đáng ngạc nhiên tới đâu nếu hai phương pháp thật ra như nhau. |
| **Multiple comparisons** (so sánh bội) | Chạy nhiều kiểm định thì sẽ có vài cái trông có ý nghĩa chỉ do may mắn. |
| **Holm correction** | Cách điều chỉnh p-value từng bước khi có nhiều kiểm định, vẫn đúng khi các kiểm định chồng lên nhau (Holm 1979). Mức 0,05. |
| **Family F1** | Nhóm xác nhận: H − BL2, cho mỗi K và các nhóm 0, 1–4, 0–4, 5–19, 20+. 15 kiểm định mỗi dataset. |
| **Family F2** | Nhóm phụ: H − từng baseline khác, cho mỗi K và các nhóm 0–4, 5–19, 20+, all. 84 kiểm định mỗi dataset. |
| **H1 verdict** (kết luận H1) | Trên dòng F1 với NDCG@10, nhóm 0–4: p sau Holm < 0,05 **và** đầu dưới của CI > 0. |
| **H0 gate** | Trên `syn-W0-M`, CI của H − BL2 (NDCG@10, mọi user) không được nằm hẳn trên 0. |
| **Common random numbers** | Mỗi phép so sánh khởi động lại luồng ngẫu nhiên của nó, nên mọi phép so sánh dùng cùng các mẫu lấy lại. |

## F. Dữ liệu

| Thuật ngữ | Nghĩa |
|---|---|
| **Synthetic generator** | Code có seed, tạo dữ liệu mạng xã hội giả nhưng giống thật qua 5 bước: users, follows, communities, posts, interactions. |
| **World W0** | Thế giới null: tương tác chỉ phụ thuộc sở thích; follow không có ảnh hưởng. |
| **World W1** | Latent homophily: người có sở thích giống nhau follow nhau, nhưng vẫn không có ảnh hưởng. |
| **World W2 (L, M, H)** | Dải ảnh hưởng: ảnh hưởng xã hội thấp, vừa, cao. W2M (vừa) là ô chính cho H1. |
| **Homophily** | "Ngưu tầm ngưu, mã tầm mã": người giống nhau kết nối với nhau. Nó làm follow và like tương quan với nhau dù không có ảnh hưởng. |
| **Influence** (ảnh hưởng) | Hành động của followee làm bạn dễ hành động theo hơn. Đây là điều social term muốn khai thác. |
| **Size S / M** | S: 200 user, 4.000 bài. M: 1.000 user, 20.000 bài (frozen). |
| **Dataset id** | `syn-<world>-<size>` (ví dụ `syn-W2M-M`) hoặc `digg2009`. |
| **Digg 2009** | Dữ liệu thật từ trang tin Digg, tháng 6/2009: 3.553 bài lên trang nhất, 3.007.345 vote, 1.729.983 liên kết follow có ngày. Vote được dùng như like. Không có community. |
| **Calibration** (hiệu chỉnh) | Đặt tham số generator để dữ liệu synthetic khớp số liệu của Digg (độ lệch hoạt động, số followee mỗi user, số vote mỗi user). |
| **Canonical dataset** | Định dạng CSV duy nhất mà mọi nguồn được chuyển về: 6 bảng, đã sắp xếp, id và giây là số nguyên, kèm manifest. |
| **Manifest** | `manifest.json`: nguồn, seed, phiên bản Node và SHA-256 của từng file. |

## G. Tái lập kết quả

| Thuật ngữ | Nghĩa |
|---|---|
| **Determinism** (tính tất định) | Cùng đầu vào thì cùng đầu ra, mọi lúc, mọi lần chạy. |
| **Class D** | Kết quả phải giống hệt từng byte: dữ liệu, xếp hạng, metric, thống kê. |
| **Class R** | Kết quả chỉ cần lặp lại được: độ trễ và thông lượng. Báo cáo bằng trung vị kèm CI. |
| **Master seed** | 20261014 (frozen). Mọi sự ngẫu nhiên đều đến từ seed này. |
| **Stage stream** | `rng(masterSeed, stage)`: một luồng ngẫu nhiên riêng cho mỗi bước (`users`, `bootstrap`, …), nên thêm một bước không làm đổi bước khác. |
| **sfc32** | Bộ sinh số ngẫu nhiên nhỏ và nhanh được dùng. Seed được lấy từ SHA-256. |
| **SHA-256** | Dấu vân tay của một file. Đổi một byte là hash đổi. |
| **Frozen value** | Giá trị được cố định trước khi chạy split test (super-plan §7). Muốn đổi cần config version mới và một dòng change log. |
| **`thesis:repro`** | Lệnh dự kiến (task 11) dựng lại mọi dataset và kết quả rồi so sánh mọi hash. |
