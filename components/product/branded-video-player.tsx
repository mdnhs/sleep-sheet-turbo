"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// The site's accent gradient — same stops as the Order Now / Shop buttons.
const BRAND_GRADIENT = "bg-[linear-gradient(135deg,#FF6FA5,#B8245A)]";
const BRAND_GRADIENT_H = "bg-[linear-gradient(90deg,#FF6FA5,#B8245A)]";

// How long the control bar stays up after the last tap/move while playing.
const CONTROLS_HIDE_MS = 1_000;

// Two taps closer together than this are a double tap.
const DOUBLE_TAP_MS = 280;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export interface BrandedVideoPlayerProps {
  sources: { src: string; type?: string }[];
  poster?: string;
  label: string;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  /**
   * "full": big play button, progress bar, time, sound and fullscreen.
   * "minimal": just a play button when paused and a hairline progress bar —
   * for the Reels viewer, which has its own controls around the video.
   */
  variant?: "full" | "minimal";
  className?: string;
  /** Extra classes for the control bar (e.g. left padding to clear overlays). */
  barClassName?: string;
  /**
   * Called on a double tap on the video. When set, a single tap waits a
   * moment before toggling playback so the two can be told apart.
   */
  onDoubleTap?: (point: { x: number; y: number }) => void;
}

/**
 * The store's own video player: lucide icons, brand-gradient accents and a
 * control bar that fades out after 1 second of inactivity while the video plays, instead of the browser's
 * native controls. The forwarded ref is the underlying <video>, so callers can
 * still start/mute it themselves.
 */
const BrandedVideoPlayer = forwardRef<HTMLVideoElement, BrandedVideoPlayerProps>(
  function BrandedVideoPlayer(
    {
      sources,
      poster,
      label,
      loop,
      preload = "metadata",
      variant = "full",
      className,
      barClassName,
      onDoubleTap,
    },
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [scrubbing, setScrubbing] = useState(false);
    // Where the thumb sits while dragging (0..1). Tracked separately from
    // video.currentTime so the bar follows the finger even if the browser is
    // slow to seek (or the file can't be seeked), instead of looking frozen.
    const [dragRatio, setDragRatio] = useState<number | null>(null);
    const scrubbingRef = useRef(false);
    const [awake, setAwake] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    // Playback was asked for but the video is waiting on data.
    const [buffering, setBuffering] = useState(false);
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef(0);

    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement, []);

    // Controls show on any activity and fade out after CONTROLS_HIDE_MS of
    // inactivity, but only while the video is actually playing.
    const wake = useCallback(() => {
      setAwake(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setAwake(false), CONTROLS_HIDE_MS);
    }, []);

    useEffect(() => {
      return () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (tapTimer.current) clearTimeout(tapTimer.current);
      };
    }, []);

    useEffect(() => {
      const onChange = () => setFullscreen(document.fullscreenElement === wrapperRef.current);
      document.addEventListener("fullscreenchange", onChange);
      return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) void video.play().catch(() => {});
      else video.pause();
      wake();
    };

    const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
      if (!onDoubleTap) {
        togglePlay();
        return;
      }
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        lastTap.current = 0;
        onDoubleTap({ x: e.clientX, y: e.clientY });
        return;
      }
      lastTap.current = now;
      tapTimer.current = setTimeout(togglePlay, DOUBLE_TAP_MS);
    };

    const toggleMute = () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      wake();
    };

    const toggleFullscreen = () => {
      const wrapper = wrapperRef.current;
      const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      if (!wrapper || !video) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else if (wrapper.requestFullscreen) void wrapper.requestFullscreen().catch(() => {});
      // iPhone Safari can only full-screen the video element itself.
      else video.webkitEnterFullscreen?.();
      wake();
    };

    const ratioFromClientX = (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    };

    const seekTo = (ratio: number) => {
      const video = videoRef.current;
      if (!video || !duration) return;
      video.currentTime = ratio * duration;
      setCurrent(ratio * duration);
    };

    // Drag to seek. The move/up listeners go on the window rather than the
    // bar: once the finger leaves the thin bar (it always does while dragging)
    // the bar stops receiving events, and pointer capture isn't reliable
    // across touch browsers.
    const startScrub = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return;
      e.preventDefault();
      scrubbingRef.current = true;
      setScrubbing(true);
      const first = ratioFromClientX(e.clientX);
      setDragRatio(first);
      seekTo(first);

      const move = (ev: PointerEvent) => {
        const ratio = ratioFromClientX(ev.clientX);
        setDragRatio(ratio);
        seekTo(ratio);
      };
      const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        scrubbingRef.current = false;
        setScrubbing(false);
        setDragRatio(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };

    const progress =
      dragRatio !== null ? dragRatio * 100 : duration ? Math.min((current / duration) * 100, 100) : 0;
    const showControls = !playing || awake || scrubbing;

    return (
      <div
        ref={wrapperRef}
        className={cn("group/player relative h-full w-full select-none", className)}
        onPointerMove={wake}
        onPointerDown={wake}
      >
        <video
          ref={videoRef}
          loop={loop}
          playsInline
          preload={preload}
          poster={poster}
          aria-label={label}
          onClick={handleVideoClick}
          onPlay={(e) => {
            setPlaying(true);
            // volumechange only fires on a change, so read the real state here
            // (a video that was never muted would otherwise show the muted icon).
            setMuted(e.currentTarget.muted || e.currentTarget.volume === 0);
            wake();
          }}
          onPause={() => {
            setPlaying(false);
            setBuffering(false);
          }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlayThrough={() => setBuffering(false)}
          onEmptied={() => setBuffering(false)}
          onTimeUpdate={(e) => !scrubbingRef.current && setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            setMuted(e.currentTarget.muted || e.currentTarget.volume === 0);
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted || e.currentTarget.volume === 0)}
          className="h-full w-full cursor-pointer touch-manipulation bg-transparent object-contain"
        >
          {/* Callers pass the transformed rendition plus the original as a
              fallback; for R2 videos productVideoUrl returns the original
              itself, so drop the repeat (duplicate keys, and a pointless
              second fetch on error). */}
          {sources.filter((s, i) => sources.findIndex((o) => o.src === s.src) === i).map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>

        {/* Waiting on the network: a spinner, after a short delay so quick
            stalls don't flash one. */}
        {playing && buffering && (
          <span
            aria-hidden="true"
            className="animate-delayed-fade pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40"
          >
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </span>
        )}

        {/* Big brand play button while paused. */}
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play video"
            className={cn(
              "absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-xl shadow-[#B8245A]/40 transition-transform hover:scale-105 active:scale-95",
              BRAND_GRADIENT,
            )}
          >
            <Play className="h-6 w-6 translate-x-0.5 fill-current" />
          </button>
        )}

        {variant === "minimal" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/25">
            <div
              className={cn("h-full transition-[width] duration-200 ease-linear", BRAND_GRADIENT_H)}
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-2.5 pt-10 text-white transition-opacity duration-300",
              showControls ? "opacity-100" : "pointer-events-none opacity-0",
              barClassName,
            )}
          >
            {/* Progress: click or drag to seek, arrow keys to step. */}
            <div
              ref={trackRef}
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration) || 0}
              aria-valuenow={Math.round(current)}
              aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
              className="group/track relative flex h-8 cursor-pointer touch-none items-center"
              style={{ touchAction: "none" }}
              onPointerDown={startScrub}
              onKeyDown={(e) => {
                const video = videoRef.current;
                if (!video) return;
                if (e.key === "ArrowRight") video.currentTime = Math.min(video.currentTime + 5, duration);
                else if (e.key === "ArrowLeft") video.currentTime = Math.max(video.currentTime - 5, 0);
                else return;
                e.preventDefault();
                setCurrent(video.currentTime);
              }}
            >
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/30 transition-all group-hover/track:h-1.5">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-200 ease-linear", BRAND_GRADIENT_H)}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span
                aria-hidden="true"
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#B8245A] bg-white shadow"
                style={{ left: `${progress}%` }}
              />
            </div>

            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause video" : "Play video"}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:bg-white/25"
              >
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
              <span className="text-xs font-medium tabular-nums text-white/90">
                {formatTime(current)} / {formatTime(duration)}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:bg-white/25"
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 active:bg-white/25"
              >
                {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default BrandedVideoPlayer;
