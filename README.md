# SaaS PERN Bots Starter

Monorepo (workspaces) with:
- **backend**: Express + Prisma (PostgreSQL), Auth (cookies), Bots CRUD, Chat endpoint, Stripe stubs, Embed script server.
- **frontend**: Vite + React + Tailwind (Landing, Login, Dashboard minimal).
- **widget**: Tiny embeddable chat widget.

## Quick Start

```bash
# 1) Install workspaces
npm install

# 2) Backend env & DB
cp .env.example app/backend/.env
# edit DATABASE_URL, SECRET_KEY, OPENAI_API_KEY, etc.

# 3) Frontend env
cp .env.example app/frontend/.env

# 4) Prisma init
npm --workspace backend run prisma:gen
npm --workspace backend run prisma:dev

# 5) Run dev (two terminals)
npm --workspace backend run dev
npm --workspace frontend run dev
```

Backend: http://localhost:4000  |  Frontend: http://localhost:5173

> NOTE: Stripe and n8n routes are stubbed; wire your real keys and logic when ready.
