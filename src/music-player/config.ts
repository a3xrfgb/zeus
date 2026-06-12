/** Public asset base for the embedded music player (Vite `public/` folder). */
export const MUSIC_PUBLIC_BASE = `${import.meta.env.BASE_URL}music-player`;

export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";
export const SPOTIFY_REDIRECT_URL =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URL ?? "http://127.0.0.1:5173";
