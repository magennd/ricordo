# User Actions & Setup Guide

Welcome to **Ricordo**! This file contains the straightforward, non-technical steps for you to take whenever you are ready.

---

## Current Status: Local Development Mode Ready
You can run and test Ricordo completely on your computer without setting up any cloud databases yet. All flashcards, decks, and reviews are saved directly in your browser's local database (IndexedDB).

### How to Start the App Locally (Fedora Linux):
Run this in your terminal:
```bash
npm run dev
```
Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Action Checklist

### 1. (Optional) Set up Free Turso Database for Cloud Sync
*Complete this whenever you want your cards to sync seamlessly between your Linux desktop and your iPhone.*

1. **Install Turso CLI on Fedora:**
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
2. **Log in / Sign up to Turso (Free Tier):**
   ```bash
   turso auth signup
   ```
   *(or `turso auth login` if you already have an account)*
3. **Create your Ricordo database:**
   ```bash
   turso db create ricordo-db
   ```
4. **Get your Database URL:**
   ```bash
   turso db show ricordo-db --url
   ```
   *(Save this URL, e.g., `libsql://ricordo-db-[username].turso.io`)*
5. **Create an Auth Token:**
   ```bash
   turso db tokens create ricordo-db
   ```
   *(Save this long secret token)*
6. **Enter credentials into Ricordo:**
   - In Ricordo, navigate to **Settings** -> **Cloud Sync & Vault Setup**.
   - Paste your URL and Token, set a username and master password.
   - Click **Save & Encrypt**. Ricordo will encrypt your credentials with your password using browser cryptography (PBKDF2 + AES-GCM) so it stays 100% secure!

---

### 2. (Optional) Deploy Free to GitHub Pages
*When you want to install Ricordo as a PWA on your iPhone Safari Home Screen:*

1. **Create a new repository on GitHub:**
   - Go to [https://github.com/new](https://github.com/new)
   - Name it `ricordo` (Public or Private)
   - Leave "Add a README" unchecked, then click **Create repository**.
2. **Push your code from terminal:**
   ```bash
   git add .
   git commit -m "Initial commit of Ricordo SRS PWA"
   git remote add origin git@github.com:YOUR_GITHUB_USERNAME/ricordo.git
   git push -u origin main
   ```
3. **Turn on GitHub Pages:**
   - On GitHub, go to your repository's **Settings** -> **Pages**.
   - Under **Build and deployment > Source**, select **GitHub Actions**.
   - The automated GitHub Actions workflow will build and publish your app automatically.

