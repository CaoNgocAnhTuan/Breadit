---
description: Start the backend on port 4000 for manual checks (curl, Socket.IO scripts, Chrome) with no real email and no Cloudinary, because the real .env holds live keys. Also stops it and shows its status.
argument-hint: "[start|stop|status] [--no-cache] [--no-build]"
---

# /run-safe

Run from the repo root:

```bash
bash .claude/hooks/run-safe.sh $ARGUMENTS
```

- `start` (default): builds the backend, then runs `node dist/main.js` in the background. SMTP points at a dead local port, Cloudinary is empty, uploads go to a temp folder. The script never reads `.env`.
- `--no-cache`: sets `REDIS_HTTP_CACHE_ENABLED=false` (feed parity checks need it, see Bugs Report T3).
- `--no-build`: skips the build.
- `stop`, `status`.

It needs `docker compose up db redis -d`. The database is the dev schema `public` (seed data). Email codes for new users are in the `VerificationToken` table. The seed users are already verified (`user1`–`user50` / `password`, `admin` / `123456`). Login is limited to 10 per minute per IP.

The log is `.claude/state/backend.log`. Stop the backend when you are done.
