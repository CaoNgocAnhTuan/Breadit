# Chapter 5. Implementation

> **Draft, 2026-11-20.** Budget: about 10 pages. This chapter has no result numbers: results and timings are in Chapter 6, and the test summary is in Chapter 8. The one tuned value it needs, α and β of the live `social` feed, is the macro `\tuneWTwoMHChosen` (printed as α/β). Every file, command, route, environment variable, version and count was checked against the repository on 2026-11-20. The chapter cites no reference, so it adds no key to `references.tex`. Remove this box and the notes at the end before the final version.

Chapter 4 designs the platform. This chapter describes what was built. Section 5.1 lists the technology, and Section 5.2 the monorepo. Sections 5.3 and 5.4 describe the backend and the real-time layer. Section 5.5 shows how the feed works in the app, and Section 5.6 describes the package that holds the ranking code. Section 5.7 describes the evaluation code, Section 5.8 explains how every result can be rebuilt, and Section 5.9 describes the tests. Chapter 3 defines the method, Chapter 6 gives the results, and Chapter 8 summarizes the tests.

## 5.1 Technology stack

The whole system is written in TypeScript and runs on Node.js 22. The exact version, v22.23.4, is in `.nvmrc`. The root `package.json` accepts only Node 22 (`"engines": { "node": ">=22 <23" }`), and `.npmrc` sets `engine-strict=true`, so npm refuses another major version. The Docker builds use `npm ci` with the lockfile `package-lock.json`, and the Docker images are pinned by digest.

Table 5.1 lists the main parts, with the versions written in the `package.json` files. A caret (`^`) means "this version or a newer one with the same major number". The lockfile fixes the exact version that `npm ci` installs.

**Table 5.1. The technology stack.**

| Layer | Technology | Version | Used for |
|---|---|---|---|
| Runtime | Node.js, TypeScript | 22 (`.nvmrc`: v22.23.4), ^5 | all code |
| Frontend | Next.js (App Router), React | 15.1.0, ^19.0.0 | pages, server components, route middleware |
| | TanStack Query, Tailwind CSS | ^5.64.2, ^3.4.1 | data fetching and infinite scroll, styling |
| | Socket.IO client | ^4.8.1 | real-time events |
| Backend | NestJS, Fastify | ^10.4.15, ^4.28.1 | modules, guards, pipes; HTTP server |
| | Prisma, ioredis | ^6.2.1, ^5.4.1 | database client and migrations, Redis client |
| | Socket.IO, `@socket.io/redis-adapter` | ^4.8.3, ^8.3.0 | the real-time gateway (through the Nest packages `@nestjs/websockets` and `@nestjs/platform-socket.io`, ^11.1.19) |
| | jose, bcryptjs, class-validator | ^5.10.0, ^3.0.3, ^0.14.1 | JWT tokens, password hashes, validation of request bodies |
| | `@nestjs/throttler`, nodemailer, sharp, cloudinary | ^6.5.0, ^8.0.7, ^0.34.5, ^2.10.0 | rate limit (counted in Redis), email, image re-encoding, optional media host |
| Data | PostgreSQL, Redis | 16, 7 (`postgres:16-alpine`, `redis:7-alpine`) | main database; cache, logout blacklist, rate limit, socket adapter |
| Tests | Jest, ts-jest; `node --test`; k6 | ^29.7.0, ^29.4.15; Node 22; k6 | backend and ranking tests; evaluation tests; the E7 load test |

The Nest core is version 10, but its two WebSocket packages are version 11. npm reports a peer-dependency conflict, so backend dependencies are added with `npm install --legacy-peer-deps`. PostgreSQL and Redis run in Docker: `docker-compose.yml` has four services (`db`, `redis`, `backend` and `app`, the frontend), on the host ports 5433, 6378, 4000 and 3000.

## 5.2 The monorepo

The repository is one npm-workspaces monorepo. The root `package.json` lists the workspaces `apps/*`, `packages/*` and `eval`: five packages (Table 5.2).

**Table 5.2. The five workspaces.**

| Package | What it is (folder) | How it is built | What it imports |
|---|---|---|---|
| `@breadit/frontend` | the Next.js app (`apps/frontend`) | `next build` | `@breadit/shared` (types) |
| `@breadit/backend` | the NestJS app (`apps/backend`) | `nest build` to `dist/` | `@breadit/ranking` |
| `@breadit/shared` | API types for the frontend (`packages/shared`) | `tsc` to `dist/` | nothing |
| `@breadit/ranking` | the pure ranking code (`packages/ranking`) | `tsc` to `dist/` (CommonJS) | nothing outside the package |
| `@breadit/eval` | the evaluation code, ESM (`eval`) | not built: Node 22 runs the `.ts` files | `@breadit/ranking`; `@prisma/client` in one file |

Three rules keep the dependencies simple. First, nothing imports `eval/`, so evaluation code can never reach production. Second, `@breadit/ranking` imports only its own files and `node:` modules. Third, `eval/` imports `@prisma/client` in one file only, `src/loader/db.ts`. Tests check the second and the third rule (Section 5.9). The packages `@breadit/shared` and `@breadit/ranking` are built first, because the other packages read their `dist/` folders; the backend Dockerfile builds `@breadit/ranking` before the backend.

For development, `docker compose up db redis -d` starts the data stores, `npm run dev` starts the frontend (port 3000), and `npm run dev -w @breadit/backend` starts the backend (port 4000). `docker compose up --build` starts the full stack. The backend container first runs `prisma migrate deploy`, so the schema always comes from the 18 committed migrations.

## 5.3 The backend

**Structure.** The backend is a NestJS 10 application on the Fastify HTTP server, not on Express. It has 18 Nest modules (one for each feature, and three for infrastructure: prisma, redis and cache), 13 controllers and 72 REST routes. Every controller path starts with `api/`, for example `@Controller('api/posts')`. The data model is the Prisma schema `apps/backend/prisma/schema.prisma` with 25 models. Chapter 4 shows it as an ERD.

**Start-up.** `main.ts` creates the app, and `setupApp` in `app.setup.ts` configures it. It registers the Fastify plugins for cookies, multipart uploads (at most 10 files, and 500 MB for one file) and static files (`/uploads/`), turns on CORS for `FRONTEND_URL` with credentials, and installs the Socket.IO adapter of Nest (`IoAdapter`). It sets the global `ValidationPipe({ whitelist: true, transform: true })`, which drops a body field that has no `class-validator` decorator in its DTO, and the global `AllExceptionsFilter`, which gives every error one JSON shape. The integration tests call the same `setupApp`. A global `ThrottlerGuard` limits the requests per route and per IP in 60 seconds, with its counters in Redis. The limit is `THROTTLE_LIMIT` (default 1,000).

**How the frontend calls the backend.** The frontend has no database access and no API route of its own. Server components call `serverFetch()` and `getSession()` (`src/lib/session.ts`) on `BACKEND_INTERNAL_URL`, and copy the cookies of the request by hand. Client components call `api()` and `apiMultipart()` (`src/lib/api.ts`) on `NEXT_PUBLIC_BACKEND_URL` with `credentials: 'include'`. The file `src/middleware.ts` only checks that the cookie `breadit_session` exists and redirects to `/sign-in` if it does not; the real check is in the backend. The main pages are in the route group `(board)`, whose `layout.tsx` calls `getSession()` and shows a "suspended" page to a banned user.

**Authentication.** Login checks the password with bcrypt and signs a JWT with HS256 (library `jose`). The token has a random `jti` and lives 30 days. It is stored in the cookie `breadit_session`, which is `httpOnly`, `SameSite=Lax`, and `Secure` in production. Logout writes the `jti` into Redis under `auth:blacklist:<jti>` until the token would expire, so a copied cookie stops working. A password reset adds 1 to `User.passwordVersion`. A token carries the version it was made with (claim `pwv`), and a token with another version is refused, so the reset ends every older session. Routes are protected with guards, in the order written in `@UseGuards(...)`. `JwtAuthGuard` comes first: it reads the cookie, checks the blacklist and sets `req.user`. `OptionalJwtAuthGuard`, used on the routes that also serve guests, runs the same check (`readSession` in `auth/session.ts`) and treats a bad or logged-out token as a guest. Then `BannedUserGuard` reads `banned` from the database again, because the token can be 30 days old; `EmailVerifiedGuard` refuses write actions until the email is verified; and `RolesGuard` with `@Roles('ADMIN')` protects the admin routes. The codes for email verification and password reset are rows of the table `VerificationToken` (identifier `email-verify:<email>` or `password-reset:<email>`), and `AuthService` sends them with nodemailer over SMTP.

**The cache.** `CacheService` (`cache/cache.service.ts`) keeps JSON answers in Redis, under keys of the form `prefix:part:part`. It does not delete keys when data changes. A read path puts a version number in its key, for example `getNumber('v:user', [userId])`, and a write path increases it with `incrNumber('v:user', [userId])`. The next read builds a new key and misses the cache, and the old entries expire with their time to live. This works because one write can change many cached pages, whose keys are not known in advance, and one version number covers them all. Feed pages, notification lists and search results use `v:user`. A new or deleted post, a follow, a block, a community join, leave or ban, and reading a notification increase it. The small lists `graph:follows` and `graph:communities` (kept 300 seconds) are deleted by key instead, because their keys are known. `getOrSetJson` adds a short lock, so only one request rebuilds an expired entry. Setting `REDIS_HTTP_CACHE_ENABLED=false` turns the cache off; the tests and the E7 benchmark run with it off.

**Rules for every listing.** `BlockService.getAllBlockedPeerIds` returns the users blocked in either direction, and the queries for posts, users, search, notifications and messages leave them out. Posts are soft-deleted (`deletedAt`), and every query filters them. A community post needs membership, and it is shown only when `isApproved` is true. Chapter 4 gives the reasons. Uploaded images are re-encoded with `sharp` and stored on Cloudinary (when `CLOUDINARY_CLOUD_NAME` is set) or in the folder `UPLOAD_DIR`.

## 5.4 The real-time layer

"Real-time" in this thesis means push: the server sends an event over an open WebSocket, and the page changes without a reload. One gateway does all of it, `NotificationsGateway` in `notifications/notifications.gateway.ts`. It runs in the same process as the REST routes, so a service that changes data can push an event at once.

**Who a socket is.** The server decides this, never the client. The singleton in `src/socket.ts` opens one socket with `withCredentials: true`, so the cookies travel with the handshake. In `afterInit`, the gateway registers a middleware that runs before the connection exists. It reads `breadit_session` from the handshake, checks the token with `readSession` (the signature, the Redis blacklist and the password version), and stores `{ id, username }` on `socket.data`. A missing, bad, expired or logged-out token is refused. After the connection, the gateway puts the socket into the room named after its username. The client still sends `newUser` (in `components/Socket.tsx`), but the gateway ignores the name in it.

**Rooms and events.** The user room, named after the username, receives the events for one user. The conversation room `conversation:<id>` carries the typing signals. A socket joins it with `joinConversation` only if `ConversationMember` has a row for the user and the conversation, and it can send `startTyping` and `stopTyping` only into a room it has joined. The typing event carries the username from the login, not one written by the client. Table 5.3 lists the events from the server to the client.

**Table 5.3. The events from the server to the client.**

| Event | Sent by | To which room | When |
|---|---|---|---|
| `getNotification` | `NotificationsService.emit` | the user room of the recipient | a like, comment, follow, mention and so on |
| `newMessage` | `MessagesService.sendMessage` | the user room of the other member | a direct message is saved |
| `messageRead` | `MessagesService.markRead` | the user room of the other member | the reader marks the conversation as read |
| `userTyping`, `userStopTyping` | the gateway | `conversation:<id>`, without the sender | a member starts or stops typing |
| `accountBanned` | `AdminService.setBanStatus` | the user room of the banned user | an admin bans the account |

A notification is saved first and pushed second: `NotificationsService.emit` writes a `Notification` row, then sends `getNotification` to the room of the recipient. A user who is offline finds the row in the list later, and a user who is online sees it at once. A notification to oneself is skipped. When an admin bans a user, `Socket.tsx` handles `accountBanned`: it calls `POST /api/auth/logout` and goes to `/sign-in?banned=true`, so the banned user cannot go on acting.

**The Redis adapter.** With two or more backend processes, the receiver may be connected to another process than the one that saved the message. The gateway therefore installs `createAdapter` of `@socket.io/redis-adapter` with two Redis connections (one to publish, one to subscribe). The adapter sends each event through Redis to every process, so it reaches the receiver wherever he is connected. Chapter 4 draws the flows of a like and of a direct message. The feed is not pushed: it is ranked when the user opens or reloads it. This thesis shows that the events arrive (Chapter 8), and it does not measure how fast.

## 5.5 The feed in the app

**The request path.** `GET /api/posts` is `PostsController.findAll` with `OptionalJwtAuthGuard`, so guests can read too. Its query parameters are `cursor`, `user`, `feed`, `communityId`, `algo` and `asOf`. `PostsService.findAll` first calls `resolveFeedOptions` (`feed/feed.options.ts`), which checks `algo` and `asOf` and applies the default `algo`. Then it reads the clock once, for the whole request, builds the cache key, and returns the cached page if there is one. When `algo` is set, it calls `algoPage`, which uses the feed module. Otherwise it runs the older modes: a community, Explore, Following, Communities, a profile, For You (newest first) or the guest feed.

**The `algo` option.** `algo` has three values, and each one runs a method of Chapter 3 (the map `ALGO_METHOD` in `feed/feed.constants.ts`): `chrono` is BL0, `engagement` is BL2 and `social` is the hybrid H. The option works only on the For You feed of a logged-in user. An unknown value, or `algo` together with `feed`, `user` or `communityId`, gives 400, and a guest gets 401. Two environment variables belong to it, and `readFeedConfig` reads both when the app starts:
- `FEED_DEFAULT_ALGO` is the `algo` of For You when the request has none. When it is not set, For You is the feed of before the thesis: the posts of the user and the followees, newest first. Docker Compose passes the variable with an empty default. Chapter 3 gives the rule that sets the default, and Chapter 6 its outcome.
- `FEED_ASOF_ENABLED=true` makes the backend accept the test parameter `asOf` (Unix seconds), to rank the feed as it was at a past time. The parity test needs it. The backend refuses to start when the flag is on and `NODE_ENV=production`, and Docker Compose never passes it.

A wrong value of either variable stops the backend at start. It never falls back to a silent default.

**The feed module.** `FeedService.rank(userId, algo, asOfSec)` in `feed/feed.service.ts` returns the whole ranked pool as `(id, score)` pairs. It never reads the clock; the time is its argument. It has no ranking logic: it loads plain arrays from Prisma, calls the package, and gives back the result. It loads, in this order: (1) the candidates, which are the root posts created in the window [t − W, t), community posts included and repost rows left out, with no row limit, because only `buildPool` applies the cap; (2) in parallel, the follows and memberships of the user with their times, and the likes, comments and reposts of the user before t, with the author and community of each post touched; (3) the blocked peers, from `BlockService.getAllBlockedPeerIds`. It calls `userFeaturesAsOf` and `buildPool`. Then, for the posts left in the pool only, it loads the likes, comments and reposts before t and calls `postFeaturesAsOf` for each post. At the end it calls the scorer of the `algo` and `rankPool`. The follows and memberships are read with their times, and not through the cached lists `graph:follows` and `graph:communities`, because the as-of rule needs the times. The file `feed/feed.mapping.ts` turns the Prisma rows into the plain types of the package, with every time in whole Unix seconds, rounded down. Listing 5.1 shows the call, shortened.

```js
const asOf = { t: asOfSec };   // whole Unix seconds, no event id
const uf = userFeaturesAsOf(userId, asOf, { follows, memberships, positives, postInfo });
const pool = buildPool({ user: userId, asOf, candidates, blocked, earlierPositives },
                       POOL_PARAMS);
const score = scorer(ALGO_METHOD[algo]);        // 'BL0', 'BL2' or 'H'
const ctx = { user: userId, asOf, uf, params: methodParams(algo) };
const order = rankPool(pool, (p) => score(ctx, p, feats.get(p.id)));   // post ids
```

**Listing 5.1. The call of the ranking package in `FeedService.rank` (shortened).**

The numbers of the method come from one file, `feed/feed.constants.ts`. `POOL_PARAMS` is the window of 7 days and the cap of 2,000 posts, and `PRIOR_M` is the prior strength m = 5. They are the frozen values of Chapter 3, and a unit test checks that they equal `eval/config/frozen-v1.json`. `SOCIAL_PARAMS` holds α and β of `social`. They are the values tuned for `syn-W2M-M` (`\tuneWTwoMHChosen`, written as α/β), and a unit test checks that they equal the approved run config `eval/config/runs/p7-main.json`.

**Paging and cache.** A page has 10 posts. For the `algo` feeds, the cursor of the first page is `1`, and a later cursor is `t:score:id` (Listing 5.2): the time t at which the pool was ranked, and the score and id of the last post of the page. The next request ranks the pool again at the same t and returns the posts after that `(score, id)`. Events after t are not visible at t, so a post is never repeated or skipped between pages. Without `asOf`, a cursor older than 24 hours gives 400, and the client starts again from the first page. After the ranking, `algoPage` loads the 10 posts of the page with their counts and media in one query, and keeps the rank order. `findAll` stores each page for 10 seconds. The cache key has the viewer, the mode (for example `algo-social`), the cursor, the version `v:user` and `asOf`, so each option has its own entry, and a follow, a block or a new post makes the next request miss the cache.

```
cursor     = "1"                          the first page
           | "<t>:<score>:<id>"           later pages of an algo feed: three integers
cache key  = feed:<viewer>:<mode>:<profile user>:<communityId>:<cursor>:<v:user>:<asOf>
```

**Listing 5.2. The cursor of an `algo` feed and the cache key of a feed page.**

**Explore and the frontend.** The Explore feed uses the package, too. It takes the 400 newest posts of the last 7 days, scores each one with `computeExploreScoreFixed` of `@breadit/ranking`, sorts by `(score desc, id desc)`, and keeps at most 3 posts per author, with one time for the whole request (the clock read once, or `asOf`). So BL2 in the evaluation is exactly the production code. In the frontend, the home page `app/(board)/page.tsx` shows the four tabs (For you, Explore, Following, Communities) and, on For you, three links ("Chronological", "Engagement" and "Social") that set `?algo=`. `Feed.tsx` is a server component that fetches the first page. `InfiniteFeed.tsx` is a client component: TanStack Query fetches the next pages with `nextCursor`, and its query key contains `algo`.

## 5.6 The ranking package

`@breadit/ranking` (folder `packages/ranking`) holds every ranking rule of the thesis: the candidate pool, the as-of features, the 13 scoring methods and the final sort. It is compiled by `tsc` to CommonJS in `dist/`, and it has no runtime dependency. Both the backend and `eval/` import it, so the live feed and the evaluation run the same functions. The only difference is how they load the data: Prisma rows in the backend, CSV files in `eval/`.

The package is pure. The same input always gives the same output, and the code never reads a clock, a database or a random source. A test, `determinism.spec.ts`, enforces this on every source file. It fails on `Date.now`, `new Date()` without an argument, `performance.now`, `Math.random`, `randomUUID`, `localeCompare`, `toLocale…String`, `Intl` and `.sort()` without a compare function. It also fails on any import except `node:` modules and files of the package itself.

The package has eight source files: `types.ts` (the plain types), `asof.ts` (`visibleAt`, the rule "only the past", and `ageHours`), `features.ts` (`userFeaturesAsOf` and `postFeaturesAsOf`), `pool.ts` (`buildPool`, the pool of Section 3.5), `scorers.ts` (`scorer(method)`), `rank.ts` (`rankPool`), `explore.ts` (`computeExploreScoreFixed`, the production Explore score, moved here unchanged) and `index.ts` (the public exports).

**The contract.** The caller gives plain arrays and gets back an ordered list of post ids. The interface is five functions (Listing 5.1 shows them in use). `userFeaturesAsOf` and `postFeaturesAsOf` build the as-of features, `buildPool` builds the pool, `scorer` returns the function of one method, and `rankPool` sorts. The time is always the argument `asOf`. An event is visible at `asOf` if its time is before `asOf.t`, or equal to it and with a smaller event id. The harness passes the id of the test event; the live app passes no id, so only events strictly before t count.

**The scorers.** `scorer(method)` returns the function of one of the 13 method ids: BL0 to BL6, BL2t, H, and the four ablations H-follow, H-comm, H-noauthor and H-noengager. H and its four ablations come from one function, `hybrid`, which switches the terms on and off. Three rules protect the results. Every score is an integer (a score in points is stored as ⌊score × 100⌋), and a score that is not finite throws an error. A missing parameter (for example α) throws an error and never falls back to a default. A NaN score in `rankPool` throws, because it has no place in a total order. The package has 85 unit tests (Jest).

## 5.7 The evaluation code

`eval/` (`@breadit/eval`) is the code of the offline evaluation of Chapter 3. It is ESM, and Node 22 runs its `.ts` files directly, so there is no build step. Its only runtime dependencies are `@breadit/ranking` and, in one file, `@prisma/client`. It never touches Redis or HTTP, and it writes to Postgres only through the loader. Table 5.4 lists its commands, which are npm scripts of the workspace (`npm run <script> -w @breadit/eval`).

**Table 5.4. The commands of `eval/`.**

| Script | What it does | Where it writes |
|---|---|---|
| `gen` | generates the eight synthetic datasets | `eval/data/<id>/` |
| `adapt:digg` | converts the two Digg 2009 zips | `eval/data/digg2009/` |
| `check` | checks every dataset: format, calibration to Digg, social lift, cut time T, history groups | the terminal |
| `harness <runId>` | runs `eval/config/runs/<runId>.json` | `.docs/results/<runId>/` |
| `freeze` | writes the ten P7 test configs from the committed tuning (`--check` only compares) | `eval/config/runs/` |
| `orient` | the group comparison of the Orientation (5 or fewer against more than 20 earlier interactions), from the per-user ranks of `p7-main` | `.docs/results/p9-orient-groups/` |
| `report` | turns the results into macros, tables and figure data | `.docs/results/p7-report/` |
| `load`, `load:check` | write a synthetic dataset into Postgres, and read it back | the schema `eval_load` |
| `rank` | prints one ranking for one user at one time | the terminal |
| `parity` | draws the 100 parity pairs and writes the harness orders | `.docs/results/p6-parity/` |
| `results:manifest` | compares every manifest with the merged manifest | the terminal |

**Datasets and random numbers.** Every dataset, synthetic or real, has the same six CSV tables: `users`, `follows`, `communities`, `memberships`, `posts` and `interactions`. The files are UTF-8 with LF line ends, the rows are sorted, and ids and times are integers. The folder also has a `manifest.json` with the SHA-256 of every file (`canonical/` holds the schema, the writer and a strict reader). `rng.ts` gives one seeded stream for each stage of the work. The generator is sfc32, seeded from the SHA-256 of the text `<master seed>:<stage>`, and the stages are `users`, `follows`, `communities`, `posts`, `interactions`, `bootstrap`, `permutation`, `parity`, `shuffle` and `bootstrap-median`. A new stage never changes the numbers of another stage.

**The generators of data.** The synthetic generator (`src/generator/`) runs the five stages of Chapter 3 and writes eight datasets: the five worlds at size M, and three of them at size S. Its parameters are in `eval/config/synthetic-v1.json`, and the SHA-256 of that file goes into every dataset manifest. The two Digg zips are protected with a password that the Digg page publishes. Node has no reader for this old protection (ZipCrypto), so `src/adapters/zip.ts` is a small reader of our own. It decrypts and unpacks in memory and writes nothing to disk. The raw files are in `datasets/raw/digg2009/`, which git ignores. `eval/config/digg2009.json` holds their SHA-256, and the adapter refuses a file with another hash.

**The harness** (`src/harness/`). One run is one JSON file in `eval/config/runs/` (there are 13). The config names the datasets, the methods, the parameters, the split and the pool. The split comes only from the file, never from a flag, and the test split runs only when the file has `"testApprovedBy": "author"`. For each user item, the harness builds the as-of features and the pool with the functions of the package, ranks the pool with each method, and records the rank of the item. A fast mode builds the post features from an index, and a reference mode calls `postFeaturesAsOf` over every event; a test checks that both give byte-identical rows. `metrics.ts` computes Recall@K, NDCG@K and coverage, and `stats.ts` the paired bootstrap, the randomization test and the Holm correction. Tuning picks each parameter on the validation split by NDCG@10, and a tie goes to the smaller value. Then `freeze` writes the test configs from the tuning files, so no tuned number is copied by hand. A run writes its CSV files and a manifest to `.docs/results/<runId>/`. A file of per-user rows above 5 MB goes to the git-ignored `eval/results/`, and the manifest lists it as external.

**The loader** (`src/loader/`). The loader puts a synthetic dataset into the real database, so that the live app can run on it (the parity test, the E7 benchmark and the demo). It writes only to a schema whose name matches `eval_[a-z0-9_]+`, by default `eval_load`; the schema `public` is never touched. It runs `prisma migrate deploy` on the schema, empties it, and writes every row with its explicit id in one transaction, so a failure rolls everything back. A repost becomes a `Post` row with `rePostId`. `load:check` reads the rows back and compares the six CSV files with the dataset manifest. The option `--rebase-to` shifts all times by one constant and is for the demo only.

**The report** (`src/report/`). `report` reads the results of the 13 P7 runs and of `orient`, checks every file against its run manifest, and writes to `.docs/results/p7-report/` the file `macros.csv`, the LaTeX macros `results-macros.tex`, twelve LaTeX tables, `results.md` and the data of three figures. Each macro in `macros.csv` records the file, the row and the column it came from. The thesis reads the macros and the tables through the path `\resultsdir` set in `main.tex`, so no result number is typed in the text. The E7 benchmark is run by `npm run bench:e7` from the repository root (`scripts/e7/run-e7.mjs`, with k6). Chapter 3 describes its method, and Chapter 6 gives its results.

## 5.8 Reproducibility

**What is pinned.** Chapter 3 divides the results into Class D (byte-identical) and Class R (repeatable). The code keeps Class D with five rules: no clock and no unseeded randomness in `packages/ranking` and `eval/` (grep tests in `determinism.spec.ts` and in `eval/src/forbidden.test.ts`); one master seed with one stream for each stage; integer scores with a total tie-break; canonical CSV files; and a pinned environment. The Node version is pinned by `.nvmrc` and `engine-strict`, the Docker images by digest, and the packages by the lockfile.

**Manifests.** Every folder of data or results has a `manifest.json` (Listing 5.3). It lists each file with its number of rows and its SHA-256 (`files`), names the files kept in the git-ignored `eval/results/` (`external`), and records the Node version, because math functions can differ between engines. The keys are sorted, so the manifest itself is byte-stable. The manifest of a dataset has `datasetId` and `epoch` in place of `runId`.

```js
{ "schemaVersion": 1, "runId": "p7-main",
  "masterSeed": 20261014, "node": "v22.23.4",
  "source": { "configSha256": "<hash>",
              "datasets": { "syn-W2M-M": "<hash of its manifest>" } },
  "files": { "summary.csv": { "rows": "<n>", "sha256": "<hash>" } },
  "external": [ "per_user.csv" ] }
```

**Listing 5.3. The shape of the manifest of a run (the values in angle brackets are placeholders).**

The merged manifest `.docs/results/manifest.json` holds the SHA-256 of the manifest of each of the 16 results folders and of the 9 dataset manifests, so one compare checks every file, including the git-ignored ones. The folder `p7-e7` is marked Class R: it is listed but never compared, because timings are never byte-equal. `npm run results:manifest -w @breadit/eval` compares the tree with the merged manifest, and `--write` writes it.

**One command.** `npm run thesis:repro` (the script `scripts/repro/thesis-repro.mjs`) rebuilds every Class D result and compares every hash. It needs the pinned Node, `docker compose up db redis -d`, and the two Digg zips with the right SHA-256. It has 27 steps. First it checks, before anything is changed, the Node version, the merged manifest, that `.docs/results/` and `eval/config/` have no uncommitted change, the Digg zips, and Docker; all problems are listed together and the command stops. Then it builds `@breadit/ranking` and the Prisma client, and deletes every Class D results folder and `eval/data/`, so every file is rebuilt from nothing. Then it runs `gen`, `adapt:digg` and `check`; the runs `p5-baseline`, the two tuning runs, `freeze --check` and the ten test runs, with the H0 gate first (it never tunes and never writes a config); the parity steps; and at the end `orient`, `report` and the compare with the merged manifest. Each step writes a log to `eval/results/repro/`. The first step that fails stops the command and prints the end of its log, and the command exits with 0 only when every hash is equal. It uses the schema `eval_load` and Redis database 2, so nothing else should use them while it runs. Chapter 6 reports that it passes.

**The parity test.** The parity test checks that the live feed gives the same order as the harness. It has three steps (Listing 5.4). First, `npm run parity` draws 100 pairs of a user and a time from `syn-W2M-M`, 25 in each history group, and writes the harness order for each pair and each `algo` to `.docs/results/p6-parity/`. Second, `load` puts the same dataset into `eval_load`. Third, `npm run test:parity -w @breadit/backend` starts the real app on `eval_load`, with the page cache off and `asOf` on. It first checks that the data and the parameters equal the sample. Then, for each of the 100 pairs and each of the three `algo` values, it makes two checks: `FeedService.rank` must give the same whole order (the same size and SHA-256), and the first two pages of `GET /api/posts?algo=…&asOf=…` must equal the first 20 posts of the harness order.

```
npm run parity -w @breadit/eval -- --param alpha=<a> --param beta=<b>
npm run load -w @breadit/eval -- syn-W2M-M
npm run test:parity -w @breadit/backend
```

**Listing 5.4. The three commands of the parity check.**

The test only reads the schema `eval_load`, and it uses Redis database 2. The values α and β of the first command must equal `SOCIAL_PARAMS`, and the output is committed. Any change of the feed, of its pool or features, or of the package must keep this test passing. That is what ties the numbers of Chapter 6 to the feed that users get. Chapter 8 gives the outcome of the test.

## 5.9 Tests

There are six levels of tests (Table 5.5). Chapter 8 summarizes them with their counts, and the appendix lists them all, so this section only says how they run.

**Table 5.5. The levels of tests and how they run.**

| Level | Tool and place | Needs |
|---|---|---|
| Ranking unit tests | Jest, `packages/ranking/src/*.spec.ts`; `npm run test -w @breadit/ranking` | nothing |
| Backend unit tests | Jest project `unit`, `apps/backend/src/**/*.spec.ts`; `npm run test -w @breadit/backend` | nothing |
| Integration tests | Jest project `it`, `apps/backend/test/it/*.it-spec.ts`; `npm run test:it -w @breadit/backend` | `docker compose up db redis -d` |
| Parity test | Jest project `parity`, `apps/backend/test/parity/`; `npm run test:parity -w @breadit/backend` | the same, and `syn-W2M-M` loaded into `eval_load` |
| Evaluation tests | `node --test`, `eval/src/**/*.test.ts`; `npm run verify -w @breadit/eval` (type check and tests) | Node from `.nvmrc` |
| Frontend | no tests; the type check `tsc --noEmit` and ESLint | nothing |

The integration tests start the real app with `setupApp`, on their own Postgres schema `it_test` and Redis database 1, so the data of the schema `public` is never touched. They also connect real Socket.IO clients to the app, to test the gateway (`socket.it-spec.ts`). `npm run test:backend` runs the unit and the integration tests together. A fourth Jest project, `bench`, only prepares the E7 benchmark. The script `.claude/hooks/verify.sh` runs all of these checks except the parity test. The Husky pre-commit hook runs `lint-staged` (ESLint on the frontend files) and `npm run typecheck`; it does not run the backend tests.

---

## Notes for the author (remove before the final version)

1. **No result number is typed.** The chapter has no timing, no parity score and no test count except the ranking tests (85, run today). Counts of things in the code are exact: 18 modules, 13 controllers, 72 routes, 25 models, 18 migration folders, 13 run configs, 13 methods, 26 repro steps, 16 results folders, 9 dataset manifests.
2. **One macro.** The text uses `\tuneWTwoMHChosen` (the tuned α/β of H on `syn-W2M-M`; it prints "1024/1024" today). Chapter 6 says the live feed uses these values "(Chapter 5)", so the chapter says it and follows the results.
3. **What I could not run today.** The 85 ranking tests pass. Of the backend unit tests, three suites (`posts.service.spec.ts`, `banned-guard-coverage.spec.ts`, `communities.service.spec.ts`) do not load on this machine, because the `sharp` module for `darwin-x64` is missing. It is a machine problem, not a code problem. I did not run the integration tests, the parity test, `thesis:repro` or any `eval` command: they need Docker, the Digg zips and Node v22.23.4 (this machine has v22.14.0). What the chapter says about them comes from the code, `package.json`, `CLAUDE.md`, `docs/System_Architecture.md` and the Guidance Manual, which I read. The step count of `thesis:repro` (26) I got by importing its `steps()` function.
4. **Table 5.1 shows version ranges**, as written in the `package.json` files (the task asked for this). The installed versions I read in `node_modules` fit the ranges (for example Next.js 15.1.0, Prisma 6.2.1, Socket.IO 4.8.3, Fastify 4.29.1, NestJS core 10.4.22).
5. **Differences from other docs.**
   - `docs/System_Architecture.md` says "19 migrations". There are 18 migration folders; the 19th entry in the folder is `migration_lock.toml`.
   - `apps/backend/package.json` lists the package `resend`, but no code imports it. Email goes through nodemailer only. The chapter does not mention `resend`.
6. **Done (task `p9-bug-quick-wins`, 2026-11-20).** `OptionalJwtAuthGuard` now checks the logout blacklist too (finding S5, HTTP part), so "a logged-out token is refused everywhere" is true; on the optional routes it is answered as a guest.
7. **Chapter 4 figures.** The text says "Chapter 4 draws the flows" and gives no figure number. The figure counter of the thesis is global, and Chapter 4 has no labels yet. Add `Figure~\ref{...}` when it has.
8. **Claims about other chapters to check.** Chapter 3 gives the default feed rule (Section 3.7, yes). Chapter 6 reports that `thesis:repro` passes (yes, Section 6.1) and the outcome of the default rule (yes, Section 6.13 summary says "stays as it is today"; check the wording). Chapter 8 should give the test counts, the parity outcome and the evidence that the socket events arrive, and the appendix should list the tests. These are not written yet.
9. **Citations.** None. Section 10 of the super-plan has no verified reference for Next.js, NestJS, Socket.IO or Prisma. The reproducibility rules are cited in Chapter 3.
10. **Tooling named in the text.** Section 5.9 names `.claude/hooks/verify.sh` and the Husky hook, which are the author's own tooling. Cut the sentence if the thesis should not mention them.
11. **Layout.** The chapter is 11 pages (pages 24 to 34 in the build of 2026-11-20). `implementation.tex` sets the float parameters for itself and puts them back at its end; its tables use `[htb]` and `\footnotesize` so that no page is left half empty.
