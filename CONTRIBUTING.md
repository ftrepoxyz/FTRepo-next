# Contributing to FTRepo

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 16+ (or Docker)
- **npm** 10+

Optional (for full pipeline):
- Telegram API credentials ([my.telegram.org](https://my.telegram.org))
- GitHub personal access token with `repo` scope

---

## Running as a User (Docker)

The fastest way to get everything running.

### 1. Clone and configure

```bash
git clone https://github.com/your-org/FTRepo.git
cd FTRepo
cp .env.example .env
```

Edit `.env` with your credentials:

```env
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo
TELEGRAM_API_ID=12345
TELEGRAM_API_HASH=abc123...
TELEGRAM_PHONE=+1234567890
TELEGRAM_CHANNELS=channel1,channel2
```

### 2. Start all services

```bash
docker compose up -d
```

This starts three containers:

| Service | Port | Description |
|---------|------|-------------|
| `db` | 5432 | PostgreSQL database |
| `app` | 3000 | Next.js dashboard |
| `worker` | — | Telegram scanner (background) |

The app container runs database migrations automatically on startup.

### 3. Open the dashboard

Visit [http://localhost:3000](http://localhost:3000). You'll land on the Dashboard page.

### 4. Seed default settings (first run)

```bash
docker compose exec app npx prisma db seed
```

### 5. Stopping

```bash
docker compose down        # stop containers (keeps data)
docker compose down -v     # stop and delete all data
```

---

## Running as a Developer

### 1. Clone and install

```bash
git clone https://github.com/your-org/FTRepo.git
cd FTRepo
npm install
```

### 2. Set up the database

Start a local PostgreSQL instance. With Docker:

```bash
docker run -d --name ftrepo-db \
  -e POSTGRES_USER=ftrepo \
  -e POSTGRES_PASSWORD=ftrepo \
  -e POSTGRES_DB=ftrepo \
  -p 5432:5432 \
  postgres:16-alpine
```

### 3. Configure environment

```bash
cp .env.example .env
```

Set at minimum:

```env
DATABASE_URL="postgresql://ftrepo:ftrepo@localhost:5432/ftrepo?schema=public"
```

Add Telegram/GitHub credentials if you want to test the full pipeline.

### 4. Initialize the database

```bash
npx prisma generate       # generate the Prisma client
npx prisma migrate dev    # create tables and apply migrations
npm run db:seed           # populate default settings
```

If you're iterating on the schema without needing migrations:

```bash
npx prisma db push        # sync schema to DB (no migration files)
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Start the worker (optional)

The worker requires valid Telegram credentials and TDLib. In a separate terminal:

```bash
npm run worker
```

This connects to Telegram, scans configured channels, and processes the download queue.

---

## Project Structure

```
src/
├── app/                  # Next.js pages and API routes
│   ├── api/              # REST endpoints
│   ├── dashboard/        # Dashboard page
│   ├── metrics/          # Charts page
│   ├── database/         # IPA catalog page
│   ├── queue/            # Download queue page
│   ├── logs/             # Activity log page
│   └── settings/         # Configuration page
├── components/
│   ├── ui/               # shadcn/ui primitives
│   ├── layout/           # Sidebar, header, page container
│   └── ...               # Feature-specific components
├── lib/
│   ├── ipa/              # IPA extraction and analysis
│   ├── telegram/         # TDLib client, scanner, downloader
│   ├── github/           # Releases, JSON publishing, cleanup
│   ├── appstore/         # iTunes lookup with caching
│   ├── json/             # AltStore/ESign/Scarlet/Feather generators
│   ├── pipeline/         # Queue, orchestrator, scheduler
│   └── cleanup/          # Log and cache cleanup
├── hooks/                # React hooks (polling, etc.)
└── types/                # Shared TypeScript types
worker/
└── index.ts              # Standalone Telegram scanner process
```

---

## Common Tasks

### Adding a shadcn/ui component

```bash
npx shadcn@latest add <component-name>
```

### Updating the database schema

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name describe-your-change`
3. The Prisma client regenerates automatically

### Running a production build locally

```bash
npm run build
npm start
```

### Regenerating JSON feeds manually

Hit the API endpoint:

```bash
curl -X POST http://localhost:3000/api/actions/generate-json
```

Or use the Settings page > Admin Actions > Generate JSON.

### Triggering a channel scan

```bash
curl -X POST http://localhost:3000/api/actions/scan
```

### Checking system health

```bash
curl http://localhost:3000/api/health
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `TELEGRAM_API_ID` | For worker | — | Telegram API ID |
| `TELEGRAM_API_HASH` | For worker | — | Telegram API hash |
| `TELEGRAM_PHONE` | For worker | — | Phone number for Telegram auth |
| `TELEGRAM_CHANNELS` | For worker | — | Comma-separated channel usernames |
| `GITHUB_TOKEN` | For uploads | — | GitHub PAT with repo scope |
| `GITHUB_OWNER` | For uploads | — | GitHub repository owner |
| `GITHUB_REPO` | For uploads | — | GitHub repository name |
| `GITHUB_BRANCH` | No | `main` | Branch for JSON publishing |
| `APPSTORE_COUNTRY` | No | `us` | App Store region for lookups |
| `SCAN_INTERVAL_MINUTES` | No | `30` | How often the worker scans channels |
| `JSON_REGEN_INTERVAL_MINUTES` | No | `60` | How often JSON feeds regenerate |
| `CLEANUP_INTERVAL_HOURS` | No | `24` | How often old releases are cleaned |
| `MAX_VERSIONS_PER_APP` | No | `5` | Versions kept per app in JSON feeds |
| `TEMP_DIR` | No | `/tmp/ftrepo` | Temporary download directory |
| `LOG_RETENTION_DAYS` | No | `30` | Days before old logs are deleted |

---

## Architecture Notes

- The **worker** runs as a separate process because TDLib maintains a persistent stateful connection to Telegram that doesn't fit the Next.js request lifecycle.
- The worker and web app communicate exclusively through the **shared PostgreSQL database** — there is no direct IPC or message queue.
- The **GitHub Actions workflow** (`.github/workflows/generate-json.yml`) serves as a backup JSON generator that runs independently using a standalone Python script, requiring no database access.
