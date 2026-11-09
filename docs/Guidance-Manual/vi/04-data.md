# 04 · Dữ liệu

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/04-data.md) · Tiếng Việt

**Đọc xong bạn sẽ:** giải thích được vì sao thesis dùng hai nguồn dữ liệu, generator synthetic tạo dữ liệu thế nào, vì sao có thế giới null, Digg 2009 được chọn và chuyển đổi ra sao, và mỗi nguồn kiểm được gì, không kiểm được gì.

Nguồn: super-plan P3, P4, §7, §8; `.docs/datasets.md`; `eval/config/synthetic-v1.json`; `eval/src/generator/`, `eval/src/adapters/`. Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md).

---

## 1. Vì sao cần hai nguồn?

Database Breadit đang chạy không dùng được: không có user thật, unlike và unfollow là xoá cứng (mất lịch sử), `seed.ts` không tất định, và dữ liệu demo `humans_v1` có 0 like và 0 follow.

Nên thesis dùng hai nguồn **ngang hàng** (co-primary) cho RQ1:

| | Dữ liệu synthetic | Digg 2009 |
|---|---|---|
| Là gì | generator có seed, 5 thế giới, 2 kích cỡ | vote và follow thật từ một trang tin, tháng 6/2009 |
| Điểm mạnh | ta điều khiển được hiệu ứng social: có thể có thế giới null và dải ảnh hưởng; có community | không ai đặt hiệu ứng social: bằng chứng từ bên ngoài |
| Điểm yếu | người đọc có thể nói "kết quả đã được cài sẵn" | nhỏ, cũ, không có community, chỉ bài lên trang nhất |
| Dùng cho | H0, H1 kiểm định 1, dải H2, community term, ablation | H1 kiểm định 2, follow term và author term, H2 dạng quan hệ |

Mỗi nguồn bù cho điểm yếu của nguồn kia. Orientation cũng cho phép dùng dữ liệu mô phỏng khi chưa có user thật.

## 2. Định dạng canonical

Mọi nguồn được chuyển về cùng sáu bảng CSV (implementation-plan §2.2), nên harness không bao giờ biết dữ liệu đến từ đâu:

| File | Các cột |
|---|---|
| `users.csv` | `user_id, joined_at` |
| `follows.csv` | `follower_id, followee_id, created_at` |
| `communities.csv` | `community_id, created_at` |
| `memberships.csv` | `user_id, community_id, joined_at` |
| `posts.csv` | `post_id, author_id, community_id, created_at` |
| `interactions.csv` | `event_id, user_id, post_id, type, created_at` (`type` = like, comment, repost) |

Quy tắc: UTF-8, xuống dòng LF, các dòng đã sắp xếp, id là số nguyên, thời gian là số giây nguyên, không trùng lặp, chỉ có thêm vào (không có unlike hay unfollow). Một file `manifest.json` ghi nguồn, seed, phiên bản Node và SHA-256 của từng file. Dữ liệu nằm ở `eval/data/<datasetId>/` (git bỏ qua, dựng lại bằng một lệnh).

**Nạp vào Postgres.** App đang chạy không đọc được file CSV. Vì vậy `npm run load -w @breadit/eval -- <datasetId>` ghi một dataset synthetic vào schema Postgres riêng `eval_load` (không bao giờ là `public`) và giữ nguyên id: user id thành `u0000000042`, like và comment giữ `event_id` của chúng, còn repost thành một dòng post có `rePostId`. `npm run load:check` đọc các dòng ra lại, ghi lại sáu file CSV và kiểm tra SHA-256 của chúng bằng với manifest. Parity test (task 8) và cost benchmark E7 chạy app trên schema này. Tùy chọn `--rebase-to`, chỉ dùng cho demo, dời mọi thời điểm đi cùng một khoảng để sự kiện cuối rơi vào một ngày cho trước; các thí nghiệm không bao giờ dùng nó.

## 3. Generator synthetic

Năm bước, mỗi bước có luồng ngẫu nhiên riêng từ master seed 20261014 (file 07):

1. **Users.** Mỗi user có một chủ đề chính ẩn (20 chủ đề) và một mức hoạt động. Mức hoạt động lệch rất mạnh, giống trang thật: tỉ lệ user có 1, 2–4, 5–19 và 20+ hành động được chép từ Digg (27,8%, 25,62%, 26,86%, 19,72%). 20% user tham gia muộn, trong khoảng thời gian hoạt động: đó là user mới thật sự.
2. **Follows.** 51,19% user có danh sách follow, trung bình khoảng 19,4 followee. Một followee được rút với trọng số `popularity × (1 − h + h × similarity)`, trong đó h là **homophily** của thế giới. Một nửa số liên kết được follow lại (hai chiều).
3. **Communities.** Mỗi chủ đề một community. 30% user không tham gia community nào; số còn lại tham gia 1 tới 4. Membership theo cùng luật homophily như follow: ngẫu nhiên trong W0, theo sở thích trong W1 và W2.
4. **Posts.** Tác giả được rút theo trọng số đăng bài; chủ đề của bài thường là chủ đề chính của tác giả (70%), còn lại là ngẫu nhiên. 30% bài được đăng vào một community mà tác giả là thành viên lúc đó, và khi đó lấy chủ đề của community.
5. **Interactions.** Mỗi hành động, theo thứ tự thời gian, chọn một bài trong 7 ngày gần nhất với trọng số:

```
weight(u, p, t) = interest(u, topic p) · fresh(p, t) · (1 + π·n_p) · (1 + g_s·S(u, p, t)) · (1 + g_c·[member])
fresh(p, t)     = 1 / (1 + ageHours / 24)
S(u, p, t)      = [u follows author(p)] + number of followees of u who acted on p before t
```

`interest` là mức chủ đề hợp với user, `fresh` ưu tiên bài mới, `(1 + π·n_p)` ưu tiên bài phổ biến, `g_s` là **ảnh hưởng social** và `g_c` là **ảnh hưởng community**. Loại hành động là like (75%), comment (15%) hoặc repost (10%).

**Quan trọng:** generator không bao giờ xếp hạng một feed. Tương tác không bao giờ phụ thuộc vào phương pháp đang được kiểm, nên không có vòng phản hồi (một cách xếp hạng tự tạo ra dữ liệu huấn luyện cho chính nó).

## 4. Năm thế giới

| Thế giới | Homophily h | Ảnh hưởng social g_s | Ảnh hưởng community g_c | Ý nghĩa |
|---|---|---|---|---|
| W0 | 0 | 0 | 0 | **thế giới null**: follow ngẫu nhiên so với sở thích và không có tác dụng |
| W1 | 0,7 | 0 | 0 | người giống nhau follow nhau, nhưng không có ảnh hưởng |
| W2L | 0,7 | 0,5 | 0,5 | ảnh hưởng thấp |
| W2M | 0,7 | 2 | 2 | ảnh hưởng vừa: **thế giới của kiểm định H1 số 1** |
| W2H | 0,7 | 8 | 8 | ảnh hưởng cao |

**Có hoạt động không?** Bước kiểm của P3 đo **social lift**: user dễ hành động trên một bài mà followee đã "cho họ thấy" hơn bao nhiêu lần so với ngẫu nhiên. Ở cỡ M: W0 1,09, W1 1,57, W2L 2,24, W2M 3,78, W2H 7,64. W0 gần 1 (không có hiệu ứng), W1 cao hơn (chỉ homophily thôi cũng khiến bạn bè đồng ý với nhau), và các ô W2 tăng theo mức ảnh hưởng. Đúng như thiết kế.

**Vì sao W0 quan trọng nhất.** Nếu H thắng BL2 trong W0, nó không thể đang dùng một hiệu ứng social thật, vì ở đó không có hiệu ứng nào. Chắc chắn là bug hoặc leak (cổng H0).

## 5. Kích cỡ và dataset id

S: 200 user, 4.000 bài. M: 1.000 user, 20.000 bài. Tám dataset synthetic: cả năm thế giới ở cỡ M, và W0, W1, W2M ở cỡ S (các bộ S dùng cho bảng baseline đầu tiên). Id: `syn-<world>-<size>`, ví dụ `syn-W2M-M`.

## 6. Hiệu chỉnh: chosen và calibrated

Mỗi tham số generator trong `synthetic-v1.json` được đánh dấu:
- **calibrated:** đặt để khớp một con số của Digg (tỉ lệ hoạt động, trung bình 21,65 hành động mỗi user, số followee, tỉ lệ có danh sách follow);
- **chosen:** do ta tự chọn, kèm lý do viết ngay bên cạnh (số chủ đề, homophily, các mức ảnh hưởng, cửa sổ thời gian).

Trên `syn-W2M-M`, mọi giá trị calibrated đều nằm trong dung sai so với mục tiêu của Digg. File config được frozen kèm SHA-256 (super-plan §7).

## 7. Digg 2009: được chọn thế nào

Các luật được viết **trước** khi xem các ứng viên (`.docs/datasets.md` §2), nên việc chọn không thể bị bẻ theo ứng viên mình thích. Hai luật quyết định:
1. một **đồ thị follow có hướng, có ngày**, trên cùng đồng hồ với tương tác;
2. **hành động tích cực có ngày** trên các item mà tác giả là một user trong cùng đồ thị.

Digg pass cả hai; Flickr, Epinions/Ciao và các bộ Weibo chỉ "partial" hoặc "fail". Host gốc đã chết, nên hai file zip lấy từ bản lưu của Internet Archive ngày 2013-08-26. Chúng có mật khẩu (trang dataset ghi mật khẩu), và điều khoản ghi "research purposes only" và yêu cầu trích dẫn Hogg và Lerman (2012). Các file zip không nằm trong git; chỉ có SHA-256 của chúng.

## 8. Digg 2009: được chuyển đổi thế nào

`npm run adapt:digg` đọc các file zip trong bộ nhớ (bộ đọc ZipCrypto tự viết, không giải nén ra đĩa) rồi ghi các file canonical. Các lựa chọn:
- một vote là một **like**;
- **tác giả của một bài là người vote đầu tiên** (trang dataset nói vote đầu tiên là của người gửi bài);
- vote lặp lại của cùng (người vote, bài) giữ lần sớm nhất (bỏ 7.299 dòng);
- liên kết có ngày 0 (không rõ, 1.670) và liên kết tự follow mình (5) bị bỏ;
- giữ nguyên id gốc của Digg.

Kết quả: 336.047 user, 3.553 bài, 3.007.345 like, 1.729.983 follow có ngày. Hai lần chạy cho cùng các file.

Một follow chỉ được tính cho một lần test nếu ngày của nó trước thời điểm test đó, nên không có follow nào về sau rò vào quá khứ.

## 9. Mỗi nguồn kiểm được gì

| | Synthetic | Digg |
|---|---|---|
| Follow term | có | có |
| Author term | có | có |
| Community term | có | **không** (không có community) |
| H0 (thế giới null) | có (W0) | không (không ai tắt được hiệu ứng) |
| H1 | có (kiểm định 1) | có (kiểm định 2) |
| H2 | có, dạng nhân quả (mức ảnh hưởng được đặt) | có, chỉ dạng quan hệ |

## 10. Các giới hạn cần nêu trong thesis

- Kết quả synthetic cho thấy **cơ chế** hoạt động khi hiệu ứng có thật; chúng không phải bằng chứng về user thật.
- Digg: 3.553 bài trong 36 ngày, chỉ bài lên trang nhất (bài nào cũng đã phổ biến, có lợi cho baseline phổ biến); khoảng 41% người vote không có trong bảng friend; đồ thị là một lần crawl từ tháng 7/2009.
- Trên Digg, 55% user test cold-start được giữ lại không follow ai tại thời điểm test của họ; với họ H bằng BL2.
- Không tìm được dataset nào có cùng lúc follow, tương tác và community, nên bằng chứng về community chỉ từ synthetic.

## 11. Tự kiểm tra

1. Vì sao không dùng được database Breadit đang chạy để đánh giá?
2. W1 khác W2M ở đâu, và vì sao cần cả hai?
3. Vì sao generator không bao giờ xếp hạng một feed?
4. Vì sao các luật chọn dataset được viết trước khi xem dữ liệu?
5. Vì sao một follow trong Digg phải có ngày trước thời điểm test thì mới được tính?
