# Đề Xuất Tính Năng Admin Nâng Cao (Advanced Admin Features Proposal)

Tài liệu này đề xuất các tính năng quản trị mở rộng cho vai trò **Global Administrator (Admin)** trên nền tảng Breadit. Các tính năng này được thiết kế để tích hợp vào phần **Hướng phát triển tương lai (Future Work)** trong báo cáo hệ thống, giúp nâng cao năng lực quản trị, bảo mật và vận hành nền tảng.

---

## 1. Hiện Trạng Hệ Thống Admin Hiện Tại
Hiện tại, vai trò Admin trên Breadit đang đảm nhận các nhiệm vụ kiểm duyệt cốt lõi:
*   **Quản lý người dùng:** Xem danh sách toàn bộ tài khoản và thực hiện cấm/mở cấm (`Ban/Unban`) truy cập viết bài trên toàn trang.
*   **Xử lý báo cáo:** Xem hàng đợi các bài đăng bị người dùng báo cáo vi phạm (`Reports Queue`), lựa chọn bỏ qua (`Dismiss`) hoặc xóa bài đăng đó khỏi hệ thống (`Delete Post`).

---

## 2. Các Tính Năng Đề Xuất Nâng Cao

### 2.1. Bảng Thống Kê & Phân Tích Hệ Thống (Dashboard & Analytics)
*   **Mô tả:** Giao diện trực quan hóa dữ liệu (charts) giúp Admin theo dõi sức khỏe và mức độ tăng trưởng của mạng xã hội.
*   **Các chỉ số cần thống kê:**
    *   Lượng người dùng đăng ký mới theo ngày/tuần/tháng.
    *   Tốc độ tăng trưởng bài đăng và lượng tương tác (Like, Comment, Repost).
    *   Danh sách các cộng đồng hoạt động tích cực nhất (Top Active Communities).
*   **Gợi ý kỹ thuật:** Tích hợp thư viện biểu đồ phía Frontend (Chart.js / Recharts) kết hợp với các truy vấn tổng hợp dữ liệu định kỳ trên Backend để tránh ảnh hưởng đến hiệu năng DB chính.

### 2.2. Quản Lý Cộng Đồng Toàn Cục (Global Community Management)
*   **Mô tả:** Admin hệ thống có quyền can thiệp vào các cộng đồng (`Community`) nội bộ để đảm bảo tuân thủ điều khoản chung.
*   **Các chức năng chi tiết:**
    *   Duyệt danh sách toàn bộ cộng đồng trên trang.
    *   Tạm khóa (Lock/Freeze) hoặc xóa vĩnh viễn cộng đồng nếu phát hiện nội dung độc hại mà Moderator của cộng đồng đó không xử lý.
    *   Can thiệp bổ nhiệm hoặc tước quyền các Moderator cộng đồng trực tiếp từ bảng Admin.

### 2.3. Bộ Lọc Nội Dung Tự Động (Global Word Filter & Censorship)
*   **Mô tả:** Hệ thống tự động phát hiện và xử lý sớm các nội dung vi phạm dựa trên từ khóa nhạy cảm.
*   **Các chức năng chi tiết:**
    *   Admin cấu hình danh sách "Từ khóa cấm" (Banned Words) trong trang quản trị.
    *   Khi người dùng đăng bài viết/bình luận, hệ thống tự động quét. Nếu chứa từ cấm, bài đăng sẽ bị:
        *   *Phương án 1:* Ẩn ngay lập tức và gửi thông báo cảnh cáo cho người dùng.
        *   *Phương án 2:* Chuyển thẳng vào hàng đợi phê duyệt của Admin (Pending Queue) và gắn cờ cảnh báo.
*   **Gợi ý kỹ thuật:** Sử dụng Redis để lưu cache danh sách từ khóa cấm nhằm tối ưu hóa tốc độ đối khớp chuỗi (Aho-Corasick algorithm) ở tầng Backend Middleware trước khi lưu xuống Database.

### 2.4. Nhật Ký Hoạt Động Của Admin (Admin Audit Logs)
*   **Mô tả:** Lưu lại lịch sử toàn bộ các hành động mang tính quản trị trên hệ thống để phục vụ công tác giám sát và bảo mật.
*   **Các thông tin cần ghi nhận:**
    *   Tên Admin thực hiện hành động.
    *   Hành động (Ban user, Unban, Xóa post, Khóa cộng đồng).
    *   Đối tượng chịu tác động (User ID, Post ID, Community ID).
    *   Lý do thực hiện và thời gian cụ thể (Timestamp).
*   **Gợi ý kỹ thuật:** Thiết kế một bảng Database riêng biệt (`AuditLog`) chỉ cho phép ghi (`INSERT`), tuyệt đối không cho phép cập nhật (`UPDATE`) hoặc xóa (`DELETE`) để đảm bảo tính toàn vẹn của lịch sử truy vết.

### 2.5. Thông Báo Toàn Hệ Thống (System Announcement / Broadcast)
*   **Mô tả:** Admin gửi thông báo khẩn cấp hoặc tin tức quan trọng đến toàn bộ người dùng đang hoạt động trên nền tảng.
*   **Các chức năng chi tiết:**
    *   Soạn nội dung thông báo và cấu hình thời gian hiển thị.
    *   Gửi thông báo xuất hiện dưới dạng banner nổi bật ở đầu trang (Top Alert Banner) hoặc đẩy trực tiếp vào danh sách thông báo của tất cả user.
*   **Gợi ý kỹ thuật:** Sử dụng Socket.IO room đặc biệt (ví dụ room `global`) để phát sóng (broadcast) sự kiện thời gian thực đến tất cả các client đang kết nối ngay lập tức mà không cần F5 trang.
