// ─── Raw YouTube Data API v3 response types ───────────────────────────────────

export interface YouTubeApiSearchItem {
  kind: string;
  etag: string;
  id: {
    kind: string;
    videoId: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: Record<string, YouTubeThumbnail>;
    channelTitle: string;
    liveBroadcastContent: 'none' | 'upcoming' | 'live';
    tags?: string[];
  };
}

export interface YouTubeApiVideoItem {
  kind: string;
  etag: string;
  id: string;
  snippet?: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: Record<string, YouTubeThumbnail>;
    channelTitle: string;
    tags?: string[];
    liveBroadcastContent: 'none' | 'upcoming' | 'live';
  };
  contentDetails?: {
    duration: string;
    dimension: string;
    definition: string;
    caption: string;
    licensedContent: boolean;
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
    favoriteCount: string;
  };
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
    concurrentViewers?: string;
  };
}

export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface YouTubeApiSearchResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeApiSearchItem[];
}

export interface YouTubeApiVideosResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeApiVideoItem[];
}

export interface YouTubeApiChannelResponse {
  kind: string;
  etag: string;
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
    };
    contentDetails: {
      relatedPlaylists: {
        uploads: string;
        likes?: string;
      };
    };
    statistics?: {
      viewCount: string;
      subscriberCount: string;
      videoCount: string;
    };
  }>;
}
