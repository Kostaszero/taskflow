# TaskFlow

TaskFlow is a full-stack task management application I built as part of this take-home assignment. It lets users register, create projects, manage tasks, and track progress - backed by a proper REST API with authentication, relational data modelling, and a responsive UI that tries to feel closer to a real product than a code exercise.

**Frontend:** [http://localhost:3000](http://localhost:3000)  
**API:** [http://localhost:3001](http://localhost:3001)

---

## Overview

I aimed to ship something I'd actually be comfortable putting in front of users, not just something that satisfies the spec on paper. That meant going beyond the minimum: the UI supports inline task editing, a dedicated task detail page, debounced server-side assignee search, and optimistic state updates that avoid unnecessary round-trips. All of this is covered in more detail in the Architecture Decisions section.

The core flows are all covered: registration and login with JWTs, full project and task CRUD, status filtering, assignee management, and a clean responsive layout across mobile and desktop.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI Components** | shadcn/ui (Radix UI primitives + Tailwind CSS) |
| **Styling** | Tailwind CSS + PostCSS |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT (24-hour expiry) + bcryptjs (cost 12) |
| **Containerization** | Docker + Docker Compose |

---

## Running Locally

The only prerequisite is Docker. Everything else — Node, PostgreSQL, migrations, seed data — runs inside the containers.

```bash
git clone https://github.com/yourusername/taskflow
cd taskflow
cp .env.example .env
docker compose up
```

That's all. On first boot, the API container automatically runs migrations and seeds the database. Once you see both services healthy in the logs, the app is ready:

- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001

Startup typically takes around 10 seconds for PostgreSQL to finish initialising.

---

## Test Credentials

A test account is created during seeding so you can explore the app immediately without registering:

```
Email:    test@example.com
Password: password123
```

The seed also creates a project with a few tasks in different states so you can see the full UI without having to set anything up manually.

---

## Project Structure

```
taskflow/
├── docker-compose.yml         # Full-stack orchestration
├── .env.example               # Environment template
│
├── backend/                   # Node.js API
│   ├── src/
│   │   ├── index.ts          # Express app entry
│   │   ├── db.ts             # PostgreSQL connection pool
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── middleware/
│   │   │   ├── auth.ts       # JWT verification
│   │   │   └── errorHandler.ts
│   │   └── routes/
│   │       ├── auth.ts       # Register, Login
│   │       ├── projects.ts   # CRUD projects
│   │       ├── tasks.ts      # CRUD tasks + single-task detail endpoint
│   │       └── users.ts      # User list + /users/search?q= endpoint
│   ├── migrations/
│   │   └── 001_init_schema.sql
│   ├── scripts/
│   │   ├── migrate.ts        # Run migrations
│   │   └── seed.ts           # Populate test data
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile            # Multi-stage build
│   └── .env.example
│
└── frontend/                  # React + Vite
    ├── src/
    │   ├── main.tsx          # React entry
    │   ├── App.tsx           # Router + Layout + ProtectedRoute
    │   ├── index.css         # Global styles
    │   ├── pages/
    │   │   ├── AuthPage.tsx          # Login/Register
    │   │   ├── ProjectsPage.tsx      # Projects list + create
    │   │   ├── ProjectDetailPage.tsx # Board: task list, filters, create/edit/delete
    │   │   └── TaskDetailPage.tsx    # JIRA-style task detail with inline editing
    │   ├── hooks/
    │   │   └── useAuth.ts    # Auth context + useAuthContext hook
    │   └── utils/
    │       └── api.ts        # Axios client with interceptors + typed API helpers
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── package.json
    ├── tsconfig.json
    ├── Dockerfile
    └── .env.example
```

---

## Architecture Decisions

I want to be transparent about the choices I made and why, rather than just listing the stack.

### Node.js/Express over Go

The assignment listed Go as preferred, and I considered it. I chose Node/Express because the entire stack is then one language — TypeScript end to end. That means a single mental model for types, error handling, and async patterns. At this scale, Go's concurrency advantages don't materialise, and a split-language codebase is harder to navigate for a reviewer with limited time. If this were a high-throughput service processing thousands of concurrent connections, the calculus changes.

### Vite over Create React App

Straightforward call. Vite's dev build is meaningfully faster, HMR is near-instant, and the production bundle is leaner. CRA has been effectively deprecated and I wouldn't start a new project with it today.

### shadcn/ui for components

I chose shadcn/ui over MUI or Chakra because it's composable and unstyled at the primitive level — you get fully accessible Radix components that you style yourself with Tailwind. There's no runtime CSS-in-JS overhead, no theme system to fight, and the output looks like your design, not the library's. It's what teams like Vercel and Linear use in production, and I think it's the right default for new projects.

### Plain SQL migrations over an ORM

I went with raw SQL for migrations because they're transparent. Any engineer can read a `.sql` file, diff it, and understand exactly what changed. An ORM like Prisma is convenient during development but introduces a layer of abstraction between the code and the database that I think is easy to misuse, especially under time pressure.

### Stateless JWT authentication

Standard choice for a REST API. Tokens are self-contained, scale horizontally without session storage, and are straightforward to validate in middleware. The main limitation is revocation — you can't invalidate a token server-side without a denylist. For this scope, 24-hour expiry is a reasonable tradeoff and I've noted it explicitly rather than pretending it's not a limitation.

### Optimistic UI — no full reloads after mutations

Every task mutation (create, edit, status change, delete) updates local React state from the API response rather than re-fetching the entire project. This makes the UI feel responsive and eliminates unnecessary network traffic. The tradeoff is that concurrent edits by another user aren't reflected until navigation — acceptable without real-time support, and an honest limitation I'd address with WebSockets if this went further.

### Server-side user search for assignee autocomplete

Rather than loading all users into the client when a project page loads (which doesn't scale), the assignee input hits `GET /users/search?q=` with a 250ms debounce. The endpoint returns at most 50 results ordered by prefix relevance. This is the right architecture from day one — any real product has far more users than tasks, and front-loading all of them is a mistake you'd eventually have to fix.

### No real-time updates

WebSockets would make the product better, but they would also meaningfully increase the codebase — persistent connection management, reconnection logic, and server-side event fan-out. I made the call to build the core product solidly rather than ship a live-update feature that's half-done. It's at the top of my "what's next" list.

---

## API Reference

All endpoints return `Content-Type: application/json`. All endpoints except auth require `Authorization: Bearer <token>`.

### Authentication

**POST `/auth/register`**
```json
// Request
{ "name": "John Doe", "email": "john@example.com", "password": "secure-password" }

// Response 201
{ "token": "eyJ...", "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com" } }
```

**POST `/auth/login`**
```json
// Request
{ "email": "test@example.com", "password": "password123" }

// Response 200
{ "token": "eyJ...", "user": { "id": "uuid", "name": "Test User", "email": "test@example.com" } }
```

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List projects the current user owns or has tasks in |
| POST | `/projects` | Create a project (owner = current user) |
| GET | `/projects/:id` | Project details + its tasks + related users |
| PATCH | `/projects/:id` | Update name/description (owner only) |
| DELETE | `/projects/:id` | Delete project + all tasks (owner only) |
| GET | `/projects/:id/stats` | Task counts by status and assignee |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/tasks` | List tasks — supports `?status=` `?assignee=` `?page=` `?limit=` |
| GET | `/projects/:id/tasks/:taskId` | Single task + project metadata + related users |
| POST | `/projects/:id/tasks` | Create a task |
| PATCH | `/tasks/:id` | Sparse update — only changed fields are sent |
| DELETE | `/tasks/:id` | Delete (project owner or task creator only) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users |
| GET | `/users/search?q=<term>&limit=<n>` | Search users by name or email (max 50, prefix-ordered) |

---

## Error Handling

**Validation Error** (400)
```json
{
  "error": "validation failed",
  "fields": { "email": "is required" }
}
```

**Unauthorized** (401) — Missing or invalid token
```json
{ "error": "unauthorized" }
```

**Forbidden** (403) — Authenticated but not authorized (e.g., delete someone else's project)
```json
{ "error": "forbidden" }
```

**Not Found** (404)
```json
{ "error": "not found" }
```

---

## Database Schema

### `users`
```sql
id (UUID, PK)
name (VARCHAR, NOT NULL)
email (VARCHAR, UNIQUE, NOT NULL, indexed)
password (VARCHAR, hashed with bcryptjs at cost ≥12)
created_at (TIMESTAMP)
```

### `projects`
```sql
id (UUID, PK)
name (VARCHAR, NOT NULL)
description (TEXT, nullable)
owner_id (UUID, FK → users, indexed)
created_at (TIMESTAMP)
```

### `tasks`
```sql
id (UUID, PK)
title (VARCHAR, NOT NULL)
description (TEXT, nullable)
status (ENUM: todo | in_progress | done, default: todo)
priority (ENUM: low | medium | high, default: medium)
project_id (UUID, FK → projects, indexed)
assignee_id (UUID, FK → users, nullable, indexed)
due_date (DATE, nullable)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

---

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `AuthPage` | Login form with validation and error feedback |
| `/register` | `AuthPage` | Registration form |
| `/projects` | `ProjectsPage` | List all accessible projects, create new |
| `/projects/:id` | `ProjectDetailPage` | Task board with status filter chips, task list, inline status toggle, create/edit/delete |
| `/projects/:id/tasks/:taskId` | `TaskDetailPage` | Full task detail view: inline editing, status/priority controls, metadata sidebar with assignee and creator |

Unauthenticated users are redirected to `/login`. Auth state is stored in `localStorage` and persists across page refreshes.

---

## What I'd Do With More Time

These aren't things I didn't think of — they're deliberate cuts to stay within the intended scope.

**Highest priority:**
- **Real-time updates** — WebSocket-based task sync so changes made by one user are immediately visible to others on the same project. The architecture is already set up for it; the missing piece is the connection layer.
- **Optimistic rollback on error** — Right now, if a mutation fails after the optimistic update, the local state stays wrong until a page reload. Adding a revert step would make this production-grade.
- **Request cancellation for search** — Stale debounced responses can currently overwrite newer results in the assignee input. A simple `AbortController` pattern fixes this.

**Also worth building:**
- Integration tests covering the auth and task CRUD flows end to end
- Role-based access: project member roles (Owner, Editor, Viewer) with a proper permission matrix
- An activity log so you can see who changed what and when
- Rate limiting on the API to prevent abuse
- A CI pipeline (GitHub Actions) that runs linting, type-check, and tests on every PR

I deliberately didn't include half-finished versions of any of these. A solid, working core is more useful to review than a lot of features that are 80% done.

---

## Bonus Features

Beyond the required spec, I also shipped:

- **Pagination** on task and project list endpoints (`?page=` and `?limit=`)
- **Stats endpoint** — `GET /projects/:id/stats` with task counts by status and assignee
- **Single-task fetch** — `GET /projects/:id/tasks/:taskId` returns only the data that page actually needs, instead of fetching the whole project
- **Server-side assignee search** — `GET /users/search?q=` with 250ms debounce and prefix-ordered results; no bulk user loading
- **Inline task editing** — full task detail page with editable fields, not just a modal
- **Optimistic UI** — create, edit, status change, and delete all update local state instantly from the API response; no round-trip fetches
- **Sparse PATCH** — task updates only send the fields that actually changed
- **Graceful shutdown** — SIGTERM handling so containers stop cleanly
- **Multi-stage Docker builds** — production images are minimal
- **Structured logging** with Pino
- **Global 401 handling** — Axios interceptor catches expired tokens and redirects to login automatically

---

## Development Workflow

If you want to work on the code locally outside Docker:

```bash
# Run migrations after schema changes
docker compose exec api npm run migrate:up

# Reseed the database
docker compose exec api npm run seed

# Access PostgreSQL directly
docker compose exec postgres psql -U taskflow -d taskflow
```

Backend changes reload automatically with ts-node-dev. Frontend changes hot-reload via Vite.

---

## Troubleshooting

**"Cannot connect to database"** — PostgreSQL takes around 10 seconds to be ready on cold start. Docker Compose healthchecks handle this automatically. If you're running services manually, start postgres first and give it a moment before starting the API.

**"Port 3000 already in use"** — Update the port mapping in `docker-compose.yml`:
```yaml
ports:
  - "3100:3000"
```

**"Migrations didn't run"** — Check the API logs:
```bash
docker compose logs api
```

**"Seed user not found"** — Verify the seed ran successfully:
```bash
docker compose exec postgres psql -U taskflow -d taskflow -c "SELECT email FROM users;"
```

---

## Security

- Passwords hashed with bcryptjs at cost 12
- JWTs signed with a secret loaded from `.env`, never hardcoded
- CORS restricted to `localhost:3000`
- All database queries parameterised — no string interpolation
- `.env` is `.gitignore`d; `.env.example` with safe defaults is committed instead
- Token expiry set to 24 hours

---