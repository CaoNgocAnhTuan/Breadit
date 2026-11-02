# CHAPTER 2: LITERATURE REVIEW

## 2.1. Overview of Social Networking Platform Architectures

Modern social networking platforms require high-throughput, low-latency architectures to handle the massive volumes of user-generated content and real-time interaction loops. Historically, social network designs relied on synchronous request-response patterns over traditional relational databases. However, research by Kwak et al. [1] demonstrates that the topology of modern social networks — characterized by low reciprocity, asymmetric follower-following relationships, and rapid information diffusion — fundamentally differs from classical human social networks, necessitating a shift toward event-driven architectures and distributed caching layers capable of handling real-time content propagation at scale.

A critical challenge arising from this scale of content production is **information overload** — the cognitive burden imposed on users when incoming content volume exceeds their processing capacity. Gupta et al. [11] empirically demonstrated, across a large-scale sample study published in the *Academy of Marketing Studies Journal*, that unmanaged information streams are a statistically significant driver of emotional exhaustion and user fatigue on social media platforms. This finding is further substantiated by Stamenković and Aleksić [12], who applied the Stressor-Strain-Outcome (SSO) model to confirm that unfiltered digital overload leads to systematic **information avoidance** — users disengaging from platforms entirely rather than engaging with irrelevant or overwhelming content. These findings collectively establish the academic necessity for intelligent content curation and ranking mechanisms within modern social networking systems.

### Comparison & Breadit's Positioning
While legacy architectures utilize heavy database queries for feed generation, **Breadit inherits the hybrid database model** proposed by Carlson [2], combining PostgreSQL as the persistent relational source of truth with Redis as an in-memory database. **Breadit differentiates itself** by implementing this hybrid model within a TypeScript monorepo, using Prisma ORM to maintain strict type safety across database transactions while leveraging Redis to handle WebSocket adapter pub/sub states, minimizing backend connection overhead. Furthermore, directly addressing the information overload challenge identified by Gupta et al. [11] and Stamenković and Aleksić [12], Breadit incorporates a time-decay heuristic ranking algorithm on the Explore feed — a design choice motivated by the empirical finding of Kwak et al. [1] that engagement signals (retweets, replies) are stronger predictors of content relevance than simple follower counts.

---

## 2.2. Web Curation and Social Feed Ranking Algorithms

A primary challenge in social media platforms is filtering "information noise." In academic literature, this is addressed through content curation and ranking algorithms. 

Early social networks utilized simple reverse-chronological ordering or basic popularity metrics (total likes). However, engagement-centric ranking algorithms often introduce bias and "filter bubbles," as examined in a large-scale empirical study by Guess et al. [3] published in *Science*. 

To balance freshness with popularity, decay-based ranking algorithms have been extensively studied in social media contexts. Lerman and Ghosh [4] conducted an empirical study of information propagation on **Digg** (a community content-voting platform directly analogous to Breadit) and Twitter, demonstrating that social content engagement follows a characteristic decay pattern: posts reach a peak engagement window within the first few hours of publication, after which interaction rates decline exponentially as new content pushes them down the feed. Their findings provide empirical validation that time-decay functions are effective quantitative models for estimating content relevance in community-driven social platforms. Similarly, the Hacker News ranking heuristic, analyzed by Salihefendic [5], operationalizes this decay principle with a concrete scoring formula:

$$\text{Score} = \frac{U - 1}{(T + 2)^G}$$

Where $U$ represents engagement points, $T$ represents time elapsed, and $G$ represents a gravity decay factor.

### Comparison & Breadit's Positioning
*   **Breadit's Approach:** **Breadit inherits the linear time-decay ranking model** ($Score = Likes + Comments \times 2 + Reposts \times 3 - AgeHours \times 0.25$) but **differentiates itself** by executing this scoring logic dynamically over a recent candidate pool queried from PostgreSQL, applying sorting and diversity filtering in Node.js backend memory, and caching the resulting final feed pages in Redis. This eliminates the database query and compute overhead for subsequent requests. Furthermore, Breadit integrates a **greedy author-diversity algorithm** directly into the ranking pipeline, ensuring that no single author dominates the feed window (capping authors to a maximum of 3 posts per page). This solves the duplication issues common in basic time-decay implementations without requiring expensive database operations.

---

## 2.3. Threaded Discussion Curation and Comment Sorting

In discussion-based social media, comment sorting is critical to maintaining conversation context. In academic literature, the two most common sorting heuristics are:
1.  **Bayesian Average:** Often used in product reviews to pull average ratings toward a global mean when the sample size is small.
2.  **Wilson Score Interval:** Populated by Edwin B. Wilson [6] and applied to web ranking by Evan Miller [7]. It calculates the lower bound of a binomial proportion confidence interval:

$$\text{Lower Bound} = \frac{\hat{p} + \frac{z_{\alpha/2}^2}{2n} - z_{\alpha/2} \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z_{\alpha/2}^2}{4n^2}}}{1 + \frac{z_{\alpha/2}^2}{n}}$$

Where $\hat{p}$ is the fraction of positive votes, $n$ is the total votes, and $z_{\alpha/2}$ is the confidence level statistical value. Sorting by this lower bound acts as a "skeptical" filter that prevents posts with few votes (e.g., 1 upvote, 0 downvotes) from outranking established quality content.

### Comparison & Breadit's Positioning
*   **Wilson Score vs. Time-Decay:** The Wilson Score (used by Reddit's "Best" sort) is excellent for static comment trees where recency is secondary to quality. However, it lacks a temporal decay factor, meaning older comments with high upvotes remain pinned at the top indefinitely, discouraging new conversations.
*   **Breadit's Approach:** For primary feeds, **Breadit differs** by utilizing a time-decay engagement algorithm ($likes \times 1 + comments \times 2 - ageHours \times 0.25$) to ensure the feed remains dynamic and fresh. For comment sections, **Breadit implements a nested, chronological threaded structure** optimized for real-time thread-based conversations, leaving statistical confidence sorting (such as the Wilson Score Interval) as an planned upgrade for future iterations when active voting pools scale.

---

## 2.4. Real-Time Web Communication Protocols

Real-time notification delivery and private messaging require bi-directional communication channels. Historically, three main paradigms have co-existed:

1.  **AJAX Short/Long Polling:** The client repeatedly requests updates from the server at fixed intervals. As evaluated by Pimentel and Nickerson [8], polling-based approaches introduce significant HTTP header overhead on each request cycle and consume excessive server CPU resources due to frequent TCP connection establishment sequences, particularly under high concurrency.
2.  **Server-Sent Events (SSE):** A unidirectional, persistent HTTP connection where the server pushes updates. While memory-efficient, SSE does not natively support bidirectional messaging (such as client-to-server chat events).
3.  **WebSockets (RFC 6455):** A full-duplex, bidirectional communication channel over a single TCP connection [9]. Once the initial HTTP handshake is upgraded, frame overhead is minimal (2-10 bytes per packet), making it the optimal protocol for low-latency bidirectional streams.

### Comparison & Breadit's Positioning
*   **Legacy Platforms:** Many early web platforms relied on AJAX polling, which suffers from latency bounded by the polling interval (e.g., 5 seconds delay).
*   **Breadit's Approach:** **Breadit inherits the full-duplex WebSocket protocol (via Socket.IO)**. By integrating Socket.IO at the NestJS gateway layer, Breadit establishes a low-latency bidirectional messaging channel that avoids the polling interval constraints of legacy systems. Additionally, Breadit optimizes connection management by storing Socket.IO adapter states in **Redis**, allowing stateless backend instances to scale horizontally without losing real-time connection contexts.

---

## 2.5. Frontend Rendering Architecture (SSR vs. CSR)

Modern frontend rendering architectures are classified into Client-Side Rendering (CSR) and Server-Side Rendering (SSR). 
As documented in the Next.js framework specification [10], CSR frameworks (like plain React) suffer from slow First Contentful Paint (FCP) and poor search engine optimization (SEO), because the browser must download and execute large JavaScript bundles before rendering any content. Conversely, SSR pre-renders the HTML on the server, ensuring instant initial page loads and search crawler visibility.

### Comparison & Breadit's Positioning
*   **Traditional CSR SPA Applications:** Experience "blank page" delays during initial loads.
*   **Breadit's Approach:** **Breadit utilizes Next.js 15 to implement a Hybrid SSR/CSR architecture**. Next.js Server Components render initial feeds on the server, utilizing cookie forwarding to retrieve session details securely from the backend. Interactive components (like upvote buttons or chat boxes) are hydrated as Client Components, ensuring both fast initial paint times and highly responsive user interfaces.

---

## 2.6. Content Recommendation Systems in Social Platforms

Content recommendation is a foundational research area addressing the information overload problem [11][12] in social networking systems. Three primary algorithmic paradigms are established in the academic literature:

1. **Collaborative Filtering (CF):** Pioneered by Sarwar et al. [13] in their landmark item-based CF paper published at the WWW 2001 conference, this approach generates recommendations by identifying users with similar engagement patterns and surfacing content preferred by those users. The core limitation of CF is the **cold-start problem**: the algorithm requires a substantial volume of historical interaction data to produce meaningful recommendations, making it ineffective for new users or newly created content.
2. **Content-Based Filtering (CBF):** Content-based approaches analyze the attributes of items a user has previously engaged with (e.g., topic tags, hashtags, textual content similarity) to recommend semantically similar items. While avoiding the cold-start problem for items, CBF tends to create **filter bubbles** [3], where users are exclusively recommended content highly similar to their past behavior, significantly reducing exposure to diverse perspectives.
3. **Hybrid Approaches:** To mitigate the respective limitations of CF and CBF, hybrid recommendation architectures combine multiple signal sources simultaneously. Large-scale commercial platforms (e.g., YouTube, Netflix) deploy deep learning-based hybrid models that fuse collaborative signals, content embeddings, and contextual session features to generate diverse personalized recommendation lists at scale.

### Comparison & Breadit's Positioning
The Breadit platform does **not currently implement** a machine learning-based recommendation engine. This is a deliberate scope decision: implementing a robust CF or hybrid recommendation system requires a sufficient interaction data volume (Sarwar et al. [13] estimate a cold-start threshold of tens of thousands of user-item interactions) and dedicated infrastructure for offline model training pipelines, both of which fall outside the defined scope of this project phase.

Instead, **Breadit adopts a deterministic, heuristic-based "Explore Feed"** implementing a linear time-decay engagement scoring model (`score = likes×1 + comments×2 + reposts×3 − ageHours×0.25`), complemented by a greedy author-diversity filter (capping any single author at 3 posts per page). This approach directly addresses the information overload problem [11][12] without incurring the cold-start dependency inherent in collaborative filtering, providing a transparent and auditable content ranking mechanism. The integration of a full collaborative filtering or hybrid recommendation engine is identified as a planned future development milestone, contingent on the platform accumulating sufficient user interaction data.

---

## 2.7. Comparative Analysis of Existing Social Media Platforms

To establish the academic necessity of the Breadit platform, this section analyzes three mainstream social networking platforms—**Reddit, Twitter/X, and Facebook**—evaluating their architectural, structural, and real-time capabilities compared to the proposed hybrid model.

| Comparison Metric | Facebook | Twitter / X | Reddit | **Breadit (Proposed)** |
| :--- | :--- | :--- | :--- | :--- |
| **System Architecture** | Opaque Algorithmic (AI-based curation) | Hybrid Algorithmic / Chronological stream | Sub-community (Subreddit) & Forum aggregation | **Hybrid sub-communities (Sub-breadits) & Trending feeds** |
| **Discussion Structure** | Linear / Semi-threaded (Limited depth) | Flat / Linear replies (Loss of context) | Highly structured nested threads (Tree structure) | **Nested chronological threaded discussions (Tree structure)** |
| **Curation Method** | Engagement-maximizing AI optimization | High-velocity activity scoring | Wilson Score Interval ("Best") & Chronological | **Linear time-decay heuristic scoring with author diversity limits** |
| **Real-Time Synchronicity** | Low-frequency polling (high latency) | Real-time push / Websockets | Polling-centric (delayed vote & comment sync) | **Full-duplex WebSockets (Socket.IO + Redis Adapter)** |

### 1. Reddit:
*   *Strengths:* Reddit is the industry standard for community-centric, threaded discussions. Nested replies preserve conversational context during multi-user debates.
*   *Limitations:* Its comment sorting ("Best") relies on the Wilson Score Interval [6], which acts as a static confidence filter. Because it lacks a strong temporal decay factor, older highly-upvoted comments remain pinned at the top indefinitely, suppressing real-time conversation. Furthermore, voting and status updates are historically synchronized via polling, introducing latency.
*   *Breadit's Solution:* Breadit inherits Reddit's **nested threaded discussion structure** to maintain conversation context, but replaces the static Wilson Sort on main feeds with a **linear time-decay heuristic algorithm** to prioritize freshness. It also deploys **Socket.IO** for instantaneous message and vote synchronization.

### 2. Twitter / X:
*   *Strengths:* Twitter/X specializes in high-velocity, real-time updates and trending hashtags, allowing immediate awareness of public events.
*   *Limitations:* Twitter/X uses flat reply chains. When discussions scale, conversations split into messy, unorganized threads, causing a significant loss of context. Its ranking algorithm is heavily engagement-driven, prioritizing controversial posts to maximize session duration.
*   *Breadit's Solution:* Breadit integrates Twitter/X's **real-time feed responsiveness** and **trending hashtag aggregation** via Socket.IO and Redis cache, but structures the replies into **hierarchical comment trees** to prevent conversational fragmentation.

### 3. Facebook:
*   *Strengths:* Extensive social graph connection mapping and high-throughput content delivery.
*   *Limitations:* Facebook utilizes a highly complex, engagement-maximizing recommendation feed. As shown by Guess et al. [3], this introduces significant "algorithmic latency," where users are served posts from days ago due to AI optimization, alongside "filter bubbles" that increase information noise.
*   *Breadit's Solution:* Breadit replaces the complex AI recommendation loop with a **transparent, time-decay scoring model** and **author-diversity filters**, preventing feed monopolization by single users while eliminating the computational overhead of deep learning engines.

---

## References for Chapter 2


```text
[1] H. Kwak, C. Lee, H. Park, and S. Moon, "What is Twitter, a social network or a news media?" in Proc. 19th Int. World Wide Web Conf. (WWW '10), Raleigh, NC, USA, Apr. 2010, pp. 591–600, doi: 10.1145/1772690.1772751.

[2] J. L. Carlson, Redis in Action. Shelter Island, NY: Manning Publications, 2013.

[3] A. M. Guess, N. Malhotra, J. B. Hunt, et al., "How do algorithmic feeds affect what people see, who they interact with, and what they believe?" Science, vol. 381, no. 6656, pp. 398–404, Jul. 2023, doi: 10.1126/science.abp9875.

[4] K. Lerman and R. Ghosh, "Information contagion: An empirical study of the spread of news on Digg and Twitter social networks," in Proc. 4th Int. AAAI Conf. Weblogs and Social Media (ICWSM '10), Washington, DC, USA, May 2010, pp. 90–97. [Online]. Available: https://arxiv.org/abs/1003.2664.

[5] A. Salihefendic, "How Hacker News ranking algorithm works," Hacking and Gonzo, Dec. 8, 2015. [Online]. Available: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c44d.

[6] E. B. Wilson, "Probable inference, the law of succession, and statistical inference," Journal of the American Statistical Association, vol. 22, no. 158, pp. 209–212, 1927.

[7] E. Miller, "How Not To Sort By Average Rating," Evan Miller Blog, 2009. [Online]. Available: https://www.evanmiller.org/how-not-to-sort-by-average-rating.html.

[8] V. Pimentel and B. G. Nickerson, "Communicating and displaying real-time data with WebSocket," IEEE Internet Computing, vol. 16, no. 4, pp. 45–53, Jul./Aug. 2012, doi: 10.1109/MIC.2012.64.

[9] I. Fette and A. Melnikov, “The WebSocket protocol,” RFC 6455, Dec. 2011. [Online]. Available: https://www.rfc-editor.org/info/rfc6455.

[10] Vercel, "Next.js Data Fetching: Server-side request routing and cookie propagation," Vercel Next.js Documentation, 2026. [Online]. Available: https://nextjs.org/docs/app/building-your-application/data-fetching/fetching.

[11] T. Gupta, R. Bodhi, and A. Pandey, "Impact of privacy concern, information overload, and social media addiction on emotional exhaustion: an empirical study," Acad. Marketing Studies J., vol. 28, no. S6, pp. 1–11, 2024.

[12] I. Stamenković and D. Aleksić, "Digital Overload: Fatigue and Information Avoidance on Social Media," Appl. Media Studies J., vol. 6, no. 2, pp. 27–41, 2025.

[13] B. Sarwar, G. Karypis, J. Konstan, and J. Riedl, "Item-based collaborative filtering recommendation algorithms," in Proc. 10th Int. World Wide Web Conf. (WWW '01), Hong Kong, China, May 2001, pp. 285–295, doi: 10.1145/371920.372071.
```
