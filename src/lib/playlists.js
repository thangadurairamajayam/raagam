// Playlists, persisted locally. Only track metadata is stored — for local files
// the blob URL dies with the session, so those entries re-link when the folder
// is re-imported.

const KEY = "sur.playlists.v1";

export function loadPlaylists() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlaylists(playlists) {
  try {
    localStorage.setItem(KEY, JSON.stringify(playlists));
  } catch {
    // Quota exceeded — keep running with in-memory playlists.
  }
  return playlists;
}

export function createPlaylist(playlists, name) {
  const trimmed = name.trim();
  if (!trimmed) return playlists;
  return savePlaylists([...playlists, { id: `pl_${Date.now()}`, name: trimmed, tracks: [] }]);
}

export function addToPlaylist(playlists, playlistId, track) {
  return savePlaylists(
    playlists.map((p) =>
      p.id !== playlistId || p.tracks.some((t) => t.id === track.id)
        ? p
        : { ...p, tracks: [...p.tracks, track] }
    )
  );
}

export function removeFromPlaylist(playlists, playlistId, trackId) {
  return savePlaylists(
    playlists.map((p) =>
      p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p
    )
  );
}

export function deletePlaylist(playlists, playlistId) {
  return savePlaylists(playlists.filter((p) => p.id !== playlistId));
}

// Sharing without a server: a playlist is just JSON. Local files can't travel
// (the recipient doesn't have them), so only streamable tracks are exported.
const SHAREABLE = new Set(["archive", "radio"]);

export function exportPlaylist(playlist) {
  const tracks = playlist.tracks.filter((t) => SHAREABLE.has(t.source));
  const payload = {
    format: "sur.playlist.v1",
    name: playlist.name,
    exported: new Date().toISOString(),
    skippedLocal: playlist.tracks.length - tracks.length,
    tracks,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${playlist.name.replace(/[^\w\s-]/g, "").trim() || "playlist"}.sur.json`;
  link.click();
  URL.revokeObjectURL(url);
  return payload.skippedLocal;
}

export async function importPlaylistFile(playlists, file) {
  const data = JSON.parse(await file.text());
  if (data.format !== "sur.playlist.v1" || !Array.isArray(data.tracks)) {
    throw new Error("That isn't a sur playlist file.");
  }
  const name = playlists.some((p) => p.name === data.name) ? `${data.name} (imported)` : data.name;
  return savePlaylists([
    ...playlists,
    { id: `pl_${Date.now()}`, name, tracks: data.tracks },
  ]);
}
