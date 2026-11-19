# Chapter 1. Introduction

> **Draft, 2026-11-19.** Only the section on the title is written. It goes after the problem statement. The other sections (background, problem, RQ1 and RQ2, contributions C1–C3, outline) come later. Remove this box before the final version.

## 1.x What the title means

The registered title is "Breadit: A real-time hybrid social networking platform with social-graph-aware personalized feed ranking". Its words have a precise meaning in this thesis.

**Real-time.** The server pushes events to the browser over a WebSocket connection (Socket.IO), without a page reload. Breadit pushes four kinds of event: new notifications, direct messages and their read state, typing signals in a conversation, and a forced logout when an admin bans the account. Chapter 4 describes this layer and Chapter 7 tests it. "Real-time" here means push delivery. This thesis does not measure how long a delivery takes.

**Hybrid social networking platform.** Breadit combines two kinds of social site. Like X (Twitter), users follow other users and read a timeline of posts. Like Reddit, users join topic communities, and a post can belong to a community that its author is a member of.

**Social-graph-aware personalized feed ranking.** The "For You" feed can be ranked by a hybrid score. It adds two social signals to the engagement score of the current Explore feed: trust in the users one follows, and affinity to the communities one joined (Chapter 3). The word "hybrid" therefore has a second meaning, the mix of engagement and social signals. The text always says "hybrid score" for this second meaning.

**The ranking runs on request.** The feed is ranked when the user opens or reloads it, and each page is cached for a few seconds. New posts are not pushed into a feed that is already open. The real-time layer and the feed ranking are separate parts of the system: the first delivers events, the second orders posts.

---

## Notes for the author (remove before the final version)

1. "Each page is cached for a few seconds": the cache lives 10 s (CLAUDE.md, "Feeds and ranking"). It is a setting, not a result, so it has no macro. Write the exact value only if Chapter 4 also gives it.
2. The thesis tests the hybrid score offline and keeps the current "For You" as the default, because H1 failed (Chapter 6). The contributions section should say that the `social` feed is built and available as an option, not that it became the default.
