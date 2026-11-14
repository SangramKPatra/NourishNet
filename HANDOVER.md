# NourishNet Development Handover

**Date:** November 14, 2026  
**Status:** Phase 2–5 complete, visual implementation verified, ready for Phase 6 (Telegram dispatch)

---

## What's been built

### Backend (FastAPI + SQLAlchemy + async)

**Phase 2 — Safety engine**
- Pure functions for safe-window calculation, countdown, and urgency scoring
- Temperature-aware window reduction (15 min per °C above 25°C)
- Minimum 30-minute safety floor
- Tests: `backend/tests/test_safety.py` (14 checks, all passing)

**Phase 3 — Weather service**
- Open-Meteo API integration with 4-second timeout
- 10-minute in-memory TTL cache keyed by rounded coordinates
- Fallback to cached or 30°C default on timeout/error
- Tests: `backend/tests/test_weather.py` (8 checks, all passing)

**Phase 4 — Vision extraction**
- Gemini 2.5 Flash integration for food photo analysis
- Image resizing to 1280px max dimension
- Structured JSON response with Pydantic validation
- Weight sanity checks (reject negative or >100 kg)
- Graceful fallback to manual entry on API failure
- Tests: `backend/tests/test_vision.py` (9 checks, all passing)

**Phase 5 — Batch API**
- Complete lifecycle: scan → confirm → claim → pickup → deliver
- Draft batches with editable fields
- Automatic shelter dispatch with haversine distance calculation
- Shelter selection by radius, capacity, verification, and travel feasibility
- At-risk status when no shelter qualifies
- Background expiry task (runs every 30 seconds)
- Stats endpoint with demo/real segregation
- Conditional update for atomic claim handling (prevents double-claims)
- Batch listing with countdown and urgency metadata

**Database**
- SQLite-compatible UUID handling for cross-dialect portability
- Async SQLAlchemy with proper session management
- Automatic table creation on startup
- Idempotent seed script: `python -m backend.seed`

**Infrastructure**
- CORS support for Vite dev server on port 5173
- Proper Python package imports (`backend.app.main:app`)
- Background lifecycle tasks using `asynccontextmanager`
- All 31 backend tests passing

---

### Frontend (Vite + React 18 + TypeScript + Tailwind)

**Visual design**
- Food-focused branding with green/cream/amber palette
- Space Grotesk display font + DM Sans body
- Mobile-first responsive layout
- Prominent camera/photo action on donor page
- Live countdown cards with urgency color coding
- Auto-refresh dashboard (5-second polling)

**Donor flow (`/donor`)**
- Hero section explaining the value proposition
- Native camera support with file input
- Automatic geolocation capture (fallback to SF coordinates)
- Photo preview
- Loading state during vision analysis
- Editable AI draft (food items, weights, portions)
- Weather and safety-window display
- One-tap confirmation and dispatch
- Success state with collection countdown
- Token field defaults to `demo-donor-token`

**Dashboard (`/dashboard`)**
- Real-time metrics: meals rescued, kg diverted, CO₂e avoided, active batches
- Batch cards with live countdowns
- Green/amber/red urgency states
- Demo data labels
- Shelter matching status
- Empty-state UI
- Refresh button

**API client**
- Typed `fetch` wrapper with error handling
- Endpoints: `scanBatch`, `confirmBatch`, `listBatches`, `getStats`
- Dev proxy forwards `/api` to `http://localhost:8000`

**Verification**
- 23 Playwright visual and integration checks passing
- Desktop (1440×900) and mobile (390×844) tested
- No horizontal overflow
- No browser console errors
- Complete scan → review → confirm → success flow verified

---

## What's next (Phase 6+)

**Phase 6 — Telegram dispatch**
- Webhook handler at `/api/telegram/webhook`
- Bot commands: `/start`, `/claim <batch_id>`, `/pickup <batch_id>`, `/deliver <batch_id>`
- Volunteer onboarding via Telegram
- Message formatting with batch details and urgency

**Phase 7 — Dashboard enhancements**
- Volunteer location on map
- Batch route visualization
- Real-time status updates via WebSocket or SSE
- Filtering by status/urgency

**Phase 8 — Production readiness**
- PostgreSQL migration
- Environment-based configuration
- Rate limiting
- Authentication for donor dashboard
- Image storage (local or S3)
- Monitoring and alerting

**Phase 9 — Mobile polish**
- PWA manifest
- Offline support
- Push notifications for volunteers
- Camera optimizations

---

## Running the application

### Prerequisites
- Python 3.10+
- Node.js 18+
- SQLite (default) or PostgreSQL

### Backend setup
```bash
cd backend
pip install -r requirements.txt

# Seed demo data (idempotent)
python -m backend.seed

# Start dev server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Run tests
python -m pytest tests/ -v
```

### Frontend setup
```bash
cd frontend
npm install

# Start dev server (proxies /api to :8000)
npm run dev

# Build for production
npm run build
```

### Environment variables
Copy `.env.example` to `.env` and configure:

```env
# Backend (.env in repository root or backend/)
GEMINI_API_KEY=your_key_here
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id
DATABASE_URL=sqlite+aiosqlite:///./dev.db
PUBLIC_BASE_URL=http://localhost:5173
STORE_IMAGES=false

# Frontend (.env in frontend/)
VITE_API_BASE_URL=  # Empty in dev (uses proxy), set for prod
```

---

## Project structure

```
NourishNet/
├── backend/
│   ├── app/
│   │   └── main.py          # FastAPI app with lifespan and CORS
│   ├── routers/
│   │   ├── batches.py       # Batch lifecycle endpoints
│   │   ├── stats.py         # Stats aggregation
│   │   └── telegram.py      # Telegram webhook (Phase 6)
│   ├── services/
│   │   ├── safety.py        # Safe window, urgency calculations
│   │   ├── weather.py       # Open-Meteo integration
│   │   ├── vision.py        # Gemini Vision API
│   │   └── dispatch.py      # Shelter matching
│   ├── tests/               # 31 passing tests
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic request/response models
│   ├── config.py            # Settings and tunables
│   ├── db.py                # Database setup and session factory
│   ├── seed.py              # Idempotent demo data seeder
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── donor/page.tsx      # Scan and confirm flow
│   │   │   └── dashboard/page.tsx  # Live command center
│   │   ├── components/
│   │   │   └── Layout.tsx          # Header, nav, footer
│   │   ├── lib/
│   │   │   └── api.ts              # Typed API client
│   │   ├── main.tsx                # Router setup
│   │   └── index.css               # Tailwind + custom styles
│   ├── vite.config.ts              # Proxy config
│   └── package.json
├── build_prompt.md          # Complete phase-by-phase build plan
├── product.md               # Product vision and user stories
├── AGENT.md                 # Repository conventions
├── HANDOVER.md              # This file
└── README.md
```

---

## API endpoints

### Batches
- `POST /api/batches/scan` — Upload photo, get AI draft
- `POST /api/batches/{id}/confirm` — Finalize batch, dispatch to shelter
- `POST /api/batches/{id}/claim` — Volunteer claims batch
- `POST /api/batches/{id}/pickup` — Mark as picked up
- `POST /api/batches/{id}/deliver` — Mark as delivered
- `GET /api/batches?status=pending&limit=50` — List batches

### Stats
- `GET /api/stats` — Aggregate metrics (meals, kg, CO₂e, active/delivered counts, demo/real split)

### Health
- `GET /health` — Service health check

### Telegram (Phase 6)
- `POST /api/telegram/webhook` — Handle bot updates

---

## Known issues and considerations

### Current limitations
1. **Telegram dispatch is stubbed** — Phase 6 requires bot setup and webhook configuration
2. **No authentication** — Donor token is a plaintext shared secret
3. **Image storage is minimal** — Photos are analyzed but not persisted
4. **Shelter matching is basic** — Uses first-fit by distance/capacity, no route optimization
5. **Dashboard auto-refresh uses polling** — WebSocket/SSE would be more efficient

### Deployment notes
- **Database**: SQLite works for development; PostgreSQL recommended for production
- **Static hosting**: Frontend can be built and served from any CDN or static host
- **API deployment**: FastAPI app runs on any ASGI server (Uvicorn, Hypercorn, Gunicorn with workers)
- **CORS**: Update `allow_origins` in `backend/app/main.py` for production domain
- **Secrets**: Use environment variables or a secret manager (never commit API keys)

---

## Testing summary

### Backend
```bash
python -m pytest backend/tests/ -v
```
- 31 tests, all passing
- Coverage: safety engine, weather service, vision extraction
- Mocked external APIs for deterministic tests

### Frontend
```bash
npm run build  # TypeScript and Vite build check
```
- No TypeScript errors
- Production build: 182 KB JS, 19 KB CSS (gzipped: 59 KB / 4.4 KB)

### Visual integration (Playwright)
- 23 checks across desktop/mobile viewports
- Scan → review → confirm → success flow
- Dashboard rendering and auto-refresh
- No horizontal overflow, no console errors
- Screenshots captured in `/tmp/nourishnet-playwright/`

---

## Key design decisions

1. **Async-first backend**: All database and HTTP operations are `async` for scalability
2. **Conservative safety windows**: Donor sees the most pessimistic estimate to avoid liability
3. **Manual-entry fallback**: Vision failures never block the donor flow
4. **Idempotent seeding**: `seed.py` can run multiple times without duplicates
5. **Mobile-first UI**: Touch targets, responsive cards, prominent camera action
6. **Atomic claim handling**: Conditional database updates prevent race conditions
7. **Demo/real segregation**: Stats separate demo data for cleaner impact reporting

---

## Resources

- **Product spec**: `product.md`
- **Build plan**: `build_prompt.md` (Phases 0–9)
- **Repository conventions**: `AGENT.md`
- **API docs**: http://localhost:8000/docs (when running)
- **Open-Meteo API**: https://open-meteo.com/en/docs
- **Gemini API**: https://ai.google.dev/gemini-api/docs

---

## Contact and handoff

This work completed Phases 2–5 of the build plan. The application is functional for the complete donor → AI draft → dispatch → dashboard flow. Visual design is polished and mobile-ready. All tests pass.

Next developer should:
1. Review `build_prompt.md` Phase 6 spec
2. Set up a Telegram bot and configure webhook
3. Implement volunteer onboarding and bot commands
4. Test end-to-end with real Telegram accounts

The codebase is clean, typed, and ready for the next phase.
