# Speaker notes: progress check, 2026-11-30

Deck: `progress-2026-11-30.tex` (20 slides, about 20 minutes). Every number on a slide is a macro of `.docs/results/p7-report/results-macros.tex`, so say the numbers as they are on the slide. Do not round them.

## 1. Title
Thank the supervisor. Say what this talk is: a progress check, with the results of Chapters 3 to 7 and a demo.
Time plan: about 12 minutes for the slides, 6 minutes for the demo, the rest for questions.

## 2. The problem and the research questions
Today "For You" shows the posts of you and your followees, newest first. Explore uses one engagement score for everyone.
A new user has no history. So the question is: can the follow graph and the communities help?
Read RQ1 and RQ2 as they are written. They are the same words as in the super-plan.

## 3. The hypotheses
We wrote H1, H2 and H0 and froze them before the first test run. Say this clearly: it is why a negative result is still valid.
H1 has two co-primary tests: the synthetic middle world and Digg 2009. Each one is judged on its own.
H0 is a gate. In the null world, the follow part must not win. If it wins, there is a bug or a leak.

## 4. The system
The browser talks to the Next.js frontend, and the frontend talks to the NestJS backend. The backend uses Postgres and Redis.
The key idea is the box in the middle: one ranking package. The app and the evaluation call the same code.
So the offline numbers describe the feed that users get. The package has no database, no clock and no randomness.

## 5. The real-time layer and the three feeds
One Socket.IO gateway pushes notifications, direct messages and the ban event. A banned user is logged out at once.
"For You" has three feeds: `chrono`, `engagement` and `social`. The default stays as before.
The parity test checks that the live order equals the harness order. The demo shows this layer.

## 6. The hybrid score
H is the Explore score plus two terms: a social term (trust in the author and in followees who engaged) and a community term.
The prior m = 5 is the reason the score works for a user with no history: every followee gets the same trust.
alpha and beta were tuned on validation only. The live feed uses the same values.

## 7. Data
Two sources, because each one tests something the other cannot. Synthetic worlds have communities and a null world. Digg is real.
Digg has no communities, so beta does nothing there. Digg is also small and special.
The numbers on the slide are the test users and the users left out of the pool.

## 8. Protocol and statistics
One cut time at 80% of the events. We tune before it and test after it, once. Every feature uses only the past.
We rank the whole pool. NDCG@10 is the main metric. The gain is a paired difference per user.
The H1 rule was fixed before the test: Holm p below 0.05 and the lower end of the interval above 0. One command rebuilds every result.

## 9. The H0 gate and E1
The gate passes: the interval contains 0, so random follows do not help. The other results can be used.
In the table, H is far above BL2 on the synthetic world and equal to it on Digg.
On Digg, BL4 and BL5 are far better than both. Remember this for slide 15.

## 10. H1 fails on both tests
Synthetic: the gain is positive, but the interval contains 0 and p is above 0.05. The group has few users.
Digg: the lower end is above 0 by a tiny amount, but p is above 0.05. H1 needs both.
The only row where both hold is users with long history. This is the opposite of what RQ1 hoped for.

## 11. E2: the gain by history group
Left is the synthetic world. The gain grows with history. The group of H1 (0 to 4) has a wide interval.
Right is Digg, on its own and much smaller scale. It is near 0 in every group.
The dashed line is 0.

## 12. E3: the gain by social density
The gain is already there for users who follow nobody, and it does not rise with the number of followees.
So H2 is not supported. The bin 1 to 4 has almost no users in the synthetic worlds, so it has no mark.
Digg is 0 in every bin.

## 13. E5: is the result built into the data?
The gain grows with the influence in the data, from W0 to W2H. Good: the method picks influence up when it is there.
But W0 and W1 have no influence and still show a gain. And shuffling the engagement times keeps most of the gain.
So most of the gain is a topic signal from the community term, not influence.

## 14. E7: the cost
We measured the live backend: page 1 of each feed, one machine, page cache off. The three medians are about the same, and the intervals overlap.
The three feeds run the same queries. So cost is not the reason for the decision.
This is a repeatable result, not an identical one.

## 15. What it means (1)
RQ1: not on these data. Two reasons: few users in the group, and a prior that gives equal trust to every followee when there is no history.
RQ2: there is no level where it starts to help. The gain at 0 followees comes from the community term.
E4: almost all the gain is the community term. In the generator a community is a topic. So the hybrid works as a topic signal.

## 16. What it means (2)
The default feed stays as it is, by the rule we set before the test. `social` stays as an option, and one variable changes the default.
The offline numbers describe the live code. A stronger time decay may help Explore, but only on some data, so it is future work.
Limits: synthetic data is ours, Digg is small and has no communities, the Hive data was not reachable, and the test is offline with one item per user.

## 17. The demo plan
Run `npm run demo:start` close to the demo. Two windows: A is normal, B is private.
Seven steps: sign in, the three feeds, Explore, a direct message, a notification, an admin ban, cleanup.
If a step fails, say so and go on. The checklist has the fix for each step: `scripts/demo/CHECKLIST.md`.

## 18. The demo: two screens
These are backup pictures from the demo run, in case the live demo fails.
Left: "For You" with the Social feed. Right: a live direct message.
The data is generated, so the posts have generated names.

## 19. Status
Done: the data, the ranking package and the harness, the social feed in the app, the experiments, the repro command, Chapters 3 to 7, the demo.
Left: the Chapter 4 figures, then the changes from your feedback (all chapters are drafted), the final checks, the defense slides and the freeze.
Update this slide before the talk if more chapters are finished.

## 20. Three questions
One: do you agree that "For You" stays as it is, because H1 failed on both tests?
Two: is the limit 120 pages with or without the appendix, and are our nine chapters the required ones?
Three: what are the dates of the final submission and the defense?
