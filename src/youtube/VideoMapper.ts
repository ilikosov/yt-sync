import type { YouTubeApiVideoItem } from '../types/youtube-api.js';
import type { Video } from '../types/index.js';

// ─── Maps raw YouTube API response → internal Video model ─────────────────────

export class VideoMapper {
  fromApiVideo(item: YouTubeApiVideoItem): Video {
    const snippet = item.snippet;
    const contentDetails = item.contentDetails;
    const statistics = item.statistics;
    const liveDetails = item.liveStreamingDetails;

    const publishedAt = snippet?.publishedAt
      ? new Date(snippet.publishedAt)
      : new Date(0);

    const duration = contentDetails?.duration ?? 'PT0S';
    const durationSeconds = parseDuration(duration);

    // A video is considered a stream if it has liveStreamingDetails
    // with an actualStartTime (meaning it actually ran as a live broadcast)
    const isStream = !!(
      liveDetails?.actualStartTime &&
      snippet?.liveBroadcastContent !== 'none'
    );

    return {
      id:              item.id,
      channelId:       snippet?.channelId ?? '',
      title:           snippet?.title ?? '',
      description:     snippet?.description ?? '',
      publishedAt,
      duration,
      durationSeconds,
      viewCount:       parseInt(statistics?.viewCount ?? '0', 10),
      likeCount:       parseInt(statistics?.likeCount ?? '0', 10),
      commentCount:    parseInt(statistics?.commentCount ?? '0', 10),
      tags:            snippet?.tags ?? [],
      thumbnails:      snippet?.thumbnails ?? {},
      isStream,
      streamStartedAt: liveDetails?.actualStartTime
        ? new Date(liveDetails.actualStartTime)
        : null,
      streamEndedAt:   liveDetails?.actualEndTime
        ? new Date(liveDetails.actualEndTime)
        : null,
      url:             `https://www.youtube.com/watch?v=${item.id}`,
    };
  }
}

// ─── Parse ISO 8601 duration to total seconds ─────────────────────────────────
// e.g. "PT1H2M3S" → 3723

export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours   = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}
