// Turns a flat track list into the browse dimensions: album, music director, genre.

import { searchNormalise } from "./tamil.js";

function groupBy(tracks, keyFn) {
  const map = new Map();
  for (const track of tracks) {
    const key = keyFn(track) || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(track);
  }
  return map;
}

function toCollections(map, kind) {
  return [...map.entries()]
    .map(([name, tracks]) => ({
      kind,
      name,
      tracks,
      count: tracks.length,
      cover: tracks.find((t) => t.cover)?.cover || null,
      subtitle: kind === "album"
        ? tracks[0].director !== "Unknown" ? tracks[0].director : tracks[0].artist
        : `${tracks.length} song${tracks.length === 1 ? "" : "s"}`,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildLibrary(tracks) {
  return {
    albums: toCollections(groupBy(tracks, (t) => t.album), "album"),
    directors: toCollections(groupBy(tracks, (t) => t.director), "director"),
    actors: toCollections(groupBy(tracks, (t) => t.actor), "actor"),
    genres: toCollections(groupBy(tracks, (t) => t.genre), "genre"),
  };
}

export function searchTracks(tracks, query) {
  const q = searchNormalise(query);
  if (!q) return [];
  return tracks.filter((t) => {
    const hay = searchNormalise([t.title, t.artist, t.album, t.director, t.actor, t.genre].join(" "));
    return hay.includes(q);
  });
}

/**
 * Search everything the app knows about, not just loaded audio — a film or a
 * composer you don't own yet should still be findable by name.
 */
export function searchEverything(query, { tracks = [], films = [], directors = [], actors = [] } = {}) {
  const q = searchNormalise(query);
  if (!q) return { tracks: [], films: [], directors: [], actors: [], total: 0 };

  const hit = (value) => searchNormalise(value).includes(q);
  const result = {
    tracks: searchTracks(tracks, query),
    films: films.filter((f) => hit(f.title) || hit(f.music) || hit(f.actor) || String(f.year).includes(q)),
    directors: directors.filter(hit),
    actors: actors.filter(hit),
  };
  result.total = result.tracks.length + result.films.length + result.directors.length + result.actors.length;
  return result;
}
