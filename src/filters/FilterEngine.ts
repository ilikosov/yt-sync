import type { Video, ChannelFilters, VideoFilter } from '../types/index.js';
import { StreamOnlyFilter } from './filters/StreamOnlyFilter.js';
import { NoShortsFilter } from './filters/NoShortsFilter.js';
import { TitleExcludeFilter } from './filters/TitleExcludeFilter.js';
import { DescriptionTagFilter } from './filters/DescriptionTagFilter.js';

// ─── FilterEngine ─────────────────────────────────────────────────────────────
// Builds a pipeline of filters from ChannelFilters config and applies them.

export class FilterEngine {
  /**
   * Build filter pipeline from channel configuration.
   */
  buildPipeline(config: ChannelFilters): VideoFilter[] {
    const filters: VideoFilter[] = [];

    if (config.streamsOnly) {
      filters.push(new StreamOnlyFilter());
    }

    if (config.noShorts) {
      filters.push(new NoShortsFilter());
    }

    if (config.titleExcludeWords && config.titleExcludeWords.length > 0) {
      filters.push(new TitleExcludeFilter(config.titleExcludeWords));
    }

    if (config.descriptionTags && config.descriptionTags.length > 0) {
      filters.push(new DescriptionTagFilter(config.descriptionTags));
    }

    // Custom filters last
    if (config.custom && config.custom.length > 0) {
      filters.push(...config.custom);
    }

    return filters;
  }

  /**
   * Apply a pipeline of filters to a list of videos.
   * Returns [passed, skipped] counts alongside the filtered list.
   */
  apply(
    videos: Video[],
    filters: VideoFilter[],
  ): { passed: Video[]; skipped: number } {
    if (filters.length === 0) {
      return { passed: videos, skipped: 0 };
    }

    const passed: Video[] = [];
    let skipped = 0;

    for (const video of videos) {
      const ok = filters.every(f => f.apply(video));
      if (ok) {
        passed.push(video);
      } else {
        skipped++;
      }
    }

    return { passed, skipped };
  }
}
