import React from "react";
import ReactDOM from "react-dom/client";
import SurMusicPlayer from "./App.jsx";

if (import.meta.env.PROD && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SurMusicPlayer />
  </React.StrictMode>
);
