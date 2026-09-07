# Boyne Cup 2026 — how this works

The whole app is **one file: `index.html`**. Open it in any browser and it runs.
Everything you'd ever change is in the block at the top of the file marked
`EDIT EVERYTHING IN THIS BLOCK`. Nothing below that needs touching.

---

## Part 1 — Try it right now (0 minutes)

Double-click `index.html`. It opens in your browser and works completely.
Scores you enter are saved on that one device only until Part 2 is done.
To wipe test scores before the trip: sign in as Commissioner → Trip tab → Commissioner panel
→ **Wipe every score** (type RESET). Or clear one round at a time.

To edit names, teams, tee times etc: right-click `index.html` → Open With →
TextEdit (Mac) or Notepad (Windows). Change the words between the quotes.
Save. Reload the browser. Don't delete commas or brackets.

---

## Part 2 — Make it live for everyone ✅ DONE 2026-09-07

Firebase project `boyne-cup` is connected. Steps kept for reference.

This gives every phone the same scores in real time. You need a Google account.

1. Go to **console.firebase.google.com** and sign in.
2. Click **Create a project** (or "Add project"). Name it `boyne-cup`.
   Turn OFF Google Analytics when asked. Click **Create project**, then **Continue**.
3. Left menu → **Build** → **Realtime Database** → **Create Database**.
   - Location: United States. Click Next.
   - Choose **Start in locked mode**. Click **Enable**.
4. Still in Realtime Database, click the **Rules** tab. Delete what's there and paste:
   ```
   {
     "rules": {
       "trips": {
         ".read": "auth != null",
         ".write": "auth != null"
       }
     }
   }
   ```
   Click **Publish**.
5. Left menu → **Build** → **Authentication** → **Get started** →
   **Sign-in method** tab → click **Anonymous** → toggle **Enable** → **Save**.
   (This is what "auth != null" above means: the app quietly gets a throwaway
   ID per phone. Nobody signs up for anything.)
6. Click the **gear icon** (top-left, next to "Project Overview") → **Project settings**.
   Scroll down to **Your apps** → click the **`</>`** (Web) icon.
   - App nickname: `boyne-cup`. Do NOT tick Firebase Hosting. Click **Register app**.
   - You'll see a block that looks like this:
     ```
     const firebaseConfig = {
       apiKey: "AIza....",
       authDomain: "boyne-cup-xxxxx.firebaseapp.com",
       databaseURL: "https://boyne-cup-xxxxx-default-rtdb.firebaseio.com",
       projectId: "boyne-cup-xxxxx",
       ...
     };
     ```
   - Copy everything from the `{` to the `}` (inclusive).
7. Open `index.html` in TextEdit/Notepad. Find the line that says
   `firebase: null,` (near the bottom of the EDIT block, section 9).
   Replace the word `null` with the block you copied, so it reads
   `firebase: { apiKey: "...", ... },` — keep the comma at the end.
8. Save. Reload the app. The top strip should now say **"Live — synced"**
   instead of "This device only". Open it on two phones and tap a score —
   it appears on both.

If step 6 didn't include a `databaseURL` line, go back to Realtime Database,
copy the URL shown at the top of the Data tab (it ends in `firebaseio.com`),
and add a line `databaseURL: "that url",` inside the block.

---

## Part 3 — Put it on the internet ✅ DONE 2026-09-07

**Live link: https://iannuzzimatt-ship-it.github.io/boyne-cup/**  (repo: github.com/iannuzzimatt-ship-it/boyne-cup)
QR code: `Boyne Cup QR.png` in the Boyne folder.

**Tests:** `node test.js` (in this folder) loads the real engine and runs ~90 checks — strokes, hole results, match play closure, carryover, halved matches, survivor, clinch maths, pairings, honours, plus 1,500 random matches. Run before every push.

**Deploys are automatic now:** this folder is linked to the GitHub repo. Claude commits and pushes after each change; the site updates within about a minute. No more manual uploads. Steps below kept for reference.

This is what your friend did. You get a link like
`https://YOURNAME.github.io/boyne-cup/` that anyone can open.

1. Go to **github.com** → **Sign up** (free). Pick a username you don't mind
   being in the link.
2. Top-right **+** → **New repository**.
   - Repository name: `boyne-cup`
   - Public (Pages is free only on public repos)
   - Click **Create repository**.
3. On the next page click the link **"uploading an existing file"**.
   Drag `index.html` onto the page. Click **Commit changes** at the bottom.
4. Click **Settings** (tab along the top of the repo) → **Pages** (left menu).
   - Under "Branch", change **None** to **main**, leave `/ (root)`, click **Save**.
5. Wait about a minute, refresh the Pages screen, and your link appears at the top.
   Text it to the group.

### To update it later
On GitHub, open the repo → click `index.html` → click the **pencil** icon →
make your edit → **Commit changes**. The live site updates in about a minute.
Or just re-upload the file the same way as step 3 (it'll ask to replace).

---

## About signing in

Players sign in by picking their name (no pin). There is one
commissioner code (section 8). They live inside `index.html`, and the GitHub
repo is public, so anyone who really wants to can open the source and read
them. They are name tags, not locks: every hole records *who* entered it and
*when*, which is what actually keeps people honest. Never reuse a real password.

## Tabs that are switched off for now

Action (skins / CTP / long drive) and Money are hidden until the side bets are
sorted. To turn them on, find `tabs: { action:false, money:false }` in the EDIT
block and change both to `true`. Section 7 holds the pots and hole numbers.

## During the trip

- Anyone can watch without signing in. Sign in by picking your name (top-right) to score.
- **Commissioner** (code in section 8): sets pairings on the Live tab (*Set pairings*), ticks
  survivor balls on the Cup tab, adjusts handicaps and clears rounds on the Trip tab.
- Live tab opens on **your match** → *Open scorecard*. Tap a score box to set par, − / + to
  adjust. When every score for the hole is in, the app decides the hole and slides on.
- Conceded hole or picked up? Tap **A wins / Halve / B wins** under the scores to set the
  result by hand. Tap again to go back to the scores.
- Swipe or use arrows to move between holes; tap any hole in the card grid to fix one.
- Rules that are still up for a vote are switches in section 6 of the EDIT block:
  `carry` (0 / 2 / 99), `halvedMatch` ("split" / "none"), `survivorPts`.
- Friday PM 18 instead of 9? Change round r3 to `course:"preserveLinks", holes:18`.
