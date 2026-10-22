# Ricordo (Spaced Repetition SRS)

> A personal, 100% free-tier Progressive Web App (PWA) for language learning via Spaced Repetition (SRS), designed to run seamlessly on **Linux desktop** and **iPhone (iOS Safari Home Screen)**.
>
> *Totally vibe coded after annoyance at clunky flashcard tools and the steep \$25 price tag of Anki on iOS.*

[![Deploy to GitHub Pages](https://github.com/magennd/ricordo/actions/workflows/deploy.yml/badge.svg)](https://github.com/magennd/ricordo/actions/workflows/deploy.yml)
**Live Web App:** [https://magennd.github.io/ricordo/](https://magennd.github.io/ricordo/)  
📖 **User Guide:** [user-guide.md](user-guide.md)

---

## Highlights & Core Capabilities

- **Modern FSRS Scheduling:** Uses the modern `ts-fsrs` (Free Spaced Repetition Scheduler) algorithm instead of legacy SM-2 for optimal memory retention.
- **Note & Card Separation:** Separate "Notes" (source vocabulary words) from "Cards" (scheduled review items) so editing a word updates all cards automatically.
- **3 Targeted Study Modes:**
  1. **Recognition:** Target language headword + collocation + example sentence on front $\rightarrow$ native definition and grammar notes on back.
  2. **Production:** Native definition + grammatical hint on front $\rightarrow$ target language headword on back.
  3. **Dynamic Cloze:** Blanks out the target word inside an example sentence with grammatical micro-prompts (e.g. `[ ... (past participle, plural) ]`).
- **Collocation & Particle Slot:** Dedicated field for paired prepositions and pronominal particles (e.g., `ricordarsi di`, `rendersi conto di`).
- **Sibling Burying:** If a note generates multiple card variations, sibling cards are automatically buried until tomorrow so you only review one mode per word per day.
- **Active Recall Prompt (Ephemeral):** Optional in-study button prompting you to type a quick original sentence before rating (purely for friction, not saved to DB).
- **Safety & Quality-of-Life:**
  - One-tap **Undo Last Review** (`Z` shortcut).
  - **Leech Detection:** Cards failing 4 or more times are automatically flagged for review or suspension.
  - Daily new card caps to prevent review avalanches.
- **CSV Importer & Templates:** In-app CSV uploader with auto-column mapping, duplicate headword detection, and downloadable blank & sample templates.
- **Dictionary Triage Queue:** Shared staging deck for bookmarked dictionary lookups ready for one-click approval into active study decks.
- **Offline-First & PWA:** Runs 100% offline via browser IndexedDB (`Dexie.js`) with cached Fontshare typography (**Excon** and **Ranade**).
- **Zero-Backend Cloud Vault:** Encrypts your Turso database credentials in memory using the Web Crypto API (`PBKDF2` + `AES-GCM`) with your master password, keeping your credentials completely private on public GitHub Pages.

---

## Visual Design & Typography

- **Heading Font:** **Excon** (`font-display`, Medium 500 & Bold 700) from Fontshare.
- **Body & Study Font:** **Ranade** (`font-sans`, Light 300, Regular 400, Italic 400i, Medium 500) from Fontshare.
- **Strict Color Palette:**
  - Deep Forest Green: `#012615`
  - Leaf Green: `#65A603`
  - Warm Alabaster: `#F6EFEB`
  - Terracotta Coral: `#E4774F`
  - Sand (Hard rating): `#D9C5B8`
  - Panel (Dark mode): `#06351F`

---

## Tech Stack

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS
- **PWA & Offline Service Worker:** `vite-plugin-pwa` with Workbox runtime caching
- **Local Storage:** `Dexie.js` (IndexedDB)
- **Spaced Repetition Engine:** `ts-fsrs`
- **Cloud Database:** Turso (Serverless SQLite / libSQL) over HTTPS via `@libsql/client/web`
- **Security:** Web Crypto API (`PBKDF2` key derivation, `AES-GCM` 256-bit encryption)
- **Hosting:** GitHub Pages via GitHub Actions

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ (tested on Node v22)
- npm 10+

### 1. Clone & Install
```bash
git clone https://github.com/magennd/ricordo.git
cd ricordo
npm install
```

### 2. Run Local Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The app runs completely offline-first with pre-seeded sample decks.

### 3. Build for Production
```bash
npm run build
```

---

## Setup: Cloud Sync with Turso (Cross-Device Sync)

Ricordo can sync seamlessly between your Linux desktop and your mobile phone using a free **Turso** SQLite database.

### 1. Install Turso CLI (Fedora Linux)
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

### 2. Sign Up & Create Database
```bash
# Log in or sign up
turso auth signup

# Create your database
turso db create ricordo-db

# Get your Database URL
turso db show ricordo-db --url
# Outputs: libsql://ricordo-db-[username].turso.io

# Create an Auth Token
turso db tokens create ricordo-db
```

### 3. Connect Ricordo to Turso
1. Open Ricordo in your browser.
2. In the sidebar, click **Sign In to Cloud** (or go to **Settings** -> **Cloud & Vault**).
3. Paste your **Turso Database URL** and **Auth Token**.
4. Choose a **Username** and **Master Password**.
5. Click **Encrypt & Connect Database**.
6. Ricordo will automatically create the database tables, encrypt your credentials with your password, and sync changes whenever your device is online.

---

## Setup: Install on iPhone (Safari PWA)

1. Open your live GitHub Pages URL in **Safari** on iOS:
   `https://magennd.github.io/ricordo/`
2. Tap the **Share** button (box with an upward arrow at the bottom).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.
5. Launch Ricordo from your home screen — it will run full-screen as a standalone native app with offline support.
6. Tap **Sign In** in the header and enter your Master Password to sync your cards.

---

## Keyboard Shortcuts (Study Mode)

| Key | Action |
| :--- | :--- |
| `Space` / `Enter` | Reveal answer (flip card) |
| `1` | Rate **Again** (Coral) |
| `2` | Rate **Hard** (Sand) |
| `3` | Rate **Good** (Leaf Green) |
| `4` | Rate **Easy** (Alabaster) |
| `Z` / `U` | **Undo** last card review |

---

## License

MIT License. Free and open source for personal language learning.

