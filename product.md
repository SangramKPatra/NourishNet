#  NourishNet Product Spec

## 1. One-liner

NourishNet turns one photo of leftover food into a safety-timed pickup alert sent to nearby volunteers, so everyday institutional surplus reaches shelters before it spoils.

## 2. Problem

**Micro-friction.** At 10:30 PM a mess manager, caterer, or cloud-kitchen supervisor has about 25 portions of cooked food left. Existing platforms require logging in, typing dish names, weighing, setting pickup windows, and waiting for someone to browse. Tired staff throw the food away.

**Macro-crisis.**
- Food insecurity coexists with large volumes of edible institutional waste.
- Organic waste in landfills emits methane (about 25x the warming potential of CO₂ over 100 years).
- Donors fear liability for illness from donated cooked food, so they don't donate.
- Volunteer groups mobilize mostly for large events (200+ plates); the daily "medium surplus" of 10–40 meals goes unrescued.

## 3. Target users

| User | Context | Need |
| --- | --- | --- |
| **Donor** (canteen cook, caterer, cloud-kitchen supervisor) | Closing time, tired, phone in hand | Donate in under 15 seconds without typing |
| **Volunteer** (student, local driver) | Gets a Telegram/WhatsApp alert | Know what, where, how long, and tap for a route |
| **Shelter** (orphanage, day shelter, community kitchen) | Registered, verified | Predictable, safe food with notice |
| **Admin / judge / sponsor** | Dashboard | See live status and impact |

## 4. Core workflow

1. **Scan.** Donor opens the mobile web app, takes one photo. GPS captured in the background.
2. **Analyze.** Gemini extracts items, estimated kg, portions, perishability tier. Open-Meteo returns ambient temperature and humidity. Safety engine computes the collection window.
3. **Confirm.** Donor reviews the draft and taps once (can edit quantities if wrong).
4. **Dispatch.** System matches shelters, alerts volunteers on Telegram with food summary, countdown, and a Google Maps link.
5. **Fulfill.** Volunteer taps **Claim Pickup**, collects, delivers to the shelter, taps **Delivered**.
6. **Track.** Dashboard updates countdowns and SDG metrics in real time.

## 5. MVP features (in scope)

**Donor app (`/donor`)**
- Camera capture (native file input with `capture`), geolocation
- AI draft with editable items/portions, one-tap confirm
- Result screen showing the countdown ("Pickup within 2 h 15 min")

**AI & safety engine**
- Strict JSON extraction: items (name, approx_kg), estimated_portions, perishability_tier
- Safe window: `base_tier − max(0, (T − 25°C) × 15)` with a 30-minute floor
- Tier base windows: high-moisture 240 min, medium 360 min, dry 480 min (configurable)
- Example: high-moisture at 32°C = 135 min

**Dispatch**
- Shelter matching by active status, radius, capacity, and travel time vs. remaining window
- Urgency score = estimated travel time ÷ remaining window; high urgency escalates alerts
- Telegram alert with **Claim Pickup** button and Google Maps link
- Re-alert if unclaimed at 50% of the window; flag `at_risk` at 75%

**Command center (`/dashboard`)**
- Live batch cards with ticking countdown (green → amber → red)
- Status: `pending → dispatched → claimed → picked_up → delivered / expired`
- Impact counters: meals saved, kg diverted, CO₂e averted

## 6. Out of scope for MVP

- Payments or discounts, consumer marketplace
- Native iOS/Android apps
- Automated shelter verification (seeded and manually verified)
- Route optimization across multiple pickups
- Donor accounts, ratings, and gamification
- Photo-based temperature or spoilage detection

## 7. Impact metrics (SDG alignment)

| SDG | Contribution | Metric |
| --- | --- | --- |
| **2 – Zero Hunger** (2.1, 2.2) | Moves surplus cooked food to people who need it | Σ portions delivered |
| **12 – Responsible Consumption** (12.3) | Contributes to reducing food waste in the neglected medium-surplus segment | Σ kg diverted |
| **13 – Climate Action** (13.2) | Avoids landfill methane | kg diverted × 2.5 = kg CO₂e averted (factor configurable, cite source) |

Wording rule: say "contributes to" a target, never "achieves" or "halves" it.

## 8. Differentiation

| Dimension | Too Good To Go | Olio | Robin Hood Army / Feeding India | **NourishNet** |
| --- | --- | --- | --- | --- |
| Mission | Discounted sales | Neighbor sharing | Charity drives | Automated dispatch to shelters |
| Donor effort | Manual listing | Photo + typing | Calls / WhatsApp | One photo, one tap |
| Freshness | Static dates | User trust | Taste check | Weather-aware countdown |
| Fulfillment | Pull (buyer comes) | Pull (wait for request) | Manual dispatch | Push to nearby volunteers |
| Target donor | Cafes, bakeries | Households | Large banquets | Everyday canteens, caterers, cloud kitchens |

## 9. Success metrics

- Logging time: under 15 seconds from open to confirm (target); baseline about 5 minutes on form-based apps
- Dispatch latency: alert sent within 10 seconds of confirm
- Claim rate: at least 80% of batches claimed within 50% of window
- Wastage: at most 10% of dispatched batches expire unclaimed
- Extraction accuracy: dish names correct in at least 85% of test photos; portion estimates within ±30%

## 10. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Food-safety liability | Conservative window, donor confirmation, disclaimer, shorter window on uncertainty; frame as guidance, not a guarantee |
| AI misestimates weight or dish | Editable draft, confirmation step, show confidence |
| No volunteer claims | Escalation, re-alerts, at-risk flag, backup shelter-pickup option |
| Volunteer/shelter trust | Seeded verified shelters, volunteer onboarding via invite link |
| Weather API outage | Cache plus conservative default |
| Privacy | Process images in memory, no storage by default, collect minimal location data |

## 11. Open questions

- Who carries liability: donor, platform, or a Good Samaritan-style legal framing in the target region?
- How are volunteers vetted at scale?
- Should humidity enter the formula in v2?
- Source and region-specific value for the CO₂e factor.

## 12. Pitch (3 minutes)

- **0:00–0:30 Reality:** Cooks throw away 20–50 good meals nightly because no one has the energy to type a donation. Shelters nearby are hungry. NourishNet fixes it in 15 seconds.
- **0:30–1:45 Live demo:** Photo on `/donor` → scan → items, portions, weather-based 2 h 15 min countdown → Telegram alert with Maps link.
- **1:45–2:30 Dashboard:** Countdown card goes green → amber; counters show meals saved, kg diverted, CO₂e averted (label demo data as demo).
- **2:30–3:00 Vision:** Camera input plus climate-aware safety turns food rescue from reactive charity into a predictable civic utility.