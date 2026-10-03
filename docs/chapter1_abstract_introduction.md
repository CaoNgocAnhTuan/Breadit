# Abstract & Chapter 1 (Revised Versions)

This document contains the corrected and verified versions of the **Abstract** and key sections of **Chapter 1 (Introduction)**. These revisions have been carefully written to remove any unsubstantiated claims of "AI/ML", "intelligent discovery", or "advanced predictive modeling" that were flagged in the professor's feedback. 

Instead, they align perfectly with the actual codebase implementation: a **deterministic, interaction-based heuristic ranking algorithm using linear time-decay and author diversity filtering**.

---

## Part 1: Revised Abstract

*This version is 100% clean of AI/ML claims. It focuses on the TypeScript monorepo architecture, custom JWT session forwarding for SSR, real-time WebSockets, and the heuristic time-decay feed algorithm.*

```text
The rapid evolution of web technologies has shifted digital communications from static networks to dynamic, real-time social ecosystems. The substantial volume of user-generated content presents challenges for modern platforms to sustain real-time performance, prevent information noise, and ensure platform security. This pre-thesis addresses these challenges by designing and implementing Breadit, a hybrid social media platform that integrates threaded discussions and real-time updates.

The platform is developed using a TypeScript-based monorepo architecture. It incorporates core social networking workflows, including custom JWT-based authentication with secure cookie propagation, media post management, and social graphs (follow/block relations). Real-time interactions, specifically private messaging and instant notifications, are achieved through Socket.IO integration at the gateway layer. The technical stack utilizes Next.js 15 for a responsive front end, NestJS with Fastify for a high-performance backend, Prisma ORM with PostgreSQL for persistent storage, and Redis for caching and managing Socket.IO adapters.

To address information noise, the platform implements an interaction-based content discovery module utilizing a linear time-decay heuristic ranking algorithm combined with author-diversity filtering. System validation conducted in a local containerized environment demonstrates the feasibility of this architecture, showing immediate API response times through Fastify's optimized event-loop and high cache hit ratios on Redis for trending queries. Furthermore, the integration of Socket.IO achieves real-time bidirectional message and notification delivery with minimal transport latency. These results prove that the proposed architecture provides a responsive, low-latency framework for community moderation and content discovery, laying a robust foundation for scalable social networking platform architectures.

```

---

## Part 2: Revised Chapter 1 (Introduction)

*These sections replace the paragraphs shown in the Chapter 1 screenshot to eliminate the terms "intelligent discovery", "personalized experiences", and "predictive modeling".*

### 1.1. Background (Revised)
```text
The exponential growth of user-generated content on modern social networking platforms has introduced "information noise," making it increasingly difficult for users to identify relevant discussions and communities within vast, continuous data streams. This challenge necessitates the development of interaction-based, time-aware content discovery systems capable of surfacing high-quality, recent content without relying on opaque algorithmic curation.

Breadit addresses this gap as a hybrid social networking platform that combines community-based sub-breadits with a transparent linear time-decay heuristic ranking algorithm, scoring posts by engagement signals (likes, comments, reposts) and enforcing author-diversity filtering to prevent content monopolization. By coupling this deterministic discovery engine with full-duplex real-time communication via Socket.IO, the platform delivers structured, community-centric social interactions within a low-latency architecture.
```

### 1.2. Problem Statement (Revised)
```text
In contemporary social media, massive content volume creates information noise. Studies empirically link this overload to statistically significant increases in emotional exhaustion and systematic information avoidance behavior (Gupta, Bodhi, & Pandey, 2024; Stamenković & Aleksić, 2025). Furthermore, platforms like Meta and X prioritize engagement-centric algorithmic feeds, delaying post visibility and disrupting conversational context (Guess et al., 2023). Existing flat-reply architectures also lack structured thread organization, causing contextual fragmentation during multi-user discussions (Kwak et al., 2010). Consequently, a clear demand exists for a hybrid platform that integrates threaded discussions for structured context alongside WebSockets to deliver real-time updates and transparent heuristic content discovery.
```

### 1.3. Research Contributions
```text
To address the identified challenges, this pre-thesis presents the following contributions:

C1. Hybrid social networking architecture: Breadit unifies Reddit-style community-based threaded discussions with Twitter-style microblogging into a single platform. Users engage in structured, multi-level comment threads within dedicated sub-breadit communities while simultaneously maintaining a global personal timeline — a combination that existing platforms provide only in isolation. This directly addresses the contextual fragmentation caused by flat-reply architectures on current microblogging platforms.

C2. Transparent, deterministic Explore feed algorithm: Rather than opaque engagement-centric ranking, Breadit implements an auditable linear time-decay heuristic:

    Score = (Likes × 1) + (Comments × 2) + (Reposts × 3) − (AgeHours × 0.25)

Combined with a greedy author-diversity filter — capping each author at a maximum of 3 posts per Explore page within a 7-day candidate window — this algorithm surfaces relevant, recent content while actively preventing content monopolization, without relying on non-interpretable machine learning models.

C3. Real-time social interaction layer: Breadit delivers instant private messaging and push notifications (likes, replies, follows, mentions) without page reload via Socket.IO WebSocket connections. This enables immediate, bidirectional social feedback loops across all platform interactions, fulfilling the core thesis requirement of real-time updates in a community-driven social context.
```


---

## Part 3: Alignment with Chapter 4 (Implementation)

To ensure consistency in your report, make sure the implementation section (**Mục 4.4 - Content Ranking & Discovery**) is updated to explain the actual code in [posts.service.ts](file:///d:/Fork/Breadit/apps/backend/src/posts/posts.service.ts). Use this description to write your Chapter 4 implementation:

1. **Heuristic Score Calculation (`computeExploreScoreFixed`):**
   * **Formula:** $Score = (Likes \times 1) + (Comments \times 2) + (Reposts \times 3) - (AgeHours \times 0.25)$
   * **Purpose:** Increases score based on engagement (comments and reposts have higher weights than likes) and decays the score linearly by $0.25$ points for every hour since creation to favor new content.
2. **Author Diversity Filtering (`applyExploreDiversity`):**
   * **Constraint:** A maximum of 3 posts per author are allowed within the candidate feed window (takes the top 400 candidates from the last 7 days).
   * **Purpose:** Prevents single-user spam from dominating the Explore feed, improving feed diversity.
3. **Cursor-Based Pagination (`parseExploreCursor`/`makeExploreCursor`):**
   * **Cursor Format:** `scoreFixed:id` (e.g., `450:12`)
   * **Purpose:** Ensures deterministic pagination that does not skip or duplicate items when new posts are created while the user scrolls.
