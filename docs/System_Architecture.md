# System Architecture

This document describes the high-level architecture of the Breadit application, illustrating how the frontend, backend, database, and external services interact.

## 1. High-Level Overview

Breadit follows a decoupled **Client-Server Architecture** with a Next.js frontend and a NestJS backend. Communication primarily occurs over HTTP (REST) and WebSockets (Real-time).

```mermaid
graph TD
flowchart TD
    %% ==================== STYLES ====================
    classDef client   fill:#F8F7F3,stroke:#5C5A50,stroke-width:2px,color:#2C2C2A,rx:8,ry:8
    classDef frontend fill:#F0EEFF,stroke:#4338CA,stroke-width:2px,color:#1E1B4B,rx:8,ry:8
    classDef backend  fill:#E6F4ED,stroke:#0F766E,stroke-width:2px,color:#164E48,rx:8,ry:8
    classDef persist  fill:#FEF3E8,stroke:#C2410C,stroke-width:2px,color:#431407,rx:8,ry:8
    classDef external fill:#EFF6FF,stroke:#1E40AF,stroke-width:2px,color:#1E3A8A,rx:8,ry:8

    %% ==================== LAYERS ====================
    subgraph Client ["Client Layer"]
        Browser[" Web Browser\n(Next.js Client)"]:::client
    end

    subgraph Frontend ["Frontend — Next.js App Router"]
        direction TB
        MW["Middleware\n(Auth & Route Guard)"]:::frontend
        SSR["Server Components & SSR"]:::frontend
        UI["UI Components"]:::frontend
    end

    subgraph Backend ["Backend API — NestJS"]
        direction TB
        CTRL["REST Controllers"]:::backend
        WS["Socket.IO Gateway"]:::backend
        SVC["Business Services"]:::backend
        ORM["Prisma ORM"]:::backend
    end

    %% ==================== DATA + EXTERNAL (Nằm ngang nhau) ====================
    subgraph DataAndExternal ["Data & External Services"]
        direction LR
        
        subgraph Data ["Data Layer"]
            direction TB
            PG[("PostgreSQL\nMain Database")]:::persist
            RD[("Redis\nCaching & Real-time")]:::persist
        end

        subgraph External ["External Services"]
            direction TB
            SMTP["Email Service\n(Resend / Nodemailer)"]:::external
            CDN["Cloudinary\nMedia Storage"]:::external
        end
    end

    %% ==================== CONNECTIONS ====================
    Browser <-->|"HTTPS / REST"| MW
    Browser <-->|"HTTPS"| SSR
    Browser <-->|"WebSocket"| WS
    Browser <-->|"REST API"| CTRL

    MW --> SSR
    SSR -->|"Server Fetch"| CTRL

    CTRL <--> SVC
    WS <--> SVC
    SVC <--> ORM
    SVC <--> RD
    
    ORM <--> PG
    SVC -->|"Send Email"| SMTP
    SVC -->|"Upload & Serve Media"| CDN

    %% Style connections
    linkStyle default stroke:#475569, stroke-width:2.2px
```

---

## 2. Component Responsibilities

### Frontend (Next.js)
- **SSR (Server-Side Rendering):** Server Components fetch initial data directly from the backend API using internal networking (bypassing the public internet).
- **CSR (Client-Side Rendering):** React components handle user interactivity, state management (TanStack Query), and real-time updates.
- **Session Forwarding:** For SSR requests, the frontend forwards the `breadit_session` cookie to the backend to maintain user context.

### Backend (NestJS)
- **API Layer:** Exposes RESTful endpoints for all business logic (Posts, Users, Communities, etc.).
- **Real-time Layer:** Uses Socket.io to push notifications and messages to connected clients.
- **Security:** Implements JWT validation, Role-Based Access Control (RBAC), and Throttling (Rate Limiting).
- **ORM (Prisma):** Acts as the interface between the application logic and the PostgreSQL database.

### Persistence Layer
- **PostgreSQL:** The primary relational database for all structured data (Users, Posts, Relationships).
- **Redis:** Used for caching and potentially as a message broker for Socket.io scaling.

### External Actors
- **SMTP Server:** Handles outgoing transactional emails (Verification codes, Password reset links).
- **Storage:** Handles file uploads for profile pictures and post media.

---

## 3. Communication Patterns

### Authentication Flow (JWT + Cookies)
1. User provides credentials.
2. Backend validates and returns a **JWT** in an `httpOnly` cookie named `breadit_session`.
3. Subsequent requests (both from Client and Server Components) include this cookie.

### Real-time Notifications
1. An action occurs in the API (e.g., a new "Like").
2. The `NotificationsService` emits an event.
3. The `NotificationsGateway` (Socket.io) identifies the recipient's active socket.
4. The notification is pushed instantly to the user's browser.

### Data Fetching Strategy
- **Initial Load:** Server Components perform `serverFetch` to minimize TTI (Time to Interactive).
- **Dynamic Content:** Client-side TanStack Query handles pagination (Infinite Scroll) and optimistic updates.

**Sơ đồ kết hợp của pre-thesis+ thesis**
flowchart TD
    %% ==================== STYLES =======**=============
    classDef client   fill:#F8F7F3,stroke:#5C5A50,stroke-width:2px,color:#2C2C2A,rx:8,ry:8
    classDef frontend fill:#F0EEFF,stroke:#4338CA,stroke-width:2px,color:#1E1B4B,rx:8,ry:8
    classDef backend  fill:#E6F4ED,stroke:#0F766E,stroke-width:2px,color:#164E48,rx:8,ry:8
    classDef persist  fill:#FEF3E8,stroke:#C2410C,stroke-width:2px,color:#431407,rx:8,ry:8
    classDef external fill:#EFF6FF,stroke:#1E40AF,stroke-width:2px,color:#1E3A8A,rx:8,ry:8
    classDef ml       fill:#FDF2F8,stroke:#DB2777,stroke-width:2px,color:#831843,rx:8,ry:8

    %% ==================== LAYERS ====================
    subgraph Client ["Client Layer"]
        Browser[" Web Browser\n(ForYou & Explore Feeds)"]:::client
    end

    subgraph Frontend ["Frontend — Next.js App Router"]
        direction TB
        MW["Middleware\n(Auth & Route Guard)"]:::frontend
        SSR["Server Components & SSR"]:::frontend
        UI["UI Components"]:::frontend
    end

    subgraph Backend ["Backend API — NestJS"]
        direction TB
        CTRL["REST Controllers\n(/api/posts, /api/recommendations)"]:::backend
        WS["Socket.IO Gateway"]:::backend
        
        subgraph AlgEngine ["Algorithmic Engine"]
            direction LR
            TrendingSvc["Trending Service\n(Online, Rule-Based)"]:::backend
            RecSvc["Recommendation Service\n(Pre-calculated Serving)"]:::backend
        end
        
        SVC["Business Services"]:::backend
        ORM["Prisma ORM"]:::backend
    end

    %% ==================== DATA, EXT & ML SERVICES ====================
    subgraph Infrastructure ["Infrastructure & Pipeline Services"]
        direction LR
        
        subgraph Data ["Data Layer"]
            direction TB
            PG[("PostgreSQL\n(Main DB & Recs Table)")]:::persist
            RD[("Redis\n(Caching & WS Adapter)")]:::persist
        end

        subgraph External ["External Services"]
            direction TB
            SMTP["Email Service\n(Resend / Nodemailer)"]:::external
            CDN["Cloudinary / Local\n(Media Storage)"]:::external
        end
        
        subgraph MLPipeline ["Offline Recommendation Pipeline"]
            direction TB
            DataExport["Data Exporter / ETL"]:::ml
            TrainScript["ML Model Script\n(Python / LightFM)"]:::ml
        end
    end

    %% ==================== CONNECTIONS ====================
    %% Client & Next.js Frontend / NestJS Backend
    Browser <-->|"HTTPS / REST (Page navigation)"| MW
    Browser <-->|"HTTPS (HTML SSR)"| SSR
    Browser <-->|"WebSocket (Notifications/DMs)"| WS
    Browser <-->|"REST API Requests"| CTRL

    MW --> SSR
    SSR -->|"Server Fetch (internal)"| CTRL

    %% Backend Internals & Algorithmic Services
    CTRL <--> SVC
    CTRL <--> TrendingSvc
    CTRL <--> RecSvc
    WS <--> SVC
    
    SVC <--> ORM
    SVC <--> RD
    
    %% Online Trending Flow (Thời gian thực)
    TrendingSvc <-->|"Fetch posts for scoring"| ORM
    TrendingSvc <-->|"Cache hot feeds (TTL)"| RD
    
    %% Serve Pre-calculated Recommendations Flow
    RecSvc <-->|"Fetch User Recommendations"| ORM
    
    %% Database Connection
    ORM <--> PG
    SVC -->|"Send Email"| SMTP
    SVC -->|"Upload & Serve Media"| CDN

    %% Offline ML Pipeline Flow (Huấn luyện định kỳ)
    PG -->|"1. Export raw interaction logs"| DataExport
    DataExport -->|"2. Train & Evaluate"| TrainScript
    TrainScript -->|"3. Save Top-K Recs"| PG

    %% Style connections
    linkStyle default stroke:#475569, stroke-width:2.2px


**Sơ đồ ban đầu của thesis**
flowchart TB
    %% Định nghĩa Style
    classDef client fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#004d40,rx:5px,ry:5px;
    classDef frontend fill:#ede7f6,stroke:#5e35b1,stroke-width:2px,color:#311b92,rx:5px,ry:5px;
    classDef backend fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#1b5e20,rx:5px,ry:5px;
    classDef persistence fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#e65100,rx:5px,ry:5px;
    classDef ml fill:#fce4ec,stroke:#d81b60,stroke-width:2px,color:#880e4f,rx:5px,ry:5px;

    %% Client Layer
    subgraph ClientLayer ["Client Browser"]
        Client["Web Browser <br>(ForYou & Explore Feeds)"]:::client
    end

    %% Frontend Server
    subgraph FrontendApp ["Frontend Server (Next.js)"]
        direction TB
        SSR["Server Components (SSR)"]:::frontend
        Middleware["Next.js Middleware"]:::frontend
    end

    %% Backend Server
    subgraph BackendApp ["Backend API (NestJS + Fastify)"]
        direction TB
        Controllers["REST Controllers <br>(/api/posts, /api/recommendations)"]:::backend
        
        subgraph AlgComponents ["Algorithmic Engine"]
            TrendingSvc["Trending Service <br>(Online, Rule-Based Scoring)"]:::backend
            RecSvc["Recommendation Service <br>(Pre-calculated Serving)"]:::backend
        end
        
        Services["Core Services <br>(Auth, Posts, Users)"]:::backend
        PrismaORM["Prisma ORM Client"]:::backend
    end

    %% Persistence Layer
    subgraph DataLayer ["Persistence & Caching"]
        direction LR
        Postgres[("PostgreSQL DB <br>(Thêm bảng UserRecommendation)")]:::persistence
        Redis[("Redis Cache <br>(Cache danh sách Trending)")]:::persistence
    end

    %% Offline ML Pipeline
    subgraph MLPipeline ["Offline Recommendation Pipeline (Batch ML)"]
        direction TB
        DataExport["Data Exporter / ETL <br>(Trích xuất Likes, Comments, Follows)"]:::ml
        TrainScript["Offline ML Script <br>(Python / LightFM / Matrix Factorization)"]:::ml
        Evaluation["Offline Evaluator <br>(Đo lường NDCG@K, Recall@K)"]:::ml
    end

    %% Kết nối luồng
    Client <-->|"Fetch feeds & recommendations"| Controllers
    Middleware <--> SSR
    SSR -->|"Internal Fetch"| Controllers
    
    Controllers <--> AlgComponents
    AlgComponents <--> Services
    Services <--> PrismaORM
    PrismaORM <--> Postgres
    
    %% Online Trending Flow (Thời gian thực)
    TrendingSvc -->|"1. Đọc tương tác trực tiếp"| PrismaORM
    TrendingSvc -->|"2. Cache kết quả Hot-list (TTL)"| Redis
    
    %% Offline ML Recommendation Flow (Chạy định kỳ)
    Postgres -->|"1. Trích xuất tương tác lịch sử"| DataExport
    DataExport -->|"2. Train & Eval Model"| TrainScript
    TrainScript -->|"3. Ghi điểm Top-K Recs"| Postgres
    
    %% Serve Recs Flow
    RecSvc -->|"Đọc Top-K Recs đã lưu"| PrismaORM



