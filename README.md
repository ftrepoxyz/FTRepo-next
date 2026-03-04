<h1 align="center">FTRepo</h1>

<p align="center">
  <strong>Automated iOS IPA distribution from Telegram to every sideloading store.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a>&nbsp;&nbsp;•&nbsp;&nbsp;<a href="#how-it-works">How It Works</a>&nbsp;&nbsp;•&nbsp;&nbsp;<a href="#configuration">Configuration</a>&nbsp;&nbsp;•&nbsp;&nbsp;<a href="#supported-stores">Supported Stores</a>
</p>

---

FTRepo watches your Telegram channels for IPA files, extracts their metadata, uploads them to GitHub Releases, and generates compatible JSON feeds for every major sideloading store — all on autopilot.

## Features

- **Telegram Scanning** — Automatically monitors channels (including forum topics) for new IPA uploads
- **IPA Analysis** — Extracts bundle info, detects injected tweaks, parses entitlements and privacy manifests
- **Multi-Store Feeds** — Generates AltStore, Feather, ESign, and Scarlet JSON formats simultaneously
- **GitHub Releases** — Uploads IPAs to daily GitHub Releases with automatic retention cleanup
- **App Store Enrichment** — Pulls icons, screenshots, and developer info from the iTunes API
- **Dashboard** — Real-time metrics, queue monitoring, activity logs, and full settings management
- **One-Click Add** — Landing page with deep links for SideStore, AltStore, Feather, StikStore, and LiveContainer

## How It Works

```
Telegram Channels
       │
       ▼
   ┌────────┐     ┌─────────────┐     ┌─────────────────┐
   │ Scanner │────▶│   Pipeline   │────▶│ GitHub Releases  │
   └────────┘     │              │     └─────────────────┘
                  │  Extract IPA │
                  │ Detect tweaks│     ┌─────────────────┐
                  │  Lookup App  │────▶│   JSON Feeds     │
                  │  Store info  │     │ AltStore/Feather │
                  └──────────────┘     │ ESign / Scarlet  │
                                       └─────────────────┘
```

The system runs as three containers:

| Service | Role |
|---------|------|
| **app** | Next.js web UI + API on port 3000 |
| **worker** | Background Telegram client, scanner, and pipeline processor |
| **db** | PostgreSQL 16 for all state, config, and queue management |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A [Telegram API ID & Hash](https://my.telegram.org/apps)
- A [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo` scope

### 1. Start the stack

```bash
curl -O https://raw.githubusercontent.com/ftrepoxyz/ftrepo/main/docker-compose.yml
docker compose up -d
```

### 2. Create your account

Open [http://localhost:3000](http://localhost:3000) and register. The first account is automatically an admin.

### 3. Configure

Go to **Settings** and fill in:

- **Telegram** — API ID, API Hash, and phone number
- **GitHub** — Token, repository owner, and repo name
- **Channels** — Add the Telegram channels to scan (e.g. `@channelname`)

The worker will pick up the new config and start scanning automatically.

### Docker Compose

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ftrepo
      POSTGRES_PASSWORD: ftrepo
      POSTGRES_DB: ftrepo
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ftrepo"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: ghcr.io/ftrepoxyz/ftrepo-app:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://ftrepo:ftrepo@db:5432/ftrepo?schema=public
    depends_on:
      db:
        condition: service_healthy

  worker:
    image: ghcr.io/ftrepoxyz/ftrepo-worker:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ftrepo:ftrepo@db:5432/ftrepo?schema=public
    volumes:
      - tdlib-data:/app/tdlib-data
      - temp-downloads:/tmp/ftrepo
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
  tdlib-data:
  temp-downloads:
```

> All settings beyond `DATABASE_URL` are managed through the web UI and stored in the database.

## Configuration

Settings are managed entirely from the dashboard under **Settings**.

| Setting | Default | Description |
|---------|---------|-------------|
| Scan interval | 30 min | How often to check channels for new IPAs |
| JSON regen interval | 60 min | How often to regenerate store feeds |
| Cleanup interval | 24 hr | How often to prune old releases and logs |
| Max versions per app | 5 | Number of versions to keep in multi-version feeds |
| Log retention | 30 days | How long to keep activity logs |
| App Store country | us | Country code for iTunes API lookups |

### Source Branding

Customize your store's appearance in `.github/config.yml`:

```yaml
source:
  name: "My Repo"
  subtitle: "iOS App Repository"
  iconURL: ""
  tintColor: "#5C7AEA"
```

## Supported Stores

### Direct deep-link integration

| Store | Format |
|-------|--------|
| SideStore | `store.json` |
| AltStore Classic | `store.json` |
| Feather | `feather.json` |
| StikStore | `store.json` |
| LiveContainer | `store.json` |

### JSON feed exports

| Store | File | Notes |
|-------|------|-------|
| AltStore / Feather | `store.json` / `feather.json` | Multi-version support |
| ESign | `esign.json` | Single version per app |
| Scarlet | `scarlet.json` | Includes categories and colors |

## Tech Stack

Next.js · React · TypeScript · Tailwind CSS · Prisma · PostgreSQL · TDLib · Octokit

## License

See [LICENSE](LICENSE) for details.
