import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, Search, Home, Volume2, VolumeX, Music2, Disc3, UserRound, Tags, FolderPlus, Globe, Loader2, ArrowLeft, ShieldCheck, ShieldAlert, Clapperboard, RadioTower, Shuffle, Repeat, Repeat1, ListMusic, Plus, Trash2, ListPlus, Youtube, KeyRound, Share2, Download, Film, History, Moon, Mic, Rss } from "lucide-react";

import { pickLocalFiles, buildLocalTracks } from "./lib/localLibrary.js";
import {
  supportsPersistentFolder, pickFolder, getFolderHandle, clearFolderHandle,
  ensureReadPermission, filesFromHandle,
} from "./lib/fileStore.js";
import { searchArchive, loadArchiveAlbum, countArchive, CATEGORIES } from "./lib/archive.js";
import { searchStations } from "./lib/radio.js";
import {
  CURATED as CURATED_PODCASTS, loadFeed, searchPodcasts, loadSubscriptions,
  saveSubscriptions, isSubscribed, toggleSubscription,
} from "./lib/podcasts.js";
import {
  loadPlaylists, createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist,
  exportPlaylist, importPlaylistFile,
} from "./lib/playlists.js";
import {
  parseYouTubeId, fetchVideoInfo, searchYouTube, loadIframeApi, getApiKey, setApiKey,
  youtubeSearchUrl, hasSharedKey,
} from "./lib/youtube.js";
import { lookupCover } from "./lib/coverArt.js";
import { ACTOR_NAMES, DIRECTOR_NAMES } from "./lib/metadata.js";
import { FILMS, DECADES, decadeOf, filmsBy, soundtrackQuery, STORES } from "./lib/films.js";
import { searchNormalise } from "./lib/tamil.js";
import {
  loadRecent, pushRecent, clearRecent, saveResume, loadResume, clearResume, resolveRecent,
} from "./lib/history.js";
import {
  showNowPlaying, updatePlayState, clearNowPlaying, bindControls,
} from "./lib/nativeAudio.js";
import { buildLibrary, searchTracks, searchEverything } from "./lib/grouping.js";

function fmtTime(s) {
  if (!s || Number.isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,500&display=swap');

.sur-root {
  --bg: #140B18;
  --surface: #1E1224;
  --surface-2: #2A182F;
  --marigold: #F2A93B;
  --rose: #EC5382;
  --text: #F6EDE7;
  --muted: #9C8AA6;
  --border: rgba(246,237,231,0.09);
  font-family: 'Work Sans', sans-serif;
  background: var(--bg);
  color: var(--text);
  height: 100dvh;
  width: 100vw;
  display: grid;
  grid-template-columns: 220px 1fr;
  grid-template-rows: 1fr auto;
  overflow: hidden;
  position: relative;
  padding-top: env(safe-area-inset-top);
}
.sur-root * { box-sizing: border-box; }
.sur-display { font-family: 'Baloo 2', sans-serif; }

/* ---- sidebar ---- */
.sur-sidebar {
  grid-row: 1 / 2;
  background: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);
  border-right: 1px solid var(--border);
  padding: 22px 14px;
  display: flex;
  flex-direction: column;
  gap: 26px;
  overflow-y: auto;
}
.sur-logo {
  display: flex; align-items: center; gap: 8px;
  font-size: 22px; font-weight: 800; letter-spacing: 0.5px;
  color: var(--marigold);
  padding: 0 6px;
}
.sur-logo span { color: var(--rose); }
.sur-nav { display: flex; flex-direction: column; gap: 3px; }
.sur-navbtn {
  display: flex; align-items: center; gap: 11px;
  padding: 9px 12px; border-radius: 9px; border: none;
  background: transparent; color: var(--muted);
  font-family: inherit; font-size: 14.5px; font-weight: 600;
  cursor: pointer; text-align: left; transition: background .15s, color .15s;
}
.sur-navbtn:hover { background: var(--surface-2); color: var(--text); }
.sur-navbtn.active { background: var(--surface-2); color: var(--marigold); }
.sur-navbtn svg { flex-shrink: 0; }

.sur-genres { margin-top: 6px; }
.sur-genres-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--muted); padding: 0 12px 8px; }
.sur-genrebtn {
  display: block; width: 100%; text-align: left; padding: 7px 12px; border-radius: 8px;
  border: none; background: transparent; color: var(--muted); font-family: inherit;
  font-size: 13.5px; cursor: pointer; transition: color .15s, background .15s;
}
.sur-genrebtn:hover, .sur-genrebtn.active { color: var(--text); background: var(--surface-2); }

/* ---- main ---- */
.sur-main { grid-row: 1 / 2; overflow-y: auto; padding: 24px 30px 100px; }
.sur-topbar { display: flex; align-items: center; gap: 14px; margin-bottom: 26px; }
.sur-searchwrap {
  flex: 1; max-width: 420px; display: flex; align-items: center; gap: 9px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 999px;
  padding: 9px 16px;
}
.sur-searchwrap input {
  background: transparent; border: none; outline: none; color: var(--text);
  font-family: inherit; font-size: 14px; width: 100%;
}
.sur-searchwrap input::placeholder { color: var(--muted); }
.sur-searchwrap svg { color: var(--muted); flex-shrink: 0; }

.sur-heading { font-size: 30px; margin: 0 0 4px; }
.sur-subtext { color: var(--muted); font-size: 14px; margin: 0 0 22px; }

.sur-section { margin-bottom: 34px; }
.sur-section-title { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.sur-section-title h2 { font-size: 18px; margin: 0; }
.sur-section-title .tag { font-size: 11px; color: var(--marigold); background: rgba(242,169,59,0.12); padding: 2px 9px; border-radius: 999px; font-weight: 600; letter-spacing: 0.3px; }

.sur-row { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 6px; }
.sur-card {
  flex: 0 0 148px; cursor: pointer; border-radius: 12px; padding: 10px;
  background: var(--surface); border: 1px solid transparent; transition: background .15s, border-color .15s, transform .15s;
}
.sur-card:hover { background: var(--surface-2); border-color: var(--border); transform: translateY(-2px); }
.sur-card-art { position: relative; width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
.sur-card-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sur-card-play {
  position: absolute; right: 8px; bottom: 8px; width: 34px; height: 34px; border-radius: 50%;
  background: var(--marigold); color: #1A0F1F; display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: translateY(6px); transition: opacity .15s, transform .15s; border: none; cursor: pointer;
}
.sur-card:hover .sur-card-play { opacity: 1; transform: translateY(0); }
.sur-card-title { font-size: 13.5px; font-weight: 600; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sur-card-artist { font-size: 12px; color: var(--muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sur-list { display: flex; flex-direction: column; }
.sur-row-item {
  display: grid; grid-template-columns: 26px 42px 1fr auto auto; align-items: center; gap: 14px;
  padding: 9px 10px; border-radius: 9px; cursor: pointer; transition: background .15s;
}
.sur-row-item:hover { background: var(--surface); }
.sur-row-item.playing { background: rgba(242,169,59,0.08); }
.sur-idx { color: var(--muted); font-size: 13px; text-align: center; }
.sur-thumb { width: 42px; height: 42px; border-radius: 6px; overflow: hidden; }
.sur-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sur-meta .t { font-size: 14px; font-weight: 600; margin: 0; }
.sur-meta .a { font-size: 12.5px; color: var(--muted); margin: 1px 0 0; }
.sur-heart { background: none; border: none; cursor: pointer; color: var(--muted); display: flex; padding: 4px; }
.sur-heart.liked { color: var(--rose); }
.sur-heart:hover { color: var(--text); }
.sur-rowacts { display: flex; align-items: center; gap: 2px; }
.sur-dur { font-size: 12.5px; color: var(--muted); }

.sur-eq { display: flex; align-items: flex-end; gap: 2px; height: 13px; width: 14px; }
.sur-eq span { flex: 1; background: var(--marigold); border-radius: 1px; animation: sur-bounce 0.9s ease-in-out infinite; }
.sur-eq span:nth-child(2) { animation-delay: 0.15s; }
.sur-eq span:nth-child(3) { animation-delay: 0.3s; }
@keyframes sur-bounce { 0%,100% { height: 30%; } 50% { height: 100%; } }

.sur-empty { color: var(--muted); font-size: 14px; padding: 40px 0; text-align: center; }

/* ---- player bar ---- */
.sur-player {
  grid-column: 1 / 3; grid-row: 2 / 3;
  background: var(--surface); border-top: 1px solid var(--border);
  display: grid; grid-template-columns: 260px 1fr 180px; align-items: center;
  padding: 10px 18px calc(10px + env(safe-area-inset-bottom)) 18px; gap: 16px;
}
.sur-np { display: flex; align-items: center; gap: 12px; min-width: 0; }
.sur-vinyl-wrap { position: relative; width: 46px; height: 46px; flex-shrink: 0; }
.sur-vinyl-glow { position: absolute; inset: -4px; border-radius: 50%; background: radial-gradient(circle, rgba(242,169,59,0.35), transparent 70%); opacity: 0; transition: opacity .3s; }
.sur-vinyl-glow.on { opacity: 1; }
.sur-vinyl { width: 46px; height: 46px; border-radius: 50%; overflow: hidden; border: 2px solid var(--surface-2); position: relative; }
.sur-vinyl img { width: 100%; height: 100%; object-fit: cover; }
.sur-vinyl.spin { animation: sur-spin 3.2s linear infinite; }
@keyframes sur-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.sur-np-meta { min-width: 0; }
.sur-np-meta .t { font-size: 13.5px; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sur-np-meta .a { font-size: 12px; color: var(--muted); margin: 1px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sur-center { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sur-controls { display: flex; align-items: center; gap: 16px; }
.sur-ctrlbtn { background: none; border: none; color: var(--text); cursor: pointer; display: flex; padding: 4px; opacity: 0.85; }
.sur-ctrlbtn:hover { opacity: 1; }
.sur-ctrlbtn.on { color: var(--marigold); opacity: 1; }
.sur-ctrlbtn:disabled { opacity: 0.3; cursor: default; }
.sur-playbtn {
  width: 34px; height: 34px; border-radius: 50%; background: var(--marigold); color: #1A0F1F;
  display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;
}
.sur-seek { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 460px; }
.sur-seek span { font-size: 11px; color: var(--muted); width: 34px; text-align: center; flex-shrink: 0; }
.sur-seek input[type=range] { flex: 1; accent-color: var(--marigold); height: 3px; }

.sur-right { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.sur-right input[type=range] { width: 90px; accent-color: var(--rose); }

.sur-noqueue { text-align: center; color: var(--muted); font-size: 13px; }

@media (max-width: 720px) {
  .sur-root { grid-template-columns: 64px 1fr; }
  .sur-sidebar { padding: 16px 8px; gap: 12px; }
  .sur-logo span:not(:first-child) { display: none; }
  .sur-navbtn span { display: none; }
  .sur-genres-label { display: none; }
  .sur-navbtn { justify-content: center; }
  .sur-main { padding: 18px 14px 100px; }
  .sur-grid { grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 12px; }
  .sur-player { grid-template-columns: 1fr; grid-template-rows: auto auto; padding: 8px 12px; gap: 6px; }
  .sur-right { display: none; }
  .sur-np-meta { max-width: 140px; }
}

/* ---- browse grids (albums / music directors / genres) ---- */
.sur-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
.sur-tile {
  cursor: pointer; border-radius: 12px; padding: 10px; background: var(--surface);
  border: 1px solid transparent; transition: background .15s, border-color .15s, transform .15s;
}
.sur-tile:hover { background: var(--surface-2); border-color: var(--border); transform: translateY(-2px); }
.sur-tile-art {
  position: relative; width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden;
  margin-bottom: 10px; background: linear-gradient(135deg, var(--surface-2), var(--bg));
  display: flex; align-items: center; justify-content: center; color: var(--marigold);
}
.sur-tile-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sur-tile-art.round { border-radius: 50%; }
.sur-tile-title { font-size: 13.5px; font-weight: 600; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sur-tile-sub { font-size: 12px; color: var(--muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ---- toolbar / actions ---- */
.sur-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 22px; }
.sur-btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 9px 15px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background .15s;
}
.sur-btn:hover { background: var(--surface-2); }
.sur-btn.primary { background: var(--marigold); color: #1A0F1F; border-color: transparent; }
.sur-btn.primary:hover { filter: brightness(1.07); }
.sur-btn:disabled { opacity: 0.55; cursor: default; }
.sur-spin-icon { animation: sur-spin 1s linear infinite; }

.sur-back { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: var(--muted); font-family: inherit; font-size: 13px; cursor: pointer; padding: 0 0 12px; }
.sur-back:hover { color: var(--text); }

.sur-note { color: var(--muted); font-size: 12.5px; margin: 0 0 18px; line-height: 1.5; }
.sur-note a { color: var(--marigold); }
.sur-error { color: var(--rose); font-size: 13px; padding: 14px 0; }
.sur-badge { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; }
.sur-badge.owned { color: var(--marigold); border-color: rgba(242,169,59,0.45); background: rgba(242,169,59,0.1); }
.sur-buy { display: flex; gap: 10px; margin-top: 8px; }
.sur-buy a { font-size: 11.5px; color: var(--muted); text-decoration: none; border-bottom: 1px dotted var(--border); }
.sur-buy a:hover { color: var(--marigold); border-color: var(--marigold); }

.sur-resume {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 22px;
  border-radius: 12px; background: var(--surface); border: 1px solid rgba(242,169,59,0.3);
}
.sur-resume > :first-child { width: 46px; height: 46px; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
.sur-resume img { width: 100%; height: 100%; object-fit: cover; }
.sur-resume-meta { flex: 1; min-width: 0; }
.sur-resume-meta .t { font-size: 14px; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sur-resume-meta .a { font-size: 12.5px; color: var(--muted); margin: 2px 0 0; }
.sur-sleep { font-size: 11px; color: var(--marigold); min-width: 34px; }
.sur-progress { color: var(--muted); font-size: 13px; padding: 8px 0; }

.sur-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.sur-chip {
  padding: 6px 13px; border-radius: 999px; border: 1px solid var(--border);
  background: transparent; color: var(--muted); font-family: inherit; font-size: 12.5px;
  font-weight: 600; cursor: pointer; transition: color .15s, background .15s, border-color .15s;
}
.sur-chip:hover { color: var(--text); background: var(--surface); }
.sur-chip.active { color: #1A0F1F; background: var(--marigold); border-color: transparent; }

.sur-btn.warn { background: rgba(236,83,130,0.14); color: var(--rose); border-color: rgba(236,83,130,0.4); }
.sur-warn { color: var(--rose); border-left: 2px solid var(--rose); padding-left: 10px; }

.sur-genart {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  font-family: 'Baloo 2', sans-serif; font-weight: 800; color: rgba(246,237,231,0.82);
  letter-spacing: 0.5px;
}

.sur-chips-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--muted); margin: 4px 0 8px; }

.sur-collection-head { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
.sur-collection-art { width: 116px; height: 116px; border-radius: 12px; overflow: hidden; flex-shrink: 0; background: var(--surface-2); }
.sur-collection-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sur-collection-head h1 { margin-bottom: 2px; }

.sur-sources { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 14px; }
.sur-source {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 14px; border-radius: 12px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text); cursor: pointer;
  font-family: inherit; text-align: left; transition: background .15s, transform .15s;
}
.sur-source:hover { background: var(--surface-2); transform: translateY(-2px); }
.sur-source svg { color: var(--marigold); margin-bottom: 4px; }
.sur-source .t { font-size: 14px; font-weight: 700; margin: 0; }
.sur-source .a { font-size: 12.5px; color: var(--muted); margin: 0 0 6px; }

.sur-sheet {
  position: fixed; inset: 0; background: rgba(10,6,12,0.66); z-index: 40;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.sur-sheet-inner {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 18px; width: min(380px, 100%); max-height: 70vh; overflow-y: auto;
}
.sur-sheet-inner h3 { margin: 0 0 12px; font-size: 16px; }
.sur-sheet-item {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 10px 12px; border-radius: 9px; border: none; background: transparent;
  color: var(--text); font-family: inherit; font-size: 14px; cursor: pointer;
}
.sur-sheet-item:hover { background: var(--surface-2); }

.sur-yt-wrap { margin: 4px 0 8px; }
.sur-yt-frame {
  position: relative; width: 100%; max-width: 720px; aspect-ratio: 16 / 9;
  border-radius: 12px; overflow: hidden; background: #000;
}
.sur-yt-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }

.sur-nav-foot { margin-top: auto; }
`;

export default function SurMusicPlayer() {
  const [tracks, setTracks] = useState([]);
  const [view, setView] = useState("home");
  const [selected, setSelected] = useState(null); // { kind, name }
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [liked, setLiked] = useState(() => new Set());
  const [scan, setScan] = useState(null);
  const [savedFolder, setSavedFolder] = useState(null);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverResults, setDiscoverResults] = useState([]);
  const [discoverBusy, setDiscoverBusy] = useState(false);
  const [discoverCategory, setDiscoverCategory] = useState("all");
  // Default to licence-verified results; opting out is a deliberate act.
  const [freeOnly, setFreeOnly] = useState(true);
  const [hiddenByLicence, setHiddenByLicence] = useState(0);
  const [radioStations, setRadioStations] = useState([]);
  const [radioQuery, setRadioQuery] = useState("");
  const [radioBusy, setRadioBusy] = useState(false);

  const [podcastSubs, setPodcastSubs] = useState(() => loadSubscriptions());
  const [podcastQuery, setPodcastQuery] = useState("");
  const [podcastResults, setPodcastResults] = useState([]);
  const [podcastBusy, setPodcastBusy] = useState(false);
  const [openShow, setOpenShow] = useState(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off"); // off | all | one
  const [playlists, setPlaylists] = useState(() => loadPlaylists());
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [addingTrack, setAddingTrack] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [ytInput, setYtInput] = useState("");
  const [ytVideo, setYtVideo] = useState(null);
  const [ytResults, setYtResults] = useState([]);
  const [ytKey, setYtKey] = useState(() => getApiKey());
  const [ytBusy, setYtBusy] = useState(false);
  const [filmDecade, setFilmDecade] = useState("");
  const [recent, setRecent] = useState(() => loadRecent());
  const [resume, setResume] = useState(() => loadResume());
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [error, setError] = useState("");
  const ytPlayerRef = useRef(null);
  const nativeHandlers = useRef({});
  const audioRef = useRef(null);

  const current = currentIndex !== null ? queue[currentIndex] : null;
  const library = useMemo(() => buildLibrary(tracks), [tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = current.src;
    audio.volume = volume;
    if (isPlaying) audio.play().catch(() => {});
  }, [current?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (current) setRecent(pushRecent(current));
  }, [current?.id]);

  // Native media notification: what keeps audio alive when the app is backgrounded.
  // Calls are wrapped so the handlers can be declared before next/prev exist.
  nativeHandlers.current = {
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    next: () => next(),
    prev: () => prev(),
    stop: () => { setIsPlaying(false); clearNowPlaying(); },
  };

  useEffect(() => {
    let cleanup;
    bindControls(nativeHandlers).then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (current) showNowPlaying(current, { isPlaying });
    else clearNowPlaying();
  }, [current?.id]);

  useEffect(() => {
    if (current) updatePlayState(isPlaying);
  }, [isPlaying, current?.id]);

  // Remember the position so playback can be picked up next session.
  useEffect(() => {
    if (!current || current.live) return;
    const save = () => saveResume(current, audioRef.current?.currentTime);
    const timer = setInterval(save, 5000);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [current?.id]);

  // Sleep timer: pause when it runs out.
  useEffect(() => {
    if (!sleepMinutes) { setSleepLeft(0); return; }
    setSleepLeft(sleepMinutes * 60);
    const timer = setInterval(() => {
      setSleepLeft((left) => {
        if (left <= 1) {
          setIsPlaying(false);
          setSleepMinutes(0);
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sleepMinutes]);

  // Lock-screen / notification controls and headset buttons.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artwork: current.cover ? [{ src: current.cover, sizes: "250x250", type: "image/jpeg" }] : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    const seekBy = (offset) => {
      const audio = audioRef.current;
      if (audio) audio.currentTime = Math.max(0, audio.currentTime + offset);
    };
    const actions = [
      ["play", () => setIsPlaying(true)],
      ["pause", () => setIsPlaying(false)],
      ["previoustrack", prev],
      ["nexttrack", next],
      ["stop", () => setIsPlaying(false)],
      ["seekbackward", (d) => seekBy(-(d?.seekOffset || 10))],
      ["seekforward", (d) => seekBy(d?.seekOffset || 10)],
      ["seekto", (d) => {
        if (audioRef.current && d?.seekTime != null) audioRef.current.currentTime = d.seekTime;
      }],
    ];
    for (const [action, handler] of actions) {
      try { navigator.mediaSession.setActionHandler(action, current.live ? null : handler); } catch { /* unsupported */ }
    }
    // Play/pause must stay available even for live radio.
    try {
      navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
    } catch { /* unsupported */ }
  }, [current?.id, isPlaying, shuffle, repeat, currentIndex, queue]);

  // Gives the lock screen a real progress bar rather than just a title.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!current || current.live || !duration || !Number.isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(currentTime, duration),
        playbackRate: 1,
      });
    } catch { /* Safari throws on odd values */ }
  }, [current?.id, duration, Math.floor(currentTime)]);

  function addTracks(incoming) {
    setTracks((prev) => {
      const seen = new Set(prev.map((t) => t.id));
      return [...prev, ...incoming.filter((t) => !seen.has(t.id))];
    });
  }

  async function importLocal() {
    setError("");
    try {
      // A directory handle can be remembered; a plain file input cannot.
      if (supportsPersistentFolder()) {
        const handle = await pickFolder();
        await loadFromHandle(handle);
        return;
      }
      const files = await pickLocalFiles({ folder: true });
      if (!files.length) return;
      setScan({ done: 0, total: files.length });
      const parsed = await buildLocalTracks(files, (done, total) => setScan({ done, total }));
      addTracks(parsed);
      setView("albums");
    } catch (e) {
      if (e.name !== "AbortError") setError(`Could not read those files: ${e.message}`);
    } finally {
      setScan(null);
    }
  }

  async function loadFromHandle(handle) {
    setError("");
    try {
      if (!(await ensureReadPermission(handle, { request: true }))) {
        setError("Permission denied for that folder.");
        return;
      }
      setScan({ done: 0, total: 0 });
      const files = await filesFromHandle(handle);
      if (!files.length) {
        setError("No audio files found in that folder.");
        return;
      }
      setScan({ done: 0, total: files.length });
      const parsed = await buildLocalTracks(files, (done, total) => setScan({ done, total }));
      addTracks(parsed);
      setSavedFolder(handle);
      setView("albums");
    } catch (e) {
      setError(`Could not read that folder: ${e.message}`);
    } finally {
      setScan(null);
    }
  }

  // A saved handle can't be reopened without a click, so surface it as one.
  useEffect(() => {
    if (!supportsPersistentFolder()) return;
    getFolderHandle().then((handle) => handle && setSavedFolder(handle));
  }, []);

  const runDiscover = useCallback(async (q, category, onlyFree) => {
    setDiscoverBusy(true);
    setError("");
    setHiddenByLicence(0);
    try {
      const results = await searchArchive({ query: q, category, freeOnly: onlyFree });
      setDiscoverResults(results);
      // An empty licence-filtered result is usually the filter, not the archive.
      if (onlyFree && results.length === 0) {
        setHiddenByLicence(await countArchive({ query: q, category, freeOnly: false }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setDiscoverBusy(false);
    }
  }, []);

  useEffect(() => {
    if (view === "discover") runDiscover(discoverQuery, discoverCategory, freeOnly);
  }, [view, discoverCategory, freeOnly]);

  async function openArchiveItem(item) {
    setDiscoverBusy(true);
    setError("");
    try {
      const albumTracks = await loadArchiveAlbum(item);
      if (!albumTracks.length) {
        setError(`"${item.title}" has no playable audio files.`);
        return;
      }
      addTracks(albumTracks);
      setQueue(albumTracks);
      setCurrentIndex(0);
      setIsPlaying(true);
      setSelected({ kind: "album", name: albumTracks[0].album });
      setView("albums");
    } catch (e) {
      setError(e.message);
    } finally {
      setDiscoverBusy(false);
    }
  }

  const runRadio = useCallback(async (q) => {
    setRadioBusy(true);
    setError("");
    try {
      setRadioStations(await searchStations({ query: q }));
    } catch (e) {
      setError(e.message);
    } finally {
      setRadioBusy(false);
    }
  }, []);

  useEffect(() => {
    if (view === "radio" && !radioStations.length && !radioBusy) runRadio("");
  }, [view]);

  const openPodcast = useCallback(async (show) => {
    setPodcastBusy(true);
    setError("");
    try {
      setOpenShow(await loadFeed(show.feed));
    } catch (e) {
      setError(e.message);
    } finally {
      setPodcastBusy(false);
    }
  }, []);

  // A pasted feed URL skips search entirely — that's the route with full coverage.
  const runPodcastSearch = useCallback(async (raw) => {
    const q = raw.trim();
    if (!q) return;
    if (/^https?:\/\//i.test(q)) return openPodcast({ feed: q });

    setPodcastBusy(true);
    setError("");
    try {
      const found = await searchPodcasts(q);
      setPodcastResults(found);
      if (!found.length) setError(`No podcast directory match for "${q}". If you have the feed URL, paste it instead.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setPodcastBusy(false);
    }
  }, [openPodcast]);

  function togglePodcastSub(show) {
    const next = toggleSubscription(podcastSubs, show);
    setPodcastSubs(next);
    saveSubscriptions(next);
  }

  // The YouTube player owns playback while it's on screen, so silence ours.
  useEffect(() => {
    if (!ytVideo) return;
    setIsPlaying(false);
    let cancelled = false;
    loadIframeApi().then((YT) => {
      if (cancelled) return;
      if (ytPlayerRef.current) {
        ytPlayerRef.current.loadVideoById(ytVideo.id);
        return;
      }
      ytPlayerRef.current = new YT.Player("sur-yt-player", {
        videoId: ytVideo.id,
        // origin must be passed or the API postMessages to the wrong target once a second.
        playerVars: { rel: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin },
        events: {
          onStateChange: (e) => { if (e.data === YT.PlayerState.PLAYING) setIsPlaying(false); },
        },
      });
    });
    return () => { cancelled = true; };
  }, [ytVideo?.id]);

  // Leaving the YouTube tab must stop its audio, or two things play at once.
  useEffect(() => {
    if (view !== "youtube" && ytPlayerRef.current?.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo(); } catch { /* not ready */ }
    }
  }, [view]);

  async function openYouTubeLink(value) {
    const id = parseYouTubeId(value);
    if (!id) {
      setError("That doesn't look like a YouTube link or video id.");
      return;
    }
    setYtBusy(true);
    setError("");
    try {
      setYtVideo(await fetchVideoInfo(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setYtBusy(false);
    }
  }

  async function runYouTubeSearch(q) {
    if (!ytKey && !hasSharedKey()) {
      // Try the server proxy first — it may hold the key with none needed here.
      setYtBusy(true);
      try {
        setYtResults(await searchYouTube(q, ""));
        setError("");
        return;
      } catch {
        window.open(youtubeSearchUrl(q), "_blank", "noopener");
        setError("No search key or server proxy, so I opened YouTube in a new tab — copy a video link back here to play it.");
        return;
      } finally {
        setYtBusy(false);
      }
    }
    setYtBusy(true);
    setError("");
    try {
      setYtResults(await searchYouTube(q, ytKey));
    } catch (e) {
      setError(e.message);
    } finally {
      setYtBusy(false);
    }
  }

  async function importPlaylist() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setPlaylists(await importPlaylistFile(playlists, file));
        setError("");
      } catch (e) {
        setError(e.message);
      }
    };
    input.click();
  }

  function sharePlaylist(playlist) {
    const skipped = exportPlaylist(playlist);
    setError(skipped
      ? `Shared ${playlist.tracks.length - skipped} streamable songs. ${skipped} local file${skipped === 1 ? "" : "s"} left out — only you have those.`
      : "");
  }

  /** Films you already own play locally; the rest fall back to YouTube. */
  const ownedAlbums = useMemo(() => {
    const map = new Map();
    for (const album of library.albums) map.set(searchNormalise(album.name), album);
    return map;
  }, [library.albums]);

  const ownedFilm = (film) => ownedAlbums.get(searchNormalise(film.title)) || null;

  function openFilm(film) {
    const owned = ownedFilm(film);
    if (owned) {
      playFrom(owned.tracks, 0);
      setSelected({ kind: "album", name: owned.name });
      setView("albums");
      return;
    }
    playFilmSoundtrack(film);
  }

  /** Films are commercial: send the user to the official upload on YouTube. */
  function playFilmSoundtrack(film) {
    const query = soundtrackQuery(film);
    setYtInput(query);
    setView("youtube");
    runYouTubeSearch(query);
  }

  function playRecent(entry) {
    const track = resolveRecent(entry, tracks);
    if (!track) {
      setError(`“${entry.title}” is one of your own files — reopen your music folder to play it.`);
      return;
    }
    playFrom([track], 0);
  }

  function continueListening() {
    const track = resolveRecent(resume.track, tracks);
    if (!track) {
      setError(`“${resume.track.title}” is one of your own files — reopen your music folder to play it.`);
      return;
    }
    playFrom([track], 0);
    // Seek once the element has the new source loaded.
    const seek = () => {
      if (audioRef.current) audioRef.current.currentTime = resume.position;
    };
    setTimeout(seek, 300);
    clearResume();
    setResume(null);
  }

  function playFrom(list, index) {
    setQueue(list);
    setCurrentIndex(index);
    setIsPlaying(true);
  }

  function togglePlay() {
    if (current) setIsPlaying((p) => !p);
  }

  /** Step through the queue honouring shuffle and repeat. */
  function step(delta) {
    if (currentIndex === null || !queue.length) return;
    if (shuffle && queue.length > 1) {
      let n = currentIndex;
      while (n === currentIndex) n = Math.floor(Math.random() * queue.length);
      setCurrentIndex(n);
      setIsPlaying(true);
      return;
    }
    const n = currentIndex + delta;
    if (n >= queue.length) {
      if (repeat === "off") { setIsPlaying(false); return; }
      setCurrentIndex(0);
    } else if (n < 0) {
      setCurrentIndex(queue.length - 1);
    } else {
      setCurrentIndex(n);
    }
    setIsPlaying(true);
  }

  const next = () => step(1);
  const prev = () => step(-1);

  function onTrackEnded() {
    if (repeat === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }
    next();
  }

  function removeFromQueue(index) {
    setQueue((q) => q.filter((_, i) => i !== index));
    if (index < currentIndex) setCurrentIndex((i) => i - 1);
    else if (index === currentIndex) setIsPlaying(false);
  }

  function toggleLike(id) {
    setLiked((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function openCollection(kind, name) {
    setSelected({ kind, name });
    setView(kind === "album" ? "albums" : kind === "director" ? "directors" : kind === "actor" ? "actors" : "genres");
  }

  const searchResults = useMemo(
    () => searchEverything(query, {
      tracks,
      films: FILMS,
      directors: DIRECTOR_NAMES,
      actors: ACTOR_NAMES,
    }),
    [tracks, query]
  );
  const likedTracks = useMemo(() => tracks.filter((t) => liked.has(t.id)), [tracks, liked]);

  // Known names are listed even with nothing loaded, so the browse dimensions are
  // never dead ends — an empty one offers to search the streaming sources instead.
  const withKnownNames = (collections, names, kind) => {
    const present = new Set(collections.map((c) => c.name));
    const extras = names
      .filter((n) => !present.has(n))
      .map((n) => ({ kind, name: n, tracks: [], count: 0, cover: null, subtitle: "Search online" }));
    return [...collections, ...extras];
  };

  const collectionsFor = {
    albums: library.albums,
    directors: withKnownNames(library.directors, DIRECTOR_NAMES, "director"),
    actors: withKnownNames(library.actors, ACTOR_NAMES, "actor"),
    genres: library.genres,
  };
  const activeCollection = selected
    ? collectionsFor[selected.kind === "album" ? "albums"
      : selected.kind === "director" ? "directors"
      : selected.kind === "actor" ? "actors" : "genres"]
        .find((c) => c.name === selected.name)
    : null;

  const isEmpty = tracks.length === 0;

  return (
    <div className="sur-root">
      <style>{STYLES}</style>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onError={() => {
          if (current?.live) setError(`"${current.title}" isn't responding — stations go offline often, try another.`);
        }}
        onPlaying={() => setError("")}
        onEnded={onTrackEnded}
      />

      <aside className="sur-sidebar">
        <div className="sur-logo sur-display">
          <Music2 size={22} />
          <span>raagam</span>
        </div>
        <nav className="sur-nav">
          <button className={`sur-navbtn ${view === "home" ? "active" : ""}`} onClick={() => { setView("home"); setSelected(null); }}>
            <Home size={17} /> <span>Home</span>
          </button>
          <button className={`sur-navbtn ${view === "search" ? "active" : ""}`} onClick={() => setView("search")}>
            <Search size={17} /> <span>Search</span>
          </button>
          <button className={`sur-navbtn ${view === "discover" ? "active" : ""}`} onClick={() => { setView("discover"); setSelected(null); }}>
            <Globe size={17} /> <span>Discover</span>
          </button>
          <button className={`sur-navbtn ${view === "radio" ? "active" : ""}`} onClick={() => { setView("radio"); setSelected(null); }}>
            <RadioTower size={17} /> <span>Tamil Radio</span>
          </button>
          <button className={`sur-navbtn ${view === "podcasts" ? "active" : ""}`} onClick={() => { setView("podcasts"); setSelected(null); setOpenShow(null); }}>
            <Mic size={17} /> <span>Podcasts</span>
          </button>
          <button className={`sur-navbtn ${view === "youtube" ? "active" : ""}`} onClick={() => { setView("youtube"); setSelected(null); }}>
            <Youtube size={17} /> <span>YouTube</span>
          </button>
        </nav>
        <div className="sur-genres">
          <div className="sur-genres-label">Browse</div>
        </div>
        <nav className="sur-nav">
          <button className={`sur-navbtn ${view === "albums" ? "active" : ""}`} title="Albums" onClick={() => { setView("albums"); setSelected(null); }}>
            <Disc3 size={17} /> <span>Albums ({library.albums.length})</span>
          </button>
          <button className={`sur-navbtn ${view === "movies" ? "active" : ""}`} title="Movies" onClick={() => { setView("movies"); setSelected(null); }}>
            <Film size={17} /> <span>Movies ({FILMS.length})</span>
          </button>
          <button className={`sur-navbtn ${view === "directors" ? "active" : ""}`} title="Music Directors" onClick={() => { setView("directors"); setSelected(null); }}>
            <UserRound size={17} /> <span>Music Directors ({library.directors.length})</span>
          </button>
          <button className={`sur-navbtn ${view === "actors" ? "active" : ""}`} title="Actors" onClick={() => { setView("actors"); setSelected(null); }}>
            <Clapperboard size={17} /> <span>Actors ({library.actors.length})</span>
          </button>
          <button className={`sur-navbtn ${view === "genres" ? "active" : ""}`} title="Genres" onClick={() => { setView("genres"); setSelected(null); }}>
            <Tags size={17} /> <span>Genres ({library.genres.length})</span>
          </button>
          <button className={`sur-navbtn ${view === "liked" ? "active" : ""}`} title="Liked" onClick={() => { setView("liked"); setSelected(null); }}>
            <Heart size={17} /> <span>Liked ({liked.size})</span>
          </button>
          <button className={`sur-navbtn ${view === "playlists" ? "active" : ""}`} title="Playlists" onClick={() => { setView("playlists"); setActivePlaylist(null); }}>
            <ListMusic size={17} /> <span>Playlists ({playlists.length})</span>
          </button>
          <button className={`sur-navbtn ${view === "queue" ? "active" : ""}`} title="Up Next" onClick={() => setView("queue")}>
            <ListPlus size={17} /> <span>Up Next ({queue.length})</span>
          </button>
        </nav>
        <nav className="sur-nav sur-nav-foot">
          <button className="sur-navbtn" title="Add my music folder" onClick={importLocal} disabled={!!scan}>
            {scan ? <Loader2 size={17} className="sur-spin-icon" /> : <FolderPlus size={17} />}
            <span>{scan ? "Scanning…" : "Add my music"}</span>
          </button>
        </nav>
      </aside>

      <main className="sur-main">
        <div className="sur-topbar">
          <div className="sur-searchwrap">
            <Search size={15} />
            <input
              placeholder="Search your songs, albums, directors"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setView("search"); }}
            />
          </div>
        </div>

        {error && <p className="sur-error">{error}</p>}
        {scan && <p className="sur-progress">Reading tags… {scan.done} / {scan.total}</p>}

        {view === "home" && (
          <>
            <h1 className="sur-heading sur-display">Welcome back</h1>
            <p className="sur-subtext">
              {isEmpty ? "Add your own songs, or browse free Tamil audio." : `${tracks.length} songs in your library.`}
            </p>
            <div className="sur-actions">
              <button className="sur-btn primary" onClick={importLocal} disabled={!!scan}>                {scan ? <Loader2 size={16} className="sur-spin-icon" /> : <FolderPlus size={16} />}
                {scan ? "Scanning…" : "Add my music folder"}
              </button>
              {savedFolder && isEmpty && (
                <button className="sur-btn" onClick={() => loadFromHandle(savedFolder)} disabled={!!scan}>
                  <FolderPlus size={16} /> Reopen “{savedFolder.name}”
                </button>
              )}
              {savedFolder && (
                <button
                  className="sur-btn"
                  title="Forget the saved folder"
                  onClick={() => { clearFolderHandle(); setSavedFolder(null); }}
                >
                  <Trash2 size={16} /> Forget folder
                </button>
              )}
              <button className="sur-btn" onClick={() => setView("discover")}>
                <Globe size={16} /> Browse free Tamil audio
              </button>
            </div>
            {isEmpty && (
              <p className="sur-note">
                Your files stay on this device — nothing is uploaded. Album, music director and
                genre are read from each file's tags, or from the folder names when tags are missing.
                {supportsPersistentFolder()
                  ? " The folder is remembered, so next time it's one click to reopen."
                  : " This browser can't remember folders — Chrome or Edge can."}
              </p>
            )}

            {resume && (
              <div className="sur-resume">
                <Cover src={resume.track.cover} seed={resume.track.album || resume.track.title} size={20} />
                <div className="sur-resume-meta">
                  <p className="t">Continue — {resume.track.title}</p>
                  <p className="a">{resume.track.artist} · stopped at {fmtTime(resume.position)}</p>
                </div>
                <button className="sur-btn primary" onClick={continueListening}>
                  <Play size={15} /> Resume
                </button>
                <button className="sur-btn" onClick={() => { clearResume(); setResume(null); }}>
                  Dismiss
                </button>
              </div>
            )}

            {recent.length > 0 && (
              <div className="sur-section">
                <div className="sur-section-title">
                  <h2>Recently played</h2>
                  <span className="tag">{recent.length}</span>
                  <button
                    className="sur-heart"
                    title="Clear history"
                    onClick={() => { clearRecent(); setRecent([]); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="sur-row">
                  {recent.slice(0, 12).map((entry) => (
                    <div className="sur-card" key={entry.id} onClick={() => playRecent(entry)}>
                      <div className="sur-tile-art" style={{ marginBottom: 10 }}>
                        <Cover src={entry.cover} seed={entry.album || entry.title} size={24} />
                      </div>
                      <p className="sur-card-title">{entry.title}</p>
                      <p className="sur-card-artist">{entry.artist}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sur-section">
              <div className="sur-section-title"><h2>Where the music comes from</h2></div>              <div className="sur-sources">
                {[
                  { icon: FolderPlus, name: "My music", music: "Whatever you own", keep: "Yours to keep", go: importLocal },
                  { icon: Globe, name: "Discover", music: "Free-licensed only", keep: "Yours to keep", go: () => setView("discover") },
                  { icon: RadioTower, name: "Tamil Radio", music: "Current hits, live", keep: "Listen only", go: () => setView("radio") },
                  { icon: Youtube, name: "YouTube", music: "Everything, incl. BGM", keep: "Listen only", go: () => setView("youtube") },
                ].map((s) => (
                  <button className="sur-source" key={s.name} onClick={s.go}>
                    <s.icon size={18} />
                    <p className="t">{s.name}</p>
                    <p className="a">{s.music}</p>
                    <span className="sur-badge">{s.keep}</span>
                  </button>
                ))}
              </div>
              <p className="sur-note">
                Commercial film music — Yuvan, Anirudh, Silambarasan, BGMs — is licensed, so it
                streams from Radio and YouTube (where ads and broadcast fees pay the artists)
                rather than being downloadable. Discover only carries music that is genuinely free.
              </p>
            </div>
            {!isEmpty && (
              <>
                <SectionRow title="Albums" items={library.albums.slice(0, 12)} onOpen={(c) => openCollection("album", c.name)} />
                <SectionRow title="Music Directors" items={library.directors.slice(0, 12)} round onOpen={(c) => openCollection("director", c.name)} />
                <SectionRow title="Genres" items={library.genres.slice(0, 12)} onOpen={(c) => openCollection("genre", c.name)} />
              </>
            )}
          </>
        )}

        {["albums", "directors", "actors", "genres"].includes(view) && (
          activeCollection ? (
            <>
              <button className="sur-back" onClick={() => setSelected(null)}>
                <ArrowLeft size={14} /> Back
              </button>
              <div className="sur-collection-head">
                <div className="sur-collection-art">
                  <Cover
                    src={activeCollection.cover}
                    seed={activeCollection.name}
                    size={34}
                    lookup={selected.kind === "album"
                      ? { album: activeCollection.name, artist: activeCollection.subtitle }
                      : null}
                  />
                </div>
                <div>
                  <h1 className="sur-heading sur-display">{activeCollection.name}</h1>
                  <p className="sur-subtext">{activeCollection.subtitle} · {activeCollection.count} songs</p>
                </div>
              </div>
              {activeCollection.tracks.length === 0 ? (
                <>
                  {filmsBy(selected.kind === "director"
                    ? { music: activeCollection.name }
                    : { actor: activeCollection.name }).length > 0 && (
                    <>
                      <p className="sur-chips-label">Soundtracks by {activeCollection.name}</p>
                      <div className="sur-grid" style={{ marginBottom: 20 }}>
                        {filmsBy(selected.kind === "director"
                          ? { music: activeCollection.name }
                          : { actor: activeCollection.name }).map((film) => (
                          <div className="sur-tile" key={`${film.title}-${film.year}`} onClick={() => playFilmSoundtrack(film)}>
                            <div className="sur-tile-art"><Cover seed={film.title} size={24} /></div>
                            <p className="sur-tile-title">{film.title}</p>
                            <p className="sur-tile-sub">{film.year} · {selected.kind === "director" ? film.actor : film.music}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="sur-empty" style={{ padding: "6px 0" }}>
                    Nothing by {activeCollection.name} in your library yet.
                  </p>
                  <div className="sur-actions">
                    <button
                      className="sur-btn"
                      onClick={() => {
                        setDiscoverQuery(activeCollection.name);
                        setView("discover");
                        runDiscover(activeCollection.name, "all", freeOnly);
                      }}
                    >
                      <Globe size={16} /> Look in Discover
                    </button>
                    <button
                      className="sur-btn primary"
                      onClick={() => {
                        setYtInput(`${activeCollection.name} songs`);
                        setView("youtube");
                        runYouTubeSearch(`${activeCollection.name} songs`);
                      }}
                    >
                      <Youtube size={16} /> Find on YouTube
                    </button>
                  </div>
                  <p className="sur-note">
                    Commercial film music rarely appears in Discover — YouTube is where
                    {" "}{activeCollection.name}'s catalogue actually lives.
                  </p>
                </>
              ) : (
                <>
                  <div className="sur-actions">
                    <button className="sur-btn primary" onClick={() => playFrom(activeCollection.tracks, 0)}>
                      <Play size={16} /> Play all
                    </button>
                    <button
                      className="sur-btn"
                      onClick={() => {
                        setShuffle(true);
                        playFrom(activeCollection.tracks, Math.floor(Math.random() * activeCollection.tracks.length));
                      }}
                    >
                      <Shuffle size={16} /> Shuffle
                    </button>
                  </div>
                  <TrackList
                    tracks={activeCollection.tracks}
                    onPlay={(idx) => playFrom(activeCollection.tracks, idx)}
                    currentId={current?.id}
                    isPlaying={isPlaying}
                    liked={liked}
                    onToggleLike={toggleLike}
                    onAdd={setAddingTrack}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="sur-heading sur-display">
                {view === "albums" ? "Albums"
                  : view === "directors" ? "Music Directors"
                  : view === "actors" ? "Actors" : "Genres"}
              </h1>
              <p className="sur-subtext">
                {view === "directors" || view === "actors"
                  ? `${library[view].length} in your library · ${collectionsFor[view].length} browsable`
                  : `${collectionsFor[view].length} in your library`}
              </p>
              {isEmpty && view !== "directors" && view !== "actors" ? (
                <p className="sur-empty">Nothing here yet — add your music folder from Home.</p>
              ) : (
                <CollectionGrid
                  items={collectionsFor[view]}
                  round={view === "directors" || view === "actors"}
                  icon={view === "albums" ? Disc3 : view === "genres" ? Tags : UserRound}
                  onOpen={(c) => openCollection(c.kind, c.name)}
                />
              )}
            </>
          )
        )}

        {view === "search" && (
          <>
            <h1 className="sur-heading sur-display">Search</h1>
            {query.trim() === "" && (
              <p className="sur-empty">Search your songs, or any film, music director or actor.</p>
            )}
            {query.trim() !== "" && searchResults.total === 0 && (
              <p className="sur-empty">No results for “{query}”.</p>
            )}

            {searchResults.tracks.length > 0 && (
              <>
                <p className="sur-chips-label">Songs in your library ({searchResults.tracks.length})</p>
                <TrackList
                  tracks={searchResults.tracks}
                  onPlay={(idx) => playFrom(searchResults.tracks, idx)}
                  currentId={current?.id}
                  isPlaying={isPlaying}
                  liked={liked}
                  onToggleLike={toggleLike}
                  onAdd={setAddingTrack}
                />
              </>
            )}

            {searchResults.films.length > 0 && (
              <>
                <p className="sur-chips-label">Movies ({searchResults.films.length})</p>
                <div className="sur-grid" style={{ marginBottom: 22 }}>
                  {searchResults.films.map((film) => {
                    const owned = ownedFilm(film);
                    return (
                      <div className="sur-tile" key={`${film.title}-${film.year}`} onClick={() => openFilm(film)}>
                        <div className="sur-tile-art"><Cover src={owned?.cover} seed={film.title} size={24} /></div>
                        <p className="sur-tile-title">{film.title}</p>
                        <p className="sur-tile-sub">{film.year} · {film.music}</p>
                        <span className={`sur-badge ${owned ? "owned" : ""}`}>
                          {owned ? `♪ ${owned.count} in library` : "YouTube"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {[["Music Directors", searchResults.directors, "director"],
              ["Actors", searchResults.actors, "actor"]].map(([label, names, kind]) =>
              names.length > 0 ? (
                <React.Fragment key={kind}>
                  <p className="sur-chips-label">{label} ({names.length})</p>
                  <div className="sur-chips" style={{ marginBottom: 20 }}>
                    {names.map((name) => (
                      <button key={name} className="sur-chip" onClick={() => openCollection(kind, name)}>
                        {name}
                      </button>
                    ))}
                  </div>
                </React.Fragment>
              ) : null
            )}
          </>
        )}

        {view === "discover" && (
          <>
            <h1 className="sur-heading sur-display">Discover</h1>
            <p className="sur-subtext">Free Tamil audio hosted publicly on the Internet Archive.</p>
            <div className="sur-actions">
              <div className="sur-searchwrap">
                <Search size={15} />
                <input
                  placeholder="Try a singer, film, or music director"
                  value={discoverQuery}
                  onChange={(e) => setDiscoverQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runDiscover(discoverQuery, discoverCategory, freeOnly)}
                />
              </div>
              <button className="sur-btn" onClick={() => runDiscover(discoverQuery, discoverCategory, freeOnly)} disabled={discoverBusy}>
                {discoverBusy ? <Loader2 size={16} className="sur-spin-icon" /> : <Search size={16} />} Search
              </button>
              <button
                className={`sur-btn ${freeOnly ? "primary" : "warn"}`}
                onClick={() => setFreeOnly((v) => !v)}
                title="Only items carrying an explicit Creative Commons or public-domain licence"
              >
                {freeOnly ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                {freeOnly ? "Free-licensed only" : "Unverified uploads"}
              </button>
            </div>
            <div className="sur-chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`sur-chip ${discoverCategory === c.id ? "active" : ""}`}
                  onClick={() => setDiscoverCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="sur-chips-label">Search by actor</p>
            <div className="sur-chips">
              {ACTOR_NAMES.map((name) => (
                <button
                  key={name}
                  className={`sur-chip ${discoverQuery === name ? "active" : ""}`}
                  onClick={() => { setDiscoverQuery(name); runDiscover(name, discoverCategory, freeOnly); }}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="sur-chips-label">By era</p>
            <div className="sur-chips">
              {["1980s", "1990s", "2000s", "2010s"].map((era) => (
                <button
                  key={era}
                  className={`sur-chip ${discoverQuery === era ? "active" : ""}`}
                  onClick={() => { setDiscoverQuery(era); runDiscover(era, discoverCategory, freeOnly); }}
                >
                  {era}
                </button>
              ))}
            </div>
            <p className={`sur-note ${freeOnly ? "" : "sur-warn"}`}>
              {freeOnly
                ? "Showing only uploads with an explicit Creative Commons or public-domain licence — safe to keep and share. Commercial film music is licensed, so film albums, BGM and OST are almost empty here."
                : "Warning: these are unverified user uploads. Most commercial Tamil film music on archive.org was posted without permission — playing or sharing it carries the copyright risk you asked to avoid. Switch back to “Free-licensed only”."}
            </p>
            {discoverBusy && !discoverResults.length && <p className="sur-progress">Searching…</p>}
            {!discoverBusy && !discoverResults.length && hiddenByLicence > 0 && (
              <div className="sur-empty">
                <p>
                  Nothing free-licensed matches, but <strong>{hiddenByLicence}</strong>{" "}
                  unverified upload{hiddenByLicence === 1 ? "" : "s"} do.
                </p>
                <p className="sur-note" style={{ margin: "8px 0 0" }}>
                  Those are commercial recordings posted without a licence — the copyright risk
                  you asked to avoid.
                </p>
                <button className="sur-btn warn" style={{ marginTop: 12 }} onClick={() => setFreeOnly(false)}>
                  <ShieldAlert size={16} /> Show them anyway
                </button>
              </div>
            )}
            {!discoverBusy && !discoverResults.length && hiddenByLicence === 0 && (
              <p className="sur-empty">No results — try another category or search.</p>
            )}
            <CollectionGrid
              items={discoverResults.map((r) => ({ ...r, subtitle: r.licence || r.creator || r.genre }))}
              icon={Disc3}
              onOpen={openArchiveItem}
            />
          </>
        )}

        {view === "radio" && (
          <>
            <h1 className="sur-heading sur-display">Tamil Radio</h1>
            <p className="sur-subtext">Live stations — current film music, legally licensed by the broadcaster.</p>
            <div className="sur-actions">
              <div className="sur-searchwrap">
                <Search size={15} />
                <input
                  placeholder="Filter stations by name"
                  value={radioQuery}
                  onChange={(e) => setRadioQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runRadio(radioQuery)}
                />
              </div>
              <button className="sur-btn" onClick={() => runRadio(radioQuery)} disabled={radioBusy}>
                {radioBusy ? <Loader2 size={16} className="sur-spin-icon" /> : <Search size={16} />} Search
              </button>
            </div>
            <p className="sur-note">
              Stations pay the broadcast royalties, so this is the one legal way to hear current
              commercial Tamil film music — the songs no free download source can legitimately offer.
            </p>
            {radioBusy && !radioStations.length && <p className="sur-progress">Finding stations…</p>}
            {!radioBusy && !radioStations.length && <p className="sur-empty">No stations found.</p>}
            <CollectionGrid
              items={radioStations}
              icon={RadioTower}
              onOpen={(station) => playFrom(radioStations, radioStations.indexOf(station))}
            />
          </>
        )}

        {view === "podcasts" && (
          <>
            {openShow ? (
              <>
                <button className="sur-btn" onClick={() => setOpenShow(null)}>
                  <ArrowLeft size={16} /> Podcasts
                </button>
                <h1 className="sur-heading sur-display" style={{ marginTop: 16 }}>{openShow.title}</h1>
                <p className="sur-subtext">{openShow.episodes.length} episodes</p>
                <div className="sur-actions">
                  <button className="sur-btn primary" onClick={() => playFrom(openShow.episodes, 0)} disabled={!openShow.episodes.length}>
                    <Play size={16} /> Play latest
                  </button>
                  <button className="sur-btn" onClick={() => togglePodcastSub(openShow)}>
                    {isSubscribed(podcastSubs, openShow.feed) ? <Trash2 size={16} /> : <Plus size={16} />}
                    {isSubscribed(podcastSubs, openShow.feed) ? " Unfollow" : " Follow"}
                  </button>
                </div>
                <TrackList
                  tracks={openShow.episodes}
                  onPlay={(idx) => playFrom(openShow.episodes, idx)}
                  currentId={current?.id}
                  isPlaying={isPlaying}
                  liked={liked}
                  onToggleLike={toggleLike}
                  onAdd={setAddingTrack}
                />
              </>
            ) : (
              <>
                <h1 className="sur-heading sur-display">Podcasts</h1>
                <p className="sur-subtext">Open RSS feeds — no account, no platform ads.</p>
                <div className="sur-actions">
                  <div className="sur-searchwrap">
                    <Rss size={15} />
                    <input
                      placeholder="Paste a podcast RSS feed URL, or search by name"
                      value={podcastQuery}
                      onChange={(e) => setPodcastQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runPodcastSearch(podcastQuery)}
                    />
                  </div>
                  <button className="sur-btn" onClick={() => runPodcastSearch(podcastQuery)} disabled={podcastBusy}>
                    {podcastBusy ? <Loader2 size={16} className="sur-spin-icon" /> : <Search size={16} />} Open
                  </button>
                </div>
                <p className="sur-note">
                  Podcasts publish an open RSS feed so any app can read it — there is no licence to
                  buy and no ad to skip. Search by name, or paste a feed URL directly if you have one.
                </p>

                {podcastSubs.length > 0 && (
                  <SectionRow
                    title="Following"
                    items={podcastSubs.map((s) => ({ ...s, kind: "podcast", name: s.title, cover: s.image, subtitle: "Followed" }))}
                    onOpen={openPodcast}
                  />
                )}

                {podcastResults.length > 0 && (
                  <SectionRow
                    title="Search results"
                    items={podcastResults.map((s) => ({ ...s, kind: "podcast", name: s.title, cover: s.image, subtitle: s.note }))}
                    onOpen={openPodcast}
                  />
                )}

                <SectionRow
                  title="Tamil podcasts to start with"
                  items={CURATED_PODCASTS.map((s) => ({ ...s, kind: "podcast", name: s.title, cover: null, subtitle: s.note }))}
                  onOpen={openPodcast}
                />
              </>
            )}
          </>
        )}

        {view === "queue" && (
          <>
            <h1 className="sur-heading sur-display">Up Next</h1>
            <p className="sur-subtext">
              {queue.length ? `${queue.length} in queue${shuffle ? " · shuffling" : ""}` : "Nothing queued."}
            </p>
            {queue.length > 0 && (
              <TrackList
                tracks={queue}
                onPlay={(idx) => setCurrentIndex(idx) || setIsPlaying(true)}
                currentId={current?.id}
                isPlaying={isPlaying}
                liked={liked}
                onToggleLike={toggleLike}
                onAdd={setAddingTrack}
                onRemove={removeFromQueue}
              />
            )}
          </>
        )}

        {view === "playlists" && (
          activePlaylist ? (
            <>
              <button className="sur-back" onClick={() => setActivePlaylist(null)}>
                <ArrowLeft size={14} /> Playlists
              </button>
              <h1 className="sur-heading sur-display">{activePlaylist.name}</h1>
              <p className="sur-subtext">{activePlaylist.tracks.length} songs</p>
              <div className="sur-actions">
                <button className="sur-btn" onClick={() => sharePlaylist(activePlaylist)}>
                  <Share2 size={16} /> Share as file
                </button>
              </div>
              {activePlaylist.tracks.length === 0 ? (
                <p className="sur-empty">Empty — use the + on any song to add it here.</p>
              ) : (
                <TrackList
                  tracks={activePlaylist.tracks}
                  onPlay={(idx) => playFrom(activePlaylist.tracks, idx)}
                  currentId={current?.id}
                  isPlaying={isPlaying}
                  liked={liked}
                  onToggleLike={toggleLike}
                  onRemove={(idx) => {
                    const updated = removeFromPlaylist(playlists, activePlaylist.id, activePlaylist.tracks[idx].id);
                    setPlaylists(updated);
                    setActivePlaylist(updated.find((p) => p.id === activePlaylist.id));
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h1 className="sur-heading sur-display">Playlists</h1>
              <p className="sur-subtext">Saved on this device.</p>
              <div className="sur-actions">
                <div className="sur-searchwrap">
                  <ListMusic size={15} />
                  <input
                    placeholder="New playlist name"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newPlaylistName.trim()) {
                        setPlaylists(createPlaylist(playlists, newPlaylistName));
                        setNewPlaylistName("");
                      }
                    }}
                  />
                </div>
                <button
                  className="sur-btn primary"
                  disabled={!newPlaylistName.trim()}
                  onClick={() => { setPlaylists(createPlaylist(playlists, newPlaylistName)); setNewPlaylistName(""); }}
                >
                  <Plus size={16} /> Create
                </button>
                <button className="sur-btn" onClick={importPlaylist}>
                  <Download size={16} /> Import shared playlist
                </button>
              </div>
              <p className="sur-note">
                Playlists live on this device only. “Share as file” exports the streamable tracks
                so a friend can import them — your own files stay out, since only you have those.
              </p>
              {playlists.length === 0 && <p className="sur-empty">No playlists yet.</p>}
              <div className="sur-list">
                {playlists.map((p) => (
                  <div key={p.id} className="sur-row-item" onClick={() => setActivePlaylist(p)}>
                    <div className="sur-idx"><ListMusic size={15} /></div>
                    <div className="sur-thumb"><Cover src={p.tracks[0]?.cover} seed={p.name} size={14} /></div>
                    <div className="sur-meta">
                      <p className="t">{p.name}</p>
                      <p className="a">{p.tracks.length} songs</p>
                    </div>
                    <button
                      className="sur-heart"
                      title="Delete playlist"
                      onClick={(e) => { e.stopPropagation(); setPlaylists(deletePlaylist(playlists, p.id)); }}
                    >
                      <Trash2 size={15} />
                    </button>
                    <span className="sur-dur" />
                  </div>
                ))}
              </div>
            </>
          )
        )}

        {view === "youtube" && (
          <>
            <h1 className="sur-heading sur-display">YouTube</h1>
            <p className="sur-subtext">Plays in YouTube's own player, so the labels get paid.</p>

            <div className="sur-actions">
              <div className="sur-searchwrap">
                <Youtube size={15} />
                <input
                  placeholder="Paste a YouTube link, or search if a key is set"
                  value={ytInput}
                  onChange={(e) => setYtInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    parseYouTubeId(ytInput) ? openYouTubeLink(ytInput) : runYouTubeSearch(ytInput);
                  }}
                />
              </div>
              <button
                className="sur-btn primary"
                disabled={ytBusy || !ytInput.trim()}
                onClick={() => (parseYouTubeId(ytInput) ? openYouTubeLink(ytInput) : runYouTubeSearch(ytInput))}
              >
                {ytBusy ? <Loader2 size={16} className="sur-spin-icon" /> : <Play size={16} />}
                {parseYouTubeId(ytInput) ? "Play" : ytKey ? "Search" : "Search on YouTube"}
              </button>
            </div>

            <div className="sur-yt-wrap" style={{ display: ytVideo ? "block" : "none" }}>
              <div className="sur-yt-frame"><div id="sur-yt-player" /></div>
              {ytVideo && (
                <p className="sur-subtext" style={{ marginTop: 10 }}>
                  <strong>{ytVideo.title}</strong> · {ytVideo.channel}
                </p>
              )}
            </div>

            {ytResults.length > 0 && (
              <div className="sur-grid" style={{ marginTop: 18 }}>
                {ytResults.map((v) => (
                  <div className="sur-tile" key={v.id} onClick={() => setYtVideo(v)}>
                    <div className="sur-tile-art">
                      <Cover src={v.thumbnail} seed={v.title} size={24} />
                    </div>
                    <p className="sur-tile-title">{v.title}</p>
                    <p className="sur-tile-sub">{v.channel}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="sur-note" style={{ marginTop: 22 }}>
              The video stays visible on purpose: YouTube's terms require their player be shown,
              and forbid extracting or downloading the audio. Played this way, every view is
              counted and monetised for the rights-holder — which is what keeps this legal.
            </p>

            <p className="sur-chips-label">In-app search (optional)</p>
            <div className="sur-actions">
              <div className="sur-searchwrap">
                <KeyRound size={15} />
                <input
                  type="password"
                  placeholder="YouTube Data API key — stored only on this device"
                  value={ytKey}
                  onChange={(e) => setYtKey(e.target.value)}
                />
              </div>
              <button
                className="sur-btn"
                onClick={() => { setApiKey(ytKey); setError(ytKey.trim() ? "Key saved — try searching now." : "Key cleared."); }}
              >
                Save key
              </button>
            </div>
            <p className="sur-note">
              Pasting links never needs a key. For in-app search, the safest setup is the
              included serverless proxy: set <strong>YOUTUBE_API_KEY</strong> in your host's
              environment and the key stays on the server, never in this page. A key typed
              below is stored on this device only — and a key built into the bundle is
              readable by anyone who opens it.
            </p>
          </>
        )}

        {view === "movies" && (
          <>
            <h1 className="sur-heading sur-display">Movies</h1>
            <p className="sur-subtext">Tamil soundtracks — pick one to hear it on YouTube.</p>
            <div className="sur-chips">
              <button className={`sur-chip ${filmDecade === "" ? "active" : ""}`} onClick={() => setFilmDecade("")}>
                All
              </button>
              {DECADES.map((d) => (
                <button key={d} className={`sur-chip ${filmDecade === d ? "active" : ""}`} onClick={() => setFilmDecade(d)}>
                  {d}
                </button>
              ))}
            </div>
            <p className="sur-note">
              Owned soundtracks play from your library as audio. The rest open the official
              upload on YouTube — that's video, so it uses roughly five times the data of an
              audio file. Buying an album is a one-off: the files are yours, play offline at
              no data cost, and turn gold here. Background scores were usually never released
              commercially, so those stay YouTube-only.
            </p>
            <div className="sur-grid">
              {filmsBy({ decade: filmDecade }).map((film) => {
                const owned = ownedFilm(film);
                return (
                  <div className="sur-tile" key={`${film.title}-${film.year}`} onClick={() => openFilm(film)}>
                    <div className="sur-tile-art">
                      <Cover src={owned?.cover} seed={film.title} size={26} />
                    </div>
                    <p className="sur-tile-title">{film.title}</p>
                    <p className="sur-tile-sub">{film.year} · {film.music}</p>
                    <span className={`sur-badge ${owned ? "owned" : ""}`}>
                      {owned ? `♪ ${owned.count} in library` : "YouTube"}
                    </span>
                    {!owned && (
                      <span className="sur-buy">
                        {STORES.map((store) => (
                          <a
                            key={store.name}
                            href={store.url(film)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {store.name}
                          </a>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === "liked" && (          <>
            <h1 className="sur-heading sur-display">Liked</h1>
            <p className="sur-subtext">Songs you've hearted.</p>
            {likedTracks.length === 0 && <p className="sur-empty">Tap the heart on any song to save it here.</p>}
            {likedTracks.length > 0 && (
              <TrackList
                tracks={likedTracks}
                onPlay={(idx) => playFrom(likedTracks, idx)}
                currentId={current?.id}
                isPlaying={isPlaying}
                liked={liked}
                onToggleLike={toggleLike}
                onAdd={setAddingTrack}
              />
            )}
          </>
        )}
      </main>

      {addingTrack && (
        <div className="sur-sheet" onClick={() => setAddingTrack(null)}>
          <div className="sur-sheet-inner" onClick={(e) => e.stopPropagation()}>
            <h3>Add “{addingTrack.title}” to…</h3>
            {playlists.length === 0 && <p className="sur-note">No playlists yet — create one first.</p>}
            {playlists.map((p) => (
              <button
                key={p.id}
                className="sur-sheet-item"
                onClick={() => { setPlaylists(addToPlaylist(playlists, p.id, addingTrack)); setAddingTrack(null); }}
              >
                <ListMusic size={15} /> {p.name} <span className="sur-dur">{p.tracks.length}</span>
              </button>
            ))}
            <button
              className="sur-sheet-item"
              onClick={() => {
                const updated = createPlaylist(playlists, newPlaylistName.trim() || `Playlist ${playlists.length + 1}`);
                setPlaylists(addToPlaylist(updated, updated[updated.length - 1].id, addingTrack));
                setNewPlaylistName("");
                setAddingTrack(null);
              }}
            >
              <Plus size={15} /> New playlist
            </button>
          </div>
        </div>
      )}

      <div className="sur-player">        <div className="sur-np">
          {current ? (
            <>
              <div className="sur-vinyl-wrap">
                <div className={`sur-vinyl-glow ${isPlaying ? "on" : ""}`} />
                <div className={`sur-vinyl ${isPlaying ? "spin" : ""}`}>
                  <Cover
                    src={current.cover}
                    seed={current.album || current.title}
                    size={16}
                    lookup={{ album: current.album, artist: current.director }}
                  />
                </div>
              </div>
              <div className="sur-np-meta">
                <p className="t">{current.title}</p>
                <p className="a">{current.artist}</p>
              </div>
              <button className={`sur-heart ${liked.has(current.id) ? "liked" : ""}`} onClick={() => toggleLike(current.id)}>
                <Heart size={16} fill={liked.has(current.id) ? "currentColor" : "none"} />
              </button>
            </>
          ) : (
            <p className="sur-noqueue">Nothing playing yet</p>
          )}
        </div>

        <div className="sur-center">
          <div className="sur-controls">
            <button
              className={`sur-ctrlbtn ${shuffle ? "on" : ""}`}
              onClick={() => setShuffle((s) => !s)}
              title={shuffle ? "Shuffle on" : "Shuffle off"}
            >
              <Shuffle size={15} />
            </button>
            <button className="sur-ctrlbtn" onClick={prev} disabled={!current}><SkipBack size={17} fill="currentColor" /></button>
            <button className="sur-playbtn" onClick={togglePlay} disabled={!current}>
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>
            <button className="sur-ctrlbtn" onClick={next} disabled={!current}><SkipForward size={17} fill="currentColor" /></button>
            <button
              className={`sur-ctrlbtn ${repeat !== "off" ? "on" : ""}`}
              onClick={() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))}
              title={`Repeat: ${repeat}`}
            >
              {repeat === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
          </div>
          <div className="sur-seek">
            <span>{current?.live ? "LIVE" : fmtTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={(e) => {
                const t = Number(e.target.value);
                setCurrentTime(t);
                if (audioRef.current) audioRef.current.currentTime = t;
              }}
              disabled={!current || current.live}
            />
            <span>{current?.live ? "●" : fmtTime(duration)}</span>
          </div>
        </div>

        <div className="sur-right">
          <button
            className={`sur-ctrlbtn ${sleepLeft ? "on" : ""}`}
            title={sleepLeft ? `Sleep in ${fmtTime(sleepLeft)}` : "Sleep timer"}
            onClick={() => setSleepMinutes((m) => (m === 0 ? 15 : m === 15 ? 30 : m === 30 ? 60 : 0))}
          >
            <Moon size={15} />
          </button>
          {sleepLeft > 0 && <span className="sur-sleep">{fmtTime(sleepLeft)}</span>}
          {volume === 0 ? <VolumeX size={16} color="var(--muted)" /> : <Volume2 size={16} color="var(--muted)" />}
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

function Cover({ src, seed = "", alt = "", size = 18, lookup = null }) {
  const [failed, setFailed] = useState(false);
  const [found, setFound] = useState(null);

  useEffect(() => {
    // Only reach out for art when there's nothing usable to show.
    if (!lookup || (src && !failed)) return;
    let live = true;
    lookupCover(lookup.album, lookup.artist).then((url) => live && url && setFound(url));
    return () => { live = false; };
  }, [lookup?.album, lookup?.artist, src, failed]);

  const url = found || (failed ? null : src);
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        onError={() => setFailed(true)}
        // archive.org auto-generates a 180x45 waveform for every audio item;
        // it isn't cover art and makes every album look identical.
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.target;
          if (h && (h < 80 || w / h > 2)) setFailed(true);
        }}
      />
    );
  }
  return <GeneratedArt seed={seed} size={size} />;
}

// A deterministic tile so every album is visually distinct even with no artwork.
function GeneratedArt({ seed, size }) {
  const text = String(seed || "?");
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 360;
  const initials = text.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/)
    .slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div
      className="sur-genart"
      style={{ background: `linear-gradient(135deg, hsl(${hash} 55% 32%), hsl(${(hash + 48) % 360} 60% 18%))` }}
    >
      <span style={{ fontSize: Math.max(11, size) }}>{initials}</span>
    </div>
  );
}

function CollectionGrid({ items, onOpen, round = false, icon = Disc3 }) {
  return (
    <div className="sur-grid">
      {items.map((item) => (
        <div className="sur-tile" key={item.id || `${item.kind}:${item.name}`} onClick={() => onOpen(item)}>
          <div className={`sur-tile-art ${round ? "round" : ""}`}>
            <Cover src={item.cover} seed={item.name || item.title} size={26} />
          </div>
          <p className="sur-tile-title">{item.name || item.title}</p>
          <p className="sur-tile-sub">{item.subtitle}</p>
        </div>
      ))}
    </div>
  );
}

function SectionRow({ title, items, onOpen, round = false }) {
  if (!items.length) return null;
  return (
    <div className="sur-section">
      <div className="sur-section-title">
        <h2>{title}</h2>
        <span className="tag">{items.length}</span>
      </div>
      <div className="sur-row">
        {items.map((item) => (
          <div className="sur-card" key={`${item.kind}:${item.name}`} onClick={() => onOpen(item)}>
            <div className={`sur-tile-art ${round ? "round" : ""}`} style={{ marginBottom: 10 }}>
              <Cover src={item.cover} seed={item.name} size={24} />
            </div>
            <p className="sur-card-title">{item.name}</p>
            <p className="sur-card-artist">{item.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackList({ tracks, onPlay, currentId, isPlaying, liked, onToggleLike, onAdd, onRemove }) {
  return (
    <div className="sur-list">
      {tracks.map((t, idx) => {
        const active = currentId === t.id;
        return (
          <div key={`${t.id}:${idx}`} className={`sur-row-item ${active ? "playing" : ""}`} onClick={() => onPlay(idx)}>
            <div className="sur-idx">
              {active && isPlaying ? (
                <div className="sur-eq"><span /><span /><span /></div>
              ) : (
                idx + 1
              )}
            </div>
            <div className="sur-thumb"><Cover src={t.cover} seed={t.album || t.title} size={14} /></div>
            <div className="sur-meta">
              <p className="t">{t.title}</p>
              <p className="a">
                {t.director && t.director !== "Unknown" && t.director !== t.artist
                  ? `${t.artist} · ${t.director}`
                  : t.artist}
              </p>
            </div>
            <div className="sur-rowacts">
              <button
                className={`sur-heart ${liked.has(t.id) ? "liked" : ""}`}
                onClick={(e) => { e.stopPropagation(); onToggleLike(t.id); }}
              >
                <Heart size={15} fill={liked.has(t.id) ? "currentColor" : "none"} />
              </button>
              {onAdd && (
                <button className="sur-heart" title="Add to playlist" onClick={(e) => { e.stopPropagation(); onAdd(t); }}>
                  <Plus size={15} />
                </button>
              )}
              {onRemove && (
                <button className="sur-heart" title="Remove" onClick={(e) => { e.stopPropagation(); onRemove(idx); }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <span className="sur-dur">{t.live ? "LIVE" : t.duration ? fmtTime(t.duration) : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
