// ─── YouTube API errors ───────────────────────────────────────────────────────

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'YouTubeApiError';
  }
}

export class YouTubeQuotaError extends YouTubeApiError {
  constructor(message = 'YouTube Data API quota exceeded') {
    super(message, 403, 'quotaExceeded');
    this.name = 'YouTubeQuotaError';
  }
}
