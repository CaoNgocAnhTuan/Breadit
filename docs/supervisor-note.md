# Thesis note for the supervisor: direction, data and design decisions

2026-10-27 · Direction A, Social-Graph-Aware Hybrid "For You" feed · Deadline 2026-11-20

This note answers the three questions of the week-0 checklist, and asks you to confirm the data choice, the design decisions and the scope cuts in one go. Details are in `.docs/super-plan.md` (plan), `.docs/literature.md` (papers and decisions) and `.docs/datasets.md` (data).

## 1. Direction A, and why

I chose Direction A. Breadit already has the follow graph and the communities, so it needs no new infrastructure. The "For You" feed today shows posts from the people you follow, newest first. It does not use how much you care about each person or each community. A new user who follows nobody sees only their own posts.

## 2. What is new (C2)

C2 is a hybrid score: the current engagement heuristic, plus a follow-trust term, plus a community-affinity term. The terms use only events before the time of the test. A prior of strength `m` replaces the three "phases" of the Orientation with one smooth curve, so a user with no history still gets a score from who they follow. In the pre-thesis platform, Explore ranks every user's feed with the same engagement heuristic. C2 adds personal signals to it and measures the gain. C1 and C3 stay as they were.

## 3. How "better" is measured

- **Metrics:** Recall@K (the same as HitRate@K), NDCG@K and Coverage@K, for K = 5, 10, 20, with full ranking and no sampled negatives.
- **Protocol:** temporal leave-last-out with one global cut time. Every feature uses only events before the test time.
- **Statistics:** paired bootstrap 95% confidence intervals and a randomization test, with Holm correction.
- **Questions:** RQ1: do social signals improve the feed, mostly for users with 0–4 earlier interactions (H1)? RQ2: how much social interaction is needed before the signal helps (H2)? Sanity check H0: in a world with no social influence, the hybrid must not win.
- **Baselines:** the current feed, newest first, the production engagement score, global popularity, Reddit "hot", Hacker News ranking, and a follow-count version of the hybrid. The tuned ones get a grid, so the hybrid is not the only tuned method.

## 4. Data (please confirm)

Breadit has no real users, only demo accounts, so the data comes from two sources, both main:
- **Real data: Digg 2009** (Lerman). 3,018,197 votes on 3,553 front-page stories by 139,409 voters, and 1,731,658 dated follow links. Follows and votes both have Unix dates. For 98.2% of the stories the author (the first voter) is in the graph. We checked this by reading both files in full.
- **Synthetic data**, made by a seeded generator. It is the only source for the null world (W0), the influence sweep and the community term.

Limits we state in the thesis: Digg is small (one month, only popular stories), only about 59% of the voters are in the friend table, and it has no communities. The community term is therefore tested on synthetic data only. Flickr WWW 2009 stays as a second real set. Its follow dates are calendar days but its favorites have only an order, so it is not the main one.

## 5. Design decisions (please confirm)

- **Trust:** one follow counts through a smoothed share of the user's past positives on that author, plus the same for friends who engaged. No time fade.
- **No history:** one smooth curve, not three phases.
- **Community:** a smoothed share of the user's past positives in the community.
- **Reach:** one hop (followees), not two. Two hops is out of scope.
- **Protocol:** as in section 3.
- **Not built into the data:** the null world W0, a world with shared interests but no influence (W1), three influence levels, and a timestamp shuffle.

## 6. Scope cuts

No graph neural network (DiffNet and similar), no learned social baseline (SoRec, SocialMF), no real-user pilot, no online A/B test. If time runs short, I drop in this order: timestamp shuffle, larger-pool run, finer ablations, latency to two feeds, the frontend toggle, and last the Digg adapter.

## 7. Questions for you

1. Do you confirm RQ1 and RQ2, and the data choice in section 4?
2. Digg's page says: "This data is made available to the community for research purposes only", and asks to cite Hogg and Lerman (2012). It has no license text. Is this enough for a thesis at our university?
3. What happens on 2026-11-20: the written thesis, the defense, or both? What format and length rules apply?
4. The pre-thesis report has a LightFM sentence that contradicts the chronological feed. I will correct it in the new text, and I will not edit the old report. Is that fine?

---

# Bản tiếng Việt

# Ghi chú gửi thầy: hướng đề tài, dữ liệu và các quyết định thiết kế

2026-10-27 · Hướng A, feed "For You" lai có nhận biết đồ thị xã hội (Social-Graph-Aware Hybrid) · Hạn nộp 2026-11-20

Ghi chú này trả lời ba câu hỏi của checklist tuần 0, và xin thầy xác nhận một lượt: lựa chọn dữ liệu, các quyết định thiết kế và các phần cắt giảm phạm vi. Chi tiết nằm trong `.docs/super-plan.md` (kế hoạch), `.docs/literature.md` (bài báo và quyết định) và `.docs/datasets.md` (dữ liệu).

## 1. Hướng A và lý do chọn

Em chọn hướng A. Breadit đã có đồ thị follow và các community, nên không cần dựng thêm hạ tầng. Feed "For You" hiện tại chỉ hiện bài của những người mình follow, mới nhất trước. Nó không dùng mức độ mình quan tâm đến từng người hay từng community. Người dùng mới chưa follow ai thì chỉ thấy bài của chính mình.

## 2. Điểm mới (C2)

C2 là một điểm số lai: heuristic engagement hiện tại, cộng một số hạng follow-trust, cộng một số hạng community-affinity. Các số hạng chỉ dùng sự kiện xảy ra trước thời điểm kiểm tra. Một prior có độ mạnh `m` thay cho ba "giai đoạn" của Orientation bằng một đường cong mượt, nên người dùng chưa có lịch sử vẫn có điểm từ những người họ follow. Ở nền tảng tiền luận văn, Explore xếp feed của mọi người bằng cùng một heuristic engagement. C2 thêm các tín hiệu cá nhân vào đó và đo mức cải thiện. C1 và C3 giữ nguyên.

## 3. Đo "tốt hơn" như thế nào

- **Chỉ số:** Recall@K (giống HitRate@K), NDCG@K và Coverage@K, với K = 5, 10, 20, xếp hạng toàn bộ, không lấy mẫu negative.
- **Giao thức:** temporal leave-last-out với một thời điểm cắt chung. Mọi feature chỉ dùng sự kiện trước thời điểm kiểm tra.
- **Thống kê:** khoảng tin cậy 95% bằng paired bootstrap và randomization test, hiệu chỉnh Holm.
- **Câu hỏi:** RQ1: tín hiệu xã hội có cải thiện feed không, nhất là với người dùng có 0–4 tương tác trước đó (H1)? RQ2: cần bao nhiêu tương tác xã hội thì tín hiệu bắt đầu có ích (H2)? Kiểm tra tỉnh táo H0: trong thế giới không có ảnh hưởng xã hội, bản lai không được thắng.
- **Baseline:** feed hiện tại (mới nhất trước), điểm engagement đang chạy ở production, độ phổ biến toàn cục, "hot" của Reddit, xếp hạng của Hacker News, và bản lai chỉ dùng số lượng follow. Các baseline có tham số đều được tune bằng grid, để bản lai không phải phương pháp duy nhất được tune.

## 4. Dữ liệu (xin thầy xác nhận)

Breadit không có người dùng thật, chỉ có tài khoản demo, nên dữ liệu đến từ hai nguồn, cả hai đều là nguồn chính:
- **Dữ liệu thật: Digg 2009** (Lerman). 3.018.197 lượt vote cho 3.553 bài lên trang nhất, từ 139.409 người vote, và 1.731.658 liên kết follow có ngày. Cả follow và vote đều có Unix timestamp. Với 98,2% số bài, tác giả (người vote đầu tiên) có trong đồ thị. Em đã kiểm tra bằng cách đọc toàn bộ cả hai file.
- **Dữ liệu tổng hợp**, sinh bởi generator có seed. Đây là nguồn duy nhất cho thế giới null (W0), phép quét mức ảnh hưởng và số hạng community.

Các giới hạn em sẽ nêu trong luận văn: Digg nhỏ (một tháng, chỉ có bài nổi tiếng), chỉ khoảng 59% người vote có trong bảng friend, và không có community. Vì vậy số hạng community chỉ được kiểm tra trên dữ liệu tổng hợp. Flickr WWW 2009 giữ làm bộ dữ liệu thật thứ hai. Ngày follow của nó chỉ có đến mức ngày, còn favorite chỉ có thứ tự, nên nó không phải bộ chính.

## 5. Quyết định thiết kế (xin thầy xác nhận)

- **Trust:** mỗi follow được tính qua tỉ lệ đã làm mượt của các positive trong quá khứ của người dùng trên tác giả đó, cộng phần tương tự cho các bạn bè đã tương tác. Không có suy giảm theo thời gian.
- **Không có lịch sử:** một đường cong mượt, không dùng ba giai đoạn.
- **Community:** tỉ lệ đã làm mượt của các positive trong quá khứ của người dùng ở community đó.
- **Phạm vi lan truyền:** một bước (followees), không phải hai. Hai bước nằm ngoài phạm vi.
- **Giao thức:** như mục 3.
- **Không đưa vào dữ liệu:** thế giới null W0, thế giới có sở thích chung nhưng không có ảnh hưởng (W1), ba mức ảnh hưởng, và phép xáo trộn timestamp.

## 6. Cắt giảm phạm vi

Không dùng mạng nơ-ron đồ thị (DiffNet và tương tự), không có baseline xã hội dạng học (SoRec, SocialMF), không có pilot với người dùng thật, không có A/B test trực tuyến. Nếu thiếu thời gian, em bỏ theo thứ tự: phép xáo trộn timestamp, lần chạy với pool lớn hơn, ablation chi tiết hơn, đo latency xuống còn hai feed, nút bật/tắt ở frontend, và cuối cùng là adapter Digg.

## 7. Câu hỏi cho thầy

1. Thầy có xác nhận RQ1, RQ2 và lựa chọn dữ liệu ở mục 4 không?
2. Trang của Digg ghi: "This data is made available to the community for research purposes only", và yêu cầu trích dẫn Hogg và Lerman (2012). Trang không có văn bản license. Như vậy có đủ cho một luận văn ở trường mình không?
3. Ngày 2026-11-20 sẽ diễn ra việc gì: nộp luận văn, bảo vệ, hay cả hai? Quy định về định dạng và độ dài là gì?
4. Báo cáo tiền luận văn có một câu về LightFM mâu thuẫn với feed theo thời gian. Em sẽ sửa câu đó trong phần văn bản mới, và không sửa báo cáo cũ. Như vậy có ổn không?
