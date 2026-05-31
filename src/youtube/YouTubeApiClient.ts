import type {
  YouTubeApiSearchResponse,
  YouTubeApiVideosResponse,
  YouTubeApiChannelResponse,
  YouTubeApiVideoItem,
} from '../types/youtube-api.js';
import type { YouTubeSearchOptions, YouTubeSearchResult, Video } from '../types/index.js';
import { VideoMapper } from './VideoMapper.js';
import { YouTubeQuotaError, YouTubeApiError } from './errors.js';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// ─── YouTube Data API v3 client ───────────────────────────────────────────────

export class YouTubeApiClient {
  private mapper = new VideoMapper();

  constructor(private apiKey: string) {}

  // ─── Search videos on a channel ────────────────────────────────────────────

  async searchVideos(options: YouTubeSearchOptions): Promise<YouTubeSearchResult> {
    const params = new URLSearchParams({
      part:       'snippet',
      channelId:  options.channelId,
      type:       'video',
      order:      'date',
      maxResults: String(Math.min(options.maxResults ?? 50, 50)),
      key:        this.apiKey,
    });

    if (options.query)           params.set('q', options.query);
    if (options.pageToken)       params.set('pageToken', options.pageToken);
    if (options.eventType)       params.set('eventType', options.eventType);
    if (options.publishedAfter)  params.set('publishedAfter', options.publishedAfter.toISOString());
    if (options.publishedBefore) params.set('publishedBefore', options.publishedBefore.toISOString());

    const data = await this.get<YouTubeApiSearchResponse>('search', params);

    const videoIds = data.items
      .filter(item => item.id.kind === 'youtube#video')
      .map(item => item.id.videoId);

    if (videoIds.length === 0) {
      return { videos: [], nextPageToken: data.nextPageToken, totalResults: 0 };
    }

    const details = await this.getVideoDetails(videoIds);

    return {
      videos:        details,
      nextPageToken: data.nextPageToken,
      totalResults:  data.pageInfo.totalResults,
    };
  }

  // ─── Get full video details by IDs (up to 50 at once) ─────────────────────

  async getVideoDetails(videoIds: string[]): Promise<Video[]> {
    if (videoIds.length === 0) return [];

    // YouTube allows max 50 IDs per request
    const chunks = chunkArray(videoIds, 50);
    const results: Video[] = [];

    for (const chunk of chunks) {
      const params = new URLSearchParams({
        part:       'snippet,contentDetails,statistics,liveStreamingDetails',
        id:         chunk.join(','),
        key:        this.apiKey,
        maxResults: '50',
      });

      const data = await this.get<YouTubeApiVideosResponse>('videos', params);
      results.push(...data.items.map(item => this.mapper.fromApiVideo(item)));
    }

    return results;
  }

  // ─── Get channel uploads playlist ID ───────────────────────────────────────

  async getChannelUploadsPlaylistId(channelId: string): Promise<string> {
    const params = new URLSearchParams({
      part: 'contentDetails',
      id:   channelId,
      key:  this.apiKey,
    });

    const data = await this.get<YouTubeApiChannelResponse>('channels', params);

    const playlist = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!playlist) {
      throw new YouTubeApiError(`Channel ${channelId} not found or has no uploads playlist`);
    }

    return playlist;
  }

  // ─── Get latest videos from uploads playlist ───────────────────────────────
  // More quota-efficient than search for simple "latest videos" use case

  async getLatestVideosFromPlaylist(options: {
    playlistId: string;
    maxResults?: number;
    pageToken?: string;
    publishedBefore?: Date;
  }): Promise<{ videoIds: string[]; nextPageToken?: string }> {
    const params = new URLSearchParams({
      part:       'contentDetails,snippet',
      playlistId: options.playlistId,
      maxResults: String(Math.min(options.maxResults ?? 50, 50)),
      key:        this.apiKey,
    });

    if (options.pageToken) params.set('pageToken', options.pageToken);

    const data = await this.get<any>('playlistItems', params);

    let items = data.items as Array<{ contentDetails: { videoId: string }; snippet: { publishedAt: string } }>;

    // Filter by date if needed
    if (options.publishedBefore) {
      const before = options.publishedBefore.getTime();
      items = items.filter(item => new Date(item.snippet.publishedAt).getTime() < before);
    }

    return {
      videoIds:      items.map(item => item.contentDetails.videoId),
      nextPageToken: data.nextPageToken,
    };
  }

  // ─── Raw GET helper ─────────────────────────────────────────────────────────

  private async get<T>(endpoint: string, params: URLSearchParams): Promise<T> {
    const url = `${BASE_URL}/${endpoint}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json() as any;

    if (!response.ok) {
      const reason = data?.error?.errors?.[0]?.reason as string | undefined;
      const message = data?.error?.message ?? 'Unknown YouTube API error';
      const code = data?.error?.code ?? response.status;

      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
        throw new YouTubeQuotaError(message);
      }

      throw new YouTubeApiError(message, code, reason);
    }

    return data as T;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
