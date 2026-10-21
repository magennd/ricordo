# User Actions & Setup Guide

Welcome to **Ricordo**! This file contains the straightforward, non-technical steps for you to take whenever you are ready.

---

## Deploy to GitHub Pages (Access on iPhone / Mobile)

Everything in the codebase is fully built, committed, and configured with automated GitHub Actions deployment.

Follow these 3 simple steps to access Ricordo on your mobile phone:

### Step 1: Create a Repository on GitHub
1. Open [https://github.com/new](https://github.com/new) in your browser.
2. Under **Repository name**, type: `ricordo`
3. Choose either **Public** or **Private** (both work with GitHub Pages).
4. **Leave "Add a README" UNCHECKED** (your project already has files).
5. Click the green **Create repository** button.

---

### Step 2: Push Your Code (Run in your Fedora Terminal)
Copy and paste this into your terminal:

```bash
git remote add origin https://github.com/danmagennis/ricordo.git
git push -u origin main
```
*(If prompted for your GitHub password, enter your GitHub Personal Access Token or credentials).*

> **Note:** If your GitHub username is different from `danmagennis`, replace it in the URL above.

---

### Step 3: Enable GitHub Pages & Open on Mobile
1. On GitHub, go to your repository's **Settings** tab.
2. In the left sidebar, click **Pages** (under the "Code and automation" section).
3. Under **Build and deployment > Source**, click the dropdown and choose **GitHub Actions**.
4. GitHub Actions will automatically build and publish your app within ~60 seconds.
5. Your live app URL will appear at the top of that page:
   `https://danmagennis.github.io/ricordo/`

---

### Step 4: Install as an App on iPhone (Safari)
1. Open your GitHub Pages URL in **Safari** on your iPhone.
2. Tap the **Share** button (the square with an arrow pointing up at the bottom).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. Ricordo will appear on your iPhone home screen with the app icon and run full-screen without Safari browser bars!

---

## (Optional) Set up Free Turso Database for Cloud Sync
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
   - In Ricordo, navigate to **Settings** -> **Cloud & Vault**.
   - Paste your URL and Token, set a username and master password.
   - Click **Encrypt & Save Vault**. Your credentials are encrypted in memory using PBKDF2 + AES-GCM and will sync whenever online.
