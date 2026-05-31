import type { VideoFilter, Video } from '../../types/index.js';

/**
 * Excludes videos whose title contains any of the given words (case-insensitive).
 */
export class TitleExcludeFilter implements VideoFilter {
  readonly name = 'TitleExcludeFilter';
  private lowerWords: string[];

  constructor(excludeWords: string[]) {
    this.lowerWords = excludeWords.map(w => w.toLowerCase());
  }

  apply(video: Video): boolean {
    const lowerTitle = video.title.toLowerCase();
    return !this.lowerWords.some(word => lowerTitle.includes(word));
  }
}
