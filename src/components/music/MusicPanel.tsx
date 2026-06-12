import { getCurrentTrack, useMusicStore } from "../../store/musicStore";
import { MusicLibrarySidebar } from "./MusicLibrarySidebar";
import { MusicMainContent } from "./MusicMainContent";
import { MusicNowPlaying } from "./MusicNowPlaying";
import { MusicPlayingBar } from "./MusicPlayingBar";

export function MusicPanel() {
  const nowPlayingView = useMusicStore((s) => s.nowPlayingView);
  const seek = useMusicStore((s) => s.seek);
  const storeSnap = useMusicStore();
  const currentTrack = getCurrentTrack(storeSnap);

  return (
    <div className="zeus-music-panel flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <MusicLibrarySidebar />
        {nowPlayingView && currentTrack ? (
          <MusicNowPlaying track={currentTrack} onSeek={seek} />
        ) : (
          <MusicMainContent />
        )}
      </div>
      <MusicPlayingBar currentTrack={currentTrack} onSeek={seek} />
    </div>
  );
}
