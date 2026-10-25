'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  SyntheticEvent,
} from 'react';
import { KBVideoEmbed } from '../../services/kb_client';

export interface VideoCaptionTrack {
  /** Display label for track selection (e.g. 'English', 'Spanish') */
  label: string;
  /** BCP 47 language code (e.g. 'en', 'es') */
  srcLang: string;
  /** URL to WebVTT captions/subtitles file */
  src: string;
  /** Flag indicating if this track is active by default */
  default?: boolean;
}

export interface VideoPlayerProps {
  /**
   * Primary video stream URL (MP4, WebM, HLS, or direct stream).
   */
  src?: string;

  /**
   * Alias for `src` URL.
   */
  url?: string;

  /**
   * Alias for `src` URL (e.g. from KBResourceDetail.media_url).
   */
  mediaUrl?: string;

  /**
   * Direct embed URL (e.g., YouTube, Vimeo, custom iframe URL).
   */
  embedUrl?: string;

  /**
   * Sanitized KBVideoEmbed object returned from API connector.
   */
  videoEmbed?: KBVideoEmbed | null;

  /**
   * Optional poster image thumbnail URL.
   */
  poster?: string;

  /**
   * Video title for ARIA labeling and screen readers.
   */
  title?: string;

  /**
   * Whether to autoplay video on load. Defaults to false.
   */
  autoPlay?: boolean;

  /**
   * Whether to display player controls. Defaults to true.
   */
  controls?: boolean;

  /**
   * Whether the video should start muted. Defaults to false.
   */
  muted?: boolean;

  /**
   * Whether the video should loop upon completion. Defaults to false.
   */
  loop?: boolean;

  /**
   * Available playback rate multipliers (e.g. [0.5, 0.75, 1, 1.25, 1.5, 2]).
   */
  playbackRates?: number[];

  /**
   * Target aspect ratio (e.g., '16:9', '4:3', '21:9'). Defaults to '16:9'.
   */
  aspectRatio?: string;

  /**
   * Caption and subtitle tracks for WCAG 2.1 Level AA accessibility.
   */
  captions?: VideoCaptionTrack[];

  /**
   * Text transcript of the video content for WCAG 2.1 Level AA accessibility.
   */
  transcript?: string;

  /**
   * Whether transcript section is open by default. Defaults to false.
   */
  defaultShowTranscript?: boolean;

  /**
   * Callback fired when video starts playing.
   */
  onPlay?: () => void;

  /**
   * Callback fired when video is paused.
   */
  onPause?: () => void;

  /**
   * Callback fired when video finishes playing.
   */
  onEnded?: () => void;

  /**
   * Callback fired on time update with progress metrics.
   */
  onProgress?: (progress: { currentTime: number; duration: number; percent: number }) => void;

  /**
   * Callback fired on time update with raw seconds.
   */
  onTimeUpdate?: (currentTime: number) => void;

  /**
   * Callback fired when video reaches completion or 90% threshold for step completion.
   */
  onStepComplete?: () => void;

  /**
   * Callback fired when volume or mute state changes.
   */
  onVolumeChange?: (volume: number, muted: boolean) => void;

  /**
   * Callback fired when fullscreen state changes.
   */
  onFullscreenChange?: (isFullscreen: boolean) => void;

  /**
   * Callback fired when an error occurs loading or playing the video.
   */
  onError?: (errorMessage: string) => void;

  /**
   * Custom CSS class name for outer container.
   */
  className?: string;

  /**
   * Data-testid attribute for testing. Defaults to 'kb-video-player'.
   */
  'data-testid'?: string;
}

/**
 * Utility to format seconds into mm:ss or hh:mm:ss format string.
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Utility to format time for screen reader announcements.
 */
export function formatTimeForScreenReader(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds <= 0) {
    return '0 seconds';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (hours === 1) parts.push('1 hour');
  else if (hours > 1) parts.push(`${hours} hours`);

  if (minutes === 1) parts.push('1 minute');
  else if (minutes > 1) parts.push(`${minutes} minutes`);

  if (secs === 1) parts.push('1 second');
  else if (secs > 0 || parts.length === 0) parts.push(`${secs} seconds`);

  return parts.join(', ');
}

/**
 * Utility to detect if a URL or embed object represents an iframe embed (YouTube, Vimeo, etc.).
 */
export function isEmbedUrl(url?: string, videoEmbed?: KBVideoEmbed | null): boolean {
  if (videoEmbed?.embed_url || videoEmbed?.sanitized_iframe) {
    return true;
  }
  if (!url || typeof url !== 'string') {
    return false;
  }
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('vimeo.com') ||
    trimmed.includes('/embed/') ||
    trimmed.includes('player.vimeo.com')
  ) {
    return true;
  }
  return false;
}

/**
 * Normalizes embed URL for iframe rendering (e.g. Youtube, Vimeo).
 */
export function getEmbedSrc(url?: string, videoEmbed?: KBVideoEmbed | null): string {
  if (videoEmbed?.embed_url) {
    return videoEmbed.embed_url;
  }
  if (!url) return '';
  const trimmed = url.trim();
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?enablejsapi=1&rel=0`;
  }
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return trimmed;
}

/**
 * Accessible inline streaming video player component with standard media controls,
 * keyboard shortcuts, captions, transcript drawer, and WCAG 2.1 Level AA compliance.
 */
export function VideoPlayer({
  src,
  url,
  mediaUrl,
  embedUrl,
  videoEmbed,
  poster,
  title = 'Video player',
  autoPlay = false,
  controls = true,
  muted = false,
  loop = false,
  playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2],
  aspectRatio = '16:9',
  captions = [],
  transcript,
  defaultShowTranscript = false,
  onPlay,
  onPause,
  onEnded,
  onProgress,
  onTimeUpdate,
  onStepComplete,
  onVolumeChange,
  onFullscreenChange,
  onError,
  className = '',
  'data-testid': testId = 'kb-video-player',
}: VideoPlayerProps): React.ReactElement {
  // Resolve effective video source URL
  const resolvedSrc = src || url || mediaUrl || embedUrl || videoEmbed?.embed_url || '';
  const isEmbed = isEmbedUrl(resolvedSrc, videoEmbed);
  const normalizedEmbedSrc = isEmbed ? getEmbedSrc(resolvedSrc, videoEmbed) : '';

  // Element references
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Accessible IDs
  const titleId = useId();
  const transcriptId = useId();

  // State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(muted ? 0 : 1);
  const [isMuted, setIsMuted] = useState<boolean>(muted);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPiP, setIsPiP] = useState<boolean>(false);
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(
    captions.some((c) => c.default)
  );
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(
    Math.max(0, captions.findIndex((c) => c.default))
  );
  const [isLoading, setIsLoading] = useState<boolean>(!isEmbed && Boolean(resolvedSrc));
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(defaultShowTranscript);
  const [announcement, setAnnouncement] = useState<string>('');
  const [stepCompletedTriggered, setStepCompletedTriggered] = useState<boolean>(false);

  // Announce to screen readers
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  // Sync muted and volume props
  useEffect(() => {
    setIsMuted(muted);
    if (muted) {
      setVolumeState(0);
    }
  }, [muted]);

  // Sync video element properties when state changes
  useEffect(() => {
    if (videoRef.current && !isEmbed) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isEmbed]);

  useEffect(() => {
    if (videoRef.current && !isEmbed) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [isMuted, volume, isEmbed]);

  // Check step completion (when video reaches 90% or ends)
  const checkStepCompletion = useCallback(
    (time: number, dur: number) => {
      if (stepCompletedTriggered || !onStepComplete || dur <= 0) return;
      const percent = (time / dur) * 100;
      if (percent >= 90) {
        setStepCompletedTriggered(true);
        onStepComplete();
      }
    },
    [stepCompletedTriggered, onStepComplete]
  );

  // Play / Pause handler
  const togglePlayPause = useCallback(() => {
    if (isEmbed) {
      setIsPlaying((prev) => !prev);
      return;
    }
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      announce('Paused video');
      if (onPause) onPause();
    } else {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          announce('Playing video');
          if (onPlay) onPlay();
        })
        .catch((err) => {
          const errStr = err?.message || 'Playback failed';
          setHasError(true);
          setErrorMessage(errStr);
          if (onError) onError(errStr);
        });
    }
  }, [isEmbed, isPlaying, announce, onPlay, onPause, onError]);

  // Seek handler
  const seekTo = useCallback(
    (targetTime: number) => {
      if (!videoRef.current || isEmbed) return;
      const clampedTime = Math.max(0, Math.min(targetTime, duration || 0));
      videoRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
      const srTime = formatTimeForScreenReader(clampedTime);
      announce(`Seeked to ${srTime}`);
    },
    [duration, isEmbed, announce]
  );

  // Seek relative (-5s / +5s)
  const seekRelative = useCallback(
    (deltaSeconds: number) => {
      seekTo(currentTime + deltaSeconds);
    },
    [seekTo, currentTime]
  );

  // Volume change handler
  const handleVolumeChange = useCallback(
    (newVol: number) => {
      const clampedVol = Math.max(0, Math.min(1, newVol));
      setVolumeState(clampedVol);
      const nextMuted = clampedVol === 0;
      setIsMuted(nextMuted);

      if (videoRef.current && !isEmbed) {
        videoRef.current.volume = clampedVol;
        videoRef.current.muted = nextMuted;
      }

      const percent = Math.round(clampedVol * 100);
      announce(nextMuted ? 'Muted' : `Volume ${percent}%`);
      if (onVolumeChange) onVolumeChange(clampedVol, nextMuted);
    },
    [isEmbed, announce, onVolumeChange]
  );

  // Mute toggle
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current && !isEmbed) {
      videoRef.current.muted = nextMuted;
    }
    announce(nextMuted ? 'Muted' : `Unmuted, volume ${Math.round(volume * 100)}%`);
    if (onVolumeChange) onVolumeChange(volume, nextMuted);
  }, [isMuted, volume, isEmbed, announce, onVolumeChange]);

  // Playback speed change
  const handleRateChange = useCallback(
    (newRate: number) => {
      setPlaybackRate(newRate);
      if (videoRef.current && !isEmbed) {
        videoRef.current.playbackRate = newRate;
      }
      announce(`Playback speed set to ${newRate}x`);
    },
    [isEmbed, announce]
  );

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          announce('Entered fullscreen mode');
          if (onFullscreenChange) onFullscreenChange(true);
        })
        .catch(() => {
          announce('Fullscreen request denied');
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
          announce('Exited fullscreen mode');
          if (onFullscreenChange) onFullscreenChange(false);
        })
        .catch(() => {});
    }
  }, [announce, onFullscreenChange]);

  // Listen to browser fullscreen change events
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (onFullscreenChange) onFullscreenChange(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [onFullscreenChange]);

  // Picture in Picture toggle
  const togglePiP = useCallback(() => {
    if (!videoRef.current || isEmbed) return;
    if (document.pictureInPictureElement) {
      document
        .exitPictureInPicture()
        .then(() => {
          setIsPiP(false);
          announce('Exited Picture in Picture mode');
        })
        .catch(() => {});
    } else if (document.pictureInPictureEnabled && videoRef.current.requestPictureInPicture) {
      videoRef.current
        .requestPictureInPicture()
        .then(() => {
          setIsPiP(true);
          announce('Entered Picture in Picture mode');
        })
        .catch(() => {});
    }
  }, [isEmbed, announce]);

  // Captions toggle
  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => {
      const next = !prev;
      if (videoRef.current && videoRef.current.textTracks) {
        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
          videoRef.current.textTracks[i].mode = next ? 'showing' : 'hidden';
        }
      }
      announce(next ? 'Captions enabled' : 'Captions disabled');
      return next;
    });
  }, [announce]);

  // HTML5 Video Event Handlers
  const handleLoadedMetadata = (e: SyntheticEvent<HTMLVideoElement>) => {
    const target = e.currentTarget;
    const dur = target.duration || 0;
    setDuration(dur);
    setIsLoading(false);
    setHasError(false);
  };

  const handleTimeUpdate = (e: SyntheticEvent<HTMLVideoElement>) => {
    const target = e.currentTarget;
    const curTime = target.currentTime || 0;
    const dur = target.duration || duration || 0;
    setCurrentTime(curTime);

    const percent = dur > 0 ? (curTime / dur) * 100 : 0;
    if (onProgress) {
      onProgress({ currentTime: curTime, duration: dur, percent });
    }
    if (onTimeUpdate) {
      onTimeUpdate(curTime);
    }
    checkStepCompletion(curTime, dur);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    announce('Video playback ended');
    if (!stepCompletedTriggered && onStepComplete) {
      setStepCompletedTriggered(true);
      onStepComplete();
    }
    if (onEnded) onEnded();
  };

  const handleVideoError = (e: SyntheticEvent<HTMLVideoElement>) => {
    const mediaErr = e.currentTarget.error;
    const msg = mediaErr?.message || 'Failed to load video stream source.';
    setIsLoading(false);
    setHasError(true);
    setErrorMessage(msg);
    announce(`Error loading video: ${msg}`);
    if (onError) onError(msg);
  };

  // Keyboard Navigation Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Avoid capturing inputs if user is typing in a text field
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' &&
      (target.getAttribute('type') === 'text' || target.getAttribute('type') === 'search')
    ) {
      return;
    }

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
      case 'j':
      case 'J':
        e.preventDefault();
        seekRelative(-5);
        break;
      case 'ArrowRight':
      case 'l':
      case 'L':
        e.preventDefault();
        seekRelative(5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleVolumeChange(volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleVolumeChange(volume - 0.1);
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'c':
      case 'C':
        if (captions.length > 0) {
          e.preventDefault();
          toggleCaptions();
        }
        break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        e.preventDefault();
        if (duration > 0) {
          const num = parseInt(e.key, 10);
          const target = (duration * (num * 10)) / 100;
          seekTo(target);
        }
        break;
      default:
        break;
    }
  };

  // Auto-hide controls when playing after 3 seconds of mouse inactivity
  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Compute aspect ratio padding percentage
  const getAspectRatioStyle = (): React.CSSProperties => {
    if (aspectRatio === '4:3') {
      return { aspectRatio: '4 / 3' };
    }
    if (aspectRatio === '21:9') {
      return { aspectRatio: '21 / 9' };
    }
    return { aspectRatio: '16 / 9' };
  };

  // Error State Rendering
  if (hasError || (!resolvedSrc && !isEmbed)) {
    return (
      <div
        className={`kb-video-player-error ${className}`}
        style={{
          backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
          color: 'var(--color-on-surface, #1b1c19)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          padding: '2rem',
          textAlign: 'center',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          ...getAspectRatioStyle(),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        data-testid="video-error-state"
        role="alert"
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-error, #ba1a1a)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ marginBottom: '1rem' }}
        >
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h4
          style={{
            margin: '0 0 0.5rem 0',
            fontFamily: 'var(--font-serif, Libre Caslon Text, serif)',
            fontSize: '1.25rem',
            color: 'var(--color-on-surface, #1b1c19)',
          }}
        >
          Unable to Load Video Stream
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--color-on-surface-variant, #4e453d)',
            maxWidth: '400px',
          }}
        >
          {errorMessage || 'No valid video source or media URL was provided.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setHasError(false);
            setErrorMessage('');
            setIsLoading(true);
            if (videoRef.current) {
              videoRef.current.load();
            }
          }}
          style={{
            marginTop: '1.25rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-primary, #59452b)',
            color: 'var(--color-on-primary, #ffffff)',
            border: 'none',
            borderRadius: 'var(--radius-sm, 0.125rem)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
          data-testid="video-retry-btn"
        >
          Retry Video
        </button>
      </div>
    );
  }

  return (
    <div
      ref={playerContainerRef}
      className={`kb-video-player-wrapper ${className}`}
      style={{
        width: '100%',
        maxWidth: '100%',
        fontFamily: 'var(--font-sans, DM Sans, sans-serif)',
        boxSizing: 'border-box',
      }}
      data-testid={testId}
    >
      {/* Screen Reader Live Region for Status Announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="additions text"
        data-testid="video-live-announcer"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </div>

      {/* Main Video Viewport Container */}
      <div
        tabIndex={0}
        role="region"
        aria-label={`Video player: ${title}`}
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (isPlaying) setControlsVisible(false);
        }}
        style={{
          position: 'relative',
          width: '100%',
          backgroundColor: '#000000',
          borderRadius: 'var(--radius-md, 0.375rem)',
          overflow: 'hidden',
          outline: 'none',
          boxShadow: '0 4px 12px rgba(115, 92, 65, 0.08)',
          ...getAspectRatioStyle(),
        }}
        data-testid="video-viewport"
      >
        {/* Hidden Screen Reader Title Header */}
        <span id={titleId} style={{ display: 'none' }}>
          {title}
        </span>

        {/* Loading Spinner Overlay */}
        {isLoading && !isEmbed && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 3,
              color: '#ffffff',
            }}
            data-testid="video-loading-spinner"
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '50%',
                borderTopColor: 'var(--color-primary-fixed, #fdddbb)',
                animation: 'pulse 1s linear infinite',
              }}
              role="status"
              aria-label="Loading video stream"
            />
          </div>
        )}

        {/* Embedded Iframe Player Rendering */}
        {isEmbed ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
            data-testid="video-embed-container"
          >
            <iframe
              src={normalizedEmbedSrc}
              title={title || 'Embedded video player'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen={videoEmbed?.allow_fullscreen ?? true}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              data-testid="video-iframe"
            />
          </div>
        ) : (
          /* Native HTML5 Streaming Video Player Rendering */
          <>
            <video
              ref={videoRef}
              src={resolvedSrc}
              poster={poster}
              autoPlay={autoPlay}
              muted={isMuted}
              loop={loop}
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              onClick={togglePlayPause}
              aria-label={title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                cursor: 'pointer',
              }}
              data-testid="video-element"
            >
              {captions.map((track, idx) => (
                <track
                  key={`${track.srcLang}-${idx}`}
                  kind="captions"
                  src={track.src}
                  srcLang={track.srcLang}
                  label={track.label}
                  default={track.default || idx === activeTrackIndex}
                />
              ))}
              Your browser does not support the video tag.
            </video>

            {/* Big Center Overlay Play Button when paused */}
            {!isPlaying && !isLoading && (
              <button
                type="button"
                onClick={togglePlayPause}
                aria-label="Play video"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(89, 69, 43, 0.85)',
                  color: '#ffffff',
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                  transition: 'transform 0.15s ease, background-color 0.15s ease',
                }}
                data-testid="video-overlay-play-btn"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={{ marginLeft: '3px' }}
                >
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            )}

            {/* Custom Controls Bar */}
            {controls && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(27, 28, 25, 0.9)',
                  backdropFilter: 'blur(8px)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  zIndex: 4,
                  opacity: controlsVisible || !isPlaying ? 1 : 0,
                  pointerEvents: controlsVisible || !isPlaying ? 'auto' : 'none',
                  transition: 'opacity 0.25s ease',
                }}
                data-testid="video-controls-bar"
              >
                {/* Timeline Scrub Slider */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    aria-label="Seek video timeline"
                    aria-valuenow={Math.round(currentTime)}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration || 100)}
                    aria-valuetext={`${formatTimeForScreenReader(currentTime)} of ${formatTimeForScreenReader(duration)}`}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      accentColor: 'var(--color-on-primary-container, #f5d6b4)',
                      cursor: 'pointer',
                    }}
                    data-testid="video-scrub-bar"
                  />
                </div>

                {/* Controls Action Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    color: '#ffffff',
                  }}
                >
                  {/* Left Controls: Play/Pause, Rewind, FastForward, Volume, Time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Play / Pause Toggle Button */}
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      aria-label={isPlaying ? 'Pause video' : 'Play video'}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      data-testid="video-play-pause-btn"
                    >
                      {isPlaying ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      )}
                    </button>

                    {/* Rewind -5s */}
                    <button
                      type="button"
                      onClick={() => seekRelative(-5)}
                      aria-label="Seek backward 5 seconds"
                      title="Seek backward 5s (Left Arrow / J)"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.85)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      data-testid="video-rewind-btn"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M11 19l-7-7 7-7" />
                        <path d="M19 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Fast Forward +5s */}
                    <button
                      type="button"
                      onClick={() => seekRelative(5)}
                      aria-label="Seek forward 5 seconds"
                      title="Seek forward 5s (Right Arrow / L)"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.85)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      data-testid="video-fast-forward-btn"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M13 5l7 7-7 7" />
                        <path d="M5 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Volume Mute & Slider Group */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <button
                        type="button"
                        onClick={toggleMute}
                        aria-label={isMuted ? 'Unmute volume' : 'Mute volume'}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        data-testid="video-mute-btn"
                      >
                        {isMuted || volume === 0 ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                          </svg>
                        ) : volume < 0.5 ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          </svg>
                        )}
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        aria-label="Volume level"
                        aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)} percent`}
                        style={{
                          width: '60px',
                          height: '4px',
                          accentColor: 'var(--color-on-primary-container, #f5d6b4)',
                          cursor: 'pointer',
                        }}
                        data-testid="video-volume-slider"
                      />
                    </div>

                    {/* Time Indicator Display */}
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontVariantNumeric: 'tabular-nums',
                        marginLeft: '0.25rem',
                      }}
                      data-testid="video-time-display"
                    >
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right Controls: Speed, Captions, PiP, Fullscreen */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Playback Speed Selector */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <select
                        value={playbackRate}
                        onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                        aria-label="Playback speed"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          color: '#ffffff',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          padding: '2px 6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                        data-testid="video-speed-select"
                      >
                        {playbackRates.map((rate) => (
                          <option key={rate} value={rate} style={{ color: '#000' }}>
                            {rate}x
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Closed Captions Toggle */}
                    {captions.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleCaptions}
                        aria-label="Toggle closed captions"
                        aria-pressed={captionsEnabled}
                        style={{
                          background: captionsEnabled ? 'rgba(255, 255, 255, 0.3)' : 'none',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        data-testid="video-captions-btn"
                      >
                        CC
                      </button>
                    )}

                    {/* Picture in Picture */}
                    {typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && (
                      <button
                        type="button"
                        onClick={togglePiP}
                        aria-label="Toggle picture in picture mode"
                        title="Picture in Picture"
                        style={{
                          background: isPiP ? 'rgba(255, 255, 255, 0.3)' : 'none',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        data-testid="video-pip-btn"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                          <rect x="12" y="10" width="8" height="6" rx="1"></rect>
                        </svg>
                      </button>
                    )}

                    {/* Fullscreen Toggle */}
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                      title="Toggle Fullscreen (F)"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      data-testid="video-fullscreen-btn"
                    >
                      {isFullscreen ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Optional Video Title & Transcript Section */}
      {(title || transcript) && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '1rem',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
          data-testid="video-info-section"
        >
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontFamily: 'var(--font-serif, Libre Caslon Text, serif)',
                color: 'var(--color-on-surface, #1b1c19)',
                fontWeight: 400,
              }}
              data-testid="video-title-heading"
            >
              {title}
            </h3>
          )}

          {transcript && (
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setIsTranscriptOpen((prev) => !prev)}
                aria-expanded={isTranscriptOpen}
                aria-controls={transcriptId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--color-primary, #59452b)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
                data-testid="video-transcript-toggle"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: isTranscriptOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                {isTranscriptOpen ? 'Hide Video Transcript' : 'Show Video Transcript'}
              </button>

              {isTranscriptOpen && (
                <div
                  id={transcriptId}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                  data-testid="video-transcript-content"
                >
                  {transcript}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
