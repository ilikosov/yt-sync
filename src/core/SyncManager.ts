import type { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import type { YouTubeApiClient } from '../youtube/YouTubeApiClient.js';
import type {
  ChannelConfig,
  SyncOptions,
  SyncOlderOptions,
  SyncResult,
  ChannelSyncResult,
  SyncError,
  VideoField,
} from '../types/index.js';
import { FilterEngine } from '../filters/FilterEngine.js';
import { FieldSelector } from './FieldSelector.js';

// ─── SyncManager ──────────────────────────────────────────────────────────────

export class SyncManager {
  private filterEngine = new FilterEngine();

  constructor(
    private yt: YouTubeApiClient,
    private adapter: DatabaseAdapter,
    private channels: Map<string, ChannelConfig>,
    private defaultFields: VideoField[] | undefined,
  ) {}

  // ─── sync: latest videos for all (or selected) channels ───────────────────

  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const startedAt = Date.now();
    const channelIds = options.channelIds ?? [...this.channels.keys()];
    const results: ChannelSyncResult[] = [];

    for (const channelId of channelIds) {
      const config = this.channels.get(channelId);
      if (!config) {
        results.push(makeErrorResult(channelId, `Channel ${channelId} is not registered`));
        continue;
      }
      results.push(await this.syncChannel(config));
    }

    return buildSyncResult(results, Date.now() - startedAt);
  }

  // ─── syncOlder: paginate backwards through history ────────────────────────

  async syncOlder(options: SyncOlderOptions): Promise<SyncResult> {
    const startedAt = Date.now();
    const config = this.channels.get(options.channelId);

    if (!config) {
      return buildSyncResult(
        [makeErrorResult(options.channelId, `Channel ${options.channelId} is not registered`)],
        Date.now() - startedAt,
      );
    }

    const selector = FieldSelector.forChannel(config.fields, this.defaultFields);
    const filters  = this.filterEngine.buildPipeline(config.filters ?? {});
    const maxPages = options.maxPages ?? 10;

    let totalSynced  = 0;
    let totalSkipped = 0;
    const errors: SyncError[] = [];

    try {
      const playlistId = await this.yt.getChannelUploadsPlaylistId(options.channelId);
      let pageToken: string | undefined;

      for (let page = 0; page < maxPages; page++) {
        const { videoIds, nextPageToken } = await this.yt.getLatestVideosFromPlaylist({
          playlistId,
          maxResults:      50,
          pageToken,
          publishedBefore: options.before,
        });

        if (videoIds.length === 0) break;

        const videos               = await this.yt.getVideoDetails(videoIds);
        const { passed, skipped }  = this.filterEngine.apply(videos, filters);
        const projected            = selector.projectAll(passed);

        await this.adapter.save(projected);
        totalSynced  += passed.length;
        totalSkipped += skipped;

        if (!nextPageToken) break;
        pageToken = nextPageToken;
      }
    } catch (err) {
      errors.push({ message: String(err), cause: err });
    }

    return buildSyncResult(
      [{ channelId: options.channelId, synced: totalSynced, skipped: totalSkipped, errors }],
      Date.now() - startedAt,
    );
  }

  // ─── Private: sync a single channel ───────────────────────────────────────

  private async syncChannel(config: ChannelConfig): Promise<ChannelSyncResult> {
    const errors: SyncError[] = [];
    let synced  = 0;
    let skipped = 0;

    try {
      const selector = FieldSelector.forChannel(config.fields, this.defaultFields);
      const filters  = this.filterEngine.buildPipeline(config.filters ?? {});

      const playlistId = await this.yt.getChannelUploadsPlaylistId(config.channelId);
      const { videoIds } = await this.yt.getLatestVideosFromPlaylist({
        playlistId,
        maxResults: 50,
      });

      if (videoIds.length > 0) {
        const videos              = await this.yt.getVideoDetails(videoIds);
        const { passed, skipped: filteredOut } = this.filterEngine.apply(videos, filters);

        await this.adapter.save(selector.projectAll(passed));
        synced  = passed.length;
        skipped = filteredOut;
      }
    } catch (err) {
      errors.push({ message: String(err), cause: err });
    }

    return { channelId: config.channelId, synced, skipped, errors };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSyncResult(channels: ChannelSyncResult[], duration: number): SyncResult {
  return {
    channels,
    totalSynced:  channels.reduce((s, c) => s + c.synced, 0),
    totalSkipped: channels.reduce((s, c) => s + c.skipped, 0),
    totalErrors:  channels.reduce((s, c) => s + c.errors.length, 0),
    duration,
  };
}

function makeErrorResult(channelId: string, message: string): ChannelSyncResult {
  return { channelId, synced: 0, skipped: 0, errors: [{ message }] };
}
