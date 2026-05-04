-- Haymow initial schema
-- Run this in Supabase SQL editor or via supabase CLI

-- ─── Animals (dairy) ───────────────────────────────────────────────────────────
create table animals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  name           text not null,
  breed          text,
  species        text check (species in ('cow', 'goat', 'sheep')) default 'cow',
  dob            date,
  freshening_date date,   -- determines days in milk (DIM)
  notes          text,
  created_at     timestamptz default now()
);

alter table animals enable row level security;
create policy "users access own animals"
  on animals for all using (user_id = auth.uid());

-- ─── Milking Sessions ──────────────────────────────────────────────────────────
create table milking_sessions (
  id           uuid primary key default gen_random_uuid(),
  animal_id    uuid references animals not null,
  user_id      uuid references auth.users not null,
  session_time timestamptz not null,
  session_type text check (session_type in ('AM', 'PM', 'single')),
  yield_lbs    numeric(6,2),   -- store in lbs; convert to gallons in app (1 gal = 8.6 lbs)
  notes        text,
  health_tags  text[],         -- ['mastitis-concern', 'off-feed', 'limping', etc.]
  created_via  text default 'app',  -- 'app' | 'sms' | 'web'
  created_at   timestamptz default now()
);

alter table milking_sessions enable row level security;
create policy "users access own milking sessions"
  on milking_sessions for all using (user_id = auth.uid());

-- ─── Flocks (layer hens) ───────────────────────────────────────────────────────
create table flocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,     -- e.g. "Barn Layers", "Rhode Island Reds"
  breed       text,
  hen_count   integer,           -- active laying hens
  intake_date date,
  status      text check (status in ('active', 'molting', 'retired')) default 'active',
  notes       text,
  created_at  timestamptz default now()
);

alter table flocks enable row level security;
create policy "users access own flocks"
  on flocks for all using (user_id = auth.uid());

-- ─── Egg Collections ───────────────────────────────────────────────────────────
create table egg_collections (
  id               uuid primary key default gen_random_uuid(),
  flock_id         uuid references flocks not null,
  user_id          uuid references auth.users not null,
  collection_date  date not null,
  egg_count        integer not null,
  broken_count     integer default 0,
  soft_shell_count integer default 0,
  notes            text,
  created_via      text default 'app',
  created_at       timestamptz default now()
);

alter table egg_collections enable row level security;
create policy "users access own egg collections"
  on egg_collections for all using (user_id = auth.uid());

-- ─── Meat Bird Batches ─────────────────────────────────────────────────────────
create table meat_bird_batches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users not null,
  breed            text default 'Cornish Cross',
  intake_date      date not null,
  chick_count      integer not null,
  chick_cost_total numeric(8,2),  -- total cost for all chicks
  source           text,          -- hatchery name
  status           text check (status in ('active', 'processed')) default 'active',
  notes            text,
  created_at       timestamptz default now()
);

alter table meat_bird_batches enable row level security;
create policy "users access own meat bird batches"
  on meat_bird_batches for all using (user_id = auth.uid());

-- ─── Meat Bird Weight Samples ──────────────────────────────────────────────────
create table meat_bird_weight_samples (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid references meat_bird_batches not null,
  user_id        uuid references auth.users not null,
  sample_date    date not null,
  day_of_batch   integer,         -- calculated: sample_date - intake_date
  birds_sampled  integer,
  avg_weight_lbs numeric(5,2),
  notes          text,
  created_at     timestamptz default now()
);

alter table meat_bird_weight_samples enable row level security;
create policy "users access own weight samples"
  on meat_bird_weight_samples for all using (user_id = auth.uid());

-- ─── Meat Bird Mortality ───────────────────────────────────────────────────────
create table meat_bird_mortality (
  id        uuid primary key default gen_random_uuid(),
  batch_id  uuid references meat_bird_batches not null,
  user_id   uuid references auth.users not null,
  log_date  date not null,
  count     integer not null default 1,
  cause     text,   -- 'pasty butt', 'unknown', 'predator', etc.
  created_at timestamptz default now()
);

alter table meat_bird_mortality enable row level security;
create policy "users access own mortality logs"
  on meat_bird_mortality for all using (user_id = auth.uid());

-- ─── Meat Bird Processing (harvest record) ─────────────────────────────────────
create table meat_bird_processing (
  id                   uuid primary key default gen_random_uuid(),
  batch_id             uuid references meat_bird_batches not null,
  user_id              uuid references auth.users not null,
  processing_date      date not null,
  birds_processed      integer,
  avg_live_weight_lbs  numeric(5,2),
  avg_dressed_weight_lbs numeric(5,2),
  yield_pct            numeric(5,2),   -- dressed / live * 100
  processing_cost      numeric(8,2),   -- if sent to a processor
  notes                text,
  created_at           timestamptz default now()
);

alter table meat_bird_processing enable row level security;
create policy "users access own processing records"
  on meat_bird_processing for all using (user_id = auth.uid());

-- ─── Feed Entries (polymorphic) ────────────────────────────────────────────────
create table feed_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  animal_id     uuid references animals,           -- nullable
  flock_id      uuid references flocks,            -- nullable
  batch_id      uuid references meat_bird_batches, -- nullable
  -- exactly one of the above three should be set
  entry_time    timestamptz not null,
  feed_type     text,
  -- dairy:      'hay' | 'grain' | 'mineral' | 'pasture' | 'other'
  -- layers:     'layer-pellet' | 'scratch' | 'oyster-shell' | 'other'
  -- meat birds: 'chick-starter' | 'grower' | 'finisher' | 'other'
  amount        numeric(8,2),
  unit          text,           -- 'lbs' | 'flakes' | 'hours' | 'bags' | 'oz'
  cost_per_unit numeric(8,4),  -- optional, for ROI tracking
  notes         text,
  created_at    timestamptz default now()
);

alter table feed_entries enable row level security;
create policy "users access own feed entries"
  on feed_entries for all using (user_id = auth.uid());

-- ─── Processing Entries (dairy milk processing) ────────────────────────────────
create table processing_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  entry_date    date not null,
  input_gallons numeric(6,2),
  output_type   text,   -- 'cream' | 'butter' | 'cheese' | 'fresh' | 'colostrum'
  output_amount numeric(8,2),
  output_unit   text,   -- 'oz' | 'lbs' | 'gallons' | 'pints'
  notes         text,
  created_at    timestamptz default now()
);

alter table processing_entries enable row level security;
create policy "users access own processing entries"
  on processing_entries for all using (user_id = auth.uid());

-- ─── Weather Logs (auto-fetched, not user-entered) ─────────────────────────────
create table weather_logs (
  id           uuid primary key default gen_random_uuid(),
  log_date     date not null,
  zip_code     text,
  high_temp_f  numeric(5,1),
  low_temp_f   numeric(5,1),
  humidity_pct numeric(5,1),
  created_at   timestamptz default now(),
  unique (log_date, zip_code)
);

-- Weather is readable by all authenticated users (no user_id column)
alter table weather_logs enable row level security;
create policy "authenticated users can read weather"
  on weather_logs for select using (auth.role() = 'authenticated');

-- ─── Subscriptions ─────────────────────────────────────────────────────────────
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users not null unique,
  tier                   text check (tier in ('free', 'homestead', 'full_farm')) default 'free',
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  is_founding_member     boolean default false,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

alter table subscriptions enable row level security;
create policy "users access own subscription"
  on subscriptions for all using (user_id = auth.uid());
