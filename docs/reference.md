# Bibliography / References

This document contains the consolidated list of academic papers, industry standards, and developer documentation guides that are directly cited across the chapters of the **Breadit Social Network Platform** thesis report.

The numbering below matches the in-text citations (`[1]` through `[13]`) used in **Chapter 1 (Introduction)** and **Chapter 2 (Literature Review)**, followed by technical guides (`[14]` through `[19]`) that detail the implementation decisions of **Chapter 3 (Methodology)** and **Chapter 5 (Evaluation)**.

Both **IEEE** and **APA (7th Edition)** formats are provided for convenience.

---

## Academic References & Key Specifications (Citations [1] – [13])

### [1] Twitter Social Topology Study (Chapter 1, 2)
* **Description:** Empirical analysis of Twitter's network structure, showing how it differs from traditional social graphs, which justifies Breadit's hybrid chronological/engagement feed design.
* **IEEE:**
  H. Kwak, C. Lee, H. Park, and S. Moon, "What is Twitter, a social network or a news media?" in *Proceedings of the 19th International Conference on World Wide Web (WWW '10)*, Raleigh, NC, USA, Apr. 2010, pp. 591–600. doi: 10.1145/1772690.1772751.
* **APA (7th Edition):**
  Kwak, H., Lee, C., Park, H., & Moon, S. (2010). What is Twitter, a social network or a news media? In *Proceedings of the 19th International Conference on World Wide Web* (pp. 591–600). https://doi.org/10.1145/1772690.1772751

---

### [2] Redis Architectural Patterns (Chapter 2, 3)
* **Description:** Details on utilizing Redis as an in-memory database and pub/sub engine, justifying Breadit's hybrid database schema.
* **IEEE:**
  J. L. Carlson, *Redis in Action*. Shelter Island, NY, USA: Manning Publications, 2013.
* **APA (7th Edition):**
  Carlson, J. L. (2013). *Redis in Action*. Manning Publications.

---

### [3] Algorithmic Feeds vs. Chronological Curation Study (Chapter 1, 2)
* **Description:** Large-scale empirical study in *Science* proving that engagement-centric algorithmic feeds delay content visibility ("algorithmic latency") and create filter bubbles.
* **IEEE:**
  A. M. Guess, N. Malhotra, J. B. Hunt, *et al.*, "How do algorithmic feeds affect what people see, who they interact with, and what they believe?" *Science*, vol. 381, no. 6656, pp. 398–404, Jul. 2023. doi: 10.1126/science.abp9875.
* **APA (7th Edition):**
  Guess, A. M., Malhotra, N., Hunt, J. B., et al. (2023). How do algorithmic feeds affect what people see, who they interact with, and what they believe? *Science*, 381(6656), 398–404. https://doi.org/10.1126/science.abp9875

---

### [4] Social Content Decay Patterns (Chapter 2)
* **Description:** Mathematical study of information propagation and interaction decay on Digg (community-based voting feed) and Twitter over time.
* **IEEE:**
  K. Lerman and R. Ghosh, "Information contagion: An empirical study of the spread of news on Digg and Twitter social networks," in *Proceedings of the 4th International AAAI Conference on Weblogs and Social Media (ICWSM '10)*, Washington, DC, USA, May 2010, pp. 90–97. [Online]. Available: https://arxiv.org/abs/1003.2664.
* **APA (7th Edition):**
  Lerman, K., & Ghosh, R. (2010). Information contagion: An empirical study of the spread of news on Digg and Twitter social networks. In *Proceedings of the 4th International AAAI Conference on Weblogs and Social Media* (pp. 90–97). https://arxiv.org/abs/1003.2664

---

### [5] Time-Decay Feed Mechanics (Chapter 2, 3)
* **Description:** Analysis of Hacker News' time-decay algorithm which serves as the direct mathematical baseline for Breadit's linear decay scoring formula.
* **IEEE:**
  A. Salihefendic, "How Hacker News ranking algorithm works," *Hacking and Gonzo*, Dec. 8, 2015. [Online]. Available: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c44d.
* **APA (7th Edition):**
  Salihefendic, A. (2015, December 8). How Hacker News ranking algorithm works. *Hacking and Gonzo*. https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c44d

---

### [6] Binomial Confidence Intervals (Wilson Score) (Chapter 2)
* **Description:** Mathematical foundation of the Wilson Score Interval used for sorting binary feedback (votes).
* **IEEE:**
  E. B. Wilson, "Probable inference, the law of succession, and statistical inference," *Journal of the American Statistical Association*, vol. 22, no. 158, pp. 209–212, 1927.
* **APA (7th Edition):**
  Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. *Journal of the American Statistical Association*, 22(158), 209–212.

---

### [7] Wilson Score Rating Application (Chapter 2)
* **Description:** Application of the Wilson Score lower bound to sorting internet comment threads.
* **IEEE:**
  E. Miller, "How Not To Sort By Average Rating," *Evan Miller Blog*, 2009. [Online]. Available: https://www.evanmiller.org/how-not-to-sort-by-average-rating.html.
* **APA (7th Edition):**
  Miller, E. (2009). How Not To Sort By Average Rating. *Evan Miller Blog*. https://www.evanmiller.org/how-not-to-sort-by-average-rating.html

---

### [8] WebSocket Protocol Performance Analysis (Chapter 2)
* **Description:** Comparative study of AJAX polling vs. WebSockets, showing WebSocket's superiority under concurrent connection loads.
* **IEEE:**
  V. Pimentel and B. G. Nickerson, "Communicating and displaying real-time data with WebSocket," *IEEE Internet Computing*, vol. 16, no. 4, pp. 45–53, Jul./Aug. 2012. doi: 10.1109/MIC.2012.64.
* **APA (7th Edition):**
  Pimentel, V., & Nickerson, B. G. (2012). Communicating and displaying real-time data with WebSocket. *IEEE Internet Computing*, 16(4), 45–53. https://doi.org/10.1109/MIC.2012.64

---

### [9] The WebSocket Protocol Specification (Chapter 2, 3)
* **Description:** Internet standard RFC 6455 detailing connection lifecycle and frames for WebSockets.
* **IEEE:**
  I. Fette and A. Melnikov, "The WebSocket protocol," Internet Engineering Task Force (IETF), RFC 6455, Dec. 2011. [Online]. Available: https://www.rfc-editor.org/info/rfc6455.
* **APA (7th Edition):**
  Fette, I., & Melnikov, A. (2011). *The WebSocket protocol* (RFC 6455). Internet Engineering Task Force. https://www.rfc-editor.org/info/rfc6455

---

### [10] Next.js Data Fetching & Server Rendering Specification (Chapter 2, 3)
* **Description:** Implementation specs of Next.js App Router, detailing data pre-fetching, hydration, and custom header propagation.
* **IEEE:**
  Vercel, "Next.js Data Fetching: Server-side request routing and cookie propagation," *Vercel Next.js Documentation*, 2026. [Online]. Available: https://nextjs.org/docs/app/building-your-application/data-fetching.
* **APA (7th Edition):**
  Vercel. (2026). Next.js data fetching: Server-side request routing and cookie propagation. *Vercel Next.js Documentation*. https://nextjs.org/docs/app/building-your-application/data-fetching

---

### [11] Social Media Fatigue & Information Overload Study (Chapter 1, 2)
* **Description:** Empirical study proving that unmanaged content volume leads to cognitive stress, fatigue, and emotional exhaustion.
* **IEEE:**
  T. Gupta, R. Bodhi, and A. Pandey, "Impact of privacy concern, information overload, and social media addiction on emotional exhaustion: an empirical study," *Academy of Marketing Studies Journal*, vol. 28, no. S6, pp. 1–11, 2024.
* **APA (7th Edition):**
  Gupta, T., Bodhi, R., & Pandey, A. (2024). Impact of privacy concern, information overload, and social media addiction on emotional exhaustion: an empirical study. *Academy of Marketing Studies Journal*, 28(S6), 1–11.

---

### [12] Information Overload & Avoidance Study (Chapter 1, 2)
* **Description:** Analysis using the SSO model to link excessive unranked social media streams to systematic user avoidance behavior.
* **IEEE:**
  I. Stamenković and D. Aleksić, "Digital Overload: Fatigue and Information Avoidance on Social Media," *Applied Media Studies Journal*, vol. 6, no. 2, pp. 27–41, 2025.
* **APA (7th Edition):**
  Stamenković, I., & Aleksić, D. (2025). Digital Overload: Fatigue and Information Avoidance on Social Media. *Applied Media Studies Journal*, 6(2), 27–41.

---

### [13] Collaborative Filtering Foundations (Chapter 2)
* **Description:** Mathematical foundations and limitations (cold-start problem) of Collaborative Filtering algorithms.
* **IEEE:**
  B. Sarwar, G. Karypis, J. Konstan, and J. Riedl, "Item-based collaborative filtering recommendation algorithms," in *Proceedings of the 10th International Conference on World Wide Web (WWW '01)*, Hong Kong, May 2001, pp. 285–295. doi: 10.1145/371920.372071.
* **APA (7th Edition):**
  Sarwar, B., G. Karypis, J. Konstan, and J. Riedl. (2001). Item-based collaborative filtering recommendation algorithms. In *Proceedings of the 10th International Conference on World Wide Web* (pp. 285–295). https://doi.org/10.1145/371920.372071

---

## Technical Guides & Framework Specifications (References [14] – [19])

### [14] NestJS Fastify Adapter Guide (Chapter 3)
* **Description:** Integration details for replacing Express with Fastify inside NestJS to maximize HTTP throughput.
* **IEEE:**
  NestJS, "NestJS Techniques: High-performance HTTP server integration using the Fastify adapter," *NestJS Documentation*, 2025. [Online]. Available: https://docs.nestjs.com/techniques/performance.
* **APA (7th Edition):**
  NestJS. (2025). NestJS techniques: High-performance HTTP server integration using the Fastify adapter. *NestJS Documentation*. https://docs.nestjs.com/techniques/performance

---

### [15] NestJS Custom Auth Guards Guide (Chapter 3)
* **Description:** Guide on integrating Passport.js, custom JWT strategies, and HTTP-only session verification in NestJS.
* **IEEE:**
  NestJS, "NestJS Security: Authentication using Passport, stateless JWTs, and custom guards," *NestJS Documentation*, 2025. [Online]. Available: https://docs.nestjs.com/security/authentication.
* **APA (7th Edition):**
  NestJS. (2025). NestJS security: Authentication using Passport, stateless JWTs, and custom guards. *NestJS Documentation*. https://docs.nestjs.com/security/authentication

---

### [16] Prisma ORM Relations Guide (Chapter 3)
* **Description:** Database modeling specifications for relational mapping (one-to-many, self-referential relations) and NestJS client singleton configuration.
* **IEEE:**
  Prisma, "Prisma Schema Relations and Client Integration with NestJS," *Prisma ORM Documentation*, 2026. [Online]. Available: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations.
* **APA (7th Edition):**
  Prisma. (2026). Prisma schema relations and client integration with NestJS. *Prisma ORM Documentation*. https://www.prisma.io/docs/orm/prisma-schema/data-model/relations

---

### [17] NestJS WebSockets Gateway Integration (Chapter 3, 5)
* **Description:** Specifications for `@WebSocketGateway` configuration, namespaces, and Socket.IO connection adapter options.
* **IEEE:**
  NestJS, "NestJS WebSockets: Gateway decorator, connection handling, and message subscription," *NestJS Documentation*, 2025. [Online]. Available: https://docs.nestjs.com/websockets/gateways.
* **APA (7th Edition):**
  NestJS. (2025). NestJS WebSockets: Gateway decorator, connection handling, and message subscription. *NestJS Documentation*. https://docs.nestjs.com/websockets/gateways

---

### [18] Cloudinary Upload API Reference (Chapter 3, 7)
* **Description:** Implementation guidelines for streaming media files from Fastify Node buffer structures to Cloudinary.
* **IEEE:**
  Cloudinary, "Cloudinary Node.js Integration: Uploading files, base64 data, and buffer streams," *Cloudinary Developer Documentation*, 2026. [Online]. Available: https://cloudinary.com/documentation/node_integration.
* **APA (7th Edition):**
  Cloudinary. (2026). Cloudinary Node.js integration: Uploading files, base64 data, and buffer streams. *Cloudinary Developer Documentation*. https://cloudinary.com/documentation/node_integration

---

### [19] Pagination API Design Patterns (Chapter 3)
* **Description:** Industry standard designs for cursor-based pagination utilizing composite pagination tokens.
* **IEEE:**
  Stripe, "Pagination," *Stripe API Reference*, 2026. [Online]. Available: https://docs.stripe.com/api/pagination.
* **APA (7th Edition):**
  Stripe. (2026). Pagination. *Stripe API Reference*. https://docs.stripe.com/api/pagination
