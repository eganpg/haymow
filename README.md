# 🌾 Haymow — Track What Your Farm Produces

A milk and egg production tracking app built for small-scale homesteaders. Covers dairy animals and chicken flocks — layers and meat birds. Not a farm ERP. Not a commercial dairy platform. Built for one cow and a flock of chickens, not a thousand of either.

> *A haymow is where the farm stores what it produces. That's exactly what this app does.*

> **V1 launch focus: dairy.** Layer and meat bird support is in the codebase and will keep shipping, but v1 launch positioning, polish, and feature investment lead with dairy production tracking.

---

## The Problem

Every dairy and poultry tracking app on the market assumes you have a milking parlor, IoT sensors, a commercial laying house, or a herd/flock of hundreds. Homesteaders with a single Jersey and a mixed chicken operation are left managing production data in Notes apps, spreadsheets, or their heads. There's no tool that:

- Correlates feed input to milk or egg output at the individual animal/flock level
- Tracks where a cow is in her lactation curve and flags underperformance
- Tracks egg production by flock and breed, and cost per dozen
- Monitors meat bird batches from chick arrival through processing day
- Lets you log data by texting a number from the barn or coop
- Feels like a personal health tracker instead of enterprise software

---

## Target User

- Family homesteaders with 1–5 dairy animals and/or a backyard/pastured chicken operation
- Raw milk producers tracking production for personal use
- Pastured egg producers tracking flock performance and cost per dozen
- Small-scale meat bird growers running seasonal Cornish Cross batches
- 4-H families managing project animals
- Anyone who just got their first family cow or flock and is drowning in a spreadsheet

---

## Core Features

### 1. Milking Session Log
Every session captures:
- Date and time
- AM / PM session designation
- Yield (lbs or gallons — user-selectable toggle)
- Feed given that session (type + amount: hay, grain, minerals, pasture hours)
- Free-text notes (heat stress, kicked the bucket, unusual behavior)
- Optional quick health tags (mastitis concern, off feed, limping, etc.)

### 2. Feed-to-Yield Correlation Engine
The core differentiator. The app surfaces questions like:
- Does 3 lbs of grain vs. 2 lbs produce meaningfully more milk the next AM session?
- Does production dip on days above 95°F?
- How does yield trend across the lactation curve?

Weather pulled automatically by zip code — no manual logging required.

### 3. Lactation Curve Tracking
- Track Days in Milk (DIM) from freshening date
- Plot actual production against the expected Jersey lactation curve
- Surface alerts when a cow is underperforming relative to her stage

### 4. Feed Cost vs. Yield ROI
- Log grain and hay costs
- Calculate cost per gallon of milk produced
- Compare feed strategies over time

### 5. Milk Processing Log
Close the loop on the full operation:
- Log what you do with the milk (fresh, cream separated, butter churned, cheese made)
- Track inventory of processed products
- See the full picture from udder to table

### 6. Layer Hen Flock Tracking
For egg-laying operations:
- Daily egg count per flock
- Broken / soft shell / double yolk flags
- Egg cost tracking: feed cost ÷ dozens produced = cost per dozen
- Lay rate % by flock (eggs / hens / day)
- Seasonal and molt tracking — flag when production drops are expected vs. abnormal
- Breed-level comparison if running mixed flocks

### 7. Meat Bird Batch Tracking
For Cornish Cross and other meat bird operations:
- Batch intake: date, number of chicks, source, cost per chick
- Weekly weight samples (spot-check a few birds to estimate flock average)
- Feed consumed per batch (bags in, cost tracked)
- Mortality log — count and cause if known
- Processing day: number processed, live weight, dressed weight, yield %
- Cost per lb of meat produced (feed + chick cost ÷ dressed lbs)

### 8. Multi-Animal / Multi-Flock Support
- Dairy animals: cows, goats, sheep — individual dashboards
- Layer flocks: grouped by pen/breed/age cohort
- Meat bird batches: grouped by intake date and breed
- Unified "Today" view across all species

---

## Input Methods

### Mobile App (Primary)
Native iOS and Android app. Quick-log a session in under 30 seconds on the way out of the barn.

### SMS / Text Logging
Text a number like:
```
3.2 gal AM 3lb grain
```
The system parses natural language entries and logs them automatically. Ideal when your hands are dirty and you just need to capture the number fast.

### Web Dashboard
Full desktop interface for reviewing trends, running correlations, editing records, and exporting data.

---

## Data Model (Core Entities)

```
Animal
  - id
  - name
  - breed
  - dob
  - fresheningDate         ← determines DIM (dairy only)
  - species (cow/goat/sheep)

Flock  ← layer hens, grouped by pen/breed/cohort
  - id
  - name (e.g. "Barn Layers", "Rhode Island Reds")
  - breed
  - henCount               ← active laying hens
  - hatchDate / intakeDate
  - status (active/molting/retired)

MeatBird Batch
  - id
  - breed (Cornish Cross, etc.)
  - chickIntakeDate
  - chickCount
  - chickCostTotal
  - source
  - processingDate
  - status (active/processed)

MilkingSession
  - animalId
  - timestamp
  - sessionType (AM/PM/single)
  - yieldLbs
  - notes
  - healthTags[]

EggCollection
  - flockId
  - collectionDate
  - eggCount
  - brokenCount
  - softShellCount
  - notes

MeatBirdWeightSample
  - batchId
  - sampleDate
  - dayOfBatch             ← calculated from intakeDate
  - birdsSampled
  - avgWeightLbs

MeatBirdMortality
  - batchId
  - date
  - count
  - cause                  ← free text

MeatBirdProcessing  ← final harvest record
  - batchId
  - processingDate
  - birdsProcessed
  - avgLiveWeightLbs
  - avgDressedWeightLbs
  - yieldPct               ← dressed / live
  - notes

FeedEntry
  - animalId OR flockId OR batchId  ← polymorphic
  - timestamp
  - feedType (hay/grain/mineral/pasture/layer-pellet/chick-starter/grower/finisher)
  - amount
  - unit
  - costPerUnit

ProcessingEntry (dairy)
  - date
  - inputGallons
  - outputType (cream/butter/cheese/fresh/colostrum)
  - outputAmount
  - outputUnit

WeatherLog (auto-fetched)
  - date
  - location (zip)
  - highTempF
  - humidity
```

---

## Tech Stack (Recommended)

| Layer | Technology | Rationale |
|---|---|---|
| Mobile | React Native / Expo | iOS + Android + Web from one codebase |
| Web | Next.js (via Expo Web or standalone) | Shared component logic |
| Backend | Supabase | Real-time DB, auth, REST API, storage |
| SMS Parsing | Twilio + Claude API | Natural language log parsing |
| Charts | Recharts | Correlation visualizations |
| Weather | Open-Meteo API | Free, no key required for basic use |
| Auth | Supabase Auth | Email/password + magic link |

---

## SMS Parsing Flow

```
User texts → Twilio receives → webhook fires → 
Claude API parses natural language → 
structured JSON extracted → 
Supabase record created → 
confirmation text sent back to user
```

Example inputs the parser should handle:
- `"3.2 gal AM 3lb grain"` → dairy yield: 3.2 gal, session: AM, feed: 3 lb grain
- `"nan gave 2.8 this morning, gave her extra hay"` → yield: 2.8, session: AM, note: extra hay
- `"evening milk 1.5 gallons, mastitis check"` → yield: 1.5, session: PM, tag: mastitis-concern
- `"layers 18 eggs today"` → egg log: 18 eggs, flock: layers
- `"11 eggs 2 soft shell"` → egg log: 11 eggs, flags: 2 soft shell
- `"meat birds day 35, pulled 3 birds avg 5.2 lbs"` → batch weight check: day 35, sample 3 birds, avg 5.2 lbs
- `"lost 2 meat birds today, looks like pasty butt"` → mortality log: 2 birds, cause: pasty butt

---

## Dashboard Views

**Dairy**
1. **Today** — Quick log button, last session, daily total, streak
2. **Trends** — 7/30/90-day production chart with feed overlay
3. **Correlation** — Feed amount vs. next-session yield scatter plot
4. **Lactation** — DIM tracker, actual vs. expected curve, projected dry-off
5. **Economics** — Cost per gallon, feed cost over time, ROI by feed type
6. **Processing** — What went where, inventory of processed products

**Chickens**
7. **Egg Log** — Daily count entry, 30-day trend, lay rate %, cost per dozen
8. **Meat Bird Batch** — Active batch status, day of growth, weight trend, mortality count, projected processing date, cost per lb tracker
9. **Flock Health** — Soft shell flags, production drop alerts, molt status

**Cross-Species**
10. **Animal Profile** — Full history, health tags, notes, export for any animal/flock/batch

---

## Billing & Subscription Tiers

Haymow uses a freemium model. The free tier is a full-featured experience for a single animal type — enough for a new homesteader to get real value and become a habitual user before hitting a paywall.

| Tier | Price | What's Included |
|---|---|---|
| **Free** | $0 | 1 animal type (dairy OR layers OR meat birds), full feature access for that type, 90-day history |
| **Homestead** | $2.99/mo | 2–3 animal types, full features across all active types, 1-year history, data export |
| **Full Farm** | $7.99/mo | Unlimited animal types and flocks/batches, full history, advanced correlations |

### Tier Design Principles

- **Animal type, not animal count** — the free tier is limited by species category (dairy vs. layers vs. meat birds), not the number of individual animals within that type. A user with 2 dairy cows is still on the free tier if dairy is their only type. This feels fair and is easy to understand.
- **No feature degradation on free** — free users get the full experience for their one type. No crippled charts, no missing SMS, no "upgrade to see your data." The limit is breadth, not depth.
- **Graceful upgrade prompts** — when a free user tries to add a second animal type, show a single clear upsell screen. Don't nag. Don't gate mid-workflow.
- **Grandfathering** — early adopters (first 500 users) get Homestead tier free for life as a founding member perk.

### What "Animal Type" Means in Practice

```
Free tier examples:
  ✓ 1 Jersey cow + 1 Dexter cow     → both dairy → still Free
  ✓ 3 layer flocks                  → all layers → still Free
  ✗ 1 dairy cow + 1 layer flock     → 2 types → needs Homestead

Homestead tier examples:
  ✓ Dairy + Layers                  → 2 types → Homestead
  ✓ Dairy + Meat birds              → 2 types → Homestead
  ✓ Layers + Meat birds             → 2 types → Homestead
  ✓ Dairy + Layers + Meat birds     → 3 types → Homestead

Full Farm:
  → Reserved for future expansion (goats, sheep as separate type, aquaculture, etc.)
  → Or users who want unlimited historical data and export
```

---

## Out of Scope (v1)

- IoT sensor integration
- Automated milking equipment sync
- Veterinary records (health notes only, not clinical records)
- Breeding / reproductive cycle tracking
- Multi-farm / multi-user enterprise features
- Milk or egg sales / commercial invoicing
- Goats and sheep as distinct animal types (v1 dairy = cows only; expand later)

These are candidates for future versions based on user demand.

---

## Brand & Visual Identity

**Name:** Haymow
**Tagline:** Track what your farm produces.
**Domain:** haymow.app (secure immediately) / haymow.com

### Visual Direction
Natural and fresh meets rugged and utilitarian. The palette feels like the land — sage, linen, soft gold. The interface feels like a tool — high contrast, no decoration for decoration's sake. Think Carhartt x farmers market.

| Element | Direction |
|---|---|
| Primary palette | Sage green, linen/cream, soft gold, deep charcoal |
| Accent | Rust/terracotta for alerts and highlights |
| Typography | Clean, high-contrast, slightly condensed — readable with one glance |
| UI feel | Rugged and utilitarian — large tap targets, minimal chrome, built for dirty hands |
| Default mode | Light mode primary, dark mode available |
| Icon | TBD — Fortune Hollow logo asset to be adapted by designer |

### Voice & Tone
- Direct, no filler. Homesteaders don't have time for marketing copy in their UI.
- Warm but not precious. This is a working farm app, not a lifestyle brand.
- Uses real farm language: "session," "yield," "freshening," "batch" — not sanitized corporate terms.
- Celebrates the work. Every log entry is an acknowledgment that someone showed up at 5am and did the thing.

---

## Market Context

Existing tools and why they don't serve this user:

| Tool | Target | Gap |
|---|---|---|
| DairyComp (VAS) | Commercial herds 50+ cows | Enterprise software, herd-level only |
| MilkingCloud | Mid-large dairy + IoT hardware | Requires farm hardware integration |
| Cattlytics Dairy | Dairy herd managers | Multi-cow herd focus, complex setup |
| FarmKeep | Beef + dairy cattle operations | General-purpose, no feed correlation |
| Navfarm | Dairy ERP | Full business management system |

**The gap:** No tool is built for the homesteader who wants feed-to-yield insight across both dairy and poultry, with the ability to log from a text message while their hands are full.

---

## Project Status

🟢 In development — scaffold complete, core logging features working.

**Completed:**
- Product definition and feature scope
- Architecture decisions (all locked — see CLAUDE.md)
- Database schema + migrations (Supabase)
- Brand, design tokens, and visual identity
- App name (Haymow — trademark pending)
- Expo scaffold (React Native + Expo Router, iOS/Android/Web)
- Google Sign In authentication
- Onboarding flow (pick animal type → set up first animal → ready)
- Today screen (dairy card + egg card, daily totals, AM/PM status)
- Log milking session (yield, session type, multi-feed, health tags, notes)
- Log egg collection (count, broken/soft shell, feed)
- Animals screen (list by type, animal profile, flock profile, add animal)
- Settings screen (account, preferences, sign out)
- Feed inventory system (stock tracking, restock, cost-per-unit, usage deduction)
- Trends screen (7/30/90-day yield chart with grain feed overlay)

**In progress / next up:**
- Lactation curve view
- Feed-to-yield correlation
- Egg trends / cost per dozen
- Meat bird batch profile
- Milk processing log
- Farm economics dashboard

**Deferred to v2:**
- Stripe billing integration (all users on free tier for now)
- SMS logging via Twilio + Claude API
- Apple Developer / Google Play store submissions
- Domain (haymow.app)

---

## Testing on iPhone (from Codespaces)

Expo Go on iPhone + ngrok tunnel from Codespaces. One-time setup, then just steps 2–5 each session.

### One-time setup
1. Install **Expo Go** from the App Store
2. Create a free account at **ngrok.com** and copy your authtoken
3. In the Codespaces terminal, save your token:
   ```
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```
4. Install the ngrok npm package globally:
   ```
   npm install -g ngrok
   ```

### Each dev session
1. In one terminal, start the ngrok tunnel first:
   ```
   ngrok http 8081 --log=stdout
   ```
2. Find the tunnel URL in the ngrok output — it looks like:
   ```
   url=https://abc123.ngrok-free.dev
   ```
3. In a second terminal, start Expo with the ngrok hostname (replace with your actual subdomain):
   ```
   REACT_NATIVE_PACKAGER_HOSTNAME=abc123.ngrok-free.dev npx expo start
   ```
4. Text yourself this link (replace with your actual ngrok URL):
   ```
   exp://abc123.ngrok-free.dev
   ```
5. Tap the link on your iPhone — it opens directly in Expo Go and loads the app

### Notes
- First load after starting the server takes 30–60 seconds (building the JS bundle)
- After that, changes you save in Codespaces appear on your phone within a couple seconds
- The ngrok URL changes every session — generate a new one each time and text it to yourself
- The tunnel must stay running while you're testing — don't close that terminal

---

## Author

Pete — Fortune Hollow Farm, Lampasas County, Texas
