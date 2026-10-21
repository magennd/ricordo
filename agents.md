# AGENTS.md — Personal Language SRS & Flashcard PWA (GitHub Pages + Turso)

## 1. CRITICAL RULES FOR INTERACTING WITH THE USER
- **Non-Coder Persona:** The user is the product designer and owner, NOT a software developer. 
- **Plain English Only:** Never ask the user technical or architectural questions (e.g., do not ask about bundler configs, state management libraries, SQL indexing strategies, or TypeScript interfaces). Make sensible, battle-tested technical decisions autonomously.
- **Human-Comprehensible Questions:** Only pause to ask the user questions about:
  1. Visual feel, layout preferences, and how they want the app to behave during study sessions.
  2. Creating their free Turso database or pushing to GitHub when needed—and when you do, provide exact, copy-paste terminal instructions for Fedora Linux.
- **Do the Heavy Lifting:** Run all terminal commands, install dependencies, write migrations, and verify builds yourself. After every milestone, explain what you just built in 2–3 plain sentences and tell the user exactly how to click around and test it in their browser.
- **Keep It Concise:** Avoid effusive praise or filler text. Be direct, practical, and highlight good or bad design trade-offs candidly.

---

## 2. PROJECT OVERVIEW & GOALS
Build a **100% free-tier Progressive Web App (PWA)** hosted on **GitHub Pages** for language learning via Spaced Repetition (SRS), designed to run seamlessly on **Linux desktop** and **iPhone (iOS Safari Home Screen PWA)**.

### Core Capabilities
1. **Deck & Note Architecture:** Separate "Notes" (source vocabulary data) from "Cards" (scheduled review items) so editing a word updates all associated cards automatically.
2. **Modern Scheduling (FSRS):** Use the `ts-fsrs` library (Free Spaced Repetition Scheduler) instead of legacy SM-2.
3. **Language-Specific Study Modes:**
   - **Recognition Card:** Target language word + example sentence on front -> Definition & grammar notes on back.
   - **Production Card:** Native definition + grammatical hint on front -> Target language word on back.
   - **Dynamic Cloze Card:** Randomly picks one stored example sentence for the note, blanks out the target word, and shows grammatical micro-prompts inside brackets (e.g., `[verb | past tense, 3rd person plural]`).
   - **Collocation / Particle Slot:** Dedicated field for prepositions or pronominal particles paired with verbs.
   - **Sibling Burying:** If a Note generates multiple Cards (Recognition, Production, Cloze), never schedule more than one sibling on the same day. Automatically bury siblings until the next day.
   - **Force Sentence Creation (Ephemeral Prompt):** An optional checkbox/input during review that prompts the user to type a quick 5-word original sentence before passing the card (not saved to DB, used purely for active recall friction).
4. **Safety & Quality-of-Life Features:**
   - Daily "New Card" cap per deck (separate from "Due" reviews) to prevent review avalanches after large CSV imports.
   - **Undo Last Review:** One-tap button to revert an accidental card rating on mobile.
   - **Leech Detection:** Automatically flag cards that fail ("Again") more than 4 times so the user can edit or suspend them.
5. **CSV Import & Dictionary App Integration:**
   - In-app CSV uploader with column mapping and duplicate headword detection.
   - **Shared Turso Staging Table:** Because both this SRS app and the user's future Dictionary App will connect to the same Turso database, include a dedicated "Triage / Staging Deck" where bookmarked dictionary words (or words looked up twice within 14 days) appear automatically for one-click approval into active study decks.

---

## 3. TECH STACK (100% FREE — GITHUB PAGES + TURSO)
- **Frontend & Hosting:** Vite + Preact (or React) + TypeScript + Tailwind CSS + `vite-plugin-pwa`, configured for static deployment to **GitHub Pages** via GitHub Actions.
- **Database:** **Turso** (Serverless libSQL / SQLite) accessed over HTTPS directly from the client using `@libsql/client/web`.
- **Offline Storage & Sync:** `Dexie.js` (IndexedDB wrapper). Because iOS Safari lacks reliable Web Background Sync, the app MUST function local-first:
  - Cache decks, notes, cards, and review logs locally in IndexedDB so card flips and reviews happen with zero network latency (even offline).
  - Queue local changes and sync bidirectionally with Turso whenever `navigator.onLine` is true or on `visibilitychange` when the app returns to the foreground.
- **Zero-Backend Password Authentication (Web Crypto Vault):**
  - Because GitHub Pages is static and public, NEVER commit plain-text Turso credentials into the repository.
  - Build a clean **Web Crypto API (`PBKDF2` + `AES-GCM`) Vault** mechanism:
    1. Provide a simple helper utility that takes the user's `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, desired `Username`, and `Master Password`, and encrypts the Turso credentials into a static `vault.json` payload shipped with the app.
    2. When the user visits the app and logs in with their **Username and Password**, the browser derives the decryption key in memory, unlocks the Turso credentials, and caches the unlocked session in `localStorage` for 30 days on that trusted device.
    3. Without the correct username and password, the encrypted vault cannot be decrypted by anyone inspecting the GitHub repo or visiting the URL.

---

## 4. VISUAL DESIGN, COLOUR PALETTE & TYPOGRAPHY
- **Aesthetic:** Minimalist, calm, zero-clutter interface with generous whitespace and subtle borders.
- **Typography (Fontshare CDN + Offline Service Worker Caching):**
  - Load **Excon** and **Ranade** from Fontshare in `index.html`:
    `<link href="https://api.fontshare.com/v2/css?f[]=excon@500,700&f[]=ranade@300,400,400i,500,500i,700&display=swap" rel="stylesheet">`
  - Configure `vite-plugin-pwa` (Workbox runtime caching) to cache `https://api.fontshare.com/*` and `https://cdn.fontshare.com/*` with a `CacheFirst` strategy so both fonts render properly when studying offline on iPhone.
  - **Heading Font (`font-display: 'Excon', sans-serif`):** Use for page titles, deck headers, navigation branding, and isolated flashcard headwords (`Medium 500` and `Bold 700`). *Note: Excon has no italic style—never apply `italic` to Excon.*
  - **Body & UI Font (`font-sans: 'Ranade', sans-serif`):** Use for all example sentences, definitions, cloze prompts, buttons, badges, and any italicized grammar notes (`Light 300`, `Regular 400`, `Italic 400i`, `Medium 500`). Use `font-variant-numeric: tabular-nums` on all counters.
- **Colour Palette (Strict Adherence):**
  - **Deep Forest Green:** `#012615`
  - **Leaf Green:** `#65A603`
  - **Warm Alabaster / Off-White:** `#F6EFEB`
  - **Terracotta Coral:** `#E4774F`
- **Theme Modes (Light & Dark Toggle):**
  - **Light Mode:** Main background `#F6EFEB`, primary text `#012615`, left desktop sidebar `#012615` (with `#F6EFEB` text), card surfaces pure white `#FFFFFF` with subtle `#012615/10` borders.
  - **Dark Mode (Default on Mobile Review):** Main background `#012615`, elevated card surface `#F6EFEB` (high-contrast card face with `#012615` text) or `#06351F` for secondary panels, primary UI text `#F6EFEB`.
  - **Semantic Action Colours (FSRS Buttons & Badges):**
    - **Again / Overdue / Leech Alert:** `#E4774F` (Terracotta Coral)
    - **Hard:** Warm muted sand (`#D9C5B8` fill with `#012615` text)
    - **Good / Due Met / Active Progress:** `#65A603` (Leaf Green)
    - **Easy:** Crisp `#F6EFEB` button with `#012615` text
- **Responsive Layout:**
  - **Desktop (Linux):** Persistent left sidebar (`#012615`) for Navigation (Decks, Cards, Staging Deck badge, Import CSV, Settings, Dark Mode toggle) + clean multi-column Deck Grid and "Recently Added" list on the right.
  - **Mobile (iPhone PWA):** Distraction-free full-screen review mode with segmented progress bar at top, centered high-contrast flashcard, collapsible/checkbox "Create original sentence" input box, thumb-friendly 4-button FSRS rating row at bottom, and a subtle `Undo` button below.

---

## 5. DATABASE SCHEMA (Turso / SQLite)
Create and manage these tables automatically via a setup/migration script:

```sql
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  new_cards_per_day INTEGER DEFAULT 15,
  is_staging INTEGER DEFAULT 0, -- 1 for the Dictionary Triage Deck
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  headword TEXT NOT NULL,
  lemma TEXT,
  part_of_speech TEXT,
  collocation_or_particle TEXT, -- e.g., governed prepositions or pronominal forms
  definition TEXT NOT NULL,
  grammar_notes TEXT,
  tags TEXT, -- JSON array of strings
  lookup_count INTEGER DEFAULT 1,
  last_lookup_at TEXT,
  source_dictionary_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS examples (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  sentence_target TEXT NOT NULL,
  sentence_native TEXT,
  cloze_target_word TEXT NOT NULL, -- exact substring to blank out
  cloze_grammar_hint TEXT -- e.g., "past participle, plural"
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK(card_type IN ('recognition', 'production', 'cloze')),
  due_date TEXT NOT NULL,
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  elapsed_days INTEGER DEFAULT 0,
  scheduled_days INTEGER DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  state INTEGER DEFAULT 0, -- 0: New, 1: Learning, 2: Review, 3: Relearning
  last_review TEXT,
  buried_until TEXT, -- ISO date string for sibling burying
  is_leech INTEGER DEFAULT 0,
  is_suspended INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL, -- 1: Again, 2: Hard, 3: Good, 4: Easy
  state_before INTEGER NOT NULL,
  stability_before REAL,
  difficulty_before REAL,
  elapsed_days INTEGER,
  scheduled_days INTEGER,
  reviewed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(deck_id, due_date, is_suspended, buried_until);
CREATE INDEX IF NOT EXISTS idx_notes_headword ON notes(headword);