import type { VideoFilter, Video } from '../../types/index.js';

const SHORTS_MAX_SECONDS = 60;
const SHORTS_MAX_TITLE_TAG = '#shorts';

/**
 * Excludes YouTube Shorts.
 * A video is considered a Short if its duration <= 60 seconds
 * OR its title contains #shorts (case-insensitive).
 */
export class NoShortsFilter implements VideoFilter {
  readonly name = 'NoShortsFilter';

  apply(video: Video): boolean {
    if (video.durationSeconds > 0 && video.durationSeconds <= SHORTS_MAX_SECONDS) {
      return false;
    }
    if (video.title.toLowerCase().includes(SHORTS_MAX_TITLE_TAG)) {
      return false;
    }
    return true;
  }
}
