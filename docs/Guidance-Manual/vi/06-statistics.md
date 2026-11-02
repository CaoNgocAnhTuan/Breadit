# 06 · Thống kê

[Sổ tay hướng dẫn](../Guidance-Manual.md) · [English](../en/06-statistics.md) · Tiếng Việt

**Đọc xong bạn sẽ:** giải thích được vì sao một mức cải thiện cần thống kê, tự tính hiệu theo cặp, giải thích bằng lời đơn giản khoảng tin cậy bootstrap, randomization test và Holm correction, và áp dụng được luật H1 và H0.

Nguồn: super-plan §5 "Statistics", implementation-plan §3.3 tới §3.5, `eval/src/stats.ts`. Thuật ngữ: [09 Bảng thuật ngữ](09-glossary.md). Nên đọc [05](05-evaluation-protocol.md) trước.

---

## 1. Vì sao cần thống kê?

Giả sử H có NDCG@10 = 0,120 và BL2 có 0,105 trên 174 user cold-start. H tốt hơn thật, hay chỉ may với nhóm user này? Với một mẫu user khác, thứ tự có thể đảo ngược. Thống kê cho ta biết hiệu này có thể dao động bao nhiêu do ngẫu nhiên, và nó có còn nằm trên 0 không.

## 2. Bước 1: ghép cặp theo user

Với mỗi user i, tính `d_i = NDCG@10(H) − NDCG@10(BL2)`.

Ghép cặp rất quan trọng. Có user dễ (lựa chọn của họ phổ biến, phương pháp nào cũng xếp cao) và có user khó. Nếu so hai trung bình tách rời, sự chênh lệch giữa các user sẽ che mất hiệu. Lấy hiệu **theo từng user** loại bỏ được chuyện đó.

**Ví dụ xuyên suốt** (8 user, tính bằng chính `eval/src/stats.ts`):

| User | Rank H | Rank BL2 | NDCG H | NDCG BL2 | d |
|---|---|---|---|---|---|
| 1 | 1 | 3 | 1 | 0,5 | 0,5 |
| 2 | 1 | 2 | 1 | 0,631 | 0,369 |
| 3 | 15 | 12 | 0 | 0 | 0 |
| 4 | 4 | 4 | 0,431 | 0,431 | 0 |
| 5 | 2 | 3 | 0,631 | 0,5 | 0,131 |
| 6 | 3 | 2 | 0,5 | 0,631 | −0,131 |
| 7 | 3 | 30 | 0,5 | 0 | 0,5 |
| 8 | 11 | 20 | 0 | 0 | 0 |

Trung bình d = **0,171**. H trông có vẻ tốt hơn. Có thật không?

## 3. Bước 2: khoảng tin cậy bootstrap

**Ý tưởng:** ta chỉ có một mẫu user. Hãy coi nó là toàn bộ tổng thể, rồi rút ra nhiều mẫu mới từ nó **có hoàn lại** (có user xuất hiện hai lần, có user không xuất hiện). Tính trung bình d của từng mẫu. Độ trải của các trung bình này cho thấy trung bình có thể dịch chuyển bao nhiêu với những user khác.

**Cách làm** (10.000 mẫu lấy lại, luồng `bootstrap`): lấy 95% ở giữa của 10.000 trung bình. Đó là **khoảng tin cậy 95% (CI)**.

**Ví dụ:** CI = [**0,016**, **0,342**]. Toàn bộ khoảng nằm trên 0.

## 4. Bước 3: randomization test (p-value)

**Ý tưởng:** nếu H và BL2 thật ra như nhau, thì nhãn "H" hay "BL2" trên hai con số của mỗi user là tuỳ ý. Vậy hãy đổi nhãn ngẫu nhiên: đổi dấu mỗi d_i với xác suất ½, rồi tính trung bình. Lặp lại thật nhiều lần. Nếu trung bình thật là bất thường so với các trung bình đã xáo, thì hiệu đó có lẽ là thật.

**p-value** = tỉ lệ số lần xáo có |trung bình| lớn ít nhất bằng |trung bình| thật. Hai phía: thua đậm cũng tính là bất thường. Công thức của ta: `p = (1 + count) / (10.000 + 1)`, luồng `permutation`.

**Ví dụ:** chỉ với 8 user, có 2^8 = 256 kiểu đổi dấu, nên ta đếm hết được: **p = 0,1875**. Khoảng 1 trên 5 cách gán nhãn ngẫu nhiên cho ra hiệu lớn như vậy. Chưa thuyết phục.

## 5. Hai công cụ có thể nói khác nhau

Trong ví dụ, CI nói "nằm trên 0" nhưng p-value nói "có thể do ngẫu nhiên". Với 8 user, khoảng bootstrap quá hẹp (nó không thấy được những biến động mà 8 user này không thể hiện). Đây là một lý do luật H1 đòi **cả hai** điều kiện (mục 7). Với hàng trăm user, hai công cụ thường đồng ý, nhưng luật không trông vào may mắn.

## 6. Bước 4: Holm correction

Mỗi kiểm định có 5% khả năng "thắng" giả. Chạy 15 kiểm định thì khả năng có ít nhất một lần thắng giả cao hơn nhiều. **Holm** (1979) sửa điều này:

1. Sắp m p-value từ nhỏ tới lớn.
2. Nhân cái nhỏ nhất với m, cái tiếp theo với m − 1, và cứ thế.
3. Giữ kết quả không giảm (mỗi p đã điều chỉnh ít nhất bằng cái trước nó), và chặn trên ở 1.

**Ví dụ** với m = 4: p = 0,01, 0,02, 0,03, 0,20.
- 0,01 × 4 = 0,04
- 0,02 × 3 = 0,06
- 0,03 × 2 = 0,06
- 0,20 × 1 = 0,20

Ở mức 0,05, chỉ cái đầu tiên pass. Nếu không điều chỉnh thì ba cái sẽ pass.

Holm vẫn đúng khi các kiểm định chồng lên nhau, điều quan trọng ở đây: nhóm 0–4 chứa nhóm 0 và nhóm 1–4.

## 7. Các family và các luật

| Family | Các phép so sánh | Số lượng mỗi dataset | Vai trò |
|---|---|---|---|
| F1, xác nhận | H − BL2 cho K = 5, 10, 20 và các nhóm 0, 1–4, 0–4, 5–19, 20+ | 15 | chứa kiểm định H1 |
| F2, phụ | H − từng BL0, BL1, BL2t, BL3, BL4, BL5, BL6, cho mỗi K và các nhóm 0–4, 5–19, 20+, all | 84 | bối cảnh: H đứng thế nào so với mọi baseline |

Chỉ `syn-W2M-M` và `digg2009` có F1 và F2. Mọi thứ khác (W0, W1, W2L, W2H, ablation, E6, E8, nhóm mật độ) chỉ có CI bootstrap, không có p-value.

**H1 pass trên một dataset** khi dòng F1 "NDCG@10, nhóm 0–4" có p sau Holm < 0,05 **và** đầu dưới CI > 0.

**Cổng H0:** trên `syn-W0-M`, CI của H − BL2 (NDCG@10, mọi user) **không được** nằm hẳn trên 0. Nó là một cổng chặn, không phải thành viên của family nào.

## 8. Common random numbers

Mỗi phép so sánh khởi động lại luồng ngẫu nhiên từ seed. Vậy H − BL2 và H − BL5 dùng đúng cùng các mẫu lấy lại và cùng các lần đổi dấu. Có hai lợi ích: số liệu của một phép so sánh không phụ thuộc vào việc các phép khác đã được tính trước hay chưa, và chạy lại cho cùng con số tới từng byte.

## 9. Kiểm chéo với scipy

Phần thống kê viết bằng TypeScript đã được kiểm một lần với scipy 1.16.3 của Python trên một bộ dữ liệu nhỏ đã commit: p hoán vị chính xác bằng nhau (0,014404296875), và CI bootstrap nằm trong dung sai. Python chỉ được dùng cho lần kiểm này.

## 10. Độ lớn hiệu ứng và ý nghĩa thống kê

Một mức cải thiện rất nhỏ vẫn có thể có ý nghĩa thống kê khi có nhiều user (Digg có 20.644 user cold-start được giữ lại). Vì vậy luôn báo cáo **hiệu trung bình và CI của nó**, không chỉ "p < 0,05". Các bảng trong thesis có cả hai.

## 11. Tự kiểm tra

1. Vì sao hiệu theo cặp tốt hơn so sánh hai trung bình?
2. Bằng lời đơn giản, một lần lấy mẫu lại bootstrap làm gì?
3. Trong ví dụ, p = 0,19 nghĩa là gì?
4. Holm với p = 0,004, 0,03, 0,04 (m = 3): cái nào pass ở mức 0,05? *(0,012 pass; 0,06 và 0,06 không pass.)*
5. Vì sao W0 có CI nhưng không có p-value trong family nào?
