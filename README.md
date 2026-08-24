# NairaAI — AI-Powered Personal Finance Tracker

> A full-stack personal finance management system designed for the Nigerian market. Automatically categorises transactions using machine learning, tracks budgets in real time, and surfaces AI-generated insights (alerts, trends, recommendations, anomaly detection).

---

## Table of Contents
1. [Architecture](#architecture)
2. [Technology Stack](#technology-stack)
3. [Local Development](#local-development)
4. [Environment Variables](#environment-variables)
5. [Running Tests](#running-tests)
6. [Production Deployment](#production-deployment)
7. [API Reference](#api-reference)
8. [ML Pipeline](#ml-pipeline)
9. [Compliance](#compliance)

---

## Architecture

```
┌─────────────────┐      HTTP / Cookie      ┌──────────────────────┐
│  React Frontend │ ◄──────────────────────► │  FastAPI Backend      │
│  (Vite + TSX)   │                          │  (Python 3.12)        │
└─────────────────┘                          └──────────┬───────────┘
                                                        │ asyncpg
                                             ┌──────────▼───────────┐
                                             │  PostgreSQL 16        │
                                             │  (Docker volume)      │
                                             └──────────────────────┘
```

- **Session Auth**: JWT stored in an HTTP-only cookie (`access_token`).
- **ML Model**: scikit-learn TF-IDF + Logistic Regression, persisted as `model.joblib`.
- **Insights Engine**: Rule-based system (4 logic types) running on-demand per user.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | FastAPI, SQLAlchemy 2 (async), Alembic, orjson |
| Auth | JWT (PyJWT), bcrypt, HTTP-only session cookie |
| ML | scikit-learn, TF-IDF, Logistic Regression, joblib |
| Database | PostgreSQL 16 |
| Infrastructure | Docker, Docker Compose |

---

## Local Development

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Node.js](https://nodejs.org/) 20+ (for frontend hot-reload outside Docker)

### Quick Start

`docker-compose.yml` alone is the production-safe base (no dev secrets, no
hot-reload, frontend served by nginx). For local development, layer on
`docker-compose.dev.yml`, which adds hot-reload, source volume mounts, and
dev defaults for env vars/ports.

```bash
# 1. Clone the repository
git clone <repo-url>
cd professional-masters-project

# 2. Start all services (DB + Backend + Frontend) in dev mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# 3. Apply database migrations
# (the backend container also runs this automatically on boot via entrypoint.sh)
docker compose exec backend alembic upgrade head

# 4. Seed categories and train the ML model baseline
docker compose exec backend python -m app.scripts.seed

# 5. Open the app
open http://localhost:5173
```

Services will be available at:
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |

### Frontend Hot-Reload (outside Docker)

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory and fill in your values.

| Variable | Description | Default (dev) |
|---|---|---|
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://postgres:postgres@db:5432/finance_tracker` |
| `JWT_SECRET_KEY` | JWT signing secret — **generate with** `openssl rand -hex 32` | dev key (insecure) |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session lifetime in minutes | `1440` (24h) |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173` |
| `FRONTEND_URL` | Primary frontend URL (used in redirects) | `http://localhost:5173` |
| `COOKIE_SECURE` | Set `True` in production (HTTPS required) | `False` |
| `ENVIRONMENT` | `development` or `production` | `development` |

---

## Running Tests

Tests use `pytest-asyncio` with a real database connection (same Postgres, isolated per test user).

```bash
# Run the full test suite inside the backend container
docker compose exec backend python -m pytest tests/ -v --tb=short

# Run a specific test file
docker compose exec backend python -m pytest tests/test_auth.py -v

# Run with coverage (install pytest-cov first)
docker compose exec backend python -m pytest tests/ --cov=app --cov-report=term-missing
```

### Test Coverage Map

| File | What it tests |
|---|---|
| `tests/test_auth.py` | Register, login, duplicate email, bad password, `/me`, logout |
| `tests/test_transactions.py` | CRUD, ML auto-categorisation, CSV import, access control |
| `tests/test_budgets.py` | CRUD, duplicate guard, `spent_amount` computation, breach detection |
| `tests/test_insights.py` | Engine execution, alert generation, deduplication, mark-read, dismiss |

---

## Production Deployment

### 1. Prepare secrets

```bash
# Generate a strong JWT secret
openssl rand -hex 32

# Copy and fill in backend/.env
cp backend/.env.example backend/.env
# Edit DATABASE_URL, JWT_SECRET_KEY, ALLOWED_ORIGINS, COOKIE_SECURE=True, ENVIRONMENT=production
```

### 2. Deploy

```bash
docker compose up -d --build
```

`docker-compose.yml` on its own *is* the production configuration (this is
what Dokploy runs) — no `-f` overlay needed:
- Uvicorn runs with **4 workers**, no `--reload`.
- No source-code volume mounts — code is baked into the Docker image.
- Frontend is a static Vite build served by nginx (not the dev server).
- All secrets/config come from `backend/.env` — nothing is hard-coded.
- DB port not published — PostgreSQL is only reachable on the compose network.

Set `COOKIE_SECURE=True`, `ALLOWED_ORIGINS`, and `ENVIRONMENT=production` in
`backend/.env` before deploying.

### 3. Migrations

The backend container runs `alembic upgrade head` automatically on startup
(see `backend/entrypoint.sh`). To run it manually:

```bash
docker compose exec backend alembic upgrade head
```

### 4. Production Checklist

- [ ] `JWT_SECRET_KEY` generated with `openssl rand -hex 32`
- [ ] `COOKIE_SECURE=True` in `.env`
- [ ] `ALLOWED_ORIGINS` set to your actual domain(s)
- [ ] HTTPS configured (Nginx / Cloudflare / Caddy in front of Docker)
- [ ] Postgres password changed from default
- [ ] DB not exposed on public network (no `ports:` mapping)
- [ ] Docker volume backup scheduled for `postgres_data`

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Log in, returns session cookie |
| `POST` | `/auth/logout` | Clear session cookie |
| `GET` | `/auth/me` | Get current authenticated user |

### Transactions
| Method | Path | Description |
|---|---|---|
| `GET` | `/transactions` | List transactions (supports `?type=`, `?category_id=`, date range filters) |
| `POST` | `/transactions` | Create a transaction (ML auto-categorises if `category_id` omitted) |
| `PUT` | `/transactions/{id}` | Update a transaction |
| `DELETE` | `/transactions/{id}` | Delete a transaction |
| `GET` | `/transactions/categories` | List all available categories |
| `POST` | `/transactions/import-csv` | Bulk import from a bank statement CSV |

### Budgets
| Method | Path | Description |
|---|---|---|
| `GET` | `/budgets` | List budgets for a month/year (includes live `spent_amount`, `percent_used`, `is_breached`) |
| `POST` | `/budgets` | Create a budget for a category + month/year |
| `PUT` | `/budgets/{id}` | Update budget limit |
| `DELETE` | `/budgets/{id}` | Delete a budget |

### Insights
| Method | Path | Description |
|---|---|---|
| `GET` | `/insights` | Run the AI insights engine and return the feed (max 50, newest first) |
| `PATCH` | `/insights/{id}/read` | Mark an insight as read |
| `DELETE` | `/insights/{id}` | Dismiss an insight permanently |

### ML
| Method | Path | Description |
|---|---|---|
| `POST` | `/ml/categorise` | Classify a description string |
| `POST` | `/ml/train` | Retrain the model on current user data |

---

## ML Pipeline

```
Raw description text
       │
       ▼
Text cleaning (lowercase, strip punctuation)
       │
       ▼
TF-IDF Vectorisation (unigrams + bigrams)
       │
       ▼
Logistic Regression Classifier
       │
       ▼
Confidence Score  ──► < 0.6 → is_flagged = True
       │
       ▼
Category Name + Confidence Score
```

The model is seeded with **49 baseline Nigerian transaction templates** and retrains incrementally as users manually correct categories. The pipeline is persisted at `backend/app/ml/artifacts/model.joblib`.

---

## Compliance

NairaAI is designed to comply with the **Nigeria Data Protection Act (NDPA) 2023**:

- **Consent Tracking**: Every user explicitly provides consent during registration. The consent timestamp is stored.
- **Data Minimisation**: Only transaction data necessary for budgeting is stored.
- **Right to Erasure**: Deleting a user account cascades to all their transactions, budgets, and insights.
- **Transparency**: The Insights tab displays compliance status and consent date to the user.

---

## Development Roadmap

| Sprint | Focus | Status |
|---|---|---|
| Sprint 1 | Project setup, Auth system, DB schema | ✅ Complete |
| Sprint 2 | Transactions CRUD, CSV import | ✅ Complete |
| Sprint 3 | Dashboard UI, Charts | ✅ Complete |
| Sprint 4 | ML model training, Categorisation API | ✅ Complete |
| Sprint 5 | Insights engine, Budget management | ✅ Complete |
| Sprint 6 | Testing, Optimisation, Deployment | ✅ Complete |
