# AGENT.md — yt-sync

This file describes the `yt-sync` library for AI agents. Read this file first.
All public types are in `src/types/index.ts`. All public exports are in `src/index.ts`.

## What this library does

Syncs YouTube channel videos to a local database (SQLite by default).
Fetches video metadata from YouTube Data API v3, applies per-channel filters, saves selected fields.

## Setup (always required)

```typescript
import { YouTubeSyncClient, SqliteAdapter } from '@your-username/yt-sync';

const client = await new YouTubeSyncClient({
  apiKey: process.env.YOUTUBE_API_KEY!,   // YouTube Data API v3 key
  adapter: new SqliteAdapter({ path: './videos.db' }),
}).initialize();                            // creates tables — must call before anything else
```

Call `await client.close()` when done. Wrap in try/finally.

## Core operations

### Save latest videos from a channel

```typescript
client.addChannel({ channelId: 'UCxxxxxx' });
await client.sync();
```

### Save older/historical videos

```typescript
await client.syncOlder({
  channelId: 'UCxxxxxx',
  before: new Date('2024-01-01'),
  maxPages: 5,               // 5 × 50 = up to 250 videos
});
```

### Query saved videos

```typescript
const videos = await client.db.query({
  channelId: 'UCxxxxxx',
  isStream: true,
  publishedAfter: new Date('2024-01-01'),
  orderBy: { field: 'publishedAt', direction: 'desc' },
  limit: 20,
});
```

### Fetch from YouTube without saving

```typescript
const videos = await client.youtube.getVideoDetails(['videoId1', 'videoId2']);
const result = await client.youtube.searchVideos({ channelId: 'UCxxxxxx', query: 'tutorial' });
```

## Channel filters

Apply on `addChannel`. All optional, combined with AND.

```typescript
client.addChannel({
  channelId: 'UCxxxxxx',
  filters: {
    streamsOnly: true,              // only completed live stream recordings
    noShorts: true,                 // exclude videos ≤60s or with #shorts in title
    titleExcludeWords: ['clip'],    // drop if title contains any word (case-insensitive)
    descriptionTags: ['#tutorial'], // keep only if description contains ALL tags
  },
});
```

## Field selection

Control which Video fields are persisted. `id` and `channelId` are always saved.

```typescript
client.addChannel({
  channelId: 'UCxxxxxx',
  fields: ['id', 'title', 'publishedAt', 'durationSeconds', 'isStream', 'url'],
});
```

Set library-wide defaults:
```typescript
new YouTubeSyncClient({
  apiKey: '...',
  adapter,
  defaultFields: ['id', 'channelId', 'title', 'publishedAt', 'url'],
});
```

## Video object shape

All fields on `Video`:

```
id               string      YouTube video ID
channelId        string      YouTube channel ID
title            string
description      string
publishedAt      Date
duration         string      ISO 8601, e.g. "PT1H30M"
durationSeconds  number      Total seconds
viewCount        number
likeCount        number
commentCount     number
tags             string[]    YouTube tags
thumbnails       object      Keys: 'default'|'medium'|'high'|'standard'|'maxres'
isStream         boolean     true = completed live broadcast
streamStartedAt  Date|null
streamEndedAt    Date|null
url              string      https://www.youtube.com/watch?v=<id>
```

## AdapterQuery fields (client.db.query)

```
channelId        string     filter by channel
publishedAfter   Date       exclusive lower bound on publishedAt
publishedBefore  Date       exclusive upper bound on publishedAt
isStream         boolean    filter streams vs uploads
fields           string[]   projection — return only these fields
limit            number     max rows
offset           number     rows to skip
orderBy          { field: VideoField, direction: 'asc'|'desc' }
```

## Error handling rules

- `YouTubeQuotaError` — thrown when daily quota (10 000 units/day) is exhausted. Do not retry same day.
- `YouTubeApiError` — other API errors. Has `.statusCode` and `.reason`.
- Per-channel errors during `sync()` do NOT throw — check `result.channels[n].errors`.

```typescript
import { YouTubeQuotaError } from '@your-username/yt-sync';

try {
  await client.sync();
} catch (e) {
  if (e instanceof YouTubeQuotaError) { /* stop for today */ }
}
```

## SyncResult shape

```typescript
{
  totalSynced:  number;   // videos saved
  totalSkipped: number;   // rejected by filters
  totalErrors:  number;   // channels with errors
  duration:     number;   // ms
  channels: [{
    channelId: string;
    synced:    number;
    skipped:   number;
    errors:    Array<{ message: string; videoId?: string; cause?: unknown }>;
  }];
}
```

## Implementing a custom database adapter

Implement the `DatabaseAdapter` interface. The only hard rule: `save()` must be upsert — silently ignore duplicate `id` values.

```typescript
import type { DatabaseAdapter, Video, AdapterQuery } from '@your-username/yt-sync';

class MyAdapter implements DatabaseAdapter {
  async initialize(): Promise<void>                               { }
  async close(): Promise<void>                                    { }
  async save(videos: Partial<Video>[]): Promise<void>             { }  // upsert by id
  async update(id: string, data: Partial<Video>): Promise<void>  { }
  async delete(id: string): Promise<void>                         { }
  async findById(id: string): Promise<Video | null>               { return null; }
  async findByChannel(channelId: string): Promise<Video[]>        { return []; }
  async query(filters: AdapterQuery): Promise<Video[]>            { return []; }
}
```

## Implementing a custom filter

```typescript
import type { VideoFilter, Video } from '@your-username/yt-sync';

const myFilter: VideoFilter = {
  name: 'MinDurationFilter',
  apply(video: Video): boolean {
    return video.durationSeconds >= 600; // 10 minutes
  },
};

client.addChannel({
  channelId: 'UCxxxxxx',
  filters: { custom: [myFilter] },
});
```

## YouTube API quota reference

| Method | Units |
|--------|-------|
| `sync()` per channel | ~2 units |
| `syncOlder()` per page | ~2 units |
| `searchVideos()` | 100 units |
| `getVideoDetails()` per 50 IDs | 1 unit |

Daily free quota: 10 000 units.
Prefer `sync()` over `searchVideos()` — 50× cheaper.

## File map

```
src/index.ts                          — all public exports
src/types/index.ts                    — all public types and interfaces
src/core/YouTubeSyncClient.ts         — main class
src/core/SyncManager.ts               — sync orchestration
src/core/FieldSelector.ts             — field projection utility
src/youtube/YouTubeApiClient.ts       — YouTube Data API v3 wrapper
src/youtube/VideoMapper.ts            — raw API response → Video
src/youtube/errors.ts                 — YouTubeApiError, YouTubeQuotaError
src/filters/FilterEngine.ts           — builds and applies filter pipelines
src/filters/filters/StreamOnlyFilter.ts
src/filters/filters/NoShortsFilter.ts
src/filters/filters/TitleExcludeFilter.ts
src/filters/filters/DescriptionTagFilter.ts
src/adapters/DatabaseAdapter.ts       — DatabaseAdapter interface
src/adapters/sqlite/SqliteAdapter.ts  — SQLite implementation
src/adapters/sqlite/schema.ts         — drizzle-orm table schema
```
