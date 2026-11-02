# Guidance Manual · Sổ tay hướng dẫn

Version 1.0 · 2026-11-02

A reading path for the author and for first-time reviewers of the Breadit thesis. It goes from **why** (the problem), to **how** (the score, the data, the protocol), to **how to defend it**. Each file answers one question and has a worked example you can check by hand.

Lộ trình đọc dành cho tác giả và cho reviewer lần đầu xem thesis Breadit. Đi từ **tại sao** (bài toán), đến **làm thế nào** (điểm số, dữ liệu, giao thức đánh giá), rồi đến **bảo vệ thế nào**. Mỗi file trả lời một câu hỏi và có ví dụ tính tay để tự kiểm tra.

Every file exists in English (`en/`) and Vietnamese (`vi/`) with the same content. The English version is the reference: if the two differ, English is right, and the Vietnamese one is fixed.

Mỗi file có hai bản cùng nội dung: tiếng Anh (`en/`) và tiếng Việt (`vi/`). Bản tiếng Anh là bản gốc: nếu hai bản khác nhau thì bản tiếng Anh đúng, và bản tiếng Việt được sửa theo.

---

## Reading order · Thứ tự đọc

✅ written · đã viết. 🔜 planned · sẽ viết.

| # | Topic · Chủ đề | Question · Câu hỏi | EN | VI | Status |
|---|---|---|---|---|---|
| 01 | Problem and research questions · Bài toán và câu hỏi nghiên cứu | Why this thesis? · Vì sao có thesis này? | [en](en/01-problem-and-questions.md) | [vi](vi/01-problem-and-questions.md) | ✅ |
| 02 | Recommender basics · Kiến thức nền về recommender | What words do I need? · Cần biết những khái niệm nào? | [en](en/02-recommender-basics.md) | [vi](vi/02-recommender-basics.md) | ✅ |
| 03 | The hybrid score and the baselines · Điểm hybrid và các baseline | How does the ranking work? · Xếp hạng hoạt động thế nào? | [en](en/03-hybrid-score.md) | [vi](vi/03-hybrid-score.md) | ✅ |
| 04 | Data · Dữ liệu | Where do the data come from? · Dữ liệu từ đâu ra? | [en](en/04-data.md) | [vi](vi/04-data.md) | ✅ |
| 05 | The evaluation protocol · Giao thức đánh giá | How is a result number made? · Một con số kết quả được tạo ra thế nào? | [en](en/05-evaluation-protocol.md) | [vi](vi/05-evaluation-protocol.md) | ✅ |
| 06 | Statistics · Thống kê | When is a gain real? · Khi nào một mức cải thiện là thật? | [en](en/06-statistics.md) | [vi](vi/06-statistics.md) | ✅ |
| 07 | Determinism · Tính tất định | Why is every run identical? · Vì sao mọi lần chạy giống hệt nhau? | [en](en/07-determinism.md) | [vi](vi/07-determinism.md) | ✅ |
| 08 | The system and the news feed · Hệ thống và news feed | How does the backend get the ranked feed, and how can the feed be optimized? · Backend lấy feed đã xếp hạng thế nào, và tối ưu feed ra sao? | [en](en/08-system-and-feed.md) | [vi](vi/08-system-and-feed.md) | ✅ |
| 09 | Glossary · Bảng thuật ngữ | What does this word mean? · Từ này nghĩa là gì? | [en](en/09-glossary.md) | [vi](vi/09-glossary.md) | ✅ |
| 10 | Defense question bank · Ngân hàng câu hỏi bảo vệ | What will the committee ask? · Hội đồng sẽ hỏi gì? | [en](en/10-defense-qa.md) | [vi](vi/10-defense-qa.md) | ✅ |

**Full path (about 4 hours) · Lộ trình đầy đủ (khoảng 4 giờ):** 01 → 10 in order · đọc theo thứ tự.

**Short path (1 hour) · Lộ trình ngắn (1 giờ):** 09 → 03 → 05 → 10. Add 08 for the system and the feed · Thêm 08 để hiểu hệ thống và feed.

Also read · Đọc thêm: [System_Architecture.md](../System_Architecture.md) (the system, the diagrams and the annotated directory tree · hệ thống, sơ đồ và cây thư mục có chú thích).

---

## Rules for these files · Quy tắc cho các file này

- Names, numbers and frozen values are copied exactly from `.docs/super-plan.md` and `.docs/implementation-plan.md`, which stay the source of truth. · Tên, số liệu và giá trị frozen được chép đúng từ super-plan và implementation-plan; hai file đó vẫn là nguồn chuẩn.
- Worked examples are checked with the real code (`@breadit/ranking`). · Các ví dụ tính tay được kiểm bằng code thật.
- Answers marked **(after P7)** are filled in when the experiments are done. · Các câu trả lời có nhãn **(after P7)** sẽ được điền khi chạy xong thí nghiệm.
