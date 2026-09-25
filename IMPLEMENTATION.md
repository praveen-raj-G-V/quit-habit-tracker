# Implementing v4

## What changed
- New visual identity: warm paper background, serif numerals for the counter/habit name, sage/amber/clay color coding for resisted/pending/acted, automatic dark mode (`prefers-color-scheme`).
- Fixed the double-urge bug: "I felt the urge" is now disabled while an urge is pending.
- Streak line under the habit name: days since you last acted on it.
- Optional note field when resolving an urge ("what triggered it?"), shown in History.
- Progress chart is now a stacked resisted/acted bar chart instead of a single urge-count line.
- Archive/unarchive habits (Habits tab) instead of only ever accumulating them.
- CSV export of the active habit's full event history (History tab).
- Toast is `aria-live="polite"`; buttons get a visible focus ring; safe-area padding for notched phones.
- Service worker bumped to `quit-habit-v4`, now falls back to cached `index.html` on offline navigation and calls `skipWaiting`/`clients.claim` so updates apply without a manual reinstall.

## Steps
1. **Run the migration.** In the Supabase SQL editor, run `supabase_v4_migration.sql`. It only adds two nullable/defaulted columns (`habit_events.note`, `habits.archived`), so it's safe against your existing data and RLS policies — nothing to reconfigure there.
2. **Copy `config.js` values.** The new `config.js` is a placeholder copy of your existing one — before deploying, paste your real `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` back in if they differ (I copied yours through, so likely no action needed — just double-check before pushing).
3. **Replace your GitHub Pages files** with `index.html`, `app.js`, `sw.js`, and `manifest.webmanifest` from this folder (keep `config.js` as your live one).
4. **Commit and push.** Because the service worker cache name changed (`v3` → `v4`), users will automatically get the new version on next load — no manual cache clear needed.
5. **Verify RLS** (skip if already confirmed): `habits` and `habit_events` should each have a policy scoping rows to `user_id = auth.uid()` for select/insert/update. The publishable key is meant to be public; RLS is what actually protects the data.

## Notes on scope / what I left out
To keep this a focused, shippable diff rather than a rewrite, I didn't add: push notifications, trigger tagging (beyond the free-text note), per-habit color themes, or a longest-streak-ever stat. All of those slot in cleanly later — the note field and the stacked chart in particular set up trigger analytics if you want to go further.
