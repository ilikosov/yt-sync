import type { VideoFilter, Video } from '../../types/index.js';

/**
 * Keeps only videos whose description contains ALL of the given tags (case-insensitive).
 * Tags are matched as whole words or hashtag patterns, e.g. "#tutorial" or "tutorial".
 */
export class DescriptionTagFilter implements VideoFilter {
  readonly name = 'DescriptionTagFilter';
  private lowerTags: string[];

  constructor(requiredTags: string[]) {
    this.lowerTags = requiredTags.map(t => t.toLowerCase());
  }

  apply(video: Video): boolean {
    const lowerDesc = video.description.toLowerCase();
    return this.lowerTags.every(tag => lowerDesc.includes(tag));
  }
}
