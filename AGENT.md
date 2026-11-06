# NourishNet Coding Agent Guide

You are building and maintaining **NourishNet**, a hyper-local food rescue and dispatch platform. A kitchen worker snaps one photo of surplus food; AI extracts the items, live weather sets a safety countdown, and a push alert sends a pickup route to nearby volunteers. Read `product.md` for the *what/why* and `build_prompt.md` for the build sequence.

## Mission-critical principles

1. **Zero friction for the donor.** Donor flow must stay: open page → take photo → one tap confirm. Never add required form fields to the donor flow.
2. **Safety first, honestly framed.** The shelf-life engine is a conservative rule-based estimate, not a medical guarantee. Never use wording like "guaranteed safe" in UI or copy. When uncertain, shorten the window.
3. **Push, not pull.** Every confirmed batch must trigger dispatch automatically. No listing should sit waiting for someone to browse.
4. **Deterministic core, AI at the edges.** Gemini only does image → structured JSON. Safe-window math, urgency, and impact metrics are plain deterministic Python, unit-tested.
5. **Demo-reliable.** The 3-minute demo must work on bad Wi-Fi: have a fallback path (see Fallbacks).

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, mobile-first PWA |
| Backend | FastAPI, Python 3.11+, async, Pydantic v2 |
| Vision AI | Gemini 2.5 Flash via `google-genai` SDK, strict JSON schema output |
| Weather | Open-Meteo API (no auth) |
| Database | PostgreSQL (Supabase) via SQLAlchemy (async); SQLite acceptable for local dev |
| Notifications | Telegram Bot API via `httpx` |

## Repository layout

```
nourishnet/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router mounting
│   │   ├── config.py          # Settings from env (pydantic-settings)
│   │   ├── db.py              # Engine, session, Base
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic request/response + Gemini schema
│   │   ├── routers/
│   │   │   ├── batches.py     # scan, confirm, claim, deliver, list
│   │   │   ├── stats.py       # impact metrics
│   │   │   └── telegram.py    # webhook for Claim button
│   │   └── services/
│   │       ├── vision.py      # Gemini call + validation + fallback
│   │       ├── weather.py     # Open-Meteo client + cache
│   │       ├── safety.py      # shelf-life engine (pure functions)
│   │       ├── dispatch.py    # shelter matching, urgency, alerts
│   │       └── impact.py      # SDG metric calculations
│   ├── tests/
│   ├── seed.py                # demo shelters, volunteers, donors
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── donor/page.tsx     # camera capture + confirm
│   │   ├── dashboard/page.tsx # command center
│   │   └── layout.tsx
│   ├── components/            # CountdownCard, ImpactCounters, BatchTable...
│   └── lib/api.ts             # typed API client
├── .env.example
└── README.md
```

## Core logic (do not change without updating tests and `product.md`)

**Safe window**

```
safe_window_min = max(MIN_WINDOW, base_window[tier] - max(0, (T_ambient_C - 25.0) * 15))
```

Default base windows (minutes): `HIGH_MOISTURE=240`, `MEDIUM_MOISTURE=360`, `DRY=480`. `MIN_WINDOW=30`. All configurable in `config.py`.
Reference check: `HIGH_MOISTURE` at 32°C → **135 min** (2 h 15 min). Use this exact value everywhere (tests, seed data, demo script, pitch). Humidity is fetched and stored but is **not** in the formula for v1.

**Urgency**

```
travel_min = distance_km / AVG_SPEED_KMPH * 60      # default 20 km/h urban
urgency = travel_min / remaining_window_min
```

`urgency >= 0.6` → escalate (alert all volunteer channels, re-ping every 5 min). `< 0.6` → normal alert to nearest volunteers first.

**Shelter match:** only shelters that are `active`, within `MAX_RADIUS_KM` (default 8), have `capacity_portions >= batch.portions` (or partial-capacity flag), and where `travel_min < remaining_window_min * 0.8`. Rank by lowest urgency first, then distance.

**CO₂e:** `kg_diverted * CO2E_FACTOR` (default 2.5, configurable; cite the source in the dashboard footnote).

## Coding conventions

- Python: type hints everywhere, `async def` for I/O, `ruff` + `black` formatting, no bare `except`.
- TypeScript: `strict` mode, no `any`, server components by default, client components only for camera/timers.
- Keep services as pure and small as possible; routers only orchestrate.
- All timestamps stored UTC, displayed in the user's local time.
- Never log full images or secrets. Images are processed in memory and discarded unless `STORE_IMAGES=true`.
- Env vars: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DATABASE_URL`, `PUBLIC_BASE_URL`. Never commit real values.

## Fallbacks (must exist)

- **Gemini fails/times out (>8 s):** return a clearly labeled manual-entry draft (editable items list) instead of an error.
- **Open-Meteo fails:** use last cached reading for that ~10 km grid; if none, assume 30°C (conservative) and flag `weather_source: "fallback"`.
- **Telegram fails:** retry 3× with backoff, then surface the batch on the dashboard with a "dispatch failed" badge.
- **No volunteer claims:** after 50% of window elapses, re-alert with escalation; at 75%, mark batch `at_risk` on the dashboard.

## Testing requirements

- Unit tests for `safety.py` (boundary temps: ≤25°C, 32°C, 45°C, floor), `dispatch.py` (ranking, capacity, radius), `impact.py`.
- Contract test: Gemini response parser rejects malformed JSON and negative weights.
- At least one end-to-end test: mock Gemini + Open-Meteo + Telegram, POST a scan, confirm, claim, deliver, assert stats.

## Definition of done (per feature)

1. Works on a mobile viewport (375 px) and desktop.
2. Tests pass; `ruff` and `tsc --noEmit` clean.
3. Failure paths handled (see Fallbacks).
4. No user-facing copy overpromises food safety.
5. `README.md` run instructions still accurate.

## Don'ts

- Don't add login walls to the donor flow for the MVP (use a donor token/link).
- Don't let the LLM compute the safe window or metrics.
- Don't invent data on the dashboard in production mode; demo/seed data must be clearly flagged `is_demo`.
- Don't add features outside the MVP list in `product.md` without asking.

## When unsure

Prefer the simplest implementation that keeps the demo working, state your assumption in the PR/commit message, and move on.