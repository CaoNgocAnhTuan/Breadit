# Breadit (X Clone) - Use Case Diagrams

Biểu đồ này được tôi trích xuất rà soát lại **100% toàn bộ các API Controllers** hiện có trong thư mục `apps/backend/src`. Mọi tính năng hiển thị dưới đây đều ĐÃ ĐƯỢC CODE THỰC TẾ, không bỏ sót bất kỳ một API nào.

## 1. Actor Hierarchy (Sơ đồ phân cấp Actor)

```mermaid
flowchart TD
    Guest(["Guest (Khách chưa đăng nhập)"])
    User(["User (Người dùng đã xác thực)"])
    Mod(["Community Moderator (Quản trị viên cộng đồng)"])
    Admin(["Admin (Quản trị viên hệ thống)"])
    Email(["Email Service (Hệ thống Email)"])

    User -. "Kế thừa quyền" .-> Guest
    Mod -. "Kế thừa quyền" .-> User
    Admin -. "Kế thừa quyền" .-> User
```

## 2. Phân hệ Authentication (Xác thực & Tài khoản)
*(Dựa trên `auth.controller.ts`)*

```mermaid
flowchart LR
    Guest([Guest])
    User([User])
    Email([Email Service])

    subgraph Auth & Identity
        UC_A1(Sign Up / Register)
        UC_A2(Sign In / Login)
        UC_A3(Logout)
        UC_A4(Verify Email)
        UC_A5(Resend Verification)
        UC_A6(Forgot Password)
        UC_A7(Reset Password)
        UC_A8(Load Session / Me)
    end

    Guest --> UC_A1
    Guest --> UC_A2
    Guest --> UC_A6
    Guest --> UC_A7
    
    User --> UC_A3
    User --> UC_A4
    User --> UC_A5
    User --> UC_A8

    UC_A1 -. "Triggers" .-> Email
    UC_A5 -. "Triggers" .-> Email
    UC_A6 -. "Triggers" .-> Email
```

## 3. Phân hệ Feed & Discovery (Bảng tin & Khám phá)
*(Dựa trên `posts.controller.ts`, `search.controller.ts`, `hashtags.controller.ts`, `users.controller.ts`)*

```mermaid
flowchart LR
    Guest([Guest])
    User([User])

    subgraph Feed & Search
        UC_F1(Browse Home Feed)
        UC_F2(View Trending Hashtags)
        UC_F3(View Posts by Hashtag)
        UC_F4(Global Search Content)
        UC_F5(View Recommendations)
        UC_F6(View Connect/Who to follow)
    end

    Guest --> UC_F2
    Guest --> UC_F3
    Guest --> UC_F4
    
    User --> UC_F1
    User --> UC_F5
    User --> UC_F6
```

## 4. Phân hệ Post & Comment Management (Quản lý Bài viết & Bình luận)
*(Dựa trên `posts.controller.ts`, `comments.controller.ts`)*

```mermaid
flowchart LR
    Guest([Guest])
    User([User])
    Admin([Admin])

    subgraph Posts & Comments
        UC_P1(View Post & Comments)
        UC_P2(Create Post + Media)
        UC_P3(Edit Own Post)
        UC_P4(Delete Own Post)
        UC_P5(Report Post)
        UC_P6(Reply / Create Comment)
        UC_P7(Edit Own Comment)
        UC_P8(Delete Own Comment)
    end

    Guest --> UC_P1
    
    User --> UC_P2
    User --> UC_P3
    User --> UC_P4
    User --> UC_P5
    User --> UC_P6
    User --> UC_P7
    User --> UC_P8

    UC_P5 -. "Enters Queue" .-> Admin
```

## 5. Phân hệ Interactions & Social Graph (Tương tác & Mạng xã hội)
*(Dựa trên `interactions.controller.ts`, `users.controller.ts`, `comments.controller.ts`)*

```mermaid
flowchart LR
    User([User])

    subgraph Interactions
        UC_I1(Like / Unlike Post)
        UC_I2(Like / Unlike Comment)
        UC_I3(Bookmark / Save Post)
        UC_I4(View Saved Posts)
        UC_I5(Repost / Quote-Repost)
    end

    subgraph Social Graph
        UC_S1(Follow / Unfollow User)
        UC_S2(Block / Unblock User)
        UC_S3(View Blocked List)
    end

    User --> UC_I1
    User --> UC_I2
    User --> UC_I3
    User --> UC_I4
    User --> UC_I5
    
    User --> UC_S1
    User --> UC_S2
    User --> UC_S3
```

## 6. Phân hệ Profile, Notifications & Messaging (Hồ sơ, Thông báo & Tin nhắn)
*(Dựa trên `users.controller.ts`, `notifications.controller.ts`, `messages.controller.ts`)*

```mermaid
flowchart LR
    Guest([Guest])
    User([User])

    subgraph Profile
        UC_PR1(View Own/Other Profile)
        UC_PR2(Edit Own Profile)
        UC_PR3(View Followers/Following)
    end

    subgraph Messaging
        UC_MG1(Find/Create Conversation)
        UC_MG2(Search Conversations)
        UC_MG3(Send Message)
        UC_MG4(View Messages & Unread Count)
        UC_MG5(Mark Message as Read)
    end

    subgraph Notifications
        UC_NT1(View Notifications List)
        UC_NT2(Mark as Read Single)
        UC_NT3(Mark All as Read)
    end

    Guest --> UC_PR1
    Guest --> UC_PR3

    User --> UC_PR2
    
    User --> UC_MG1
    User --> UC_MG2
    User --> UC_MG3
    User --> UC_MG4
    User --> UC_MG5

    User --> UC_NT1
    User --> UC_NT2
    User --> UC_NT3
```

## 7. Phân hệ Communities (Cộng đồng)
*(Dựa trên `communities.controller.ts`)*

```mermaid
flowchart LR
    Guest([Guest])
    User([User])
    Mod([Community Moderator])

    subgraph Community Usage
        UC_C1(Browse/Search Communities)
        UC_C2(View Community by Slug)
        UC_C3(Join / Leave Community)
        UC_C4(Create Community)
        UC_C5(Post inside Community)
    end

    subgraph Community Moderation
        UC_M1(Edit Community / Images)
        UC_M2(Add / Remove Rules)
        UC_M3(View Pending Posts)
        UC_M4(Moderate Post - Approve/Remove)
        UC_M5(Ban / Unban / View Banned Members)
        UC_M6(Promote Member)
        UC_M7(Transfer Ownership / Delete)
    end

    Guest --> UC_C1
    Guest --> UC_C2

    User --> UC_C3
    User --> UC_C4
    User --> UC_C5

    Mod --> UC_M1
    Mod --> UC_M2
    Mod --> UC_M3
    Mod --> UC_M4
    Mod --> UC_M5
    Mod --> UC_M6
    Mod --> UC_M7
```

## 8. Phân hệ System Admin (Quản trị hệ thống)
*(Dựa trên `admin.controller.ts`)*

```mermaid
flowchart LR
    Admin([Admin])

    subgraph Administration
        UC_A1(View Users List)
        UC_A2(Ban / Unban User)
        UC_A3(View Reports List)
        UC_A4(Dismiss Report)
        UC_A5(Delete Reported Post)
    end

    Admin --> UC_A1
    Admin --> UC_A2
    Admin --> UC_A3
    Admin --> UC_A4
    Admin --> UC_A5
```
