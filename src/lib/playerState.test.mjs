import test from "node:test";
import assert from "node:assert/strict";
import { storedTrack, resolveTrack, loadQueue, saveQueue, loadFavorites, saveFavorites,
  removeQueueTrack, moveQueueTrack } from "./playerState.js";
import { savePlaylists, loadPlaylists } from "./playlists.js";

const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
};
const local = { id: "local:Album/song.mp3:128:99", filePath: "Album/song.mp3", fileKey: "Album/song.mp3:128:99",
  source: "local", title: "Song", src: "blob:audio", cover: "blob:cover" };
const remote = { id: "archive:1", source: "archive", title: "Stream", src: "https://example.org/song.mp3" };

test("saved queue and favorites survive reload without dead blob URLs", () => {
  saveQueue([local, remote], 1);
  saveFavorites([local]);
  const restored = loadQueue();
  assert.equal(restored.currentIndex, 1);
  assert.equal(restored.queue[0].src, null);
  assert.equal(restored.queue[0].cover, null);
  assert.equal(restored.queue[1].src, remote.src);
  assert.equal(loadFavorites()[0].id, local.id);
  assert.equal(resolveTrack(restored.queue[0], []), null);
  assert.equal(resolveTrack(restored.queue[0], [local]).src, "blob:audio");
});

test("playlist storage reconnects current and legacy local tracks", () => {
  savePlaylists([{ id: "p", tracks: [local] }]);
  const entry = loadPlaylists()[0].tracks[0];
  assert.equal(entry.src, null);
  assert.equal(resolveTrack(entry, [local]), local);
  assert.equal(resolveTrack({ id: "local:Album/song.mp3:7", source: "local", src: "blob:expired" }, [local]), local);
  assert.equal(resolveTrack({ id: "local:Album/other.mp3:7", source: "local", src: "blob:expired" }, [local]), null);
  assert.equal(local.src, "blob:audio", "saving must not mutate the active track");
});

test("queue removal keeps selection valid, including the final entry", () => {
  const queue = [local, remote, { ...remote, id: "last" }];
  assert.equal(removeQueueTrack(queue, 1, 0).currentIndex, 0);
  assert.equal(removeQueueTrack(queue, 2, 2).currentIndex, 1);
  assert.equal(removeQueueTrack(queue, 1, 1).queue[1].id, "last");
  assert.deepEqual(removeQueueTrack([local], 0, 0), { queue: [], currentIndex: null });
  assert.deepEqual(removeQueueTrack(queue, null, 1).currentIndex, null);
});

test("reordering preserves the selected occurrence even with duplicate songs", () => {
  const queue = [remote, local, remote];
  const moved = moveQueueTrack(queue, 2, 2, 0);
  assert.equal(moved.currentIndex, 0);
  assert.equal(moved.queue[1], remote);
  assert.equal(moveQueueTrack(queue, 1, 0, 2).currentIndex, 0);
  assert.deepEqual(moveQueueTrack(queue, 1, 0, -1), { queue, currentIndex: 1 });
});

test("malformed storage and invalid queue selection recover safely", () => {
  data.set("sur.queue.v1", "not json");
  assert.deepEqual(loadQueue(), { queue: [], currentIndex: null });
  data.set("sur.queue.v1", JSON.stringify({ queue: [null, remote], currentIndex: 99 }));
  assert.deepEqual(loadQueue(), { queue: [remote], currentIndex: 0 });
  data.set("sur.favorites.v1", JSON.stringify([null, false, remote]));
  assert.deepEqual(loadFavorites(), [remote]);
});

test("storage quota failure never interrupts active playback", () => {
  const setter = localStorage.setItem;
  localStorage.setItem = () => { throw new Error("Quota exceeded"); };
  try {
    assert.equal(saveQueue([local], 0), false);
    assert.equal(saveFavorites([local]), false);
    assert.equal(storedTrack(local).src, null);
  } finally { localStorage.setItem = setter; }
});
