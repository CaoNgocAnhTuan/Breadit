# 10 · Ngân hàng câu hỏi bảo vệ

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/10-defense-qa.md) · Tiếng Việt

Những câu hội đồng hoặc reviewer có thể hỏi, mỗi câu có câu trả lời ngắn và chỗ có bằng chứng. Hãy học câu trả lời ngắn trước. Mở phần bằng chứng khi cần chi tiết.

Khi bảo vệ bằng tiếng Anh, dùng bản [English](../en/10-defense-qa.md): câu trả lời ở đó đã được viết để nói thành lời.

Các câu có nhãn **(after P7)** từng phụ thuộc vào kết quả chưa có. Từ task 10 (2026-11-12), không còn câu nào mang nhãn này. Trạng thái: 2026-11-18, sau task 11.

---

## A. Ý tưởng

**Q1. Đóng góp của thesis, trong một câu?**
Một điểm "For You" hybrid cộng follow trust và community affinity (đã được làm trơn) vào điểm engagement của production, được tích hợp vào một app thật và được đo bằng một giao thức offline không rò rỉ, tái lập được, chủ yếu cho user có ít lịch sử.
*Bằng chứng:* super-plan §1, §6; [03](03-hybrid-score.md).

**Q2. Sao không dùng mô hình machine learning (LightFM, matrix factorization, graph neural network)?**
Ba lý do. (1) Câu hỏi là *tín hiệu nào* giúp ích; một điểm tự xây có các term tắt được từng cái một (ablation), còn mô hình học sẽ che mất điều đó. (2) Mô hình học cần lịch sử, mà thesis nhắm vào user gần như chưa có lịch sử. (3) Thời gian: không đủ thời gian để xây, tune và bảo vệ cho tốt một mô hình học. Các mô hình social có học (SoRec, SocialMF, DiffNet) được bàn trong phần related work và future work.
*Bằng chứng:* super-plan §9 (ngoài phạm vi); `.docs/related-work.md`.

**Q3. Vì sao hybrid là "social-graph-aware" chứ không chỉ là "độ phổ biến cộng bạn bè"?**
Vì trust được tính theo hành vi trước đây của chính user và được làm trơn. BL6 đúng là "độ phổ biến cộng số bạn bè", và nó là một baseline. Muốn biết trọng số trust thêm được gì, phải so **H-follow** với BL6, **không phải H** với BL6: BL6 không có community term, mà phần lớn gain của H đến từ term đó. Cặp này chưa được tính khoảng tin cậy, và mỗi bên dùng α riêng (1024 cho H-follow, lấy từ H, và 16 cho BL6 trên `syn-W2M-M`).
*Bằng chứng:* [00 §4.4](00-core-in-one-file.md); E1 (`.docs/results/p7-main/summary.csv`) và E4 (`.docs/results/p7-e4-terms/summary.csv`), NDCG@10, mọi user. `syn-W2M-M`: H-follow 0.016, BL6 0.011 (H 0.054, H-comm 0.052). `digg2009`: H-follow 0.024, BL6 0.025.

**Q4. Vì sao dùng m-estimate smoothing? Vì sao m = 5?**
Không làm trơn thì trust của user mới là 0/0. m-estimate (Cestnik 1990) là cách chuẩn để trộn một tỉ lệ quan sát với một prior. m = 5 nghĩa là "prior có giá trị bằng năm tương tác": sau 5 tương tác thì prior chiếm một nửa. Giá trị này được frozen trước mọi lần chạy test, và E4 báo cáo m = 0, 2, 5, 10 để người đọc thấy kết quả nhạy tới đâu.
*Bằng chứng:* super-plan §6, §7; E4 (`.docs/results/p7-e4-*/`): trên `syn-W2M-M`, phần tăng của H so với BL2 là +0.047, +0.051, +0.045 và +0.041 với m = 0, 2, 5 và 10. Trên `digg2009` là 0.000 với mọi m.

**Q5. Vì sao điểm cần author term?**
Công thức trong Orientation chỉ đếm bạn bè đã tương tác. Một bài mới của bạn bè mà chưa ai like sẽ được 0. RealGraph ở Twitter gán trọng số cho cạnh giữa các user và được dùng để xếp hạng tweet trong mạng lưới, điều này ủng hộ một liên kết trực tiếp tới tác giả. E4 (H-noauthor) đo phần này thêm được gì.
*Bằng chứng:* super-plan §6; tài liệu [5], [7].

## B. Dữ liệu

**Q6. Kết quả có phải đã được cài sẵn trong dữ liệu synthetic không? Bạn sinh like từ follow mà.**
Đó là rủi ro chính, và thiết kế trả lời nó theo bốn cách. (1) **W0**, thế giới null nơi follow không có ảnh hưởng: H-follow không được thắng BL2 ở đó (cổng H0). (2) **W1**, nơi người giống nhau follow nhau nhưng vẫn không có ảnh hưởng: tách homophily khỏi influence. (3) Ba mức ảnh hưởng (W2L, W2M, W2H): mức cải thiện phải tăng theo ảnh hưởng. (4) **Digg 2009**, dữ liệu thật mà không ai đặt mức ảnh hưởng. Kết quả synthetic cho thấy cơ chế hoạt động; Digg là bằng chứng từ bên ngoài.
*Bằng chứng:* super-plan §8; E5 (`.docs/results/p7-e5-worlds/`, `p7-h0/`, `p7-e5-shuffle/`): phần tăng của H so với BL2 lớn dần theo influence: W0 +0.012, W1 +0.029, W2L +0.035, W2M +0.045, W2H +0.076. Cổng H0 pass (H-follow − BL2 trên W0 = 0.001, CI −0.004 đến 0.006). Phần tăng ở W0 và W1 đến từ community term, term này mang tín hiệu sở thích topic (super-plan 0.25). Khi xáo thời gian bên trong mỗi post, phần tăng trên W2M vẫn còn +0.042.

**Q7. Sao lại là Digg 2009? Nó cũ rồi.**
Đây là một trong rất ít dataset công khai có cả vote có ngày lẫn đồ thị follow có ngày trên cùng một đồng hồ, đúng thứ một feed cần. Việc chọn dùng các tiêu chí cố định, viết ra trước khi chọn. Tuổi của dữ liệu không ảnh hưởng câu hỏi: hành động của bạn bè có dự đoán được hành động của bạn không?
*Bằng chứng:* `.docs/datasets.md`.

**Q8. Digg có những giới hạn gì?**
3.553 bài, một tháng, chỉ bài lên trang nhất (nên bài nào cũng đã phổ biến, có lợi cho baseline phổ biến), khoảng 41% người vote không có trong bảng friend, đồ thị follow chỉ được crawl một lần, và không có community. Tất cả đều được nêu là giới hạn.
*Bằng chứng:* super-plan §8, P4.

**Q9. Digg không có community. Vậy β được kiểm thế nào?**
Chỉ trên dữ liệu synthetic. Đây là một giới hạn đã nêu: không tìm được dataset công khai nào có cùng lúc follow, tương tác với item và membership community.
*Bằng chứng:* super-plan §8.

**Q10. Dữ liệu synthetic có giống thật không?**
Tham số của nó được hiệu chỉnh theo số liệu của Digg: độ lệch hoạt động (trên Digg, 20% user hoạt động nhiều nhất tạo khoảng 84% số vote), số followee và follower mỗi user, số vote mỗi user. Mọi giá trị hiệu chỉnh đều nằm trong dung sai trên `syn-W2M-M`. Nhưng việc hiệu chỉnh chỉ khớp các tỉ lệ và giá trị trung bình, không khớp cả phân bố. Trong `syn-W2M-M` không user nào có danh sách follow từ 1 đến 9 tài khoản, còn trên Digg, trong số user có danh sách, 58.1% follow 1–4 và 17.4% follow 5–9 ([00 §2.3](00-core-in-one-file.md)).
*Bằng chứng:* `eval/config/synthetic-v1.json`; file `check_output.txt` của task P3.

## C. Giao thức

**Q11. Làm sao chặn được data leakage?**
Mọi feature được tính tại thời điểm test: chỉ các sự kiện trước đó. Một leakage test sửa hoặc xoá mọi sự kiện về sau và kiểm rằng kết quả của user không đổi dù một byte. Test này pass.
*Bằng chứng:* [05 §5](05-evaluation-protocol.md); trạng thái P5.

**Q12. Sao dùng một cut time chung mà không leave-last-out theo từng user?**
Với một T chung, việc tune không bao giờ thấy gì từ giai đoạn test, với bất kỳ user nào. Cắt theo từng user để tương lai của user này rò vào quá khứ của user khác.
*Bằng chứng:* [05 §3](05-evaluation-protocol.md); Meng và cộng sự 2020.

**Q13. Sao mỗi user chỉ có một item test?**
Nó cho mỗi user một con số sạch, so sánh được, và thống kê ghép cặp cần đúng một giá trị cho mỗi user và mỗi phương pháp. Với một item, Recall@K bằng HitRate@K, và thesis có nói điều này.

**Q14. Sao không lấy mẫu 100 negative như nhiều bài báo?**
Metric trên mẫu có thể đổi phương pháp trông như thắng (Krichene và Rendle 2020). Ta xếp hạng toàn bộ pool.

**Q15. Sao kiểm định chính là NDCG@10 trên user có 0–4 tương tác?**
RQ1 nói về user có ít lịch sử, và 10 bài là khoảng một màn hình feed. Cố định một metric và một nhóm chính trước lần chạy test giúp tránh việc chọn con số đẹp nhất sau khi đã thấy kết quả.

**Q16. Vì sao tham chiếu là BL2 mà không phải BL5, baseline mạnh nhất?**
H1 hỏi "có tốt hơn cái app đang làm không?" BL2 là điểm của production. H cũng được so với mọi baseline khác (family F2), nên người đọc thấy H đứng thế nào so với BL5.
*Bằng chứng:* implementation-plan §3.3; E1 (`.docs/results/p7-main/`): trên `digg2009`, BL5 (0.199) và BL4 (0.197) cao hơn H (0.024) rất nhiều; trên `syn-W2M-M`, H (0.054) cao hơn mọi baseline rất nhiều.

**Q17. Các baseline có được tune kỹ như phương pháp của bạn không?**
Có. BL2t, BL4, BL5 và BL6 mỗi cái có một tham số được tune trên một lưới có chứa giá trị đã công bố, theo cùng luật như H. Điều này tránh vấn đề đã biết là chỉ thắng baseline yếu (Ferrari Dacrema và cộng sự 2019).

**Q18. Các trường hợp hoà điểm ảnh hưởng kết quả thế nào?**
Hoà điểm được tách bằng post id. E6 chạy lại chín phương pháp của E1 trên `syn-W2M-M` và `digg2009` với tie-break đảo ngược (W0 và các thế giới khác không được chạy lại, và không tính khoảng tin cậy hay p-value mới). Nếu các giá trị thay đổi nhiều thì tie có ảnh hưởng, và thesis sẽ nói vậy.
*Bằng chứng:* E6 (`.docs/results/p7-e6-ties/`): đảo tie-break làm NDCG@10 thay đổi nhiều nhất 0.001, nên kết luận không đổi.

## D. Thống kê

**Q19. Sao dùng cả bootstrap lẫn randomization test?**
Bootstrap cho độ lớn của mức cải thiện kèm khoảng tin cậy. Randomization test cho p-value mà không cần giả định phân phối chuẩn. Luật H1 cần cả hai: p sau Holm < 0,05 và đầu dưới CI > 0.

**Q20. Sao cần Holm correction?**
Có 15 phép so sánh xác nhận mỗi dataset (3 giá trị K × 5 nhóm user). Không điều chỉnh thì vài cái sẽ trông có ý nghĩa chỉ do may. Holm kiểm soát chuyện này và vẫn đúng khi các kiểm định chồng lên nhau (nhóm 0–4 chứa nhóm 0 và 1–4).

**Q21. Nếu H1 không pass thì sao?**
Thesis báo cáo đúng như vậy. Một kết quả âm với giao thức sạch vẫn là kết quả hợp lệ. Khi đó "For You" mặc định giữ nguyên, và Chương 7 bàn vì sao.
*Bằng chứng:* super-plan §1, P7 "Default feed rule".

**Q22. H1 có pass không?**
Không, fail ở cả hai test. Trên `syn-W2M-M` (174 user cold-start), H − BL2 = +0.023 (CI −0.002 đến 0.051, p sau Holm 0.680). Trên `digg2009` (20,644 user), H − BL2 = +0.0001 (CI 0.00002 đến 0.0002, p sau Holm 0.335). Cổng H0 pass. Vì vậy "For You" mặc định giữ như hiện tại (Q21). Trên `syn-W2M-M`, phần tăng lớn ở user có 20 interaction trở lên (+0.078, p sau Holm 0.002), không phải ở user mới.
*Bằng chứng:* `.docs/results/p7-main/compare.csv` (family F1), `.docs/results/p7-h0/compare.csv`; bảng e2 và e5 trong `.docs/results/p7-report/results.md`.

## E. Hệ thống

**Q23. Làm sao biết app thật xếp hạng giống như evaluation?**
Cả hai gọi cùng một package, `@breadit/ranking`, nên chỉ khác ở cách nạp dữ liệu. Một parity test so endpoint thật với harness trên 100 cặp (user, thời điểm) lấy mẫu và yêu cầu thứ tự giống hệt. Trên `syn-W2M-M` test pass với cả ba giá trị `algo`: 300 trên 300 thứ tự đầy đủ ở feed module và 300 trên 300 cặp hai trang đầu qua HTTP.
*Bằng chứng:* `docs/System_Architecture.md` §6.4; task 8 (`.docs/results/p6-parity/`, `npm run test:parity -w @breadit/backend`).

**Q24. Người khác có tái lập được các con số không?**
Có. Mọi sự ngẫu nhiên đến từ một seed, điểm là số nguyên, tie-break toàn phần, file ở định dạng chuẩn, và mỗi đầu ra có SHA-256 trong manifest. Double-run test chứng minh đầu ra giống hệt từng byte. `npm run thesis:repro` xoá và dựng lại mọi kết quả Class D, trong khoảng 3 giờ, rồi so mọi hash với `.docs/results/manifest.json`. Độ trễ thuộc Class R, nên lặp lại được nhưng không giống hệt từng byte, và không bị so sánh.
*Bằng chứng:* super-plan §2.

**Q25. Feed mới tốn bao nhiêu?**
Gần như nhau ở cả ba feed. E7 chạy k6 trên `syn-W2M-M`, cache trang tắt, trên một máy: 5 lần chạy, bỏ lần đầu, lấy trung vị kèm CI, và một lần chạy chỉ được tính nếu không có request lỗi nào. Trang 1 có trung vị 35.8 ms với `social`, 35.9 ms với `chrono` và 35.9 ms với `engagement` (chạy với α và β đã tune), và một request gửi khoảng 19.6 đến 19.7 query Prisma ở cả ba. Các khoảng tin cậy chồng lên nhau, nên công thức thêm rất ít. Các con số chỉ so sánh các feed trên một máy; chúng không phải tốc độ tuyệt đối.
*Bằng chứng:* E7 (task 10): `.docs/results/p7-e7/`, bảng e7 trong `.docs/results/p7-report/`, `docs/System_Architecture.md` §6.5.

**Q26. Sao điểm được tính mỗi request mà không lưu sẵn trong bảng?**
Nó là một công thức rẻ trên các số đếm mà database đã có. Tính mỗi request giữ feed luôn mới và không cần batch job. E7 cho thấy chi phí: trung vị 35.8 ms cho trang 1 với `social`, so với 35.9 ms với `chrono`.

**Q27. Sao code xếp hạng nằm trong một package riêng?**
Để evaluation chạy đúng code của production mà không cần khởi động server, database hay cache. Backend import package đó; không ai import phần evaluation.

## F. Giới hạn và đạo đức

**Q28. Các giới hạn chính là gì?**
Không có kiểm thử với user thật (chỉ offline); Digg nhỏ và cũ; bằng chứng về community chỉ từ synthetic; chỉ có positive (không có dislike hay thời gian xem); mỗi user một item held-out. α và β sau khi tune thường nằm ở đỉnh lưới (1,024). Trong dữ liệu synthetic không user nào có danh sách follow từ 1 đến 9 tài khoản, nên mật độ social thấp chưa được kiểm tra. Trên Digg, H bằng BL2 ở ba chữ số thập phân; cách đọc của chúng em là các social term quá nhỏ so với số vote, nhưng điều này **chưa được kiểm tra**.

**Q29. Feed social có tạo ra bong bóng lọc (filter bubble) không?**
Có thể, một feed ưu tiên bạn bè có thể thu hẹp những gì người ta thấy. Coverage@K được báo cáo để cho thấy H có hiển thị ít bài khác nhau hơn các baseline không. Kiểm soát độ đa dạng là future work.
*Bằng chứng:* E1 (`.docs/results/p7-main/coverage.csv`): Coverage@10 trên `syn-W2M-M` là 0.210 cho H và 0.250 cho BL2; trên `digg2009` là 0.144 cho cả hai. BL0 và BL1 (mới nhất trước) phủ nhiều post nhất.

**Q30. Có thêm thời gian thì bạn sẽ làm gì?**
Thêm các mô hình social có học (SoRec, SocialMF, graph neural network) làm baseline, một pilot với user thật hoặc A/B test, phản hồi tiêu cực, và xếp hạng có tính tới độ đa dạng.
*Bằng chứng:* super-plan §9.

## G. Kết quả và nền tảng (thêm ngày 2026-11-19)

**Q31. Tên đề tài có chữ "real-time". Vậy feed có real-time không?**
Không. "Real-time" nghĩa là đẩy (push): server gửi thông báo, tin nhắn riêng, trạng thái đã đọc, tín hiệu đang gõ và lệnh buộc đăng xuất qua WebSocket, và trang cập nhật mà không cần tải lại. Feed được xếp hạng khi user mở hoặc tải lại nó, và bài mới không được đẩy vào một feed đang mở. Thesis cho thấy các sự kiện đến nơi; nó không đo chúng đến nhanh tới mức nào.
*Bằng chứng:* `apps/backend/src/notifications/notifications.gateway.ts`, các IT của socket (`apps/backend/test/it/socket.it-spec.ts`); tài liệu 12 §3.

**Q32. Làm sao bạn ngăn một user đọc tin nhắn của user khác qua socket?**
Server, không phải client, quyết định một socket là của ai. Trước khi kết nối được tạo, server kiểm tra cookie đăng nhập, blacklist khi logout và phiên bản mật khẩu (đặt lại mật khẩu sẽ kết thúc mọi phiên cũ hơn), rồi đưa socket vào room mang username của user đó. Một socket chỉ vào được room của một cuộc trò chuyện nếu database xác nhận nó là thành viên, và sự kiện gõ mang username lấy từ phiên đăng nhập. Điều này sửa finding S1, khi client có thể chọn bất kỳ room nào.
*Bằng chứng:* `authenticate` và `handleJoinConversation` của gateway; `socket.it-spec.ts` ("alice claims to be bob … does NOT get bob's DM"); Bugs Report S1.

**Q33. Trên Digg, khoảng tin cậy của gain nằm trên 0. Vì sao bạn nói H1 fail?**
Luật được cố định trước test split cần cả p Holm dưới 0.05 và khoảng nằm trên 0. Khoảng là 0.000015 đến 0.000225, nhưng p Holm là 0.335: p thô (0.030) đứng thứ 5 từ nhỏ lên trong 15 p của family, nên Holm nhân nó với 11. Và gain chỉ khoảng 0.0001 NDCG, quá nhỏ để có ý nghĩa thực tế.
*Bằng chứng:* `.docs/results/p7-main/compare.csv`, dòng `digg2009,F1,H,BL2,10,0-4`; implementation-plan §3.4; tài liệu 11 §6.

**Q34. Vì sao hybrid giúp user có nhiều lịch sử hơn là user mới?**
Đây là cách đọc của chúng em: nó khớp với các số, nhưng chưa có lần chạy nào tách riêng nó ra (**chưa được kiểm tra**). Với user chưa có lịch sử, smoothing cho mọi followee cùng một trust và mọi community đã tham gia cùng một trọng số, nên điểm chỉ nói được "bài của người bạn follow" hoặc "bài trong community bạn tham gia". Khi lịch sử tăng, các con số đếm của chính user thay thế prior và điểm trở nên cá nhân. Trên `syn-W2M-M`, gain là 0.023 với 0–4 interaction và 0.078 với từ 20 trở lên.
*Bằng chứng:* bảng e2; công thức ở tài liệu 03; Chương 7.

**Q35. Nếu H1 fail, thesis đóng góp được gì?**
Ba điều. Một hybrid score mà app đang chạy, được đo bằng một protocol không leak và tái lập được, so với các baseline đã tune. Một câu trả lời âm rõ ràng: trên các dữ liệu này follow graph đóng góp ít cho user mới, và gain đến từ lịch sử trong community đóng vai một tín hiệu topic. Và một app mà con số offline mô tả đúng feed live (parity test), với một lệnh dựng lại mọi con số.
*Bằng chứng:* super-plan §1 ("a negative result with a clean protocol is still a valid result"); tài liệu 07 và 11.
