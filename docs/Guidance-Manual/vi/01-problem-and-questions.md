# 01 · Bài toán và câu hỏi nghiên cứu

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/01-problem-and-questions.md) · Tiếng Việt

**Đọc xong bạn sẽ:** nói được trong hai phút thesis này làm gì, vì sao quan trọng, hỏi gì, khẳng định gì và mỗi khẳng định được phán xét thế nào.

Nguồn: `.docs/Thesis_Orientation.md` (Hướng A), super-plan §1, `.docs/supervisor-note.md`. Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md).

---

## 1. Thesis bắt đầu từ đâu

**Breadit** là một mạng xã hội kiểu X/Twitter được xây trong pre-thesis: bài viết, like, comment, repost, follow, community, tin nhắn và thông báo thời gian thực (frontend Next.js, backend NestJS, Postgres, Redis).

Bản đánh giá pre-thesis (`Thesis_Orientation.md`) chỉ ra bốn lỗ hổng. Thesis xử lý chúng:

| Gap | Sai ở đâu | Thesis làm gì |
|---|---|---|
| 1 | "For You" không cá nhân hoá: chỉ là mới nhất trước trong số người bạn follow | một cách xếp hạng cá nhân, điểm hybrid H |
| 2 | report pre-thesis nhắc tới một pipeline LightFM không hề tồn tại | văn bản thesis sửa lại; kiến trúc không còn phần đó |
| 3 | `Follow` và `CommunityMember` có trong database nhưng không cách xếp hạng nào dùng | điểm số dùng cả hai (trust và community affinity) |
| 4 | chỉ có metric hệ thống (độ trễ, cache hit), không có metric chất lượng | Recall@K, NDCG@K, coverage, kèm một giao thức thống kê |

## 2. Vì sao là social graph?

Một feed phải chọn vài bài trong rất nhiều bài. Có hai loại tín hiệu rẻ và đã nằm sẵn trong database:
- **độ phổ biến** (like, comment, repost): tốt về trung bình, nhưng ai cũng như ai;
- **social graph** (bạn follow ai, tham gia community nào): mang tính cá nhân, và có ngay cả với user mới chưa like gì.

Các nền tảng lớn dùng social graph đúng vào việc này. RealGraph của Twitter gán cho mỗi cặp user một trọng số là xác suất dự đoán họ sẽ tương tác, và Twitter gọi nó là thành phần quan trọng nhất để xếp hạng tweet trong mạng lưới (tài liệu [5], [7] trong super-plan §10).

Trường hợp khó là **user cold-start**: người có ít hoặc chưa có lịch sử. Độ phổ biến không cá nhân hoá được cho họ, và mô hình học từ lịch sử thì không có gì để học. Nhưng họ thường follow vài người và tham gia một community khi đăng ký. Đó là tín hiệu mà thesis dùng.

## 3. Các đóng góp

| | Đóng góp | Trạng thái |
|---|---|---|
| **C1** | Kiến trúc nền tảng Breadit (từ pre-thesis) | giữ nguyên |
| **C2** | **Xếp hạng hybrid có dùng social graph**: engagement + α·follow trust + β·community affinity, được làm trơn bằng một prior độ mạnh m để user mới vẫn có điểm cá nhân; chỉ tính từ các sự kiện trước thời điểm xếp hạng; được đo offline so với các baseline đã tune | **mới** |
| **C3** | Tầng WebSocket thời gian thực (từ pre-thesis) | giữ nguyên |

C2 bao gồm cả phần đánh giá: hai nguồn dữ liệu, một giao thức không rò rỉ và một pipeline tái lập được.

## 4. Các câu hỏi nghiên cứu

**RQ1.** Thêm tín hiệu social graph (follow trust và community affinity) vào xếp hạng có làm feed "For You" tốt hơn heuristic hiện tại không, nhất là với user có ít lịch sử?

**RQ2.** Mức độ tương tác xã hội giữa các user thay đổi chất lượng xếp hạng thế nào? Từ mức tối thiểu nào thì tín hiệu social bắt đầu có ích?

## 5. Các giả thuyết và cách phán xét

Các giả thuyết được frozen trước lần chạy split test đầu tiên. Mỗi cái có một luật viết sẵn từ trước, nên không thể đọc kết quả theo cách có lợi sau khi đã thấy nó.

| | Khẳng định | Cách phán xét |
|---|---|---|
| **H0** (kiểm tra tỉnh táo, làm đầu tiên) | Trong thế giới null W0, nơi follow không có ảnh hưởng, H **không** thắng BL2 | Trên `syn-W0-M`, CI 95% của H − BL2 (NDCG@10, mọi user) không được nằm hẳn trên 0. Nếu có: có bug hoặc leak. Dừng lại và sửa |
| **H1** (RQ1) | Với user có 0–4 tương tác trước đó, H có NDCG@10 cao hơn BL2 | p sau Holm < 0,05 **và** đầu dưới CI > 0. Kiểm hai lần, mỗi lần riêng: `syn-W2M-M` và `digg2009` |
| **H2** (RQ2) | Mức cải thiện so với BL2 tăng theo mật độ social, và gần bằng 0 với user không follow ai và không ở community nào | mức cải thiện được lập bảng theo nhóm mật độ (thí nghiệm E3); trình bày bằng khoảng tin cậy, không có một p-value duy nhất |

**Vì sao tham chiếu là BL2.** BL2 là điểm Explore mà app đang dùng. Câu hỏi là "tốt hơn cái ta đang có", không phải "tốt hơn phương pháp yếu nhất".

**Nếu một giả thuyết không pass,** thesis báo cáo đúng như vậy. Một kết quả âm với giao thức sạch vẫn là kết quả hợp lệ. Khi đó feed mặc định giữ nguyên.

## 6. Những gì thesis không làm

Không có graph neural network hay mô hình social có học, không có pilot với user thật hay A/B test, không có log hiển thị, không có Python trong pipeline chính (super-plan §9). Thời gian là bốn tuần (hạn 2026-11-20), và câu hỏi là tín hiệu nào giúp ích, điều mà một điểm số minh bạch trả lời tốt nhất. Xem [10 Ngân hàng câu hỏi](10-defense-qa.md), Q2.

## 7. Thesis trong một hình

```
problem:  "For You" is not personal; new users get nothing personal
idea:     add follow trust + community affinity to the popularity score,
          smoothed so a new user still gets a personal signal
build:    one ranking package used by the app and by the evaluation
measure:  replay the past (no leakage), compare with tuned baselines,
          synthetic worlds (with a null world) + real Digg data
judge:    H0 gate first, then H1 on two datasets with a pre-written rule
deliver:  the default feed changes only if H1 and H0 pass
```

Tạm dịch: bài toán là "For You" không cá nhân hoá; ý tưởng là cộng follow trust và community affinity vào điểm phổ biến, có làm trơn; xây một package xếp hạng dùng chung cho app và evaluation; đo bằng cách tua lại quá khứ, so với baseline đã tune, trên thế giới synthetic (có thế giới null) và dữ liệu Digg thật; phán xét bằng cổng H0 trước, rồi H1 trên hai dataset theo luật viết sẵn; feed mặc định chỉ đổi khi H1 và H0 pass.

## 8. Tự kiểm tra

1. Điểm hybrid lấp lỗ hổng nào trong bốn cái, và phần evaluation lấp cái nào?
2. Vì sao user cold-start khó với độ phổ biến và với mô hình học, nhưng không khó với social graph?
3. Nếu H thắng BL2 trong W0 thì nghĩa là gì?
4. Vì sao có hai kiểm định H1, và vì sao mỗi cái được phán xét riêng?
