// ─── Public API ───────────────────────────────────────────────────────────────

export { YouTubeSyncClient } from './core/YouTubeSyncClient.js';

// Field selection
export { FieldSelector, ALL_FIELDS } from './core/FieldSelector.js';

// Adapters
export { SqliteAdapter } from './adapters/sqlite/SqliteAdapter.js';
export type { SqliteAdapterConfig } from './adapters/sqlite/SqliteAdapter.js';
export type { DatabaseAdapter } from './adapters/DatabaseAdapter.js';

// Filters — expose base classes for custom filter creation
export { StreamOnlyFilter } from './filters/filters/StreamOnlyFilter.js';
export { NoShortsFilter } from './filters/filters/NoShortsFilter.js';
export { TitleExcludeFilter } from './filters/filters/TitleExcludeFilter.js';
export { DescriptionTagFilter } from './filters/filters/DescriptionTagFilter.js';
export { FilterEngine } from './filters/FilterEngine.js';

// Errors
export { YouTubeApiError, YouTubeQuotaError } from './youtube/errors.js';

// Utilities
export { parseDuration } from './youtube/VideoMapper.js';

// Types
export type {
  Video,
  VideoField,
  ChannelConfig,
  ChannelFilters,
  VideoFilter,
  AdapterQuery,
  SyncOptions,
  SyncOlderOptions,
  SyncResult,
  ChannelSyncResult,
  SyncError,
  YouTubeSearchOptions,
  YouTubeSearchResult,
  YouTubeSyncClientConfig,
} from './types/index.js';
