import type { VideoFilter, Video } from '../../types/index.js';

/**
 * Keeps only completed live stream recordings.
 * Rejects regular uploaded videos and scheduled (upcoming) streams.
 */
export class StreamOnlyFilter implements VideoFilter {
  readonly name = 'StreamOnlyFilter';

  apply(video: Video): boolean {
    return video.isStream === true;
  }
}
