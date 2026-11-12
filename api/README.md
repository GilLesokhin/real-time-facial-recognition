# Building Entry: API

The Python backend: FastAPI, SQLAlchemy, Alembic and Postgres, managed with [uv](https://docs.astral.sh/uv/).

## Set up (once)

1. Install uv and Postgres.
2. Create a user and two databases: one for the app, one only for the tests (the tests wipe it).

   ```sql
   CREATE USER building_entry WITH PASSWORD 'choose-one';
   CREATE DATABASE building_entry OWNER building_entry;
   CREATE DATABASE building_entry_test OWNER building_entry;
   ```

3. Copy `.env.example` to `.env` and fill it in: both database URLs, a random `SECRET_KEY` (at least 32 characters) and the first Platform Admin's email and password.

   ```bash
   uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

4. Install the packages and build the database. This also creates the Platform Admin from `.env`.

   ```bash
   uv sync
   uv run alembic upgrade head
   ```

## Run

```bash
uv run fastapi dev app/main.py
```

The API runs on http://localhost:8000, with interactive docs at http://localhost:8000/docs. The web app reaches it through the Vite proxy at `/api`.

## Test

```bash
uv run pytest
```

The tests use `TEST_DATABASE_URL`, never `DATABASE_URL`. Each run empties that database and rebuilds it with the real migrations, and each test is rolled back afterwards.

## Endpoints

Every endpoint is listed at http://localhost:8000/docs. To protect an endpoint so only signed-in admins can call it, add `admin: CurrentAdmin` (from `app/auth/deps.py`) to its parameters.

## Code map

Each feature has three layers: router (HTTP) → service (rules) → db (queries).

| Path | What |
| -- | -- |
| `app/main.py` | The app and the session-cookie middleware |
| `app/core/` | Settings from `.env`, the database session, password hashing |
| `app/<feature>/` | One folder per feature, such as `auth/` and `users/` |
| `migrations/versions/` | Database migrations, run with `uv run alembic upgrade head` |
| `tests/` | pytest suite, one folder per feature. `conftest.py` sets up the test database |
