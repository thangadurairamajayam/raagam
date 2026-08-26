// Local files source — the user's own music, read straight off the device.
// Nothing is uploaded; files are parsed in the browser and played from blob URLs.

import { resolveMusicDirector, cleanAlbumName, normaliseGenre, stripSiteSpam, isJunkArtist, resolveActor } from "./metadata.js";
const AUDIO_EXT = /\.(mp3|m4a|aac|flac|ogg|opus|wav|wma)$/i;

/** Opens the system picker. `folder` uses directory selection where supported. */
export function pickLocalFiles({ folder = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "audio/*";
    if (folder) {
      input.webkitdirectory = true;
      input.directory = true;
    }
    input.onchange = () => resolve([...(input.files || [])].filter((f) => AUDIO_EXT.test(f.name)));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

function coverUrl(picture) {
  if (!picture?.length) return null;
  const { data, format } = picture[0];
  return URL.createObjectURL(new Blob([data], { type: format || "image/jpeg" }));
}

// "03 - Munbe Vaa.mp3" -> "Munbe Vaa"
function titleFromFilename(name) {
  return stripSiteSpam(
    name.replace(AUDIO_EXT, "").replace(/^\d{1,3}[\s._-]+/, "").replace(/_/g, " ")
  );
}

/**
 * Regional rips are frequently untagged, but the folders aren't: people file them
 * as Composer/Movie/track. Recover album and artist from the path when tags fail.
 */
export function inferFromPath(relativePath) {
  const parts = String(relativePath || "").split("/").filter(Boolean);
  parts.pop(); // filename
  const clean = (s) => stripSiteSpam(String(s || "").replace(/_/g, " ")).trim();
  const album = parts.length >= 1 ? clean(parts[parts.length - 1]) : "";
  const artist = parts.length >= 2 ? clean(parts[parts.length - 2]) : "";
  return {
    album: isJunkArtist(album) ? "" : album,
    artist: isJunkArtist(artist) ? "" : artist,
  };
}

/**
 * Parse picked files into tracks. Tags are read one file at a time so a single
 * corrupt file can't abort the whole scan.
 */
export async function buildLocalTracks(files, onProgress) {
  const { parseBlob } = await import("music-metadata");
  const tracks = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let common = {};
    let format = {};
    try {
      ({ common, format } = await parseBlob(file, { duration: true, skipPostHeaders: true }));
    } catch {
      // Unreadable tags are fine — fall back to the filename.
    }

    const path = file.webkitRelativePath || file.name;
    const fromPath = inferFromPath(path);
    const album = cleanAlbumName(stripSiteSpam(common.album) || fromPath.album, "Singles");
    const title = stripSiteSpam(common.title) || titleFromFilename(file.name);
    const director = resolveMusicDirector({
      composer: Array.isArray(common.composer) ? common.composer[0] : common.composer,
      artist: common.artist || fromPath.artist,
      album: common.album || fromPath.album,
      title: common.title,
    });
    const artist = [common.artist, common.albumartist, fromPath.artist, director]
      .find((v) => v && !isJunkArtist(v) && v !== "Unknown");

    tracks.push({
      id: `local:${path}:${i}`,
      title,
      artist: artist || "Unknown artist",
      album,
      director,
      actor: resolveActor(common.album, common.title, path),
      genre: normaliseGenre(common.genre),
      year: common.year || "",
      track: common.track?.no || i + 1,
      duration: format.duration || 0,
      src: URL.createObjectURL(file),
      cover: coverUrl(common.picture),
      source: "local",
    });

    onProgress?.(i + 1, files.length);
  }

  return tracks;
}
