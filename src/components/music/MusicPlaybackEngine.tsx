import { useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentTrack, useMusicStore } from "../../store/musicStore";

function trackSrc(path: string): string {
  return convertFileSrc(path);
}

/**
 * Global audio host — mounted once at app root so playback continues
 * when navigating to chat, gallery, models, etc.
 */
export function MusicPlaybackEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSrcRef = useRef<string | null>(null);

  const hydrate = useMusicStore((s) => s.hydrate);
  const playing = useMusicStore((s) => s.playing);
  const volume = useMusicStore((s) => s.volume);
  const currentTime = useMusicStore((s) => s.currentTime);
  const setCurrentTime = useMusicStore((s) => s.setCurrentTime);
  const setPlaying = useMusicStore((s) => s.setPlaying);
  const playNext = useMusicStore((s) => s.playNext);

  const storeSnap = useMusicStore();
  const currentTrack = getCurrentTrack(storeSnap);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Volume changes only — never touch play/pause here.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  // Track source changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const src = trackSrc(currentTrack.path);
    if (activeSrcRef.current !== src) {
      activeSrcRef.current = src;
      audio.src = src;
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  }, [currentTrack?.id, currentTrack?.path, setCurrentTime]);

  // Play / pause only — not tied to volume.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (playing) {
      if (audio.paused) {
        void audio.play().catch((err: Error) => {
          if (err.name !== "AbortError") setPlaying(false);
        });
      }
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [playing, currentTrack?.id, currentTrack?.path, setPlaying]);

  // Seek when store time diverges (user scrubbed progress bar).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - currentTime) > 0.75) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => playNext();

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [setCurrentTime, playNext]);

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      aria-hidden
    />
  );
}
