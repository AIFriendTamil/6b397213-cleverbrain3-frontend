import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  VideoPlayer,
  formatTime,
  formatTimeForScreenReader,
  isEmbedUrl,
  getEmbedSrc,
  VideoCaptionTrack,
} from '../../src/components/kb/VideoPlayer';
import { KBVideoEmbed } from '../../src/services/kb_client';

// Mock HTMLMediaElement.prototype.play and pause for jsdom
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: false, configurable: true });
    return Promise.resolve();
  });
  window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: true, configurable: true });
  });
  window.HTMLMediaElement.prototype.load = vi.fn();
});

describe('formatTime Utility', () => {
  it('formats seconds into mm:ss format', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(83)).toBe('01:23');
    expect(formatTime(599)).toBe('09:59');
  });

  it('formats seconds into hh:mm:ss format when total hours > 0', () => {
    expect(formatTime(3600)).toBe('01:00:00');
    expect(formatTime(3665)).toBe('01:01:05');
    expect(formatTime(7384)).toBe('02:03:04');
  });

  it('handles negative, NaN, or non-finite inputs gracefully', () => {
    expect(formatTime(-10)).toBe('00:00');
    expect(formatTime(NaN)).toBe('00:00');
    expect(formatTime(Infinity)).toBe('00:00');
  });
});

describe('formatTimeForScreenReader Utility', () => {
  it('formats 0 or negative seconds as 0 seconds', () => {
    expect(formatTimeForScreenReader(0)).toBe('0 seconds');
    expect(formatTimeForScreenReader(-5)).toBe('0 seconds');
  });

  it('formats minutes and seconds accurately for screen readers', () => {
    expect(formatTimeForScreenReader(1)).toBe('1 second');
    expect(formatTimeForScreenReader(65)).toBe('1 minute, 5 seconds');
    expect(formatTimeForScreenReader(120)).toBe('2 minutes');
  });

  it('formats hours, minutes, and seconds accurately', () => {
    expect(formatTimeForScreenReader(3600)).toBe('1 hour');
    expect(formatTimeForScreenReader(3661)).toBe('1 hour, 1 minute, 1 second');
    expect(formatTimeForScreenReader(7325)).toBe('2 hours, 2 minutes, 5 seconds');
  });
});

describe('isEmbedUrl and getEmbedSrc Utilities', () => {
  it('detects YouTube, Vimeo, and iframe embed URLs', () => {
    expect(isEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isEmbedUrl('https://vimeo.com/123456789')).toBe(true);
    expect(isEmbedUrl('https://player.vimeo.com/video/123456789')).toBe(true);
    expect(isEmbedUrl('https://example.com/embed/123')).toBe(true);
    expect(isEmbedUrl('https://example.com/video.mp4')).toBe(false);
  });

  it('detects KBVideoEmbed object', () => {
    const embedObj: KBVideoEmbed = {
      original_input: 'youtube:dQw4w9WgXcQ',
      provider: 'youtube',
      video_id: 'dQw4w9WgXcQ',
      embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      has_controls: true,
      allow_fullscreen: true,
      aspect_ratio: '16:9',
      sanitized_iframe: '<iframe></iframe>',
      title: 'YouTube Embed',
    };
    expect(isEmbedUrl(undefined, embedObj)).toBe(true);
  });

  it('normalizes YouTube and Vimeo URLs into iframe embed links', () => {
    expect(getEmbedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain(
      'youtube-nocookie.com/embed/dQw4w9WgXcQ'
    );
    expect(getEmbedSrc('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789'
    );
  });
});

describe('VideoPlayer Component - HTML5 Direct Video Mode', () => {
  const sampleSrc = 'https://example.com/stream.mp4';
  const sampleTitle = 'Platform Onboarding Video Guide';
  const sampleCaptions: VideoCaptionTrack[] = [
    { label: 'English', srcLang: 'en', src: '/captions/en.vtt', default: true },
    { label: 'Spanish', srcLang: 'es', src: '/captions/es.vtt' },
  ];

  it('renders video container, title region, and controls', () => {
    render(
      <VideoPlayer
        src={sampleSrc}
        title={sampleTitle}
        captions={sampleCaptions}
        data-testid="kb-video-player"
      />
    );

    const playerContainer = screen.getByTestId('kb-video-player');
    expect(playerContainer).toBeDefined();

    const videoEl = screen.getByTestId('video-element');
    expect(videoEl).toBeDefined();
    expect(videoEl.getAttribute('src')).toBe(sampleSrc);

    const titleHeading = screen.getByTestId('video-title-heading');
    expect(titleHeading.textContent).toBe(sampleTitle);

    const playBtn = screen.getByTestId('video-play-pause-btn');
    expect(playBtn).toBeDefined();

    const scrubBar = screen.getByTestId('video-scrub-bar');
    expect(scrubBar).toBeDefined();

    const muteBtn = screen.getByTestId('video-mute-btn');
    expect(muteBtn).toBeDefined();

    const speedSelect = screen.getByTestId('video-speed-select');
    expect(speedSelect).toBeDefined();
  });

  it('toggles play/pause state when overlay or play button is clicked', () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();

    render(
      <VideoPlayer
        src={sampleSrc}
        title={sampleTitle}
        onPlay={onPlay}
        onPause={onPause}
      />
    );

    const overlayBtn = screen.getByTestId('video-overlay-play-btn');
    fireEvent.click(overlayBtn);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(onPlay).toHaveBeenCalled();

    const playPauseBtn = screen.getByTestId('video-play-pause-btn');
    fireEvent.click(playPauseBtn);
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(onPause).toHaveBeenCalled();
  });

  it('toggles mute/unmute and volume changes', () => {
    const onVolumeChange = vi.fn();

    render(
      <VideoPlayer
        src={sampleSrc}
        title={sampleTitle}
        onVolumeChange={onVolumeChange}
      />
    );

    const muteBtn = screen.getByTestId('video-mute-btn');
    fireEvent.click(muteBtn);
    expect(onVolumeChange).toHaveBeenCalledWith(1, true);

    const volumeSlider = screen.getByTestId('video-volume-slider');
    fireEvent.change(volumeSlider, { target: { value: '0.6' } });
    expect(onVolumeChange).toHaveBeenCalledWith(0.6, false);
  });

  it('changes playback speed multiplier', () => {
    render(<VideoPlayer src={sampleSrc} title={sampleTitle} />);

    const speedSelect = screen.getByTestId('video-speed-select') as HTMLSelectElement;
    fireEvent.change(speedSelect, { target: { value: '1.5' } });
    expect(speedSelect.value).toBe('1.5');
  });

  it('toggles closed captions when CC button is clicked', () => {
    render(
      <VideoPlayer
        src={sampleSrc}
        title={sampleTitle}
        captions={sampleCaptions}
      />
    );

    const ccBtn = screen.getByTestId('video-captions-btn');
    expect(ccBtn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(ccBtn);
    expect(ccBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('handles keyboard shortcuts for play/pause, volume, seeking, and mute', () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();

    render(
      <VideoPlayer
        src={sampleSrc}
        title={sampleTitle}
        onPlay={onPlay}
        onPause={onPause}
      />
    );

    const viewport = screen.getByTestId('video-viewport');
    viewport.focus();

    // Space bar toggles play
    fireEvent.keyDown(viewport, { key: ' ' });
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // M key toggles mute
    fireEvent.keyDown(viewport, { key: 'm' });
    const liveAnnouncer = screen.getByTestId('video-live-announcer');
    expect(liveAnnouncer.textContent).toContain('Muted');

    // Arrow keys for volume
    fireEvent.keyDown(viewport, { key: 'ArrowUp' });
    expect(liveAnnouncer.textContent).toBeDefined();

    // Arrow keys for seek
    fireEvent.keyDown(viewport, { key: 'ArrowRight' });
    expect(liveAnnouncer.textContent).toContain('Seeked');
  });
});

describe('VideoPlayer Component - Embed Iframe Mode', () => {
  it('renders iframe for YouTube embed URL', () => {
    render(
      <VideoPlayer
        embedUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="External YouTube Tutorial"
      />
    );

    const embedContainer = screen.getByTestId('video-embed-container');
    expect(embedContainer).toBeDefined();

    const iframe = screen.getByTestId('video-iframe') as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    expect(iframe.src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(iframe.title).toBe('External YouTube Tutorial');
  });

  it('renders iframe for KBVideoEmbed object from API', () => {
    const videoEmbedObj: KBVideoEmbed = {
      original_input: 'vimeo:123456789',
      provider: 'vimeo',
      video_id: '123456789',
      embed_url: 'https://player.vimeo.com/video/123456789',
      has_controls: true,
      allow_fullscreen: true,
      aspect_ratio: '16:9',
      sanitized_iframe: '',
      title: 'Vimeo Overview Video',
    };

    render(<VideoPlayer videoEmbed={videoEmbedObj} title="Vimeo Overview Video" />);

    const iframe = screen.getByTestId('video-iframe') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://player.vimeo.com/video/123456789');
  });
});

describe('VideoPlayer Component - Transcript Section', () => {
  const sampleTranscript =
    'In this video tutorial, we demonstrate how to set up your team workspace, invite members, and configure default project roles.';

  it('renders transcript drawer button and content', () => {
    render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        title="Workspace Setup"
        transcript={sampleTranscript}
        defaultShowTranscript={false}
      />
    );

    const toggleBtn = screen.getByTestId('video-transcript-toggle');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('video-transcript-content')).toBeNull();

    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');

    const content = screen.getByTestId('video-transcript-content');
    expect(content.textContent).toBe(sampleTranscript);
  });
});

describe('VideoPlayer Component - Error State', () => {
  it('renders error alert view when no valid video source is provided', () => {
    render(<VideoPlayer src="" title="Missing Video" />);

    const errorView = screen.getByTestId('video-error-state');
    expect(errorView).toBeDefined();

    const retryBtn = screen.getByTestId('video-retry-btn');
    expect(retryBtn).toBeDefined();
  });

  it('renders error state when onError is triggered from video element', () => {
    const onError = vi.fn();
    render(<VideoPlayer src="https://example.com/bad-video.mp4" onError={onError} />);

    const videoEl = screen.getByTestId('video-element');
    fireEvent.error(videoEl);

    const errorView = screen.getByTestId('video-error-state');
    expect(errorView).toBeDefined();
    expect(onError).toHaveBeenCalled();
  });
});
