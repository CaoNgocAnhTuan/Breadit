# CHAPTER 7: CONCLUSION & FUTURE WORKS

The Breadit Social Network Platform successfully integrates features for personalized content recommendations and real-time trending feeds, enhancing the user browsing and interaction experience. It provides a fully web-based interface accessible across modern browsers, with a responsive design that adapts to desktop and mobile viewports. The system includes both community moderator and global admin functionalities, enabling efficient content governance, user management, and report handling. Secure authentication, robust database management with PostgreSQL and Redis, and performance-optimized pagination ensure scalability and reliability, while user-friendly interfaces make the platform accessible to diverse audiences.

---

## 7.1. Achievement of Research Contributions and Goals

We evaluate the quality and success of the implemented Breadit platform against the initial Problem Statement and the three primary Research Contributions (C1, C2, C3) defined in Chapter 1:

1. **C1: Hybrid Social Networking Architecture Evaluation:**
   * *Goal:* Address the contextual fragmentation and unorganized discussions caused by flat-reply structures in contemporary social media.
   * *Result:* Breadit successfully unifies Reddit-style community threaded discussions and Twitter-style microblogging. Recursive parent-child relational mappings and client-side nested rendering allow multi-user conversations to maintain structural context. Qualitative validation of core use cases (UC-26, UC-27) confirmed that parallel sub-discussions co-exist without layout clutter or contextual fragmentation, satisfying Pillar 1.
2. **C2: Transparent, Deterministic Explore Feed Algorithm Evaluation:**
   * *Goal:* Solve the "information noise" problem and prevent content monopolization in social feeds using an auditable, deterministic ranking heuristic instead of opaque, non-interpretable machine learning models.
   * *Result:* The content discovery engine was validated qualitatively in Section 5.5 against a like-count baseline. The empirical scoring scores proved that our linear time-decay formula ($Score = Likes \times 1 + Comments \times 2 + Reposts \times 3 - AgeHours \times 0.25$) successfully penalizes older content to prioritize freshness, while the author-diversity filter (capping at 3 posts per author) ensures feed variety and prevents content monopolization, satisfying Pillar 2.
3. **C3: Real-Time Social Interaction Layer Evaluation:**
   * *Goal:* Deliver instant push notifications and bidirectional feedback loops without page reloads to resolve the stale user interface problems typical of traditional social networks.
   * *Result:* The Socket.IO WebSocket gateway, integrated with a Redis Pub/Sub adapter, was validated under active load. Real-world network telemetry in Section 5.4 recorded a round-trip notification delivery latency of **23.62 ms** (from a user action like a "like" to client reception). This sub-30ms performance establishes an instant, full-duplex social interaction layer, satisfying Pillar 3.
4. **Performance, Reliability, and Security (Non-Functional Requirements):**
   * *Goal:* Sustain high concurrent performance, prevent database read bottlenecks, and secure sensitive authentication endpoints under load.
   * *Result:*
     * *Caching & Feeds:* Redis query caching yielded a **69.19% hit rate** under load. k6 load testing under concurrent load verified consistent response times for the Explore Feed (**8.39 ms** average) with a **0.00% HTTP failure rate**, validating cursor-based pagination stability.
     * *Security:* Custom JWT secure cookie propagation (HTTP-only) satisfies XSS mitigation (NFR-SEC-01), while Redis-backed rate limiting successfully mitigates brute-force vulnerabilities by returning HTTP 429 after 10 requests.
     * *Usability:* Next.js SSR pre-rendering resulted in a Lighthouse **SEO score of 100/100** and FCP of **400 ms**, ensuring indexing readiness.

---

## 7.2. System Limitations

Despite meeting the non-functional requirements, the current Breadit implementation has several limitations that must be acknowledged:

1. **Content Cold-Start Problem:**
   * The time-decay trending algorithm relies heavily on engagement metrics (likes, comments, reposts). Brand new posts or posts by new users with low initial visibility face a "cold-start" period where they struggle to surface in the Explore feed, even if the content is highly relevant.
2. **Local Single-Instance Evaluation:**
   * Although the backend is designed to scale horizontally using a Redis Pub/Sub adapter for WebSockets and a Redis-backed throttler, the system has only been evaluated in a single-instance containerized local Docker environment. High-availability clustering, database replication lag, and multi-region network latency have not been tested under production cloud loads.
3. **Lack of Offline Notification Fallbacks:**
   * Real-time notifications are only delivered if the target user is actively connected via WebSockets. The system currently lacks fallback mechanisms (such as email digests, SMS, or native Web Push notifications) to notify offline users of urgent direct messages or interactions.
4. **Synchronous Media Processing Overhead:**
   * Uploading and processing images on the Fastify backend (handling multi-part files and uploading to Cloudinary) runs synchronously on the main Node.js event loop. Processing very large media payloads can block execution, temporarily slowing down concurrent lightweight API requests.

---

## 7.3. Hướng phát triển tương lai (Future Works)

Based on the evaluation and limitations, we propose the following directions for future research and engineering enhancements:

### 7.3.1. Deployment and Cloud Infrastructure
* **Production Cloud Deployment:** Transition from local Docker Compose to a fully production-ready cloud architecture. This includes containerizing services to AWS ECS/EKS, deploying PostgreSQL on a managed multi-AZ database service (AWS RDS), and setting up autoscaling groups behind an Application Load Balancer.

### 7.3.2. Multi-Platform Integration
Provide seamless access to the Breadit Social Network across multiple platforms:
* **Mobile Application:** Develop mobile apps for iOS and Android using React Native or Expo, consuming the existing NestJS REST API and Socket.IO gateway.
  * *Full social functionality:* Browsing feeds (For You, Explore, Hashtag, Community), creating posts with media attachments, and interacting (like, repost, comment, bookmark).
  * *Real-time push notifications:* Push notifications for new likes, comments, mentions, follows, and direct messages.
  * *Moderation on the go:* Community management interface for Moderators to approve posts and manage membership.
* **Desktop Application:**
  * Create a desktop version using Tauri or Electron for cross-platform compatibility (Windows, macOS, Linux).
  * Replicate the full web feature set, optimized for larger screens and keyboard-driven navigation.
  * Add desktop-native features such as system tray notifications for real-time events (new messages, mentions) and native file-picker integration for media uploads.

### 7.3.3. Trending and Recommendation Module Upgrade
* **Online Scoring Pipeline:** Upgrade the Explore Feed from its current rule-based time-decay scoring model to an online learning approach, updating post rankings in near real-time as interaction events stream in, so that trending content reflects the last few minutes of activity rather than the last cache TTL window.
* **Implicit Feedback Modeling:** Extend the For You Feed offline pipeline (currently Matrix Factorization / LightFM) by incorporating richer implicit signals such as post view duration events (PostView table), allowing the model to distinguish between posts that were scrolled past and posts that were genuinely read, improving Recall@K and NDCG@K scores.
* **Progressive Web App (PWA) Features:** Enable offline caching of the last-seen feed via Service Workers and a Web App Manifest, allowing users to browse cached content without an active internet connection and install Breadit as a home-screen shortcut on mobile devices.

### 7.3.4. Enhanced AI Capabilities
* **NLP-Assisted Topic Extraction:** Replace the current keyword-based hashtag parsing with an NLP topic extraction model that automatically infers relevant topics from post text even when the author does not include explicit hashtags, enriching feed targeting and search discovery.
* **Automated Toxicity Detection:** Introduce a toxicity detection classifier (e.g., a fine-tuned BERT-based model) into the content moderation pipeline to automatically flag or quarantine posts and comments containing harmful or abusive language before they reach other users, reducing the moderation burden on Admins and Community Moderators.
* **Cross-Community Recommendation:** Surface posts from communities a user has not yet joined but whose content is statistically similar to communities they actively engage with, increasing organic community discovery and platform growth.

### 7.3.5. Public API and Integration
* **Social Login Integration:** Integrate third-party identity providers (Google OAuth, GitHub OAuth) to enable social login, reducing registration friction and increasing conversion rates.
* **Public API Developer Portal:** Expose a public API (with OAuth 2.0 scopes) allowing third-party clients to read public feeds, post on behalf of users, and embed Breadit content widgets in external websites.
* **Webhook Subscriptions:** Enable webhook subscriptions so external services can receive real-time callbacks for events such as new posts in a community, enabling integration with bots, automation pipelines, and developer tooling.

### 7.3.6. Performance Optimization
* **Database Query Performance:** Optimize database queries for handling large post volumes efficiently, particularly the Explore feed scoring query, by introducing materialized views or pre-aggregated engagement counters that are refreshed periodically rather than computed on every request.
* **Cache Extension:** Extend Redis caching beyond search results to cover user profile data, community metadata, and notification payloads, further reducing PostgreSQL read pressure during peak traffic.
* **Horizontally Scalable Gateway:** Configure Socket.IO with a Redis Pub/Sub adapter to enable stateless, horizontally scaled backend deployments where WebSocket events are correctly routed across multiple server instances.
* **Load Testing:** Perform regular load testing (e.g., using k6 or Artillery) to validate that the system scales gracefully under concurrent feed requests, post submissions, and WebSocket connections.

### 7.3.7. Security Enhancements
* **Immutable Admin Audit Log:** Implement a comprehensive Admin Audit Log—an append-only database table (`AuditLog`) that immutably records every administrative action (ban/unban user, delete post, dismiss report) with the acting admin's identity, target entity, reason, and timestamp, providing a non-repudiable trail for accountability.
* **Automated Content Filtering:** Introduce a global word filter backed by a Redis-cached banned-word list, scanned at the backend middleware layer using the Aho-Corasick algorithm before content reaches the database, automatically flagging or blocking violating submissions in real time.
* **Regular Security Audits:** Conduct regular security audits covering JWT secret rotation, httpOnly cookie configuration, CORS policy enforcement, and SQL injection surface area through Prisma's parameterized queries.
* **Automated End-to-End Tests:** Implement automated end-to-end tests (e.g., using Playwright) covering authentication flows, admin moderation actions, and community permission boundaries to catch regressions in security-critical paths before deployment.
