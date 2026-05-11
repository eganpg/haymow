# CLAUDE.md — Haymow Project Context
push 
This file gives Claude Code the full context needed to work on this project effectively. Read this before touching any code.

---

## What This App Is

**Haymow** is a production tracking app for small-scale homesteaders. The long-term scope covers dairy animals (cows, goats, sheep) and chicken operations (layer flocks and meat bird batches). It is NOT a commercial dairy or poultry platform. The UX should feel like a personal health tracker (think Cronometer or Oura), not farm management software.

Two core insights that make this different from everything on the market:
1. **Feed-to-yield correlation** at the individual animal/flock level
2. **Unified homestead view** — dairy and poultry in one place, with SMS logging from the barn or coop

---

## V1 Focus (Locked — 2026-05-05)

**v1 is dairy-first.** Launch positioning is "dairy production tracking for homesteaders" — narrow niche, focused traction. Layers and meat birds remain in the codebase and database (don't remove them), but new feature work, polish, and marketing copy default to the dairy side until further notice.

**What this means for build decisions:**
- "What next?" → pick from the dairy backlog (lactation curve, feed→yield correlation, milk processing log, dairy economics) before poultry work.
- Don't delete poultry tables, screens, or queries. Existing scaffolding stays.
- Don't add new poultry features unless explicitly requested.
- Onboarding still presents all three types — Pete may still set up a flock, it's just not the launch story.

---

## Keeping Docs in Sync

When a checklist item gets completed, an architecture decision is made, or a screen ships, update both `CLAUDE.md` and `README.md` before ending the session — these docs are how future-you stays oriented.

---

## The Primary User

Pete, a homesteader in Lampasas County, Texas with:
- One Jersey dairy cow named Nan (AM + PM milking sessions)
- Layer hens producing eggs daily
- Seasonal meat bird batches (Cornish Cross)
- Tracking raw milk production, cream separation, and butter output
- A phone always in his pocket while doing barn and coop chores
- No interest in enterprise software complexity

Design and build for this user. Every feature decision should be validated against: *would a guy milking one cow and collecting eggs at 6am actually use this?*

---

## Product Priorities (in order)

V1 is dairy-first. Items marked **(v1.x)** are scaffolded but parked until dairy gets traction.

1. **Speed of data entry** — logging any session must take under 30 seconds on mobile
2. **Dairy: Feed correlation** — show the relationship between what the cow eats and what she produces
3. **Dairy: Lactation curve** — track Days in Milk, plot actual vs. expected Jersey curve
4. **Dairy: Processing log** — track what happened to the milk (fresh, cream, butter, cheese)
5. **Dairy: Economics** — cost per gallon of milk, feed-cost trends
6. **SMS logging** — text a number from the barn, data gets recorded, confirmation comes back (post-v1)
7. **Layers: Egg log + cost per dozen** — daily count, lay rate %, feed cost tracked against output *(v1.x)*
8. **Meat birds: Batch tracker** — chick-to-freezer lifecycle with cost per lb at the end *(v1.x)*
9. **Cross-species economics** — unified cost-per-unit dashboard across milk, eggs, meat *(v1.x)*

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile + Web | **React Native / Expo** | Single codebase — iOS, Android, and web via Expo Web |
| Backend / DB | **Supabase** | Postgres, real-time, auth, storage, REST |
| SMS | **Twilio (post-v1)** | Not in initial build — added in a future release |
| NLP Parsing | **Claude API** (claude-sonnet-4-20250514) | SMS parsing when that feature ships |
| Charts | **Recharts** | Trend and correlation visualizations |
| Weather | **Open-Meteo API** | Free, no API key required |
| Auth | **Supabase Auth + Google OAuth** | Google Sign In only (no email/password in v1) |
| Payments | **Stripe** | Subscription billing — deferred to v2, all users on free tier for now |
| IDE | **GitHub Codespaces** | Cloud-based dev environment — no local setup required |
| Version Control | **GitHub** | Required for Codespaces; create repo before first session |

## Architecture Decisions (Locked)

These are resolved — do not re-open without explicit discussion:

| Decision | Choice | Rationale |
|---|---|---|
| Repo structure | Single Expo app, no monorepo | Simplest to build and maintain with Claude Code |
| Web vs. mobile | Expo Web — one codebase, two layouts | Mobile = quick-log UI; Web = full dashboard/analytics |
| Offline support | Quick-log only (Expo SQLite + sync) | Charts/analytics require live data; logging cannot |
| SMS | Post-v1, not in initial build | Reduces complexity for launch |
| Feed table | Single polymorphic table | One query surface, simpler to maintain |
| Feed inventory | Separate feed_inventory + feed_purchases tables | Stock tracking, purchase history, cost-per-unit; log-milking pulls from inventory |
| Onboarding | Guided single animal type setup | Matches free tier, less overwhelming |
| Auth | Google Sign In only (v1) | No email/password — simplifies auth surface; Apple/others can be added later |
| Stripe billing | Deferred to v2 | All users on free tier during early access; no paywall until post-launch |
| Downgrade behavior | Data retained, hidden until upgrade | Never delete user data |
| History enforcement | Exclude from DB queries (not UI filter) | Cleaner, nothing leaks to client |
| Price points | Free / $2.99 / $7.99 | Locked |
| Yield storage | Always stored in lbs in DB | Converted to gallons in app (1 gal = 8.6 lbs); user preference stored in SecureStore |

---

## Project Structure (target)

```
haymow/                      ← root project folder (also the app name, trademark pending)
├── app/                     ← Expo Router file-based routing
│   ├── (auth)/
│   │   └── login.tsx        ← Google Sign In screen
│   ├── (onboarding)/
│   │   ├── pick-type.tsx    ← Choose dairy / layers / meat birds
│   │   ├── setup-animal.tsx ← Set up first animal/flock/batch
│   │   └── ready.tsx        ← Done screen with first-log CTA
│   ├── (tabs)/              ← Main tab navigation
│   │   ├── index.tsx        ← Today screen (dairy card + egg card)
│   │   ├── trends.tsx       ← Charts and analytics (placeholder)
│   │   ├── animals.tsx      ← Animal/flock/batch list + profiles
│   │   └── settings.tsx     ← Account, preferences, feed inventory link
│   ├── log-milking.tsx      ← Modal: log dairy session
│   ├── log-eggs.tsx         ← Modal: log egg collection
│   ├── add-animal.tsx       ← Modal: add animal/flock/batch
│   ├── animal-profile.tsx   ← Dairy animal detail screen
│   ├── flock-profile.tsx    ← Layer flock detail screen
│   ├── batch-profile.tsx    ← Meat bird batch detail screen
│   ├── feed-management.tsx  ← Feed inventory list (from Settings)
│   ├── add-feed-item.tsx    ← Modal: add new feed to inventory
│   ├── feed-item.tsx        ← Feed item detail + restock
│   └── _layout.tsx          ← Root layout + auth routing guard
├── constants/
│   └── Colors.ts            ← Design tokens (sage, linen, rust, etc.)
├── lib/
│   ├── supabase.ts          ← Supabase client (SecureStore + web localStorage adapter)
│   ├── AppContext.tsx        ← Global auth state: 'loading'|'unauthenticated'|'onboarding'|'ready'
│   ├── auth.ts              ← signInWithGoogle(), signOut()
│   └── queries/
│       ├── milking.ts       ← logMilkingSession(), getMilkingSessions()
│       ├── eggs.ts          ← logEggCollection(), getEggCollections()
│       └── feedInventory.ts ← getFeedInventory(), createFeedItem(), restockFeedItem(), logFeedUsage()
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  ← Core tables + RLS
│       └── 002_feed_inventory.sql  ← feed_inventory, feed_purchases, feed_entries.feed_inventory_id
├── README.md
└── CLAUDE.md
```

**Layout principle:** Mobile screens are optimized for one-thumb quick-log. Web screens (detected via `Platform.OS === 'web'`) expand to show full dashboard layouts with side-by-side charts. Use the same components, different layout wrappers.

---

## Database Schema

### animals (dairy)
```sql
create table animals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  breed text,
  species text check (species in ('cow', 'goat', 'sheep')) default 'cow',
  dob date,
  freshening_date date,        -- determines days in milk (DIM)
  notes text,
  created_at timestamptz default now()
);
```

### milking_sessions
```sql
create table milking_sessions (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid references animals not null,
  user_id uuid references auth.users not null,
  session_time timestamptz not null,
  session_type text check (session_type in ('AM', 'PM', 'single')),
  yield_lbs numeric(6,2),       -- store in lbs, convert to gallons in app (1 gal = 8.6 lbs)
  notes text,
  health_tags text[],           -- ['mastitis-concern', 'off-feed', 'limping', etc.]
  created_via text default 'app', -- 'app' | 'sms' | 'web'
  created_at timestamptz default now()
);
```

### flocks (layer hens)
```sql
create table flocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,           -- e.g. "Barn Layers", "Rhode Island Reds"
  breed text,
  hen_count integer,            -- active laying hens
  intake_date date,             -- when this cohort arrived or hatched
  status text check (status in ('active', 'molting', 'retired')) default 'active',
  notes text,
  created_at timestamptz default now()
);
```

### egg_collections
```sql
create table egg_collections (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid references flocks not null,
  user_id uuid references auth.users not null,
  collection_date date not null,
  egg_count integer not null,
  broken_count integer default 0,
  soft_shell_count integer default 0,
  notes text,
  created_via text default 'app',
  created_at timestamptz default now()
);
```

### meat_bird_batches
```sql
create table meat_bird_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  breed text default 'Cornish Cross',
  intake_date date not null,
  chick_count integer not null,
  chick_cost_total numeric(8,2), -- total cost for all chicks
  source text,                   -- hatchery name
  status text check (status in ('active', 'processed')) default 'active',
  notes text,
  created_at timestamptz default now()
);
```

### meat_bird_weight_samples
```sql
create table meat_bird_weight_samples (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references meat_bird_batches not null,
  user_id uuid references auth.users not null,
  sample_date date not null,
  day_of_batch integer,          -- calculated: sample_date - intake_date
  birds_sampled integer,
  avg_weight_lbs numeric(5,2),
  notes text,
  created_at timestamptz default now()
);
```

### meat_bird_mortality
```sql
create table meat_bird_mortality (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references meat_bird_batches not null,
  user_id uuid references auth.users not null,
  log_date date not null,
  count integer not null default 1,
  cause text,                    -- free text: 'pasty butt', 'unknown', 'predator', etc.
  created_at timestamptz default now()
);
```

### meat_bird_processing (harvest record)
```sql
create table meat_bird_processing (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references meat_bird_batches not null,
  user_id uuid references auth.users not null,
  processing_date date not null,
  birds_processed integer,
  avg_live_weight_lbs numeric(5,2),
  avg_dressed_weight_lbs numeric(5,2),
  yield_pct numeric(5,2),        -- dressed / live * 100
  processing_cost numeric(8,2),  -- if sent to a processor
  notes text,
  created_at timestamptz default now()
);
```

### feed_inventory (stock on hand — migration 002)
```sql
create table feed_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,           -- e.g. "Purina Layena", "Coastal Bermuda Hay"
  feed_type text not null,      -- 'grain' | 'hay' | 'mineral' | 'pasture' | 'layer-pellet' | 'scratch' | 'oyster-shell' | 'chick-starter' | 'grower' | 'finisher' | 'other'
  unit text not null,           -- 'lbs' | 'bags' | 'flakes' | 'oz'
  quantity_on_hand numeric(10,2) default 0,
  cost_per_unit numeric(8,4),   -- auto-updated on each restock
  low_stock_alert numeric(10,2), -- nullable; show badge when quantity_on_hand <= this
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### feed_purchases (restock history — migration 002)
```sql
create table feed_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  feed_inventory_id uuid references feed_inventory not null,
  quantity_purchased numeric(10,2) not null,
  total_cost numeric(8,2),      -- nullable; if provided, updates cost_per_unit
  purchase_date date not null default current_date,
  created_at timestamptz default now()
);
```

### feed_entries (polymorphic — works for dairy, layers, and meat birds)
```sql
create table feed_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  animal_id uuid references animals,         -- nullable
  flock_id uuid references flocks,           -- nullable
  batch_id uuid references meat_bird_batches, -- nullable
  feed_inventory_id uuid references feed_inventory, -- nullable; links to inventory item
  -- exactly one of animal_id/flock_id/batch_id should be set
  entry_time timestamptz not null,
  feed_type text,
  -- dairy: 'hay' | 'grain' | 'mineral' | 'pasture' | 'other'
  -- layers: 'layer-pellet' | 'scratch' | 'oyster-shell' | 'other'
  -- meat birds: 'chick-starter' | 'grower' | 'finisher' | 'other'
  amount numeric(8,2),
  unit text,                    -- 'lbs' | 'flakes' | 'hours' | 'bags' | 'oz'
  cost_per_unit numeric(8,4),   -- snapshotted from inventory at time of log
  notes text,
  created_at timestamptz default now()
);
-- NOTE: logFeedUsage() deducts amount from feed_inventory.quantity_on_hand automatically
```

### processing_entries (dairy milk processing)
```sql
create table processing_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  entry_date date not null,
  input_gallons numeric(6,2),
  output_type text,             -- 'cream' | 'butter' | 'cheese' | 'fresh' | 'colostrum'
  output_amount numeric(8,2),
  output_unit text,             -- 'oz' | 'lbs' | 'gallons' | 'pints'
  notes text,
  created_at timestamptz default now()
);
```

### weather_logs (auto-fetched, not user-entered)
```sql
create table weather_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  zip_code text,
  high_temp_f numeric(5,1),
  low_temp_f numeric(5,1),
  humidity_pct numeric(5,1),
  created_at timestamptz default now()
);
```

---

## SMS Parsing (Critical Feature)

### Flow
```
User texts Twilio number
  → Twilio webhook POST to /api/sms
  → Extract phone number, look up user
  → Send raw message to Claude API with parsing prompt
  → Claude returns structured JSON with logType field
  → Route to correct table: milking_sessions | egg_collections | meat_bird_weight_samples | meat_bird_mortality
  → Twilio sends confirmation SMS back
```

### Claude Parsing Prompt (system)
```
You are a parser for a homestead production tracking app. The user has texted a log entry from their barn or coop.

First determine the log type, then extract fields. Return ONLY valid JSON, no other text.

Log types:
- "dairy" → milk session
- "eggs" → egg collection
- "meat_bird_weight" → meat bird weight sample
- "meat_bird_mortality" → bird death/loss log

Return this structure:
{
  "logType": "dairy" | "eggs" | "meat_bird_weight" | "meat_bird_mortality",

  // dairy fields
  "yield": number | null,
  "yieldUnit": "gal" | "lbs" | null,
  "session": "AM" | "PM" | "single" | null,
  "animalName": string | null,

  // egg fields
  "eggCount": number | null,
  "brokenCount": number | null,
  "softShellCount": number | null,
  "flockName": string | null,

  // meat bird fields
  "birdsSampled": number | null,
  "avgWeightLbs": number | null,
  "dayOfBatch": number | null,
  "mortalityCount": number | null,
  "mortalityCause": string | null,

  // shared
  "feedType": string | null,
  "feedAmount": number | null,
  "feedUnit": string | null,
  "healthTags": string[],
  "notes": string | null
}

Examples:
"3.2 gal AM 3lb grain" → {"logType":"dairy","yield":3.2,"yieldUnit":"gal","session":"AM","feedType":"grain","feedAmount":3,"feedUnit":"lbs",...nulls}
"layers 18 eggs today" → {"logType":"eggs","eggCount":18,"flockName":"layers",...nulls}
"11 eggs 2 soft shell" → {"logType":"eggs","eggCount":11,"softShellCount":2,...nulls}
"meat birds day 35 pulled 3 birds avg 5.2 lbs" → {"logType":"meat_bird_weight","dayOfBatch":35,"birdsSampled":3,"avgWeightLbs":5.2,...nulls}
"lost 2 meat birds pasty butt" → {"logType":"meat_bird_mortality","mortalityCount":2,"mortalityCause":"pasty butt",...nulls}
```

### SMS Confirmation Format
```
// dairy
✓ Logged: [Nan] 3.2 gal AM | Feed: 3 lbs grain
Running today's total: 3.2 gal

// eggs
✓ Logged: 18 eggs | Flock: Layers
This week: 112 eggs (84% lay rate)

// meat birds
✓ Logged: Day 35 weight check | 3 birds @ avg 5.2 lbs
Batch mortality to date: 2 birds
```

---

## Key Business Logic

### Days in Milk (DIM)
```typescript
const getDIM = (fresheningDate: Date): number => {
  const today = new Date();
  const diff = today.getTime() - fresheningDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};
```

### Yield Unit Conversion
```typescript
const LBS_PER_GALLON = 8.6; // average for Jersey whole milk

const toGallons = (lbs: number): number => lbs / LBS_PER_GALLON;
const toLbs = (gallons: number): number => gallons * LBS_PER_GALLON;
```

### Jersey Lactation Curve (Expected Production by DIM)
Use a Wood's curve model or hardcoded lookup table for Jersey breed average. Peak production typically occurs around DIM 60–90. Flag if actual production falls more than 15% below expected for DIM.

### Cost Per Gallon
```
costPerGallon = totalFeedCostInPeriod / totalGallonsProducedInPeriod
```

### Lay Rate %
```typescript
const getLayRate = (eggCount: number, henCount: number): number => {
  return (eggCount / henCount) * 100;
  // Healthy layers: 70–90%. Flag if < 50% for 3+ consecutive days.
};
```

### Cost Per Dozen Eggs
```
costPerDozen = totalFeedCostInPeriod / (totalEggsInPeriod / 12)
```

### Meat Bird Day of Batch
```typescript
const getDayOfBatch = (intakeDate: Date, sampleDate: Date): number => {
  const diff = sampleDate.getTime() - intakeDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};
// Cornish Cross target: ~4.5–5 lbs live weight by day 42–49
```

### Meat Bird Cost Per Lb (calculated at processing)
```
costPerLb = (chickCostTotal + totalFeedCost + processingCost) / totalDressedWeightLbs
```

### Meat Bird Yield %
```
yieldPct = avgDressedWeightLbs / avgLiveWeightLbs * 100
// Typical Cornish Cross: 70–75% dressed yield
```

---

## Feed-to-Yield Correlation Query

Core analytics query — run this when building the correlation view:

```sql
-- For each milking session, join with feed entries from the prior 12 hours
-- then compare yield to a rolling 7-day average
select
  ms.session_time,
  ms.yield_lbs,
  ms.session_type,
  sum(fe.amount) filter (where fe.feed_type = 'grain') as grain_lbs,
  sum(fe.amount) filter (where fe.feed_type = 'hay') as hay_amount,
  avg(ms2.yield_lbs) over (
    order by ms.session_time
    rows between 13 preceding and 1 preceding
  ) as rolling_7day_avg_lbs
from milking_sessions ms
left join feed_entries fe
  on fe.animal_id = ms.animal_id
  and fe.entry_time between ms.session_time - interval '12 hours' and ms.session_time
left join milking_sessions ms2
  on ms2.animal_id = ms.animal_id
where ms.animal_id = $1
group by ms.id, ms.session_time, ms.yield_lbs, ms.session_type
order by ms.session_time desc;
```

---

## UI/UX Principles

- **Mobile-first** — all primary actions reachable with one thumb
- **Quick-log is the hero action** — big floating button on home screen, 3-tap maximum to log a session
- **No jargon** — write "Days since freshening" not "DIM", "Grain" not "TMR"
- **Charts over tables** — show the trend visually; hide the raw data table behind a toggle
- **Color coding** — green for above-average sessions, yellow for at-average, red for below
- **Dark mode support** — barns are dark at 5am

---

## Brand & Design Tokens

### Color Palette
```typescript
const colors = {
  // Primary
  sage:       '#7C9A7E',   // primary green — nav, buttons, active states
  linen:      '#F5F0E8',   // background — light mode canvas
  gold:       '#C9A84C',   // accent — highlights, streak indicators
  charcoal:   '#2C2C2C',   // primary text

  // Secondary
  rust:       '#B85C38',   // alerts, health tags, warnings
  cream:      '#FAF7F2',   // card backgrounds
  moss:       '#4A6741',   // dark variant of sage, pressed states

  // Dark mode equivalents
  darkBg:     '#1A1A1A',
  darkCard:   '#252525',
  darkBorder: '#333333',
};
```

### Typography
- **Primary font:** System font (SF Pro on iOS, Roboto on Android) — no custom font load, instant render
- **Weight:** Heavy use of bold/semibold for data values (yield numbers, egg counts)
- **Size:** Generous — minimum 16px body, 28px+ for key metrics. Readable at arm's length in a barn.

### UI Rules for Claude Code
- **Large tap targets** — minimum 48x48px for all interactive elements
- **High contrast** — all text meets WCAG AA minimum (4.5:1 ratio)
- **No decorative elements** — every UI element earns its place
- **Data first** — the number is the hero, not the label
- **Light mode default** — `colorScheme: 'light'` as base, dark mode via system toggle
- **Icon:** TBD — Fortune Hollow logo asset will be provided. Do not generate a placeholder icon; use a simple text mark during development.

---

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Anthropic (SMS parsing)
ANTHROPIC_API_KEY=

# Weather (Open-Meteo — no key required for basic use)
USER_ZIP_CODE=               # default zip for weather fetching

# Stripe (billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_HOMESTEAD=
STRIPE_PRICE_ID_FULL_FARM=
```

---

## Dev Seed Data

**Dairy — Nan:**
- Animal: Nan, Jersey cow, freshened ~90 days ago
- 60 days of AM + PM milking sessions with realistic Jersey yields (2.5–4.5 gal/day)
- Corresponding feed entries (morning: 3 lbs grain + hay, evening: 2 lbs grain)
- A few health tags and notes for realism
- 2–3 weeks of butter/cream processing entries

**Layers:**
- Flock: "Barn Layers", 12 hens, mixed breed, intake 6 months ago
- 60 days of egg collection logs (8–11 eggs/day with realistic variation)
- A few soft shell and broken egg entries
- Layer pellet feed entries with costs

**Meat Birds:**
- One completed batch: 25 Cornish Cross, 49-day run, processed
- Weekly weight samples at day 7, 14, 21, 28, 35, 42, 49
- 2 mortality entries with causes
- Final processing record with live/dressed weights and yield %
- One active batch: 30 birds, day 21, with weight samples so far

---

## Billing & Subscription Model

### Tiers (Locked)

| Tier | Price | Animal Types Allowed | History |
|---|---|---|---|
| `free` | $0 | 1 type | 90 days |
| `homestead` | $2.99/mo | up to 3 types | 1 year |
| `full_farm` | $7.99/mo | unlimited | unlimited |

**Animal types:** `dairy` | `layers` | `meat_birds`

Type = species category, not individual animal count. Two dairy cows = 1 type. One dairy cow + one layer flock = 2 types.

### Subscription Table

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  tier text check (tier in ('free', 'homestead', 'full_farm')) default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  is_founding_member boolean default false,  -- first 500 users, grandfathered to homestead
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Enforcement Logic

**On adding a new animal/flock/batch:**
```typescript
const TIER_TYPE_LIMITS = {
  free: 1,
  homestead: 3,
  full_farm: Infinity,
};

async function canAddAnimalType(userId: string, newType: AnimalType): Promise<boolean> {
  const sub = await getSubscription(userId);
  const existingTypes = await getActiveAnimalTypes(userId); // distinct types user already has
  if (existingTypes.includes(newType)) return true;        // adding within existing type, always allowed
  const limit = TIER_TYPE_LIMITS[sub.tier];
  return existingTypes.length < limit;
}
```

**On querying historical data (enforced at query layer, not UI):**
```typescript
const HISTORY_DAYS: Record<string, number | null> = {
  free: 90,
  homestead: 365,
  full_farm: null, // no limit
};

function getHistoryCutoff(tier: string): Date | null {
  const days = HISTORY_DAYS[tier];
  if (!days) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

// Apply in every historical query — example:
async function getMilkingSessions(userId: string, animalId: string) {
  const { tier } = await getSubscription(userId);
  const cutoff = getHistoryCutoff(tier);
  let query = supabase
    .from('milking_sessions')
    .select('*')
    .eq('animal_id', animalId)
    .order('session_time', { ascending: false });
  if (cutoff) query = query.gte('session_time', cutoff.toISOString());
  return query;
}
// IMPORTANT: cutoff is applied in lib/queries/ — never filter in the UI layer.
// Data outside the window is retained in the DB but never sent to the client.
```

### Stripe Integration

Use Stripe for payment processing. Key events to handle via webhook:
- `customer.subscription.created` → set tier in subscriptions table
- `customer.subscription.updated` → update tier (upgrades and downgrades)
- `customer.subscription.deleted` → revert to `free`
- `invoice.payment_failed` → grace period of 3 days before downgrade

```bash
# Add to env variables
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_HOMESTEAD=
STRIPE_PRICE_ID_FULL_FARM=
```

### Upsell UX Rules

- Prompt only at the moment of friction — when user tries to add a second animal type
- One screen, one clear CTA — no popups, no banners, no nag emails
- Show what they'd unlock, not what they're missing
- Never interrupt an active logging flow — check tier before starting the "add animal" flow, not after

### Founding Member Logic

```typescript
// On new user signup, check total user count
const totalUsers = await getUserCount();
if (totalUsers <= 500) {
  await setFoundingMember(userId); // is_founding_member = true, tier = 'homestead'
}
```

---

## What NOT to Build (v1)

Do not add these without explicit discussion:
- IoT / sensor integration
- Breeding / reproductive tracking
- Veterinary clinical records
- Multi-user / farm team access
- Milk or egg sales / invoicing
- Goats and sheep as distinct animal types (v1 dairy = cows only)

Keep v1 focused. The goal is a working, fast, genuinely useful tool — not a platform.

---

## Pre-Build Checklist

This is the handoff list. Complete these before writing any production code. Claude Code should review this list at the start of every session and note what's been completed.

---

### 🔧 Question 3 — Tooling Accounts

These accounts need to exist and credentials need to be in `.env` before scaffolding begins.

- [x] **GitHub** — Repo `haymow` created (private). Codespaces active.
- [x] **GitHub Codespaces** — Running. Default Node.js dev container with Node, npm, git.
- [x] **Supabase** — Project created. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`. Migrations 001 (core schema) and 002 (feed inventory) applied. Google OAuth provider configured.
- [ ] **Stripe** — Deferred to v2. All users on free tier during early access.
- [x] **Expo** — App scaffolded with `create-expo-app`. Logged in with `npx expo login`. EAS initialized.
- [ ] **Expo Dev Client / Preview** — For mobile testing, use Expo Go on phone pointed at Codespaces forwarded port (port 8081).
- [ ] **Apple Developer account** — Available (existing account). Needed before first TestFlight build.
- [ ] **Google Play Console** — Available (existing account). Needed before first Android build.
- [ ] **Domain** — haymow.app to be registered. Defer until app is ready to ship.

**Codespaces `.env` note:** Codespaces supports encrypted secrets at the repo or org level (Settings → Secrets → Codespaces). Set your env vars there so they're available automatically in every Codespace — don't commit a `.env` file with real credentials.

---

### 📱 Question 4 — Onboarding Flow

The guided first-run experience needs to be fully designed before Claude Code builds it. Here's the proposed 4-screen flow — **Pete to confirm or revise before build starts.**

**Screen 1 — Welcome**
- Haymow logo / wordmark
- Tagline: "Track what your farm produces."
- Two CTAs: "Get Started" / "I already have an account"

**Screen 2 — Pick Your Animal Type**
- Header: "What do you raise?"
- Three large cards: 🐄 Dairy Animals / 🥚 Layer Hens / 🐔 Meat Birds
- Single select (free tier = 1 type)
- Small note: "You can add more animal types later"

**Screen 3 — Set Up Your First Animal**
*Branches based on Screen 2 selection:*

- **Dairy:** Name your animal → Pick breed (Jersey / Other) → Enter freshening date (or "I don't know yet")
- **Layers:** Name your flock → How many hens? → When did they start laying? (or "Not sure")
- **Meat Birds:** Breed (Cornish Cross / Other) → How many birds? → When did chicks arrive?

**Screen 4 — You're Ready**
- Summary card: "Nan is set up. Ready to log your first session?"
- Single CTA: "Log First Session" → drops directly into quick-log screen

- [x] **Flow confirmed and built.** All 4 onboarding screens complete.
- [x] **Decided:** Screen 2 shows all 3 options; user picks one and it becomes their free tier type. Can be adjusted later.

---

### 🖥️ Question 5 — Screen Inventory

Full list of every screen in the app. Claude Code will build these in order. **Pete to confirm before build starts.**

**Auth**
- [x] Welcome / splash — login screen with Google Sign In
- [x] Log in — Google OAuth via Supabase
- [x] Onboarding — pick animal type → set up first animal → ready (3 screens)
- [ ] Forgot password — N/A (Google-only auth in v1)

**Main App — Mobile (Tab Bar)**
- [x] Today — dairy card + egg card, daily totals, AM/PM session status, log buttons
- [x] Trends — 7/30/90-day yield bar chart, grain feed overlay toggle, animal selector when >1; tap a bar to drill into that day's sessions + the feed logged with each session; tap a session row to edit/delete (reuses log-milking flow)
- [x] Animals — list by type, animal/flock/batch profile, add animal/flock/batch
- [x] Settings — account info, yield unit toggle, feed inventory link, subscription tier, sign out

**Dairy Screens**
- [x] Dairy animal profile (`/animal-profile`) — DIM, recent sessions, freshening date
- [x] Log milking session (`/log-milking`) — yield, session type, multi-feed from inventory, health tags, notes
- [ ] Lactation curve view
- [ ] Feed-to-yield correlation chart
- [ ] Milk processing log entry
- [ ] Milk processing history

**Layer Hen Screens**
- [x] Flock profile (`/flock-profile`) — hen count, recent egg logs
- [x] Log egg collection (`/log-eggs`) — count, broken/soft shell, feed from inventory, notes
- [ ] Egg trend chart + lay rate %
- [ ] Cost per dozen view

**Meat Bird Screens**
- [x] Batch profile (`/batch-profile`) — placeholder, basic info
- [ ] Log weight sample
- [ ] Log mortality
- [ ] Batch summary (completed) — cost per lb, yield %, full lifecycle

**Feed Inventory Screens**
- [x] Feed management (`/feed-management`) — grouped list, stock on hand, low stock badges
- [x] Add feed item (`/add-feed-item`) — name, type, unit, quantity, cost, alert threshold
- [x] Feed item detail (`/feed-item`) — current stock, restock modal, purchase history

**Economics**
- [ ] Farm economics dashboard — cost per gallon / per dozen / per lb side by side

**Billing**
- [ ] Upgrade prompt (triggered when adding second animal type) — deferred (all users free)
- [ ] Subscription management screen — deferred
- [ ] Paywall / plan comparison screen — deferred

**Web-Specific Layouts**
- [ ] Full dashboard (expanded trends + correlation side by side)
- [ ] Data export screen

---

*When transferring to Claude Code: ask Claude Code to read README.md and CLAUDE.md in full, confirm it understands the architecture decisions, then start with this checklist. Do not begin building screens until tooling accounts are confirmed.*

---

*Last updated: 2026-05-11. App scaffold complete, core logging and feed inventory system built, Trends drill-down shipped. See README.md for full project status.*
