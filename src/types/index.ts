// ─── Public types exported from the library ───────────────────────────────────

export type VideoField =
  | 'id'
  | 'channelId'
  | 'title'
  | 'description'
  | 'publishedAt'
  | 'duration'
  | 'durationSeconds'
  | 'viewCount'
  | 'likeCount'
  | 'commentCount'
  | 'tags'
  | 'thumbnails'
  | 'isStream'
  | 'streamStartedAt'
  | 'streamEndedAt'
  | 'url';

// ─── Video model ──────────────────────────────────────────────────────────────

export interface Video {
  id: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: Date;
  duration: string;           // ISO 8601, e.g. "PT1H2M3S"
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  thumbnails: Record<string, { url: string; width: number; height: number }>;
  isStream: boolean;
  streamStartedAt: Date | null;
  streamEndedAt: Date | null;
  url: string;
}

// ─── Channel configuration ────────────────────────────────────────────────────

export interface ChannelFilters {
  /** Keep only completed live streams */
  streamsOnly?: boolean;
  /** Exclude YouTube Shorts (duration <= 60s) */
  noShorts?: boolean;
  /** Exclude videos whose title contains any of these words (case-insensitive) */
  titleExcludeWords?: string[];
  /** Keep only videos whose description contains all of these tags */
  descriptionTags?: string[];
  /** Custom predicate filters — applied after built-in filters */
  custom?: VideoFilter[];
}

export interface ChannelConfig {
  channelId: string;
  filters?: ChannelFilters;
  /** Subset of Video fields to persist. Defaults to all fields. */
  fields?: VideoField[];
}

// ─── Filter interface ─────────────────────────────────────────────────────────

export interface VideoFilter {
  readonly name: string;
  apply(video: Video): boolean;
}

// ─── Database adapter query ───────────────────────────────────────────────────

export interface AdapterQuery {
  channelId?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  isStream?: boolean;
  fields?: VideoField[];
  limit?: number;
  offset?: number;
  orderBy?: {
    field: VideoField;
    direction: 'asc' | 'desc';
  };
}

// ─── Sync options ─────────────────────────────────────────────────────────────

export interface SyncOptions {
  /** Sync only specific channels. Defaults to all registered channels. */
  channelIds?: string[];
}

export interface SyncOlderOptions {
  channelId: string;
  /** Fetch videos published before this date */
  before: Date;
  /** Maximum number of pages to fetch from YouTube API. Default: 10 */
  maxPages?: number;
}

// ─── Sync result ──────────────────────────────────────────────────────────────

export interface ChannelSyncResult {
  channelId: string;
  synced: number;
  skipped: number;
  errors: SyncError[];
}

export interface SyncResult {
  channels: ChannelSyncResult[];
  totalSynced: number;
  totalSkipped: number;
  totalErrors: number;
  duration: number; // ms
}

export interface SyncError {
  videoId?: string;
  message: string;
  cause?: unknown;
}

// ─── YouTube search options ───────────────────────────────────────────────────

export interface YouTubeSearchOptions {
  channelId: string;
  query?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  maxResults?: number;
  pageToken?: string;
  eventType?: 'completed' | 'live' | 'upcoming';
}

export interface YouTubeSearchResult {
  videos: Video[];
  nextPageToken?: string;
  totalResults: number;
}

// ─── Client config ────────────────────────────────────────────────────────────

export interface YouTubeSyncClientConfig {
  apiKey: string;
  adapter: import('../adapters/DatabaseAdapter').DatabaseAdapter;
  /** Default fields to save when channel doesn't specify. Defaults to all. */
  defaultFields?: VideoField[];
}
