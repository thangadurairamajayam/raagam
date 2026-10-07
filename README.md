# Raagam

A personal music player with an on-device library and Tamil radio. No account,
subscription, or app-inserted advertisements are required for local playback.
Radio streams may contain the station's own advertisements.

## Add and listen to your songs

1. Open Home and choose **Add songs** or **Add music folder**.
2. Select audio files from your computer or phone. On browsers without folder
   selection, use **Add songs** to select individual files.
3. Imported songs appear in **My songs**, ready to play. Albums, favorites,
   playlists, search, and the listening queue are available in **My library**.

The app copies imported audio and embedded artwork into this browser's IndexedDB
storage. Songs automatically reopen on this device; they are never uploaded.
Importing another folder adds to the library. Removing a song from its options
menu deletes the app's stored copy and leaves the original file unchanged.
Keep your original files: clearing site data, private browsing, or browser storage
cleanup can remove the stored copies. Storage limits depend on your device and
browser; failed saves show a message and still allow playback for that session.
Different browsers and devices have separate libraries.

After the production app has loaded online and installed its offline cache,
the app and saved songs can open offline. Radio and other external sources need
an internet connection. YouTube playback, search, movie previews, and their API
functions have been removed.

## Other library options

Tamil radio retains the existing stations and playback controls. Optional
Internet Archive discovery, podcasts, and a Subsonic-compatible personal server
remain accessible from My library. Use files and streams you have permission to
access; importing files does not grant redistribution rights.

## Development and deployment

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

Netlify builds the app with `npm test && npm run build` and publishes `dist`.
Local music and radio need no API keys. Docker is optional and is not required
for the Netlify deployment.

## Native apps

The Capacitor projects are in `android/` and `ios/`.

```bash
npm run cap:android
npm run cap:ios
```

These commands build and sync the web assets, then open Android Studio or Xcode.
Native file picking and audio behavior should also be checked on physical devices.
