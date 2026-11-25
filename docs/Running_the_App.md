# Running the Breadit app

A guide for the supervisor, the reviewers and the committee. It shows how to start the app, its database (Postgres) and Redis on your own machine, and how to run the demo.

Pick one way:

| Way | Use it when | What it runs |
|---|---|---|
| **A. Quick demo** | You want to see the thesis feed working (the meeting) | Postgres and Redis in Docker. Backend and frontend on your machine. Generated data. |
| **B. App for development** | You want to read or change the code | The same, with the seed data (50 users) |
| **C. Full stack in Docker** | You want everything in containers | Four containers: db, redis, backend, app |

Do not run two ways at the same time. They use the same ports.

## 1. What you get

Breadit is a small X (Twitter) clone: a Next.js frontend, a NestJS backend, a PostgreSQL 16 database and Redis 7. The thesis adds a "For You" feed with three rankings (Chronological, Engagement, Social). The demo (Way A) loads a generated dataset of 1,000 users and 20,000 posts, starts the backend and the frontend on it, and prints the logins. Nothing in it is real user data.

## 2. What you need

Tools:

- **git**.
- **Node.js 22**, the exact version in `.nvmrc` (`v22.23.4`), through **nvm**. `.npmrc` has `engine-strict=true`, so npm refuses another major version. npm comes with Node.
- **Docker with Docker Compose** (Docker Desktop has both). It runs Postgres (`postgres:16-alpine`) and Redis (`redis:7-alpine`).
- **macOS or Linux.** The demo scripts call `bash`, `lsof`, `ps` and `curl`.
- **A browser.** The demo checklist uses Chrome, one normal window and one private window.
- **openssl**, only for Way B and Way C (to make a `JWT_SECRET`).

Free ports on your machine:

| Port | Used by |
|---|---|
| 3000 | frontend |
| 4000 | backend |
| 5433 | Postgres (port 5432 inside the container) |
| 6378 | Redis (port 6379 inside the container) |

What you do **not** need:

- A real email server. The demo never sends email. In Way B and Way C, mail fails and the backend only logs it (see section 4).
- A Cloudinary account. Without `CLOUDINARY_CLOUD_NAME`, uploaded files go to a folder on disk.
- The Digg 2009 data. Only the evaluation commands use it, not the app and not the demo.
- A `.env` file, for Way A only.

## 3. Way A: the quick demo (recommended for the meeting)

**Get the code and install.** Run everything from the repo root.

```bash
git clone --branch test-app <repository-url> Breadit
cd Breadit
nvm use
npm install
npx prisma generate --schema=apps/backend/prisma/schema.prisma
```

If nvm says the version is not installed, run `nvm install` once, then `nvm use`.

**Start Postgres and Redis.**

```bash
docker compose up db redis -d
docker compose ps
```

Wait until `docker compose ps` shows both services as healthy.

**Generate the data (one time).**

```bash
npm run gen -w @breadit/eval
```

This writes the eight synthetic datasets to `eval/data/`. The folder is git-ignored and is rebuilt from a fixed seed, so you get the same data every time. The demo uses one of them, `syn-W2M-M`. If it is missing, `demo:start` stops and tells you to run this command.

**Start the demo.** Run it close to the meeting, not the evening before. The newest post is dated at the start time, and Explore shows the last 7 days.

```bash
npm run demo:start
```

It takes about 40 s. It builds the two shared packages, loads `syn-W2M-M` into the Postgres schema `eval_demo` (dated to now), adds an admin account, starts the backend on port 4000 and the frontend on port 3000, picks two demo users and warms up the pages. At the end it prints these lines, among others:

```text
== the demo is up (start took N s) ==
schema      : eval_demo   Redis database: 3
frontend    : http://localhost:3000
backend     : http://localhost:4000
admin       : demo-admin@example.com (username demo_admin) / password
user, long history  (...)  : u0000000064@example.com (u0000000064) / password
user, little history (...) : u0000000787@example.com (u0000000787) / password
```

For this dataset the two users are always the same (if the script prints other users, use those). To see them again, with the first 10 post ids of each ranking:

```bash
npm run demo:users
```

| Role | Email | Password |
|---|---|---|
| Admin | `demo-admin@example.com` | `password` |
| Long history (history 20 or more, many follows) | `u0000000064@example.com` | `password` |
| Little history (history 1 to 4) | `u0000000787@example.com` | `password` |

Sign-in takes the **email**, not the username. Sign-in page: `http://localhost:3000/sign-in`.

**The demo in short.** The full steps, with the expected result of each, are in [scripts/demo/CHECKLIST.md](../scripts/demo/CHECKLIST.md).

1. Sign in the long user in a normal window and the little user in a private window.
2. On For You, click **Chronological**, **Engagement**, **Social**. The order changes. Social differs for the two users, because it uses who each user follows.
3. Click **Explore**: 10 posts, the newest from the last day.
4. Direct message: from the little user, open the profile of the long user and send a message. The long user sees the typing dots and the message without a reload.
5. Notification: the little user likes a post of the long user. The notification count of the long user goes up without a reload.
6. Ban: sign in as the admin, open **Admin Console**, **Manage Users**, search `u0000000787`, click **Ban**. The little user is logged out at once. Ban only the little user. An admin cannot ban an admin.
7. Clean up with `npm run demo:stop`.

**Stop the demo.**

```bash
npm run demo:stop
```

It lifts every ban, stops the frontend and the backend, and empties Redis database 3. It is safe to run when the demo is half started: it says "nothing to do" for what is not running. `demo:stop` does not stop Docker. To stop Postgres and Redis too, see section 7.

**What the demo touches.** It writes only the Postgres schema `eval_demo` and Redis database 3. It sets the database, Redis and email settings of its backend itself, so `DATABASE_URL` and `REDIS_URL` from your shell or a `.env` file do not change them, and no email goes out. It never writes the schemas `public` or `eval_load`, or Redis databases 0, 1 and 2. It starts its own servers, so port 3000 and port 4000 must be free.

## 4. Way B: the app for development

Here the database holds the seed data in the schema `public`, and the app uses Redis database 0.

**1. The pinned Node, and Postgres and Redis.**

```bash
nvm use
docker compose up db redis -d
```

**2. The environment file.** Make `.env` from the example, then make a secret.

```bash
cp .env.example .env
openssl rand -base64 32
```

Open `.env` and paste the output after `JWT_SECRET=`. Never commit `.env` (git ignores it). The example already has the right local values for the rest. These matter for a local run:

| Variable | Value for a local run |
|---|---|
| `DATABASE_URL` | the one in the example (Postgres on `localhost:5433`) |
| `REDIS_URL` | the one in the example (Redis on `localhost:6378`) |
| `FRONTEND_URL` | `http://localhost:3000` |
| `JWT_SECRET` | the output of `openssl rand -base64 32` |
| `BACKEND_INTERNAL_URL` | `http://localhost:4000` |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` |
| `UPLOAD_DIR` | `./uploads` |

Leave `SMTP_*`, `CLOUDINARY_*`, `COOKIE_DOMAIN` and `FEED_DEFAULT_ALGO` empty. Empty `FEED_DEFAULT_ALGO` means the old For You (newest first).

Who reads `.env`:

- The Prisma commands below run from the repo root and read `.env` there.
- Nest reads `.env` from the folder where the backend starts, which is `apps/backend`. So copy the file there:

```bash
cp .env apps/backend/.env
```

- The frontend needs `BACKEND_INTERNAL_URL`. Its built-in default (`http://backend:4000`) only works inside Docker. The command in step 5 sets it.

**3. Install and build.**

```bash
npm install
npm run build -w @breadit/shared
npm run build -w @breadit/ranking
npx prisma generate --schema=apps/backend/prisma/schema.prisma
```

**4. Create the tables and the seed data.** Always use `migrate deploy` here: it applies the committed migrations, and some of them hold data. (`prisma migrate dev --name <name>` is for people who write a new migration.)

```bash
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
npx prisma db seed --schema=apps/backend/prisma/schema.prisma
```

**5. Start the backend and the frontend** (two terminals, both from the repo root).

```bash
npm run dev -w @breadit/backend
```

```bash
BACKEND_INTERNAL_URL=http://localhost:4000 npm run dev
```

Open `http://localhost:3000/sign-in`.

**Seed logins** (sign in with the email):

| Who | Email | Password |
|---|---|---|
| `admin` (role ADMIN) | `admin@breadit.dev` | `123456` |
| `user1` to `user50` | `user1@example.com` to `user50@example.com` | `password` |

Set `SEED_USERS` before the seed command to change the number of users.

**Email codes without SMTP.** Register works, but the mail with the 6-digit code cannot go out. The backend logs `Failed to send verification email:` and goes on. An account that is not verified cannot write (the API answers "Email not verified"). The seed users are already verified, so use them. If you must test a new account, read the code from the database (it is valid for 15 minutes). The `token` ends with the code:

```bash
docker compose exec db psql -U breadit -d breadit -c 'SELECT token FROM "VerificationToken"'
```

The password reset mail fails the same way. To send real mail, fill in the `SMTP_*` values.

## 5. Way C: the full stack in Docker

Compose starts four services: `db`, `redis`, `backend` (port 4000) and `app`, the frontend (port 3000). The backend container runs in production mode. It refuses to start when `JWT_SECRET` is missing or shorter than 32 characters.

```bash
cp .env.example .env
openssl rand -base64 32
```

Paste the output after `JWT_SECRET=` in `.env`. The output is 44 characters long, which is enough. Compose reads `.env` in the repo root. You can leave `SMTP_*` and `CLOUDINARY_*` empty.

```bash
docker compose up --build
```

On start, the backend container runs `prisma migrate deploy` and then the server. The `app` container waits until the backend is healthy.

| What | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:4000` |
| Postgres | `localhost:5433` |
| Redis | `localhost:6378` |

Use Chrome or Firefox for Way C. In production mode the session cookie is marked `secure`; these browsers keep it on `http://localhost`, and some others (Safari) may not, so the sign-in would not stick (not tested here).

Compose does not run the seed, so you cannot sign in yet. (The users `human01` to `human50` that the migrations add have no password.) Run the seed from your machine, against the database in the container. This needs `npm install` and `npx prisma generate` as in Way B. It reads `DATABASE_URL` from the `.env` in the repo root.

```bash
npx prisma db seed --schema=apps/backend/prisma/schema.prisma
```

Then use the seed logins of section 4.

Useful commands:

```bash
make logs
make rebuild
docker compose down
```

- `make logs` follows the logs of all services.
- `make rebuild` rebuilds and restarts only the frontend and the backend images. Use it after a code change. The database and Redis stay as they are.
- `docker compose down` stops and removes the containers. The data stays (section 7).

## 6. Checks that it works

**The backend.** It answers with `status` `ok`:

```bash
curl http://localhost:4000/api/health
```

**The frontend.** It answers 200:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/sign-in
```

**The pages.** Open `http://localhost:3000/sign-in`, sign in, and check that For You shows posts. In Way C, `docker compose ps` should show every service as healthy.

**The tests (optional).** `verify.sh` builds the shared packages, runs the ranking tests, the frontend typecheck and lint, the backend build and unit tests, the integration tests and the eval checks. It prints one PASS, FAIL or SKIP line per check. The integration tests use the Postgres schema `it_test` and Redis database 1, so your other data is not touched. They run only when the db and redis containers are up.

```bash
bash .claude/hooks/verify.sh
```

Options: `--quick` (skips the frontend lint, the backend build and the integration tests) and `--no-it` (skips the integration tests only).

**The parity test (optional).** It checks that the live feed order equals the order of the evaluation code. It needs Postgres and Redis up, and the dataset `syn-W2M-M` loaded into the schema `eval_load` **without** `--rebase-to`. It only reads that schema and uses Redis database 2. Run `npm run gen -w @breadit/eval` first if `eval/data/` is empty. The load command empties `eval_load` before it writes.

```bash
npm run build -w @breadit/ranking
npm run load -w @breadit/eval -- syn-W2M-M
npm run test:parity -w @breadit/backend
```

## 7. Stopping and cleaning up

```bash
# Way A: stop the demo
npm run demo:stop
# Way B: stop each dev server with Ctrl+C in its terminal
# Any way: stop Postgres and Redis (or the full stack)
docker compose down
```

`docker compose down` removes the containers and the network, but **keeps the data**. Compose keeps two volumes: `postgres_data` (the whole database) and `uploads_data` (uploaded files). The schema `eval_demo` stays after `demo:stop`; the next `demo:start` empties it and loads it again.

To delete the data too, add `-v`:

```bash
docker compose down -v
```

This **deletes both volumes**: every Postgres schema (`public`, `eval_demo`, `eval_load`, `it_test`) and all uploaded files. Redis has no volume: its data is lost whenever its container is removed, with or without `-v`. After `down -v`, start again from the steps of your way (for Way B and Way C, this means `migrate deploy` and the seed).

To remove the generated datasets, delete the folder `eval/data/`. `npm run gen -w @breadit/eval` makes them again.

## 8. Troubleshooting

**A port is already in use.** `demo:start` stops with "port 3000 is in use" (or 4000). Find the process and stop it:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

If it is a demo server, run `npm run demo:stop`. If it is the backend of an earlier run, run `bash .claude/hooks/run-safe.sh stop`. For 5433 or 6378, something else on your machine (often another Postgres or Redis) uses the port. Stop it first.

**Wrong Node version.** `npm install` fails, or `demo:start` says "is not Node 22". Run `nvm use` in the repo root (and `nvm install` once if the version is missing).

**`npm install` stops on a peer dependency error.** `@nestjs/core` is 10 while `@nestjs/websockets` is 11. Run:

```bash
npm install --legacy-peer-deps
```

**`npm ci` removed the Prisma client.** The backend build or start fails on `@prisma/client` after `npm ci`. Generate the client again:

```bash
npx prisma generate --schema=apps/backend/prisma/schema.prisma
```

**"Too many requests" at sign-in.** Sign-in allows 10 logins per minute per IP (the answer is 429). Wait one minute. For the demo, `npm run demo:stop` and `npm run demo:start` also reset the counters.

**`eval/data/syn-W2M-M` is missing.** `demo:start` says "Run: npm run gen -w @breadit/eval". Run it (section 3), then start again.

**Docker does not answer, or db or redis is not running.** Start Docker Desktop, then run `docker compose up db redis -d`.

**A host run tries Docker host names.** An error like `redis://redis:6379` or `http://backend:4000` means the app runs on your machine but got a value made for Docker. Set `REDIS_URL` (`redis://localhost:6378`) and `BACKEND_INTERNAL_URL` (`http://localhost:4000`), as in section 4. Several code defaults use the Docker names, so a missing variable shows up as a connection failure.

**The backend container stops at start (Way C).** The log says `JWT_SECRET must be set (at least 32 characters) when NODE_ENV=production`. Put a secret of 32 characters or more in `.env` (`openssl rand -base64 32`), then run `docker compose up -d` again. Read the log with `make backend-logs`.

**The demo backend or frontend does not come up.** `demo:start` prints the last log lines. The full logs are in `.claude/state/backend.log` and `.claude/state/demo/frontend.log`. Run `npm run demo:stop`, fix the cause, and start again.

**The first page load is slow in the demo.** The frontend is a dev server, and it compiles a page on the first request. `demo:start` warms up the pages the checklist uses.

More: [README.md](../README.md) (stack, environment variables), [docker-compose.yml](../docker-compose.yml), [Makefile](../Makefile), [scripts/demo/CHECKLIST.md](../scripts/demo/CHECKLIST.md), [System_Architecture.md](System_Architecture.md).
