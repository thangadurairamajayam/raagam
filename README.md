# sur. — Music Player (Capacitor project)

A Capacitor-wrapped version of the sur. music player MVP, ready to build for Android and iOS.

## What's inside
- `src/App.jsx` — the player UI (browse, search, playback)
- `src/lib/localLibrary.js` — reads your own music files + ID3 tags
- `src/lib/archive.js` — Internet Archive search/streaming
- `src/lib/metadata.js` — music-director / album / genre resolution
- `src/lib/grouping.js` — groups tracks into albums, directors, genres
- `dist/` — pre-built web assets (already run once, committed so you can sync immediately)
- `android/` — native Android Studio project (generated, ready to open)
- `ios/` — native Xcode project (generated; needs `pod install` on a Mac before it opens cleanly)
- `capacitor.config.json` — app id, name, and web asset folder

## Where the music comes from

**1. Your own files** ("Add my music folder" on Home). Pick a folder; the app reads
ID3 tags in the browser and groups the songs. Nothing is uploaded and no network is
used. Blob URLs are per-session, so re-pick the folder after a restart.

**2. Internet Archive** ("Discover"). Publicly hosted Tamil audio, browsable by category:
Everything, Songs, Film & Movie, Jukebox & Hits, Devotional, Carnatic & Vocal,
Folk & Gaana, Instrumental, BGM & Themes, OST.

Approximate catalogue sizes (live Archive counts):

| category | items | with a free licence |
| --- | --- | --- |
| all Tamil audio | ~15,800 | ~1,570 |
| songs | ~2,200 | — |
| film / movie | ~71 | **9** |
| devotional / folk / jukebox | ~130–150 each | — |
| Carnatic & vocal | ~112 | — |
| instrumental | ~41 | — |
| BGM & themes | ~14 | — |
| OST | ~10 | — |

### On licensed music
Current commercial Tamil film music (Sony Music South, Think Music, Saregama and so on)
is **not** free, and this app deliberately has no scraper for JioSaavn/Gaana/YouTube.
Those routes are copyright infringement, get apps rejected from both stores, and break
constantly. To play music you own, use "Add my music folder".

This is also why **BGM and OST are nearly empty** — background scores are exactly the
material studios license, so they aren't legally free anywhere.

### The "Free-licensed only" toggle — on by default
Archive.org items are user uploads and their copyright status varies. Discover starts in
**Free-licensed only** mode: results are restricted to items carrying an explicit Creative
Commons or public-domain licence (`licenseurl`), and every tile shows which licence it is
(Public Domain, CC BY, CC BY-NC-ND …). Turning it off shows unverified uploads and is
deliberately styled as a warning.

`-NC` licences forbid commercial use and `-ND` forbids derivatives — both fine for
listening yourself and with friends.

### Why "free Tamil movie albums" barely exist
Filtered to a verifiable free licence, the whole Archive returns **9** Tamil film/movie
items — and most are lectures or interviews, not albums. Roughly three are real Tamil film
music. The other ~60 film items are unverified uploads of commercial soundtracks.

This isn't a limitation of the app's search. Commercial Tamil film music is licensed, full
stop; there is no legitimate free source for it. For those albums, buy them and use
"Add my music folder" — album / music-director / genre browsing works identically on your
own files.

### Sharing with friends
- Sharing **the app** is fine — it's your code.
- Discover **streams from archive.org**; it never copies or re-hosts audio, so each
  listener fetches from the source. That is materially safer than passing files around.
- Sharing **your own ripped MP3s** with friends is redistribution and is not made legal
  by doing it through this app.

## How music director is worked out
ID3 has no music-director field, so `src/lib/metadata.js` resolves it in this order:
1. `composer` tag — but a comma-separated list is treated as playback singers, not a director
2. a known director matched anywhere in artist/album/title, fuzzy enough to absorb
   misspellings ("Yuvan Shnakar Raja" → Yuvan Shankar Raja) and short forms ("Yuvan hits")
3. bracketed or trailing-dash names in the album ("Ayan (Harris Jayaraj)")
4. otherwise `Unknown`

Add names to `KNOWN_DIRECTORS` / `ALIASES` in that file to improve grouping.

## Prerequisites (install once, on your own machine)
- Node.js 18+ and npm
- **For Android:** Android Studio (includes the Android SDK)
- **For iOS:** a Mac with Xcode + CocoaPods (`sudo gem install cocoapods`) — Apple requires macOS for iOS builds, there's no way around this

## First-time setup
```bash
npm install
```

## Everyday workflow
Whenever you change `src/App.jsx` (or any file in `src/`):

```bash
npm run cap:android   # builds the web app, syncs it into android/, opens Android Studio
npm run cap:ios        # builds the web app, syncs it into ios/, opens Xcode
```

These two scripts do three things automatically: `vite build` → `npx cap sync` → open the native IDE.

## Android — build & run
1. `npm run cap:android` (opens Android Studio)
2. Let Gradle finish syncing (first time takes a few minutes)
3. Plug in a phone (USB debugging on) or start an emulator
4. Press ▶ Run

To publish: Android Studio → Build > Generate Signed App Bundle, then upload the `.aab` to the Google Play Console ($25 one-time registration fee).

## iOS — build & run
1. On a Mac, run `cd ios/App && pod install` (only needed once, or after adding plugins)
2. `npm run cap:ios` (opens Xcode)
3. Select your device/simulator, press ▶ Run
4. You'll need an Apple Developer account ($99/yr) to run on a physical device or publish to the App Store

## Notes
- Audio, likes, search, and playback all work as-is inside the native shell — it's the same React app, just running in a native WebView instead of a browser tab.
- On Android, "Add my music folder" opens the system file picker. iOS WebView restricts
  directory picking — select files individually there, or use the Files app.
- App icon/splash screen are still Capacitor defaults — see https://capacitorjs.com/docs/guides/splash-screens-and-icons to brand them.
