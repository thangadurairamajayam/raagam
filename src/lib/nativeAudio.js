// Background playback on the phone.
//
// A WebView pauses audio when the app leaves the foreground unless something
// holds a media session open. This plugin posts a media notification backed by a
// foreground service, which keeps playback alive and adds lock-screen controls.
//
// Web builds skip all of it — the browser's own Media Session already handles
// what a browser can.

let controls = null;
let listening = false;

async function plugin() {
  if (controls !== null) return controls;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor?.isNativePlatform?.()) {
      controls = false;
      return controls;
    }
    const mod = await import("capacitor-music-controls-plugin");
    controls = mod.CapacitorMusicControls || false;
  } catch {
    controls = false;   // plugin absent, e.g. a plain web build
  }
  return controls;
}

export async function isNative() {
  return Boolean(await plugin());
}

/** Show (or refresh) the media notification for the playing track. */
export async function showNowPlaying(track, { isPlaying = true } = {}) {
  const mc = await plugin();
  if (!mc || !track) return;
  try {
    await mc.create({
      track: track.title,
      artist: track.artist,
      album: track.album || "",
      cover: track.cover || "",
      isPlaying,
      dismissable: true,
      hasPrev: true,
      hasNext: true,
      hasClose: true,
      // Live streams have no timeline to scrub.
      duration: track.live ? 0 : Math.floor(track.duration || 0),
      elapsed: 0,
      ticker: `${track.title} — ${track.artist}`,
    });
  } catch {
    // A failed notification must never stop the music.
  }
}

export async function updatePlayState(isPlaying) {
  const mc = await plugin();
  if (!mc) return;
  try {
    await mc.updateIsPlaying({ isPlaying });
  } catch { /* no-op */ }
}

export async function clearNowPlaying() {
  const mc = await plugin();
  if (!mc) return;
  try {
    await mc.destroy();
  } catch { /* no-op */ }
}

/**
 * Wire the notification's buttons to the player. Returns a cleanup function.
 * Registered once — the handlers read the latest callbacks via the ref object.
 */
export async function bindControls(handlers) {
  const mc = await plugin();
  if (!mc || listening) return () => {};
  listening = true;

  const onEvent = (info) => {
    const action = typeof info === "string" ? info : info?.message;
    switch (action) {
      case "music-controls-play": handlers.current.play(); break;
      case "music-controls-pause": handlers.current.pause(); break;
      case "music-controls-next": handlers.current.next(); break;
      case "music-controls-previous": handlers.current.prev(); break;
      case "music-controls-destroy":
      case "music-controls-stop": handlers.current.stop(); break;
      // Headset unplugged or Bluetooth disconnected: stop, don't blast audio.
      case "music-controls-headset-unplugged":
      case "music-controls-media-button-pause": handlers.current.pause(); break;
      default: break;
    }
  };

  document.addEventListener("controlsNotification", onEvent);
  try {
    mc.addListener?.("controlsNotification", onEvent);
  } catch { /* older plugin builds only emit the document event */ }

  return () => {
    document.removeEventListener("controlsNotification", onEvent);
    listening = false;
  };
}
