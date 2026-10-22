# Ricordo User Guide

Welcome to **Ricordo**, an offline-first Spaced Repetition (SRS) language learning application built with the modern Free Spaced Repetition Scheduler (FSRS).

This guide walks you through daily operations, deck management, studying, card assignments, and cross-device synchronization.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Adding & Editing Vocabulary](#2-adding--editing-vocabulary)
3. [Deck Management & Card Assignments](#3-deck-management--card-assignments)
   - [Switching to Tabular Manage Mode](#switching-to-tabular-manage-mode)
   - [Finding Unassigned Cards ("Not in a Deck")](#finding-unassigned-cards-not-in-a-deck)
   - [Moving Cards to a Deck](#moving-cards-to-a-deck)
   - [Removing Cards from a Deck](#removing-cards-from-a-deck)
   - [Copying Cards Across Decks](#copying-cards-across-decks)
   - [Batch / Multi-Select Management](#batch--multi-select-management)
4. [Studying & Flashcard Modes](#4-studying--flashcard-modes)
   - [FSRS Ratings & Scheduling](#fsrs-ratings--scheduling)
   - [Keyboard Shortcuts](#keyboard-shortcuts)
   - [Sibling Card Burying](#sibling-card-burying)
   - [Ephemeral Active Recall Prompt](#ephemeral-active-recall-prompt)
5. [Revise All Mode (Random Practice)](#5-revise-all-mode-random-practice)
6. [Dictionary Triage Queue](#6-dictionary-triage-queue)
7. [CSV Bulk Import](#7-csv-bulk-import)
8. [Cross-Device Cloud Sync (Turso Vault)](#8-cross-device-cloud-sync-turso-vault)
9. [Leech Management & Suspending Cards](#9-leech-management--suspending-cards)

---

## 1. Core Concepts

### Notes vs. Cards
In Ricordo, there is a clear separation between **Notes** and **Cards**:
- **Note (Vocabulary Entry):** Contains the source dictionary data—the headword, definition, part of speech, collocation/particle, grammar notes, tags, and example sentences.
- **Cards (Study Flashcards):** Generated automatically from each note. When you edit or reassign a note to a deck, all of its generated flashcards update automatically.

### 3 Flashcard Types Generated Per Word
1. **Recognition:** Shows the target headword and collocation. Flip to reveal definition, part of speech, and notes.
2. **Production:** Shows the native definition and grammar hint. Flip to recall and test target headword.
3. **Dynamic Cloze:** Blanks out the target word within an authentic sentence with micro-prompts (e.g., `[ ... (2nd pers. sing.) ]`).

---

## 2. Adding & Editing Vocabulary

### Adding a Word
1. Click **Add Word** in the navigation header or inside any deck.
2. Fill in:
   - **Target Deck:** Choose which deck this word belongs to (or leave unassigned).
   - **Headword (Target Language):** e.g., `ricordare`.
   - **Definition (Native Meaning):** e.g., `to remember, to recall`.
   - **Part of Speech:** (optional) e.g., `verb`.
   - **Collocation / Particle Slot:** (optional) e.g., `ricordarsi di + inf.`
   - **Grammar Notes:** (optional) e.g., `Regular -are verb. Takes essere in pronominal form.`
   - **Tags:** (optional, comma-separated) e.g., `verbs, b1, memory`.
3. Add **Example Sentences**:
   - **Target Sentence:** `Ti ricordi di chiudere la finestra?`
   - **English Translation:** `Do you remember to close the window?`
   - **Cloze Word:** `ricordi` (word to blank out).
   - **Grammar Micro-Prompt:** `present tense, 2nd pers. sing.`
4. Click **Create Vocabulary Note**. Recognition, Production, and Cloze cards are generated automatically.

### Editing a Word
- In **Cards & Notes**, click the **Pencil (Edit)** icon on any card or row.
- Updating the note immediately updates all attached cards.

---

## 3. Deck Management & Card Assignments

Ricordo gives you complete control over moving, copying, removing, and batch-managing cards to and from decks.

### Switching to Tabular Manage Mode
1. In the sidebar or bottom navigation, go to **Cards & Notes**.
2. In the top right header, click **Manage Decks** (table icon).
3. The layout switches from the card browser to a high-density **Tabular Management Table**.
4. Click **Card View** anytime to switch back to the card browser.

### Finding Unassigned Cards ("Not in a Deck")
If you have cards or imported notes that are not currently assigned to any study deck:
1. Open the **Deck Filter** dropdown at the top of **Cards & Notes**.
2. Select **`⚠️ Unassigned / No Deck`**.
3. The count of unassigned items is displayed directly in the dropdown and on the **Manage Decks** badge.
4. Only unassigned cards will be displayed, allowing you to easily assign or organize them.

### Moving Cards to a Deck
- **Individual assignment:**
  In the table view, locate the **Deck Assignment** dropdown in the row. Select the desired destination deck. The note and all its cards are moved immediately.
- **In Card View:**
  Each vocabulary card displays an inline deck dropdown so you can reassign it without opening the manage table.

### Removing Cards from a Deck
- **Individual removal:**
  Click the **Folder Minus (`-`)** icon in the row's action column. The entry is unassigned (`No Deck`) and will no longer appear in daily deck study until assigned again.
- Alternatively, select **`— No Deck (Unassigned) —`** from the row's deck dropdown.

### Copying Cards Across Decks
Want the same vocabulary word in multiple decks (e.g., both "Italian Essentials" and "Travel Vocab")?
1. Click the **Copy** icon in the row's actions.
2. Select the **Destination Deck**.
3. Click **Copy Word**.
4. A clean duplicate with fresh flashcards and example sentences is created in the destination deck without affecting your original word.

### Batch / Multi-Select Management
You can manage dozens or hundreds of cards at once:
1. In **Manage Decks** mode, check the box next to any rows you want to manage.
   - Use the **Table Header Checkbox** to select or deselect all currently filtered words with one click.
2. A floating **Bulk Management Toolbar** will appear at the bottom of the screen showing the number of selected items:
   - **Move to Deck:** Select a deck from the dropdown to batch-move all selected cards.
   - **Copy to Deck:** Click **Copy to Deck** to duplicate all selected words into another deck.
   - **Remove from Deck:** Click **Remove from Deck** to unassign all selected items.
   - **Delete:** Permanently delete all selected notes and cards.
   - **Clear Selection:** Resets selected checkboxes.

All changes are saved to local IndexedDB and queued for cloud synchronization across your devices.

---

## 4. Studying & Flashcard Modes

### Starting a Study Session
1. Navigate to **Decks**.
2. Click **Study Deck** on any deck with due reviews or new cards.
3. Flashcards present the prompt on the front. Tap the card or press `Space`/`Enter` to reveal the back.

### FSRS Ratings & Scheduling
Ricordo uses **FSRS** (Free Spaced Repetition Scheduler) with 4 rating buttons:
- **1 — Again (Coral):** You forgot the word. Relearning interval is scheduled (e.g., 10 minutes).
- **2 — Hard (Sand):** Recalled with significant effort. Interval increases moderately.
- **3 — Good (Leaf Green):** Normal successful recall. Standard interval progression.
- **4 — Easy (Alabaster):** Effortless recall. Long interval progression.

Each button displays the exact predicted interval (e.g., `10m`, `1d`, `4d`, `12d`).

### Keyboard Shortcuts
| Key | Action |
| :--- | :--- |
| `Space` / `Enter` | Flip card / Show answer |
| `1` | Rate **Again** |
| `2` | Rate **Hard** |
| `3` | Rate **Good** |
| `4` | Rate **Easy** |
| `Z` or `U` | **Undo** last rating |

### Sibling Card Burying
If a word has Recognition, Production, and Cloze cards, reviewing one card automatically **buries sibling cards until tomorrow**. This prevents you from encountering the same word twice in the same day and tests true long-term memory.

### Ephemeral Active Recall Prompt
Want extra friction before rating?
- Click **"Type original sentence before rating?"** below the card.
- A quick text input appears for you to construct an original sentence using the target word.
- This friction is completely ephemeral (not saved to database) and helps build active recall capability.

---

## 5. Revise All Mode (Random Practice)

When you have finished your scheduled cards for the day but want extra practice:
1. Go to **Decks**.
2. In the top action bar, click **Revise All** (with the shuffle icon).
3. A modal opens displaying the total number of cards you have already learned.
4. Choose your revision batch size:
   - **10 Cards**
   - **20 Cards**
   - **50 Cards**
   - **All Seen Cards**
5. Click **Start Revision**.
6. Random cards you have already studied across all active decks are shuffled and presented.
7. Upon completing the batch, click **Revise Another Batch** or return to decks.

---

## 6. Dictionary Triage Queue

Ricordo includes a dedicated **Dictionary Triage** deck:
- When you bookmark repeated lookups from your dictionary or import unvetted words, they wait in the Triage queue.
- Navigate to **Dictionary Triage** in the sidebar.
- Inspect the word, tweak definitions, and click **Approve Word** to move it into an active study deck with one click.

---

## 7. CSV Bulk Import

1. Navigate to **Import CSV**.
2. Select your destination deck.
3. Upload any standard `.csv` file (or download our blank/sample templates).
4. Map the columns (Headword, Definition, Part of Speech, Examples, Cloze Word, etc.).
5. Check **Skip duplicate headwords** to prevent duplicate entries.
6. Click **Import Vocabulary**. All notes and corresponding cards are generated automatically.

---

## 8. Cross-Device Cloud Sync (Turso Vault)

Ricordo uses a zero-backend Web Crypto encryption vault that syncs with a free serverless **Turso** SQLite database.

### Setting Up Sync
1. In the sidebar, click **Sign In to Cloud** (or **Settings** $\rightarrow$ **Cloud & Vault**).
2. Enter your Turso Database URL (`libsql://...`) and Auth Token.
3. Enter your **Username** and create a **Master Password**.
4. Click **Encrypt & Connect Database**.

### Cross-Device Sync Behavior
- **Encrypted in Memory:** Your database credentials are encrypted with AES-GCM 256-bit using your master password.
- **Decks & Cards Sync:** All decks, notes, cards, and review logs sync bidirectionally.
- **Tombstone Deletion Protection:** If you delete a deck or card on one device, a deletion tombstone ensures it is cleanly removed from all connected devices on next sync without data conflicts.
- **Offline Resilient:** You can study offline anytime. When internet access resumes or the app comes to foreground, changes sync automatically.

### Installing as a Mobile App (iOS / Android)
- **iPhone (Safari):** Open the app in Safari $\rightarrow$ tap **Share** $\rightarrow$ tap **Add to Home Screen**.
- **Android (Chrome):** Tap menu (three dots) $\rightarrow$ **Install App** / **Add to Home Screen**.
- Launch from your home screen for a full-screen, native-feeling PWA experience.

---

## 9. Leech Management & Suspending Cards

- **Leech Detection:** Cards that fail 4 or more times (`lapses >= 4`) are automatically flagged with a **Leech** warning badge.
- **Viewing Leeches:** In the navigation, open **Leech Cards** to inspect problematic words.
- **Suspending:** Click the **Pause** icon on any flashcard in **Cards & Notes** or the Leech view to suspend it from daily study without deleting the underlying note. Click the **Play** icon anytime to unsuspend.

---

*Happy learning with Ricordo!*
