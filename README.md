# Quit Habit Tracker

A free-tier, mobile-first habit/urge tracker.

## Architecture
- Frontend: plain HTML/CSS/JavaScript
- Hosting: GitHub Pages
- Auth + PostgreSQL database: Supabase Free
- PWA: manifest + service worker

## Setup order
1. Create a Supabase project.
2. Run `supabase_schema.sql` in Supabase SQL Editor.
3. Copy Supabase Project URL and anon/publishable key into `app.js`.
4. Test locally or deploy the folder to GitHub Pages.
5. Open the HTTPS URL on Android Chrome and choose Install/Add to Home screen.

Never put a Supabase service-role key in `app.js`. Only the public anon/publishable key belongs in the browser.
