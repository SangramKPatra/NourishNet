# NourishNet — Backend Plan

**Owner:** backend team
**Scope:** everything under `backend/` — FastAPI app, services, models, tests, seeders, and the external API integrations (Gemini, Open-Meteo, Telegram).
**Companion docs:** `product.md` (what/why), `AGENT.md` (repo conventions), `HANDOVER.md` (current state + Phase 6+ notes), `build_prompt.md` (original master build prompt — recovered from git at `HEAD`).

**Status of this document (Nov 2026):** Phases 0–5 of the original build plan are built and verified. Phases 6+ are **not** built. This document restates the backend contract as-built, records the drift between the plan and the code, and lays out the remaining work as concrete, verifiable phases.

---

## 1. Purpose

NourishNet's backend is the engine of a four-step loop:

```
photo ──▶ vision (Gemini)  ─┐
                             ├─▶ safe window (deterministic) ──▶ dispatch (shelter match + Telegram) ──▶ impact
GPS ──▶ weather (Open-Meteo)┘
```

The backend's job is to turn *one photo plus two coordinates* into **a time-boxed, shelter-matched, volunteer-claimable batch** — and to record enough state to prove impact afterwards.

**Non-negotiable principles (inherited from `AGENT.md`, still binding):**

1. **Zero friction for the donor.** Open → photo → confirm. No required form fields in the donor path.
2. **Safety first, honestly framed.** The safe window is a conservative *estimate*, never a guarantee. Never write "guaranteed safe" in any API-facing string, error message, or copy field.
3. **Push, not pull.** Every confirmed batch triggers dispatch automatically. Nothing sits waiting to be browsed.
4. **Deterministic core, AI at the edges.** Gemini only does image → structured JSON. Safe-window math, urgency, ranking, and impact metrics are plain deterministic Python, unit-tested.
5. **Demo-reliable.** Every external dependency has a defined fallback (see §7).

---

## 2. Current state — as built

### 2.1 What exists

| Area | Files | State |
| --- | --- | --- |
| App shell + CORS + lifespan | `backend/app/main.py` | Done. Routers mounted, `expire_batches` background loop running. |
| Settings | `backend/config.py` | Done. pydantic-settings, repo-root `.env`, all tunables exposed. |
| DB engine/session | `backend/db.py` | Done. Async SQLAlchemy 2.x, `AsyncSessionLocal`, `get_session` dependency. |
| Models | `backend/models.py` | Done. `Donor`, `Shelter`, `Volunteer`, `Batch`, `DispatchLog`, `User`, `UserToken`; GUID type for PG/SQLite parity. |
| Schemas | `backend/schemas.py` | Done. Vision schema, batch schema, stats schema, auth schema. |
| Safety engine | `backend/services/safety.py` | Done. Pure functions: `compute_safe_window`, `remaining_minutes`, `urgency`. |
| Weather | `backend/services/weather.py` | Done. Open-Meteo, 4 s timeout, 10-min TTL cache, live/cached/fallback. |
| Vision | `backend/services/vision.py` | Done. Gemini, 1280 px resize, JSON schema response, Pydantic validation, `None` → manual entry. |
| Dispatch (shelter match) | `backend/services/dispatch.py` | **Partial.** Haversine matching + capacity + travel-feasibility filter works; **no Telegram send, no volunteer selection**. |
| Impact | `backend/services/impact.py` | **Stub.** Returns zeros; the real math lives inline in `routers/stats.py`. |
| Batch API | `backend/routers/batches.py` | Done. scan → confirm → claim → pickup → deliver → list. |
| Stats API | `backend/routers/stats.py` | Done. Demo/real segregation. |
| Telegram webhook | `backend/routers/telegram.py` | **Stub.** Reads the body, returns `{"ok": true}`. |
| Auth | `backend/routers/auth.py`, `backend/services/auth.py` | Done but **off-model**: adds a `supplier`/`distributor` user model that the product spec doesn't describe. |
| Seeders | `backend/seed.py` (async, idempotent), `backend/db_sync.py` (sync, not idempotent) | **Duplicated.** `db_sync.py` should be deleted. |
| Tests | `backend/tests/` | 31 tests, all passing (`pytest tests/ -q` → `31 passed`). Unit level only. |

### 2.2 Verified baseline

```
$ cd backend && .venv/bin/python -m pytest tests/ -q
31 passed, 11 warnings in 7.86s
```

The 11 warnings are all `datetime.utcnow()` deprecation (Python 3.12+) — cosmetic today, a hard break on 3.13+. See §10 Phase 9.

### 2.3 Known drift (plan vs. code)

These are the concrete gaps this plan closes. Each cites the file.

| # | Drift | Where | Severity |
| --- | --- | --- | --- |
| D1 | Telegram dispatch never sends anything. `dispatch_batch` only picks a shelter and writes a `DispatchLog`; the webhook returns a stub. | `services/dispatch.py:45`, `routers/telegram.py:6` | **High** — core loop is broken without it |
| D2 | `urgency` is always computed from distance `0`, so `urgency_band` is always `normal` and the dashboard never shows watch/urgent states. The batch row does not carry shelter coordinates, so distance cannot be recomputed at list time. | `routers/batches.py:42-46` | **High** — safety-relevant signal is dead |
| D3 | Background task only expires batches. The promised **50 % re-alert** and **75 % `at_risk`** transitions are not implemented. | `app/main.py:15-33` | **High** |
| D4 | `services/impact.py` is a zero-returning placeholder; the live metric math is duplicated inside the stats router. | `services/impact.py`, `routers/stats.py:13-20` | Medium |
| D5 | Two conflicting identity models: `Donor.token` (product spec) vs `User`/`UserToken` with `supplier`/`distributor` roles (not in `product.md`). Donors are unauthenticated; dashboard is unauthenticated. | `models.py:35`, `models.py:105` | **High** — needs a decision (§12, D-1) |
| D6 | `Base.metadata.create_all` runs on every startup against a Supabase-managed database. | `app/main.py:38-39` | Medium |
| D7 | No Alembic migrations; schema changes are applied by hand. | — | Medium |
| D8 | Vision timeout is 15 s with 3 retries and exponential sleeps → worst case ~45 s before the donor sees a manual-entry form. `AGENT.md` mandates an 8 s total budget. | `services/vision.py:104-124` | Medium |
| D9 | The configured model id `gemini-3.6-flash` is **valid and current** (verified live against the Gemini catalog: `2.5-flash` → `3.8-flash` all exist), but `AGENT.md` still documents `gemini-2.5-flash`. The **docs** are stale, not the code. | `config.py:27` vs `AGENT.md:19` | Low — doc drift only |
| D10 | No upload size limit, no rate limit on `/api/batches/scan` — an unauthenticated endpoint that spends money per call. | `routers/batches.py:78` | Medium |
| D11 | `db_sync.py` and `seed.py` both seed; `db_sync.py` is not idempotent (duplicates rows every run) and needs `psycopg2`, which is not in `requirements.txt`. | `backend/db_sync.py` | Medium |
| D12 | `datetime.utcnow()` everywhere → deprecation warnings and naive-datetime comparisons. | all services | Low |
| D13 | No structured logging anywhere; failures print to stdout (`print(f"vision error: {e!r}")`), and the background task swallows all exceptions silently. | `services/vision.py:141`, `app/main.py:30-32` | Medium |
| D14 | Dead code: `services/dispatch.py:56 dispatch()` stub returning `True`; unused imports in `db.py`, `app/main.py`, `routers/auth.py`; `BatchStatus` literal in `schemas.py` is unused. | multiple | Low |
| D15 | `CORS allow_origins` includes `settings.PUBLIC_BASE_URL`, which defaults to `""` — an empty origin in the allowlist. Only one origin can be configured. | `app/main.py:51-56` | Low |
| D16 | `requirements.txt` unpinned; `pyproject.toml` duplicates the dependency list and declares `requires-python = ">=3.9"` while the code uses `X \| None` syntax (3.10+). | `backend/requirements.txt`, `backend/pyproject.toml` | Low |

---

## 3. Architecture

### 3.1 Layering

```
routers/          HTTP surface. Parse → validate → orchestrate → serialise.
  ├── auth.py         signup / signin / me / logout
  ├── batches.py      scan → confirm → claim → pickup → deliver → list
  ├── stats.py        aggregate impact metrics
  └── telegram.py     Telegram update webhook (callback_query)
        │
services/         business logic. Pure or I/O-bound. No HTTP objects, no session commits.
  ├── safety.py       safe window, remaining minutes, urgency      (pure)
  ├── vision.py       Gemini image → structured items              (I/O)
  ├── weather.py      Open-Meteo current temp/humidity              (I/O)
  ├── dispatch.py     shelter matching, alert formatting, sending  (I/O)
  ├── impact.py       meals / kg / CO₂e aggregation                 (pure)
  └── auth.py         password hashing, token issue/verify         (pure + DB)
        │
models.py         SQLAlchemy ORM. GUID PKs, UTC naive datetimes, FK constraints.
schemas.py        Pydantic v2 request/response contracts + Gemini response schema.
db.py             Async engine, session factory, `get_session` dependency.
config.py         pydantic-settings; every tunable in one place.
```

**Rules:**
- Routers never compute business metrics. Move the math into `services/` and unit-test it there.
- Services never raise `HTTPException`. They return data or raise a typed domain error; the router maps errors to status codes.
- Services never commit. The router owns the transaction boundary.
- No service imports from `routers/`, and no router imports from another router.

### 3.2 Request flows

**Scan (donor):**
```
POST /api/batches/scan  (multipart: image, lat, lng, donor_token)
  → resolve Donor by token           (401 if unknown)
  → asyncio.gather(vision.run_vision, weather.get_weather)     ← parallel, both degrade independently
  → items = vision.items or []      (vision None ⇒ manual-entry draft, NOT an error)
  → safe_window = safety.compute_safe_window(tier, temp)
  → persist Batch(status="draft", expires_at = now + safe_window)
  → 200 ScanResponse(needs_manual_entry = vision is None)
```

**Confirm (donor, one tap):**
```
POST /api/batches/{id}/confirm  {items?, portions?}
  → 409 unless status == "draft"
  → apply edits, recompute total_kg
  → 422 if no items or portions <= 0
  → expires_at = now + safe_window_min ; status = "pending"
  → dispatch.dispatch_batch()      (best-effort; never fails the request)
  → 200 ConfirmResponse
```

**Claim (volunteer / Telegram):**
```
POST /api/batches/{id}/claim  {volunteer_id? | telegram_chat_id?}
  → 422 if neither identifier
  → 409 unless status in {pending, dispatched, at_risk}
  → 409 + mark expired if window already closed
  → resolve Volunteer
  → conditional UPDATE ... WHERE status IN (...)   ← atomicity
  → rowcount != 1 ⇒ 409 "already claimed"          ← exactly one winner
```

### 3.3 State machine

```
                ┌──────────────┐
   scan ───────▶│    draft     │  (created by POST /scan, editable, never dispatched)
                └──────┬───────┘
                       │ confirm
                       ▼
                ┌──────────────┐   no feasible shelter    ┌──────────┐
                │   pending    │────────────────────────▶│ at_risk  │
                └──────┬───────┘◀────────────────────────└────┬─────┘
                       │ shelter selected                    │ re-alert / rescued
                       ▼                                     │
                ┌──────────────┐                             │
                │  dispatched  │─────────────────────────────┘
                └──────┬───────┘
                       │ claim (atomic)
                       ▼
                ┌──────────────┐        ┌──────────┐
                │   claimed    │───────▶│ picked_up│
                └──────────────┘        └────┬─────┘
                                                │ deliver
                                                ▼
                                         ┌────────────┐
                                         │  delivered │  ← only status that counts for impact
                                         └────────────┘

   any non-terminal status + now > expires_at ──▶ expired
```

Legal transitions are enforced in the routers. Status is a free-form `String` column today (see Phase 9 for a DB-level enum/constraint).

---

## 4. Data model

### 4.1 Tables

**`donors`** — the party that has surplus food.
| Column | Type | Notes |
| --- | --- | --- |
| `id` | GUID PK | `uuid.uuid4` default |
| `name` | String | not null |
| `org_type` | String | `canteen \| caterer \| cloud_kitchen \| other` |
| `lat`, `lng` | Float | not null — donor pickup point |
| `token` | String | **unique, indexed** — bearer credential for the donor link |

**`shelters`** — the party that receives food.
| Column | Type | Notes |
| --- | --- | --- |
| `id` | GUID PK | |
| `name` | String | not null |
| `lat`, `lng` | Float | not null |
| `capacity_portions` | Integer | not null — must be ≥ batch portions |
| `contact` | String | email/phone |
| `active` | Boolean | default true — filterable |
| `verified` | Boolean | default false — **only verified shelters are dispatched to** |

**`volunteers`** — the party that collects.
| Column | Type | Notes |
| --- | --- | --- |
| `id` | GUID PK | |
| `name` | String | not null |
| `telegram_chat_id` | String | **unique, not null** — auto-created on first claim |
| `lat`, `lng` | Float | nullable — used for "nearest volunteers" ranking |
| `active` | Boolean | default true |

**`batches`** — the unit of work.
| Column | Type | Notes |
| --- | --- | --- |
| `id` | GUID PK | |
| `donor_id` | GUID FK → `donors.id` | indexed, not null |
| `items` | JSON | `[{name, approx_kg}]` |
| `total_kg` | Float | not null — recomputed on confirm |
| `portions` | Integer | not null |
| `tier` | String | `HIGH_MOISTURE \| MEDIUM_MOISTURE \| DRY` |
| `ambient_temp_c` | Float | from weather |
| `humidity_pct` | Float | stored, **not** in the v1 formula |
| `weather_source` | String | `live \| cached \| fallback` |
| `safe_window_min` | Integer | minutes |
| `created_at` | DateTime | default `utcnow` |
| `expires_at` | DateTime | nullable until confirm |
| `status` | String | indexed, default `draft` |
| `shelter_id` | GUID FK → `shelters.id` | set by dispatch |
| `volunteer_id` | GUID FK → `volunteers.id` | set by claim |
| `lat`, `lng` | Float | pickup coordinates |
| `is_demo` | Boolean | default false — segregates demo metrics |

**`dispatch_logs`** — the audit trail for every outbound attempt.
| Column | Type | Notes |
| --- | --- | --- |
| `id` | GUID PK | |
| `batch_id` | GUID FK → `batches.id` | indexed, not null |
| `channel` | String | `telegram \| dashboard \| ...` |
| `payload` | JSON | message body + recipient list |
| `status` | String | `selected \| sent \| failed \| skipped` |
| `attempt` | Integer | 1-based retry counter |
| `created_at` | DateTime | default `utcnow` |

**`users`** / **`user_tokens`** — the newer auth model (drift D5).
`users`: `id`, `email` (unique, indexed), `password_hash`, `password_salt`, `role` (`supplier | distributor`), `lat`, `lng`, `radius_km`, `active`, `created_at`.
`user_tokens`: `id`, `user_id` FK, `token` (unique, indexed), `created_at`, `expires_at` (30-day TTL).

### 4.2 Model rules
- **UUIDs** are stored through the `GUID` type decorator: native `uuid` on PostgreSQL, `CHAR(36)` on SQLite. Never write raw `str(uuid)`.
- **Every FK is declared.** Commit `1b2c554` added the missing constraints on `batches`, `dispatch_logs`, `user_tokens`.
- **All timestamps are UTC.** Naive datetimes, single source of truth — migrate to timezone-aware in Phase 9.
- **Indexes** on every FK and on every column used in a list filter (`batches.status`, `batches.created_at`).

---

## 5. Core deterministic engine

These functions are the heart of the safety story. They are pure, unit-tested, and must never be moved into an LLM prompt.

### 5.1 Safe window (`services/safety.py`)

```python
safe_window_min = max(MIN_WINDOW, BASE_WINDOWS[tier] - max(0, (temp_c - 25.0) * 15))
```

| Tier | Base window |
| --- | --- |
| `HIGH_MOISTURE` | 240 min (4 h) |
| `MEDIUM_MOISTURE` | 360 min (6 h) |
| `DRY` | 480 min (8 h) |

`MIN_WINDOW = 30` (floor, configurable). At or below 25 °C the base window is returned unchanged.

**Reference values — use these exact numbers in tests, seed data, the demo script, and the pitch:**

| Scenario | Result |
| --- | --- |
| HIGH_MOISTURE @ 32 °C | **135 min = 2 h 15 min** |
| HIGH_MOISTURE @ 25 °C | 240 min |
| HIGH_MOISTURE @ 45 °C | 30 min (floor hit: 240 − 300 → clamped) |
| DRY @ 25 °C | 480 min |

Humidity is fetched, stored, and displayed, but is **not** part of the v1 formula. Do not add it without updating `AGENT.md` and `product.md`.

### 5.2 Remaining time and urgency

```python
remaining_min = max(0, int((expires_at - now).total_seconds() // 60))
travel_min    = distance_km / AVG_SPEED_KMPH * 60        # AVG_SPEED_KMPH = 20
urgency       = travel_min / max(remaining_min, 1)       # inf if remaining <= 0
```

| `urgency` | Band | Action |
| --- | --- | --- |
| `>= 0.6` | `urgent` | Escalate: alert **all** active volunteers, re-ping every 5 min |
| `0.3 – 0.6` | `watch` | Normal alert to the nearest 5 volunteers |
| `< 0.3` | `normal` | Normal alert to the nearest 5 volunteers |
| `inf` | — | Expired; stop dispatching |

`URGENCY_ESCALATE = 0.6` and `MAX_RADIUS_KM = 8` are configurable in `config.py`. The band thresholds live in `_urgency_band()` in `routers/batches.py` and **must** move into `services/safety.py` so they are testable and consistent (Phase 1 below).

### 5.3 Shelter matching (`services/dispatch.py`)

A shelter is a candidate when **all** hold:

1. `active = true` **and** `verified = true`
2. `haversine(donor, shelter) <= MAX_RADIUS_KM`
3. `capacity_portions >= batch.portions`
4. `travel_min < remaining_min * 0.8`

Candidates are ranked by **(lowest urgency, then lowest distance)**. The winner is written to `batches.shelter_id` and the batch moves to `dispatched`. If there is no candidate the batch stays `pending`, is flagged `at_risk`, and the dashboard shows a clear "no shelter available" state.

### 5.4 Impact (`services/impact.py`)

Only `delivered` batches count.

```
portions_delivered = Σ portions
kg_diverted        = Σ total_kg
co2e_kg            = kg_diverted * CO2E_FACTOR        # 2.5
```

Example: 57 kg → 142.5 kg CO₂e. Demo and real totals are reported separately. The CO₂e factor must be cited in the dashboard footnote (see `product.md` §7).

---

## 6. API contract

All responses are JSON. Errors use FastAPI's `{"detail": "..."}` shape (the frontend client at `frontend/src/lib/api.ts` parses exactly this).

### Auth — prefix `/api/auth`

| Method | Path | Body | Response | Notes |
| --- | --- | --- | --- | --- |
| POST | `/signup` | `{email, password, role, lat?, lng?, radius_km?}` | `{token, user}` | 409 if email exists. Issues **two** tokens (see Phase 3). |
| POST | `/signin` | `{email, password}` | `{token, user}` | 401 on bad credentials. New token each call. |
| GET | `/me` | — | `user` | Requires `Authorization: Bearer <token>`; 401 if missing/expired. |
| POST | `/logout` | — | `{message}` | Deletes the token. |

### Batches — prefix `/api/batches`

| Method | Path | Body / Form | Response | Status codes |
| --- | --- | --- | --- | --- |
| POST | `/scan` | multipart `image`, `lat`, `lng`, `donor_token` | `ScanResponse` | 401 bad token, 422 bad form |
| POST | `/{id}/confirm` | `{items?, portions?}` | `{batch, status}` | 404, 409 not-draft, 422 empty |
| POST | `/{id}/claim` | `{volunteer_id?, telegram_chat_id?}` | `{batch}` | 404, 409 not-claimable/expired/already-claimed, 422 no identifier |
| POST | `/{id}/pickup` | — | `{batch}` | 409 unless `claimed` |
| POST | `/{id}/deliver` | — | `{batch}` | 409 unless `picked_up` |
| GET | `` | query `status?`, `limit?` (1–100, default 50) | `Batch[]` | — |

### Stats — prefix `/api/stats`

| Method | Path | Response |
| --- | --- | --- |
| GET | `` | `{meals, kg, co2e_kg, active_batches, delivered_batches, demo:{meals,kg,co2e_kg}, real:{...}}` |

### Telegram — prefix `/api/telegram`

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/webhook` | Telegram `Update` | `{"ok": true}` — **stub today** |

### Health

| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | `{"status": "ok"}` |

### Response conventions
- `BatchResponse` always carries derived fields: `remaining_min`, `urgency`, `urgency_band`.
- `expires_at`, `created_at` are ISO-8601 UTC strings; the client renders local time.
- `is_demo` is on every batch so the frontend can badge demo data honestly.

---

## 7. External integrations and fallbacks

Every third-party call degrades instead of failing the request. This table is the contract; code must match it.

| Integration | Endpoint / SDK | Timeout | Budget | On failure |
| --- | --- | --- | --- | --- |
| **Gemini vision** | `google-genai`, `generate_content` with `response_mime_type=application/json` + JSON schema | 4 s per attempt | **8 s total** (retry 2×, jittered backoff) | Return `None` → `needs_manual_entry: true`, donor gets an editable draft |
| **Open-Meteo** | `GET api.open-meteo.com/v1/forecast?current=temperature_2m,relative_humidity_2m` | 4 s | 4 s | Last cached reading for that ~10 km grid (`source="cached"`), else 30 °C / 50 % (`source="fallback"`) |
| **Telegram** | `POST api.telegram.org/bot{token}/sendMessage` + `editMessageText` + `answerCallbackQuery` | 5 s | 3 attempts, exponential backoff | After 3 failures: log to `dispatch_logs` with `status="failed"` and surface the batch on the dashboard with a **"dispatch failed"** badge. The batch stays `pending`/`dispatched` and is never silently dropped. |

**Other rules:**
- Images are processed **in memory** and discarded unless `STORE_IMAGES=true`. Never log image bytes.
- Never log or echo `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, or bearer tokens.
- The weather cache is **in-process**. With more than one Uvicorn worker each process keeps its own cache — acceptable for MVP, documented as a known limitation until Phase 8.

---

## 8. Configuration

All settings come from the repo-root `.env` via `backend/config.py` (`ENV_FILE = parent.parent / ".env"`). `DATABASE_URL` is **required** — no default, no fallback.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | *(required)* | e.g. `postgresql+asyncpg://…` or `sqlite+aiosqlite:///./dev.db` |
| `PUBLIC_BASE_URL` | `""` | Frontend origin for CORS. **Phase 0 must support a comma-separated list.** |
| `GEMINI_API_KEY` | `""` | Empty ⇒ vision returns `None` ⇒ manual entry. |
| `VISION_MODEL` | `gemini-3.6-flash` | Valid and current (verified live). `AGENT.md` still says `gemini-2.5-flash` — update the doc. |
| `TELEGRAM_BOT_TOKEN` | `""` | Empty ⇒ dispatch logs `skipped`, no crash. |
| `TELEGRAM_CHAT_ID` | `""` | Fallback broadcast chat when no volunteer is matched. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | `""` | Reserved for auth/storage. |
| `STORE_IMAGES` | `false` | Persist uploaded photos. Default off. |
| `MIN_WINDOW` | `30` | Safety floor, minutes. |
| `AVG_SPEED_KMPH` | `20.0` | Urban travel speed for urgency. |
| `MAX_RADIUS_KM` | `8.0` | Shelter matching radius. |
| `CO2E_FACTOR` | `2.5` | kg CO₂e per kg diverted. Cite the source in the dashboard footnote. |
| `URGENCY_ESCALATE` | `0.6` | Escalation threshold. |
| `BASE_WINDOWS` | `{HIGH_MOISTURE:240, MEDIUM_MOISTURE:360, DRY:480}` | Tier base windows, minutes. |

**New settings required by this plan** (Phase 0):

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTO_CREATE_TABLES` | `false` | Run `create_all` on startup. Off when Supabase owns the schema. |
| `VISION_TOTAL_BUDGET_S` | `8.0` | Hard ceiling for the whole vision call. |
| `MAX_UPLOAD_BYTES` | `10485760` (10 MB) | Reject oversized photos with 413. |
| `TELEGRAM_TIMEOUT_S` | `5.0` | Per-attempt Telegram timeout. |
| `TOKEN_TTL_DAYS` | `30` | Session token lifetime. |
| `LOG_LEVEL` | `INFO` | Log level. |
| `RATE_LIMIT_PER_MIN` | `30` | Per-IP limit on `/scan`. |

---

## 9. Seeders, migrations, and the local database

**Current state:** two seeders exist.
- `backend/seed.py` — async, **idempotent** (checks each entity before inserting), uses the async engine. This is the canonical one.
- `backend/db_sync.py` — sync engine, **not idempotent** (inserts duplicates on every run), requires `psycopg2` which is not in `requirements.txt`. It is a leftover from before the async engine was introduced.

**Plan:** delete `backend/db_sync.py`. `backend/seed.py` stays and becomes the only seeding path. Add `backend/seed.py --reset-demo` to drop and recreate demo rows only (never production rows).

**Schema management:** move from `create_all` to **Alembic**. `alembic init` under `backend/`, `alembic.ini` at `backend/`, versions in `backend/migrations/versions/`. `create_all` remains available behind `AUTO_CREATE_TABLES=true` for throwaway local SQLite only.

---

## 10. Roadmap

Each phase lists the goal, the concrete edits, and the verification that must pass before the phase is closed.

---

### Phase 0 — Foundations and cleanup (half day)

**Goal:** make the code honest before adding features — fix the broken model id, remove dead code, kill the duplicate seeder, introduce structured logging.

**Tasks**
1. `config.py` — keep `VISION_MODEL = "gemini-3.6-flash"` (verified valid; `AGENT.md` is stale — update the doc instead of the code, drift D9). Log the resolved model id at startup so a bad override is visible immediately. Add the new settings from §8: `AUTO_CREATE_TABLES`, `VISION_TOTAL_BUDGET_S`, `MAX_UPLOAD_BYTES`, `TELEGRAM_TIMEOUT_S`, `TOKEN_TTL_DAYS`, `LOG_LEVEL`, `RATE_LIMIT_PER_MIN`.
2. New `backend/logging_config.py` — one `logging.getLogger("nourishnet")` setup: level from `LOG_LEVEL`, single stream handler, no secrets, no image bytes. Replace every `print(...)` (currently only `services/vision.py:141`).
3. `app/main.py` — replace the bare `except Exception: pass` in `expire_batches` with `logger.exception(...)`. Remove unused imports (`select`, `User`).
4. `db.py` — remove the unused `os` import.
5. `routers/auth.py` — remove the unused `sqlalchemy.orm.Session` import.
6. Delete `backend/db_sync.py`. Update `README.md` / `HANDOVER.md` references.
7. `schemas.py` — use the `BatchStatus` literal in `BatchResponse.status` (or delete it). Remove the dead `services/dispatch.py:56 dispatch()` stub.
8. `app/main.py` — gate table creation behind `settings.AUTO_CREATE_TABLES` (default off) so a Supabase-hosted deployment never mutates the schema at boot.
9. `app/main.py` — CORS: parse `PUBLIC_BASE_URL` as a comma-separated list, filter empties, always include `http://localhost:5173`.
10. `backend/requirements.txt` — pin versions for the whole tree; drop the duplicated dependency list from `pyproject.toml` (keep only build + pytest config there); set `requires-python = ">=3.10"`.
11. Delete the stale root-level scratch scripts that are currently staged as deleted (`check_db.py`, `create_local_tables.py`, `init_db.py`, `test_*.py`, `verify_tables.py`) — commit the deletions.

**Verify**
- `pytest tests/ -q` still green (31 passed).
- `uvicorn backend.app.main:app` boots against a fresh SQLite DB with `AUTO_CREATE_TABLES=true`, and against a Supabase URL with `AUTO_CREATE_TABLES=false` **without touching the remote schema**.
- `ruff check backend/` clean.

**Done when:** no `print` in `backend/`, no dead imports, no duplicate seeder, the app boots on both databases.

---

### Phase 1 — Urgency, distance, and urgency bands (half day)

**Goal:** fix drift D2 — the dashboard's urgency signal is currently always `normal`.

**Tasks**
1. `models.py` — add to `Batch`: `shelter_lat` Float, `shelter_lng` Float, `shelter_distance_km` Float, `volunteer_distance_km` Float (nullable). Storing the resolved route on the batch lets list responses compute urgency without a join and without re-running haversine per row.
2. `services/safety.py` — move the band thresholds out of the router: add `urgency_band(score) -> "normal" | "watch" | "urgent"` and `TRAVEL_FACTOR = 0.8` (the feasibility margin currently hardcoded in `dispatch.py:35`).
3. `services/dispatch.py` — on selection, write `shelter_lat`, `shelter_lng`, `shelter_distance_km`, and the computed `urgency` onto the batch. Store the urgency score in `dispatch_logs.payload` too.
4. `routers/batches.py` — `_batch_response` computes `urgency = safety.urgency(shelter_distance_km, remaining)` when a distance is known, else `None`. Use `safety.urgency_band(...)`.
5. `routers/batches.py` — return the urgency band thresholds from `settings.URGENCY_ESCALATE` rather than the literal `0.6`.

**Verify**
- New unit tests: band boundaries (`0.29 → normal`, `0.30 → watch`, `0.59 → watch`, `0.60 → urgent`), distance stored on dispatch, urgency recomputed correctly from the stored distance.
- Integration test: seed a donor + shelter 3 km apart, dispatch a batch, assert `shelter_distance_km ≈ 3.0` and that `urgency_band` flips to `urgent` when the remaining window is short.

**Done when:** a short-window batch shows a non-`normal` band on `GET /api/batches`, and the frontend colour states have data behind them.

---

### Phase 2 — Telegram client and alert dispatch (1.5 days) — *the big one*

**Goal:** implement drift D1 — a confirmed batch must actually reach volunteers, and a volunteer tapping **Claim Pickup** must actually claim it.

**Tasks**

*New file `backend/services/telegram.py`:*
1. `TelegramClient` class wrapping `httpx.AsyncClient`:
   - `send_message(chat_id, text, reply_markup=None)`
   - `edit_message_text(chat_id, message_id, text, reply_markup=None)`
   - `answer_callback_query(callback_id, text)`
   - `get_me()` — used by `/health` to confirm the bot token works.
   - 5 s timeout, 3 attempts, exponential backoff (1 s, 2 s, 4 s) + jitter.
   - Every attempt appends a `DispatchLog` row with `status="sent" | "failed"` and the attempt number.

*`services/dispatch.py`:*
2. Split the current function into two:
   - `select_shelter(session, batch) -> Shelter | None` — the existing pure matching logic (§5.3), unchanged.
   - `dispatch_batch(session, batch) -> bool` — calls `select_shelter`, then formats and sends the alert.
3. Alert text (exact format, copy from the original build plan):
   ```
   🍲 Food rescue: {portions} meals ({total_kg} kg)
   {item list, one per line}
   ⏱ Collect within {remaining} min (safe-window estimate)
   📍 Pickup → Shelter: {shelter_name} ({distance} km)
   🗺 Route: https://www.google.com/maps/dir/?api=1&origin={donor_lat},{donor_lng}&destination={shelter_lat},{shelter_lng}
   ```
   plus an inline keyboard with a **Claim Pickup** button, `callback_data = claim:{batch_id}`.
4. Recipient selection: urgent (`urgency >= URGENCY_ESCALATE`) → all active volunteers with a `telegram_chat_id`; normal → the 5 nearest active volunteers by haversine, the rest on re-alert. Fall back to `settings.TELEGRAM_CHAT_ID` if no volunteer rows exist.
5. If no shelter qualifies: keep the batch `pending`, mark `at_risk`, log `status="skipped"`, and **still notify** the fallback chat so a human can intervene.

*`routers/telegram.py`:*
6. Parse the Telegram `Update` payload: handle `callback_query` (the Claim button), `message` with `/start`, `/claim <batch_id>`, `/pickup <batch_id>`, `/deliver <batch_id>`, and `/help`.
7. On `claim:*` — resolve or auto-create the `Volunteer` by `telegram_chat_id`, call the same claim logic the HTTP router uses (extract it to `services/batches.py` so both paths share one implementation), then:
   - `answerCallbackQuery` with "Claimed" / "Already claimed" / "Expired",
   - `editMessageText` → "Claimed by {name}" with **Pickup** and **Delivered** buttons,
   - update the original message's keyboard.
8. Verify the Telegram secret header (`X-Telegram-Bot-Api-Secret-Token`) when `TELEGRAM_WEBHOOK_SECRET` is set.
9. Always return `{"ok": true}` quickly — Telegram retries non-2xx responses and duplicate deliveries must be safe. The claim path is already idempotent-by-conditional-update.

*Refactor for shared logic:*
10. New `backend/services/batches.py` — move the claim / pickup / deliver state transitions out of the router so the HTTP router and the Telegram webhook call the same functions. Keep the atomic conditional `UPDATE` exactly as it is.

**Verify**
- Unit tests with a mocked `httpx`: ranking of recipients, escalation to all volunteers, retry count and backoff, message text formatting, `DispatchLog` rows written per attempt.
- Contract test: a malformed Telegram update returns 200 and does not raise.
- Race test: two `callback_query` updates for the same batch ⇒ exactly one claim succeeds, the loser gets "Already claimed".
- Manual end-to-end with a real bot: scan → confirm → alert arrives → tap Claim → message edits → Pickup → Delivered.

**Done when:** a confirmed batch reaches a volunteer's Telegram within 10 s, and tapping Claim transitions the batch exactly once.

---

### Phase 3 — Auth consolidation and hardening (1 day)

**Goal:** resolve drift D5 — one identity model, no half-implemented auth, dashboard protected.

**Decisions required first (§12, D-1 and D-2).** Assuming the decision is "keep `Donor.token` for the donor flow and add `User` auth for staff/operations":

**Tasks**
1. `services/auth.py` — move password hashing to **Argon2id** (`argon2-cffi`) with a transparent rehash-on-login path for existing PBKDF2 hashes. Keep the salt/hash columns; add an `algo` column so both are readable.
2. `services/auth.py` — issue **one** token per signup (currently `register_user` creates a token and `login_user` creates a second). Return the same token.
3. `services/auth.py` — make token TTL configurable via `settings.TOKEN_TTL_DAYS`; add a sweep that deletes expired tokens (run it in the background loop).
4. `services/auth.py` — hash tokens at rest (store `sha256(token)`, compare hashes). A database leak must not yield usable session tokens.
5. `routers/auth.py` — add rate limiting on `/signin` (5 attempts/minute/IP) and a uniform 401 message that does not reveal whether the email exists.
6. `routers/auth.py` — add `GET /api/auth/me` usage everywhere; protect `GET /api/stats` and `GET /api/batches` with `Depends(get_current_user)` **if** D-2 decides the dashboard is staff-only. If the dashboard stays public for demo purposes, gate it behind `DEMO_MODE` and log the decision.
7. `schemas.py` — add `role` to `UserResponse` (already present) and document the two roles: `supplier` = donor-side account, `distributor` = shelter/volunteer-side account.
8. Add `POST /api/auth/onboard-volunteer` — creates a `Volunteer` linked to the user, and returns a one-time Telegram link token so the volunteer can connect their chat id.

**Verify**
- Tests: signup → signin → `me` → logout → `me` returns 401.
- Test: wrong password, unknown email, and inactive user all return the same 401.
- Test: an expired token is rejected; a revoked token is rejected.
- Test: two tokens from one signup ⇒ only one is active.

**Done when:** no unauthenticated path exposes real (non-demo) data, and token storage is not plaintext.

---

### Phase 4 — Background jobs: expiry, at-risk, re-alert (1 day)

**Goal:** implement drift D3 — the 50 % re-alert and 75 % `at_risk` transitions promised by the product spec.

**Tasks**
1. New `backend/jobs/` package (or `backend/services/jobs.py`) — one scheduler loop, every 30 s:
   - **Expire:** any batch in `{draft, pending, dispatched, at_risk}` with `expires_at <= now` → `expired`.
   - **At-risk:** unclaimed batch with `remaining <= 25 %` of `safe_window_min` → `at_risk`, and raise a "dispatch failed / at risk" signal to the dashboard.
   - **Re-alert:** unclaimed batch at `50 %` elapsed → send a second Telegram alert (escalation, all volunteers). At `75 %` elapsed → escalate to all volunteers + log `status="escalated"`.
   - **Dedup:** mark on the batch which alerts have already been sent (`alerted_at_50`, `alerted_at_75` timestamps or a `dispatch_logs` count check) so a restart does not re-alert. **Never re-alert a batch that has been claimed.**
2. Move the loop out of `app/main.py` into the jobs module; keep the `asynccontextmanager` lifecycle but make the task cancellable and log its start/stop.
3. Add `expired`/`at_risk` cleanup: mark batches `expired` even if a volunteer claimed them but never delivered (a claimed batch that times out → `expired`, not stuck in `claimed`).
4. Emit `logger.info` for every transition (batch id, from → to, minutes remaining).

**Verify**
- Time-controlled tests: a batch at 40 % elapsed gets one re-alert; at 60 % elapsed it gets a second; at 90 % it is `at_risk`; a claimed batch gets no re-alert at any point.
- Restart test: the job does not re-alert a batch that already received its 50 % alert.
- A batch that expires while `claimed` transitions to `expired`.

**Done when:** the 50 % / 75 % escalation behaviour described in `product.md` §5 actually happens, exactly once per threshold.

---

### Phase 5 — API reliability, limits, and error envelope (1 day)

**Goal:** the API must not be a liability when exposed to a network.

**Tasks**
1. `routers/batches.py` — enforce `MAX_UPLOAD_BYTES`: read the upload in chunks, reject with **413** when exceeded. Also verify the content type is `image/*` and decode with Pillow before calling Gemini (reject non-images with 415).
2. Add a lightweight in-process rate limiter (`backend/middleware/rate_limit.py`) — fixed-window counter per IP, applied to `/api/batches/scan` and `/api/auth/signin`. Keep it dependency-free for MVP; document the Redis upgrade path.
3. `backend/middleware/request_id.py` — accept or generate `X-Request-ID`, echo it on the response, include it in every log line.
4. Standard error envelope: a FastAPI exception handler that returns `{"detail": "...", "request_id": "..."}` and never leaks a stack trace or a SQL error to the client. Internally, log the traceback.
5. `app/main.py` — add `GET /health` (process alive) **and** `GET /health/ready` (database reachable, Gemini key present, Telegram reachable, weather reachable). `/health/ready` returns a per-dependency breakdown and a 503 when any hard dependency is down.
6. Add `GET /metrics` in Prometheus text format: request count, request duration histogram, batches by status, dispatch success/failure counters. No dependency required — hand-roll the exposition.
7. `services/vision.py` — enforce the **8 s total budget** (drift D8): budget = `VISION_TOTAL_BUDGET_S`; attempts get `remaining / 2` each; stop retrying when the budget is exhausted; return `None` (manual entry) instead of hanging the donor.
8. `services/vision.py` — move the `json.loads` + validation into a small `parse_vision_payload(raw: str) -> VisionResult | None` pure function so it is unit-testable without the network (the current tests exercise the whole async function with mocks).
9. `services/vision.py` — log the failure with the exception type, not the raw payload. Never log image bytes.

**Verify**
- Test: a 12 MB upload returns 413; a 1×1 PNG returns 200; a text file renamed `.jpg` returns 415.
- Test: the vision path returns `None` within 8 s when the mocked API hangs.
- Test: `parse_vision_payload` rejects malformed JSON, negative weight, weight > 100 kg, `estimated_portions` < 0, and an unknown tier.
- Test: `/health/ready` reports each dependency and returns 503 when the DB is unreachable.

**Done when:** no request can hang the event loop, oversized uploads are rejected before any paid API call, and errors are structured.

---

### Phase 6 — Migrations and database hardening (1 day)

**Goal:** replace `create_all` with real migrations; make Supabase the supported target.

**Tasks**
1. Add Alembic: `backend/alembic.ini`, `backend/migrations/env.py` (async engine, `target_metadata = Base.metadata`), an initial revision that creates all seven tables, the `GUID` type, the FKs, and the indexes.
2. `app/main.py` — keep `AUTO_CREATE_TABLES` for local SQLite only; document that production runs `alembic upgrade head`.
3. Supabase: document `DATABASE_URL=postgresql+asyncpg://…?sslmode=require` (or the pooler URL) and make the pool settings explicit (`pool_size`, `max_overflow`, `pool_pre_ping=True`) so a stale connection cannot 500 the API.
4. `db.py` — add `pool_pre_ping=True` and configurable pool size via env; dispose the engine on shutdown.
5. Add the indexes the queries actually need: `batches(status, created_at)`, `batches(expires_at)`, `batches(shelter_id)`, `batches(volunteer_id)`, `dispatch_logs(batch_id)`.
6. Constraint: `batches.status` should be a real enum or have a `CHECK` constraint; same for `tier` and `weather_source`.
7. `models.py` — `donors.token`, `volunteers.telegram_chat_id`, `users.email` uniqueness must exist in the DB, not only in code. Verify against Supabase (`pg_constraint`) — the app currently relies on ORM-level uniqueness.
8. Seed: `backend/seed.py` gains `--reset-demo` (drops and recreates demo rows only) and is safe to run against Supabase.

**Verify**
- `alembic upgrade head` on an empty Postgres database creates the exact schema; `alembic downgrade base` drops it.
- `alembic check` reports no pending model drift.
- Seed twice ⇒ identical row counts.

**Done when:** the schema is reproducible from a migration, and no server startup mutates the schema in production.

---

### Phase 7 — Realtime dashboard feed (1 day, optional but high value)

**Goal:** replace 5-second polling with a push feed so the dashboard reflects claims instantly.

**Tasks**
1. `GET /api/events` — Server-Sent Events (SSE). Chosen over WebSocket: one-way, works through proxies, trivial to reconnect, no extra dependency.
2. Publish a `BatchEvent` on every state transition: `batch_id`, `status`, `remaining_min`, `urgency_band`, `shelter_name`, `volunteer_name`, `type` (`created|updated|expired|at_risk`).
3. `services/events.py` — an in-process `asyncio.Queue` fan-out with a bounded per-client buffer; slow clients drop events rather than stalling the publisher.
4. `routers/batches.py` and `routers/stats.py` emit events after each successful transaction.
5. Frontend: `EventSource` with exponential-backoff reconnect, falling back to the existing polling if SSE is unavailable. Keep polling as the fallback path — the demo must not depend on a persistent connection.

**Verify**
- Test: connect, trigger a batch transition, assert the event frame arrives within 1 s.
- Test: a client that stops reading does not block other clients.

**Done when:** a volunteer claims a batch and the dashboard updates without waiting for the next poll.

---

### Phase 8 — Scale and performance (1 day)

**Goal:** make the single-process assumptions explicit, and remove the obvious hot spots.

**Tasks**
1. `routers/stats.py` — replace `select(Batch)` (loads every batch) with aggregate SQL (`SUM`, `COUNT` with a `status = 'delivered'` filter, grouped by `is_demo`). Same numbers, O(1) memory.
2. `services/weather.py` — the cache is per-process. Document the limitation; if more than one worker is deployed, move the cache to Redis (or accept the duplication).
3. `services/impact.py` — implement it properly (drift D4): pure functions `summarise(batches) -> ImpactSummary`, used by both the stats router and a future reporting endpoint. Delete the duplicated math in `routers/stats.py`.
4. Batch listing — paginate with a cursor (`created_at, id`) instead of `LIMIT` only, so the dashboard can page without duplicates.
5. Index review with `EXPLAIN ANALYZE` on the three hot queries: list batches by status, active-batch count, delivered aggregate.
6. Connection-pool tuning for Supabase's pooler (transaction mode vs session mode).

**Verify**
- A benchmark script seeds 100 k batches and reports the p95 latency of the three hot queries.
- Stats endpoint returns byte-identical numbers before and after the rewrite (property test over a fixed fixture).

**Done when:** stats no longer scale with the size of the table.

---

### Phase 9 — Timezone and consistency sweep (half day)

**Goal:** remove the deprecation warnings and make time handling explicit.

**Tasks**
1. Replace every `datetime.utcnow()` with `datetime.now(timezone.utc)`. Files: `models.py`, `db.py` (none), `app/main.py`, `routers/batches.py`, `services/safety.py`, `services/weather.py`, `services/auth.py`, `services/dispatch.py`, `seed.py`, `tests/*`.
2. Store timezone-aware timestamps in the DB (`DateTime(timezone=True)` on Postgres). Migration in Phase 6. Existing naive rows are assumed UTC.
3. `services/safety.py` — `remaining_minutes` must handle both naive and aware datetimes during the migration window; normalise at the boundary.
4. Rename `backend/tests/` → keep as is, but add `backend/tests/conftest.py` with an async `session` fixture backed by an in-memory SQLite DB, plus fixtures for a donor, shelters, volunteers, and a fake clock.
5. Delete the stale `HANDOVER.md` claims that no longer hold (e.g. "31 tests passing" becomes the real number).

**Verify**
- `pytest -q` shows zero deprecation warnings.
- A test asserts that `remaining_minutes` is correct across a DST boundary and across naive/aware inputs.

**Done when:** `pytest -q` is warning-free and every timestamp in the system is explicitly UTC.

---

### Phase 10 — Test suite completion (2 days)

**Goal:** meet the testing requirements in `AGENT.md`, which are currently only partially met.

**Current coverage:** `test_safety.py` (14), `test_weather.py` (8), `test_vision.py` (9). **Missing:** dispatch ranking, impact maths, the API lifecycle, the auth flows, and the end-to-end path.

**Tasks**
1. `tests/conftest.py` — async engine on in-memory SQLite, schema creation per test, transactional rollback between tests, `frozen_now` fixture.
2. `tests/test_dispatch.py` — ranking (lowest urgency then distance), capacity exclusion, radius exclusion, `verified = false` exclusion, travel-feasibility exclusion (`travel_min >= remaining * 0.8`), and the "no candidate ⇒ `at_risk`" path.
3. `tests/test_impact.py` — hand-calculated numbers (57 kg → 142.5 kg CO₂e), delivered-only filtering, demo/real separation.
4. `tests/test_api_batches.py` — full lifecycle with `httpx.AsyncClient` + `ASGITransport`: scan (mocked vision + weather) → confirm → claim → pickup → deliver → stats.
5. `tests/test_api_batches.py` — double claim returns **409**; claim on an expired batch returns 409; confirm on a non-draft returns 409.
6. `tests/test_api_auth.py` — signup/signin/me/logout, bad password, inactive user, expired token, revoked token, rate limit.
7. `tests/test_api_telegram.py` — webhook parse, `claim:*` callback, idempotent double-delivery, unknown command.
8. `tests/test_e2e.py` — the `AGENT.md` requirement: mock Gemini + Open-Meteo + Telegram, POST a scan, confirm, claim, deliver, assert the stats response.
9. `tests/test_contract_vision.py` — the malformed-JSON and negative-weight contract test, now against the extracted `parse_vision_payload`.
10. Add `pytest-cov` and set a coverage floor of **80 %** on `backend/services/` and `backend/routers/`; wire it into CI.
11. CI: GitHub Actions — `ruff check`, `ruff format --check`, `pytest -q --cov`, and `tsc --noEmit` for the frontend. Fail the build on any error.

**Verify**
- `pytest -q --cov=backend --cov-fail-under=80` passes.
- The suite runs in under 30 s and touches no network (all external calls mocked at the `httpx` transport level).

**Done when:** every requirement in the `AGENT.md` "Testing requirements" section has a corresponding test.

---

### Phase 11 — Observability and operations (1 day)

**Tasks**
1. Structured JSON logs (`python-json-logger` or a hand-rolled formatter) with `request_id`, `batch_id`, `donor_id`, `duration_ms`.
2. Error tracking (Sentry) behind an optional `SENTRY_DSN`; never required for the demo.
3. `GET /metrics` (Prometheus) — completed in Phase 5; wire it to a dashboard or at least document the key series.
4. Alerting rules to document: `dispatch_failed_total > 0`, `batches_expired_total` rate, `vision_failure_ratio > 0.2`, `db_pool_exhausted`.
5. A `runbook.md`: how to rotate the Telegram token, how to re-seed demo data, how to roll back a bad deploy, how to verify the safe-window numbers against the reference table in §5.1.

---

### Phase 12 — Demo hardening (half day)

**Tasks**
1. `POST /api/batches/scan` honours a `?demo=1` flag or a `DEMO_MODE` setting: skip Gemini, return a canned result (rice + dal, 6 kg, 30 portions, `HIGH_MOISTURE`), so the demo works with no API key and no network.
2. `backend/seed.py --demo` loads sample batches at **different stages** (draft, pending, dispatched, claimed, picked_up, delivered, expired) so the dashboard is never empty and the countdown cards show all three colour states.
3. A `scripts/demo.sh` that runs the full 3-minute demo script from `product.md` §12: seed → start backend → start frontend → scan → confirm → Telegram alert → dashboard.
4. `README.md`: setup, env vars, the Telegram bot + webhook setup (including `ngrok` for local development), run commands, and a **Limitations** section — the window is a conservative heuristic, not a food-safety guarantee; humidity is not modelled; volunteers and shelters are manually vetted.

---

## 11. Definition of done (per phase)

1. Works at a 375 px mobile viewport and on desktop (for any API-visible UI change).
2. `pytest -q` passes with no new warnings; coverage does not drop.
3. `ruff check backend/` and `ruff format --check backend/` are clean.
4. Every failure path is handled per §7 — no unhandled exception reaches the client as a 500.
5. No user-facing or API-facing string overpromises food safety.
6. `README.md` and `HANDOVER.md` remain accurate.
7. No secrets committed; images are not persisted unless `STORE_IMAGES=true`.

---

## 12. Open decisions — need an answer before Phase 3

| # | Decision | Options | Recommendation | Blocks |
| --- | --- | --- | --- | --- |
| D-1 | Which identity model is canonical? | (a) keep `Donor.token`, drop `User`; (b) keep both — donors by token, staff by `User`; (c) migrate donors to `User` with a `role="donor"` | **(b)** — it preserves the zero-friction donor flow from `AGENT.md` and gives staff real auth | Phase 3 |
| D-2 | Is the dashboard public? | (a) public; (b) staff-only (`supplier`/`distributor`); (c) public in demo mode, locked in production | **(c)** — keeps the judge demo frictionless without leaking real data | Phase 3 |
| D-3 | Telegram vs WhatsApp? | (a) Telegram only; (b) add a WhatsApp Cloud API provider behind the same `channels` interface | **(a)** for the MVP; structure `DispatchLog.channel` so (b) is additive | Phase 2 |
| D-4 | Volunteer location? | (a) capture on `/start`; (b) ask once at first claim; (c) manual entry | **(b)** — least friction, and enough for nearest-5 ranking | Phase 2 |
| D-5 | Database target | (a) Supabase Postgres only; (b) keep SQLite for local dev | **(b)** — SQLite is already wired and useful for CI | Phase 6 |
| D-6 | Migration tool | (a) Alembic; (b) Supabase CLI (`supabase db push`) | **(a)** — dialect-portable, works for CI and local Postgres | Phase 6 |

---

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Food-safety liability | Legal exposure | Conservative window, donor confirmation, disclaimer in copy, never say "guaranteed safe". Keep the formula deterministic and auditable (§5.1). |
| AI misestimates weight or dish | Wrong portions, wrong window | Editable draft before dispatch, per-item validation, `needs_manual_entry` fallback, show confidence. |
| Telegram delivery fails silently | Surplus is wasted | 3 attempts with backoff, `DispatchLog` per attempt, dashboard "dispatch failed" badge, fallback chat id. |
| No volunteer claims | Wasted surplus | 50 % re-alert, 75 % `at_risk` + escalation, fallback shelter-pickup path (Phase 4). |
| Vision latency | Donor abandons the flow | 8 s total budget, 4 s per attempt, resize to 1280 px, manual-entry fallback. |
| Weather API outage | Wrong window | 10-min cache, conservative 30 °C fallback, `weather_source` surfaced to the UI. |
| Rate abuse on `/scan` | Cost + DoS | Upload size cap, per-IP rate limit, no unauthenticated bulk access. |
| Database outage | Total outage | `pool_pre_ping`, `/health/ready` for the load balancer, fail fast with a clear 503. |
| Demo fails on bad Wi-Fi | Lost pitch | `?demo=1` canned path, seeded dashboard states, `demo.sh`, offline fallback in the frontend. |

---

## 14. Quick reference

```bash
# All commands run from the REPO ROOT (backend/ is an importable package).

# Setup
pip install -r backend/requirements.txt   # or: uv sync
cp .env.example .env                      # config.py resolves .env at the repo root

# Database
alembic upgrade head                      # Phase 6+ (alembic.ini lives in backend/)
python -m backend.seed --demo              # idempotent demo data

# Run
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
# or: python backend/dev.py               # same, with the repo root on sys.path

# Test
cd backend && python -m pytest tests/ -q
cd backend && python -m pytest tests/ -q --cov=backend --cov-fail-under=80

# Lint
ruff check backend/ && ruff format --check backend/

# Telegram webhook (local)
ngrok http 8000 --domain=<your-domain>
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -d url="https://<domain>/api/telegram/webhook"
```

**Reference values that must never drift:**

| Check | Expected |
| --- | --- |
| `compute_safe_window("HIGH_MOISTURE", 32)` | `135` (2 h 15 min) |
| `compute_safe_window("HIGH_MOISTURE", 45)` | `30` (floor) |
| `compute_safe_window("DRY", 25)` | `480` |
| Impact, 57 kg delivered | `142.5` kg CO₂e (factor 2.5) |
| Two volunteers claim the same batch | exactly one `200`, the other `409` |
