# Project Directory Tree

```text
.
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── migrations/      # Database version history
│   │   │   ├── schema.prisma    # Data models
│   │   │   └── seed.ts          # Initial data
│   │   ├── src/
│   │   │   ├── admin/           # Admin dashboard logic
│   │   │   ├── auth/            # JWT & OTP authentication
│   │   │   ├── communities/     # Community/Subreddit logic
│   │   │   ├── hashtags/        # Trending tags logic
│   │   │   ├── health/          # Health check endpoints
│   │   │   ├── interactions/    # Likes, Follows, Blocks
│   │   │   ├── messages/        # DMs & Conversations
│   │   │   ├── notifications/   # Logic & WebSockets
│   │   │   ├── posts/           # Post & Feed logic
│   │   │   ├── prisma/          # Database client module
│   │   │   ├── redis/           # Caching & Throttling
│   │   │   ├── search/          # Global search logic
│   │   │   ├── uploads/         # File handling
│   │   │   ├── users/           # Profile & Discovery
│   │   │   ├── app.module.ts    # Root module
│   │   │   └── main.ts          # Entry point
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── public/
│       │   ├── general/         # Default assets
│       │   └── icons/           # UI icons
│       ├── src/
│       │   ├── app/             # Routes & Pages
│       │   │   ├── (auth)/      # Login/Register
│       │   │   ├── admin-console/
│       │   │   ├── c/           # Community routes
│       │   │   ├── p/           # Post routes
│       │   │   ├── profile/     # User profiles
│       │   │   └── messages/    # DM interface
│       │   ├── components/      # UI Components
│       │   ├── hooks/           # Custom React hooks
│       │   ├── lib/             # API & Utilities
│       │   ├── providers/       # Context Providers
│       │   ├── middleware.ts    # Auth redirects
│       │   └── socket.ts        # Socket client
│       ├── Dockerfile
│       ├── next.config.ts
│       └── tailwind.config.ts
├── packages/
│   └── shared/
│       ├── src/
│       │   └── index.ts         # Shared Types & DTOs
│       ├── package.json
│       └── tsconfig.json
├── docs/                        # Project documentation
├── docker-compose.yml           # Local infra (DB/Redis)
├── Makefile                     # Dev commands
├── package.json                 # Monorepo config
├── GEMINI.md                    # Assistant instructions
└── CLAUDE.md                    # Assistant instructions
```

## Detailed File Descriptions

### Root
- `docker-compose.yml`: Launches PostgreSQL and Redis containers.
- `Makefile`: Provides shortcuts for `npm install`, `db migrate`, and `dev` commands across all workspaces.

### Backend (`apps/backend`)
- `src/auth/jwt.guard.ts`: Protects routes by verifying the `breadit_session` cookie.
- `src/notifications/notifications.gateway.ts`: The Socket.io hub for real-time alerts.
- `prisma/schema.prisma`: Defines the PostgreSQL tables and their relationships.

### Frontend (`apps/frontend`)
- `src/lib/session.ts`: A critical utility that forwards cookies from Next.js Server Components to the Backend API.
- `src/components/InfiniteFeed.tsx`: Handles infinite scrolling for the main and community feeds using TanStack Query.
- `src/app/layout.tsx`: Wraps the entire site in the necessary Theme, Auth, and Query providers.

### Shared (`packages/shared`)
- `src/index.ts`: Contains the `Role` enum, `User` interfaces, and various `DTO` classes that ensure the Frontend never sends data in a format the Backend doesn't expect.
