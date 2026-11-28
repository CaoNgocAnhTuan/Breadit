# Guidance Manual · Sổ tay hướng dẫn

Version 1.3 · 2026-11-28

A reading path for the author and for first-time reviewers of the Breadit thesis. It goes from **why** (the problem), to **how** (the score, the data, the protocol), to **how to defend it**. Each file answers one question and has a worked example you can check by hand.

Lộ trình đọc dành cho tác giả và cho reviewer lần đầu xem thesis Breadit. Đi từ **tại sao** (bài toán), đến **làm thế nào** (điểm số, dữ liệu, giao thức đánh giá), rồi đến **bảo vệ thế nào**. Mỗi file trả lời một câu hỏi và có ví dụ tính tay để tự kiểm tra.

Every file exists in English (`en/`) and Vietnamese (`vi/`) with the same content. The English version is the reference: if the two differ, English is right, and the Vietnamese one is fixed.

Mỗi file có hai bản cùng nội dung: tiếng Anh (`en/`) và tiếng Việt (`vi/`). Bản tiếng Anh là bản gốc: nếu hai bản khác nhau thì bản tiếng Anh đúng, và bản tiếng Việt được sửa theo.

---

## Reading order · Thứ tự đọc

✅ written · đã viết. 🔜 planned · sẽ viết.

| # | Topic · Chủ đề | Question · Câu hỏi | EN | VI | Status |
|---|---|---|---|---|---|
| 00 | The core in one file · Nền tảng trong một file | What do I need to know, in one thread from raw data to the verdict? · Cần biết gì, theo một mạch từ dữ liệu thô đến kết luận? | [en](en/00-core-in-one-file.md) | [vi](vi/00-core-in-one-file.md) | ✅ |
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
| 11 | The experiments and what the results mean · Các thí nghiệm và ý nghĩa kết quả | What did each experiment show, and what can the thesis claim? · Mỗi thí nghiệm cho thấy gì, và thesis được phép kết luận gì? | [en](en/11-experiments-and-results.md) | [vi](vi/11-experiments-and-results.md) | ✅ |
| 12 | The platform and the real-time layer · Nền tảng và lớp real-time | How does the whole system work, beyond the feed? · Toàn bộ hệ thống hoạt động thế nào, ngoài feed? | [en](en/12-platform-and-real-time.md) | [vi](vi/12-platform-and-real-time.md) | ✅ |

**Start here · Bắt đầu từ đây:** [00](en/00-core-in-one-file.md) ([vi](vi/00-core-in-one-file.md)). It covers the data, the five worlds, the nine methods, the metrics, one real user, and H0 to H2. The other files go deeper. · File này gồm dữ liệu, năm thế giới, chín phương pháp, các metric, một user thật, và H0 đến H2. Các file khác đi sâu hơn.

**Full path (about 5 hours) · Lộ trình đầy đủ (khoảng 5 giờ):** 01 → 12 in order · đọc theo thứ tự.

**Short path (1.5 hours) · Lộ trình ngắn (1,5 giờ):** 09 → 03 → 05 → 11 → 10. Add 08 and 12 for the system · Thêm 08 và 12 để hiểu hệ thống.

Also read · Đọc thêm: [System_Architecture.md](../System_Architecture.md) (the system, the diagrams and the annotated directory tree · hệ thống, sơ đồ và cây thư mục có chú thích).

---

## Study and verification path · Lộ trình học và kiểm chứng

For the author: learn the thesis and check it at the same time. Each stage is one loop: read the topic, open the code it names, run one command to see it with your own eyes, then answer "Check yourself" at the end of the topic.

Dành cho tác giả: vừa học vừa kiểm chứng thesis. Mỗi chặng là một vòng: đọc chủ đề, mở đúng file code mà chủ đề nói tới, chạy một lệnh để thấy tận mắt, rồi trả lời mục "Tự kiểm tra" ở cuối chủ đề.

| Stage · Chặng | Read · Đọc | Code | Run to check · Chạy để kiểm chứng |
|---|---|---|---|
| 1. The big picture · Bức tranh lớn (~30 min) | 01, [System_Architecture.md](../System_Architecture.md) §1–3; 09 when a word is new · 09 khi gặp từ lạ | the repo tree · cây thư mục của repo | — |
| 2. The hybrid score · Hybrid score (~1 h) | 02, 03 | `packages/ranking/src/scorers.ts`, `features.ts`, `pool.ts` | `npm run test -w @breadit/ranking`; the worked example of 03 §4 by hand · tự tính tay ví dụ ở 03 §4; `npm run rank -w @breadit/eval -- --dataset syn-W2M-M --method H --user <u> --asof <t>`, then the same with `--method BL2` · rồi chạy lại với `--method BL2` |
| 3. Data, protocol, statistics · Dữ liệu, protocol, thống kê (~1.5 h) | 04, 05, 06 | `eval/src/generator/`, `eval/src/harness/`, `eval/src/stats.ts` | `npm run check -w @breadit/eval`; take the H1 row of `.docs/results/p7-main/compare.csv` and redo the Holm step by hand · lấy dòng H1 trong `compare.csv` và tự tính lại bước Holm (11 §6) |
| 4. Reproducibility · Tính tái lập (~45 min) | 07 | `scripts/repro/thesis-repro.mjs`, any `manifest.json` · một `manifest.json` bất kỳ | `npm run results:manifest -w @breadit/eval`; read the `repro_output.txt` of the last run · đọc `repro_output.txt` của lần chạy gần nhất |
| 5. System and real-time · Hệ thống và real-time (~1.5 h) | 08, 12 | `apps/backend/src/notifications/notifications.gateway.ts`, `src/feed/`, `src/auth/` | run the app on the seed data (`user1` / `password`): the three `algo` options of For You, a direct message and a like between two browsers · chạy app trên dữ liệu seed: ba lựa chọn `algo` của For You, nhắn tin và like giữa hai trình duyệt; `npm run test:it -w @breadit/backend` |
| 6. Results and defense · Kết quả và bảo vệ (~1.5 h) | 11, the drafts of Chapters 6 and 7 · nháp Chương 6 và 7, then 10 · rồi 10 | `.docs/results/p7-report/results.md` | answer the questions of 10 aloud without looking at the answers, mark the weak ones · trả lời to các câu của 10 mà không nhìn đáp án, đánh dấu câu còn yếu |

**Then the demo by hand · Sau đó tự chạy demo bằng tay** (what `scripts/demo/` will automate · những gì `scripts/demo/` sẽ tự động hoá): load `syn-W2M-M` into the schema `eval_load` with `--rebase-to` the current time, start the backend with `DATABASE_URL` ending in `?schema=eval_load`, and sign in as a loaded user (password `password`) · nạp `syn-W2M-M` vào schema `eval_load` với `--rebase-to` là giờ hiện tại, chạy backend với `DATABASE_URL` kết thúc bằng `?schema=eval_load`, rồi đăng nhập bằng một user đã nạp (mật khẩu `password`). Commands · Lệnh: `CLAUDE.md`, "Commands".

**Rules · Quy tắc:**
- Stages 1–4 only read files and run tests. Stages 5–6 and the demo use the database and Redis, so never run them while `npm run thesis:repro` runs: it uses the schema `eval_load` and Redis database 2. · Chặng 1–4 chỉ đọc file và chạy test. Chặng 5–6 và demo dùng database và Redis, nên đừng chạy khi `npm run thesis:repro` đang chạy: nó dùng schema `eval_load` và Redis database 2.
- Write every question and every doubt into `.docs/study-notes.md`. Claude answers each one; a real error in the code or the docs becomes a bug in `.docs/Bugs Report.md` or a doc fix. So studying is also a check of the thesis. · Ghi mọi câu hỏi và mọi chỗ nghi ngờ vào `.docs/study-notes.md`. Claude trả lời từng câu; một lỗi thật trong code hoặc tài liệu sẽ thành một bug trong Bugs Report hoặc một lần sửa tài liệu. Như vậy việc học cũng là một lần kiểm chứng thesis.

---

## Rules for these files · Quy tắc cho các file này

- Names, numbers and frozen values are copied exactly from `.docs/super-plan.md` and `.docs/implementation-plan.md`, which stay the source of truth. · Tên, số liệu và giá trị frozen được chép đúng từ super-plan và implementation-plan; hai file đó vẫn là nguồn chuẩn.
- Worked examples are checked with the real code (`@breadit/ranking`). · Các ví dụ tính tay được kiểm bằng code thật.
- Answers marked **(after P7)** were filled in when the experiments were done. No answer has this mark since task 10 (2026-11-12). · Các câu trả lời có nhãn **(after P7)** đã được điền khi chạy xong thí nghiệm. Từ task 10 (2026-11-12) không còn câu nào mang nhãn này.
