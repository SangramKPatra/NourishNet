# build_prompt.md — Master Build Prompt for NourishNet


## Role and goal

You are a senior full-stack engineer. Build the **NourishNet MVP**: a mobile-first web app where a donor photographs surplus cooked food, Gemini extracts the items, Open-Meteo weather drives a deterministic safe-collection window, and a Telegram bot pushes a claimable pickup alert to volunteers. A live dashboard shows countdowns and SDG impact. Follow `agent.md` for conventions and `product.md` for scope. Do not build anything out of scope.

## Stack

Next.js 15 (App Router, TS, Tailwind) · FastAPI (Python 3.11, async, Pydantic v2) · UV (Python package manager) · Gemini 2.5 Flash (`google-genai`) · Open-Meteo · PostgreSQL/Supabase via SQLAlchemy async (SQLite for local dev) · Telegram Bot API via `httpx`.

## Phase 0 — Scaffold

- Create the repo layout from `agent.md`.
- `backend/requirements.txt`: fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, aiosqlite, pydantic, pydantic-settings, httpx, google-genai, python-multipart, pytest, pytest-asyncio, ruff.
- `.env.example` with `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DATABASE_URL`, `PUBLIC_BASE_URL`, `STORE_IMAGES=false`.
- `config.py` using pydantic-settings; expose tunables: tier base windows, `MIN_WINDOW`, `AVG_SPEED_KMPH`, `MAX_RADIUS_KM`, `CO2E_FACTOR`, `URGENCY_ESCALATE=0.6`.
- Health endpoint `GET /health`. CORS for the frontend origin.

**Verify:** backend and frontend both start; `/health` returns 200.

## Phase 1 — Data model

SQLAlchemy models (UUID primary keys, UTC timestamps):

- `Donor`: name, org_type (`canteen|caterer|cloud_kitchen|other`), lat, lng, token (unique, used for link-based access)
- `Shelter`: name, lat, lng, capacity_portions, contact, active, verified
- `Volunteer`: name, telegram_chat_id, lat, lng, active
- `Batch`: donor_id, items (JSON: `[{name, approx_kg}]`), total_kg, portions, tier, ambient_temp_c, humidity_pct, weather_source (`live|cached|fallback`), safe_window_min, created_at, expires_at, status (`draft|pending|dispatched|claimed|picked_up|delivered|expired|at_risk`), shelter_id, volunteer_id, lat, lng, is_demo
- `DispatchLog`: batch_id, channel, payload, status, attempt, created_at

`seed.py`: 1 demo donor, 4 shelters around one city center, 5 volunteers, all flagged demo where relevant.

**Verify:** tables create; `python seed.py` runs idempotently.

## Phase 2 — Safety engine (pure functions)

In `services/safety.py`:

```python
def compute_safe_window(tier: Tier, temp_c: float) -> int: ...
# base[tier] - max(0, (temp_c - 25.0) * 15), floored at MIN_WINDOW
def remaining_minutes(expires_at, now) -> int: ...
def urgency(distance_km: float, remaining_min: int) -> float: ...
# (distance_km / AVG_SPEED_KMPH * 60) / max(remaining_min, 1)
```

Tests: ≤25°C returns base; HIGH_MOISTURE at 32°C returns exactly 135; very high temp hits the 30-minute floor; remaining never negative.

**Verify:** `pytest tests/test_safety.py` green.

## Phase 3 — Weather service

`services/weather.py`: async call to Open-Meteo `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,relative_humidity_2m`. Timeout 4 s. In-memory TTL cache (10 min) keyed by lat/lng rounded to 1 decimal. On failure return cached value, else fallback 30°C with `source="fallback"`.

**Verify:** unit test with mocked `httpx`: success, timeout → cached, timeout with no cache → fallback.

## Phase 4 — Vision extraction

`services/vision.py`:

- Resize image (max 1280 px longest side), send to Gemini 2.5 Flash with a response schema:

```python
class FoodItem(BaseModel):
    name: str
    approx_kg: float  # > 0

class VisionResult(BaseModel):
    items: list[FoodItem]
    estimated_portions: int  # > 0
    perishability_tier: Literal["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]
    confidence: float  # 0-1
    notes: str | None
```

- System prompt: identify only visible cooked/ready-to-eat food; estimate weight conservatively using tray/container size cues; assume one portion is about 150–200 g cooked; choose the *most perishable* tier if the photo mixes dishes; never invent dishes not visible; return an empty list if no food is visible.
- Validate with Pydantic; reject negative or absurd weights (>100 kg). Timeout 8 s. On any failure, return `None` so the router produces a manual-entry draft.
- Overall tier for a mixed batch = most perishable item tier.

**Verify:** parser tests for malformed JSON, negative weight, empty items; one manual test with a real photo.

## Phase 5 — Batch API

Routers in `routers/batches.py`:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/batches/scan` | multipart: `image`, `lat`, `lng`, `donor_token`. Runs vision and weather in parallel, computes window, saves a `draft` batch, returns the draft (items, portions, tier, temp, window, expires_at, `needs_manual_entry` flag). |
| POST | `/api/batches/{id}/confirm` | Accepts optional edited items/portions, recomputes totals, sets `expires_at = now + safe_window`, status `pending`, triggers dispatch, returns the batch. |
| POST | `/api/batches/{id}/claim` | Body: `volunteer_id` or Telegram chat id. Atomic: only one claim succeeds (409 otherwise). Status `claimed`. |
| POST | `/api/batches/{id}/pickup` | Status `picked_up`. |
| POST | `/api/batches/{id}/deliver` | Status `delivered`, increments impact. |
| GET | `/api/batches` | List with computed `remaining_min` and urgency band. Query: `status`, `limit`. |
| GET | `/api/stats` | `{meals, kg, co2e_kg, active_batches, delivered_batches}`, with demo data split out. |

A background task (asyncio loop, every 30 s) marks batches `expired` when `expires_at` passes, `at_risk` at 75% of the window if unclaimed, and triggers re-alerts at 50%.

**Verify:** API tests for the full lifecycle, double-claim returning 409, expiry transition.

## Phase 6 — Dispatch and Telegram

`services/dispatch.py`:

1. Select candidate shelters: active, verified, within `MAX_RADIUS_KM` (haversine), capacity check, `travel_min < remaining * 0.8`.
2. Choose best shelter (lowest urgency, then distance), store `shelter_id`.
3. Build the alert:

```
🍲 Food rescue: {portions} meals ({total_kg} kg)
{item list}
⏱ Collect within {remaining} min (safe-window estimate)
📍 Pickup → Shelter: {shelter_name} ({distance} km)
🗺 Route: https://www.google.com/maps/dir/?api=1&origin={donor_lat},{donor_lng}&destination={shelter_lat},{shelter_lng}
[ Claim Pickup ]
```

4. Send via Telegram `sendMessage` with an inline keyboard (`callback_data = claim:{batch_id}`). Urgent batches (urgency ≥ 0.6) alert all active volunteers; otherwise the nearest 5 first, with the rest on re-alert.
5. Retry 3× with exponential backoff; log every attempt in `DispatchLog`.
6. `routers/telegram.py`: webhook receiving `callback_query`; on `claim:*`, map the user to a volunteer (auto-register by chat id on first claim), call the claim logic, edit the original message to "Claimed by {name}" with the pickup and delivered buttons, and answer the callback.

If no shelter qualifies: keep the batch `pending`, mark `at_risk`, show a clear message on the dashboard.

**Verify:** tests with a mocked Telegram client: ranking, escalation, retry, claim race.

## Phase 7 — Impact service

`services/impact.py`:

- `portions_delivered = Σ portions` (delivered only)
- `kg_diverted = Σ total_kg` (delivered only)
- `co2e_kg = kg_diverted * CO2E_FACTOR`

Only `delivered` batches count. Return demo and real totals separately.

**Verify:** unit test against hand-calculated numbers (for example 57 kg → 142.5 kg CO₂e at 2.5).

## Phase 8 — Frontend

Design: clean, high-contrast, large touch targets, green/amber/red status palette, works at 375 px.

**`/donor?token=...`**
1. Big "Scan Surplus" button → native camera (`<input type="file" accept="image/*" capture="environment">`).
2. Request geolocation on load; fall back to the donor's saved coordinates.
3. Upload to `/api/batches/scan` with a loading state (target under 3 s feel; skeleton + "Reading your tray…").
4. Show the draft: items with editable kg, portions, tier badge, ambient temp, and the countdown ("Pickup within 2 h 15 min").
5. If `needs_manual_entry`, show an editable list with a clear notice.
6. Single **Confirm & Dispatch** button; success screen with the live countdown and status.

**`/dashboard`**
- Impact counters row (meals, kg, CO₂e) with a footnote stating the CO₂e factor and a demo-data toggle/label.
- Batch cards: items, portions, shelter, volunteer, status chip, ticking countdown (client-side from `expires_at`), color shifts green → amber (<50% left) → red (<25% left).
- Auto-refresh every 5 s (polling is fine; SSE optional).
- Map or list of shelters is optional; skip if time is short.

**Verify:** manual run on a phone viewport; `tsc --noEmit` clean.

## Phase 9 — Demo hardening

- `seed.py --demo` loads sample batches at different stages so the dashboard is never empty.
- A hidden `?demo=1` toggle on `/donor` skips Gemini and returns a canned result (rice + dal, 6 kg, 30 portions, HIGH_MOISTURE) for offline demo safety.
- README: setup, env vars, Telegram bot and webhook setup (including `ngrok` for local), run commands, demo script from `product.md`.
- Add a short "Limitations" section: window is a conservative heuristic, not a food-safety guarantee; humidity not yet modeled; volunteers and shelters are manually vetted.

## Global acceptance criteria

1. Photo → confirmed batch → Telegram alert in under 20 seconds end to end on normal Wi-Fi.
2. High-moisture food at 32°C shows exactly 2 h 15 min (135 min) on the donor screen, the dashboard, and the alert.
3. Two volunteers tapping Claim at once: exactly one succeeds.
4. With Gemini, Open-Meteo, or Telegram blocked, the app degrades per `agent.md` fallbacks without crashing.
5. All tests pass; no secrets committed; images are not persisted by default.
6. UI copy never says "guaranteed safe".

## Working style

- Work phase by phase; after each, run the verify step and report results briefly.
- If a requirement is ambiguous, pick the simplest option consistent with `product.md`, note the assumption, and continue.
- Do not add dependencies, features, or auth beyond what is specified without asking.