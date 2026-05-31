import type { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import type {
  ChannelConfig,
  SyncOptions,
  SyncOlderOptions,
  SyncResult,
  YouTubeSearchOptions,
  YouTubeSearchResult,
  Video,
  AdapterQuery,
  VideoField,
  YouTubeSyncClientConfig,
} from '../types/index.js';
import { YouTubeApiClient } from '../youtube/YouTubeApiClient.js';
import { SyncManager } from './SyncManager.js';
import { ALL_FIELDS } from './FieldSelector.js';

// ─── YouTubeSyncClient — main entry point ─────────────────────────────────────

export class YouTubeSyncClient {
  private channels = new Map<string, ChannelConfig>();
  private syncManager: SyncManager;

  /** Direct access to YouTube API methods */
  readonly youtube: YouTubePublicApi;

  /** Direct access to database adapter methods */
  readonly db: DatabasePublicApi;

  constructor(private config: YouTubeSyncClientConfig) {
    const ytClient = new YouTubeApiClient(config.apiKey);
    const defaultFields = config.defaultFields ?? ALL_FIELDS;

    this.syncManager = new SyncManager(
      ytClient,
      config.adapter,
      this.channels,
      defaultFields,
    );

    this.youtube = new YouTubePublicApi(ytClient);
    this.db = new DatabasePublicApi(config.adapter);
  }

  // ─── Channel registration ──────────────────────────────────────────────────

  addChannel(config: ChannelConfig): this {
    this.channels.set(config.channelId, config);
    return this;
  }

  removeChannel(channelId: string): this {
    this.channels.delete(channelId);
    return this;
  }

  getChannels(): ChannelConfig[] {
    return [...this.channels.values()];
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  async initialize(): Promise<this> {
    await this.config.adapter.initialize?.();
    return this;
  }

  async close(): Promise<void> {
    await this.config.adapter.close?.();
  }

  // ─── Sync ──────────────────────────────────────────────────────────────────

  /**
   * Sync latest videos for all (or specified) registered channels.
   * Call this from your own scheduler/cron/trigger.
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    return this.syncManager.sync(options);
  }

  /**
   * Sync older (historical) videos for a channel, paginating backwards.
   */
  async syncOlder(options: SyncOlderOptions): Promise<SyncResult> {
    return this.syncManager.syncOlder(options);
  }
}

// ─── YouTube API surface ──────────────────────────────────────────────────────

class YouTubePublicApi {
  constructor(private client: YouTubeApiClient) {}

  searchVideos(options: YouTubeSearchOptions): Promise<YouTubeSearchResult> {
    return this.client.searchVideos(options);
  }

  getVideoDetails(videoIds: string[]): Promise<Video[]> {
    return this.client.getVideoDetails(videoIds);
  }

  getChannelUploadsPlaylistId(channelId: string): Promise<string> {
    return this.client.getChannelUploadsPlaylistId(channelId);
  }
}

// ─── Database surface ─────────────────────────────────────────────────────────

class DatabasePublicApi {
  constructor(private adapter: DatabaseAdapter) {}

  query(filters: AdapterQuery): Promise<Video[]> {
    return this.adapter.query(filters);
  }

  findById(id: string): Promise<Video | null> {
    return this.adapter.findById(id);
  }

  findByChannel(channelId: string): Promise<Video[]> {
    return this.adapter.findByChannel(channelId);
  }

  update(id: string, data: Partial<Video>): Promise<void> {
    return this.adapter.update(id, data);
  }

  delete(id: string): Promise<void> {
    return this.adapter.delete(id);
  }
}
