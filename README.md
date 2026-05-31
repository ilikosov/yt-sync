# yt-sync

TypeScript library for syncing YouTube channel videos to a local database via YouTube Data API v3.

## Installation

```bash
npm install @your-username/yt-sync
```

## Quick start

```typescript
import { YouTubeSyncClient, SqliteAdapter } from '@your-username/yt-sync';

const client = await new YouTubeSyncClient({
  apiKey: process.env.YOUTUBE_API_KEY!,
  adapter: new SqliteAdapter({ path: './videos.db' }),
}).initialize();

client.addChannel({
  channelId: 'UCxxxxxx',
  filters: { streamsOnly: true, noShorts: true },
});

const result = await client.sync();
console.log(`Synced ${result.totalSynced} videos`);

await client.close();
```

---

## API Reference

### `YouTubeSyncClient`

Main entry point. Composes YouTube API access, filtering, and database persistence.

```typescript
new YouTubeSyncClient(config: YouTubeSyncClientConfig)
```

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | `string` | ✓ | YouTube Data API v3 key |
| `adapter` | `DatabaseAdapter` | ✓ | Database adapter instance |
| `defaultFields` | `VideoField[]` | — | Fields saved when channel has no `fields`. Defaults to all fields. |

---

#### `client.initialize(): Promise<this>`

Runs adapter setup (creates tables, indexes). Call once before first sync.

```typescript
const client = await new YouTubeSyncClient({ ... }).initialize();
```

---

#### `client.close(): Promise<void>`

Graceful shutdown — closes DB connections.

---

#### `client.addChannel(config: ChannelConfig): this`

Register a channel for syncing. Chainable.

```typescript
client
  .addChannel({ channelId: 'UCaaaaa', filters: { streamsOnly: true } })
  .addChannel({ channelId: 'UCbbbbb', filters: { noShorts: true } });
```

**ChannelConfig:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channelId` | `string` | ✓ | YouTube channel ID (starts with `UC`) |
| `filters` | `ChannelFilters` | — | Filters applied before saving |
| `fields` | `VideoField[]` | — | Fields to persist. Overrides `defaultFields`. |

---

#### `client.removeChannel(channelId: string): this`

Unregister a channel.

---

#### `client.getChannels(): ChannelConfig[]`

Returns all registered channel configs.

---

#### `client.sync(options?: SyncOptions): Promise<SyncResult>`

Fetch and persist the latest videos (up to 50 per channel) for all registered channels. Designed to be called from an external scheduler.

```typescript
// Sync all channels
const result = await client.sync();

// Sync specific channels only
const result = await client.sync({ channelIds: ['UCaaaaa'] });
```

**SyncOptions:**

| Field | Type | Description |
|-------|------|-------------|
| `channelIds` | `string[]` | Limit sync to these channels. Omit to sync all. |

**SyncResult:**

```typescript
{
  channels: ChannelSyncResult[];  // per-channel breakdown
  totalSynced: number;            // videos saved across all channels
  totalSkipped: number;           // videos rejected by filters
  totalErrors: number;            // channels that threw errors
  duration: number;               // total time in ms
}

// ChannelSyncResult:
{
  channelId: string;
  synced: number;
  skipped: number;
  errors: Array<{ videoId?: string; message: string; cause?: unknown }>;
}
```

---

#### `client.syncOlder(options: SyncOlderOptions): Promise<SyncResult>`

Paginate backwards through a channel's history. Saves videos published before a given date.

```typescript
const result = await client.syncOlder({
  channelId: 'UCaaaaa',
  before: new Date('2024-01-01'),
  maxPages: 5,  // 5 pages × 50 videos = up to 250 videos
});
```

**SyncOlderOptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channelId` | `string` | ✓ | Must be a registered channel |
| `before` | `Date` | ✓ | Fetch videos published before this date |
| `maxPages` | `number` | — | Max API pages to fetch. Default: `10` |

---

### `client.youtube` — YouTube API surface

Direct access to YouTube Data API without touching the database.

#### `client.youtube.searchVideos(options): Promise<YouTubeSearchResult>`

Search videos on a channel.

```typescript
const result = await client.youtube.searchVideos({
  channelId: 'UCaaaaa',
  query: 'typescript tutorial',
  eventType: 'completed',   // 'completed' | 'live' | 'upcoming'
  maxResults: 25,
  publishedAfter: new Date('2024-01-01'),
  publishedBefore: new Date('2024-12-31'),
  pageToken: result.nextPageToken,  // for pagination
});
// result.videos: Video[]
// result.nextPageToken?: string
// result.totalResults: number
```

#### `client.youtube.getVideoDetails(videoIds: string[]): Promise<Video[]>`

Fetch full details for up to 50 video IDs at once (batches automatically).

```typescript
const videos = await client.youtube.getVideoDetails(['id1', 'id2', 'id3']);
```

#### `client.youtube.getChannelUploadsPlaylistId(channelId: string): Promise<string>`

Returns the uploads playlist ID for a channel. Useful for manual pagination.

---

### `client.db` — Database surface

Query and mutate the local database directly.

#### `client.db.query(filters: AdapterQuery): Promise<Video[]>`

Flexible query with filtering, sorting, pagination, and field projection.

```typescript
const videos = await client.db.query({
  channelId: 'UCaaaaa',
  isStream: true,
  publishedAfter: new Date('2024-06-01'),
  publishedBefore: new Date('2024-12-31'),
  orderBy: { field: 'publishedAt', direction: 'desc' },
  limit: 20,
  offset: 0,
  fields: ['id', 'title', 'publishedAt', 'url'],
});
```

**AdapterQuery:**

| Field | Type | Description |
|-------|------|-------------|
| `channelId` | `string` | Filter by channel |
| `publishedAfter` | `Date` | Published strictly after this date |
| `publishedBefore` | `Date` | Published strictly before this date |
| `isStream` | `boolean` | Filter streams vs regular videos |
| `fields` | `VideoField[]` | Field projection — return only these fields |
| `limit` | `number` | Max records to return |
| `offset` | `number` | Records to skip (for pagination) |
| `orderBy` | `{ field, direction }` | Sort. direction: `'asc'` \| `'desc'` |

#### `client.db.findById(id: string): Promise<Video | null>`

Find a single video by YouTube ID.

#### `client.db.findByChannel(channelId: string): Promise<Video[]>`

Return all saved videos for a channel (no filters, no limit).

#### `client.db.update(id: string, data: Partial<Video>): Promise<void>`

Update specific fields of an existing video.

#### `client.db.delete(id: string): Promise<void>`

Delete a video by ID.

---

### Filters (`ChannelFilters`)

All filters are optional and combined with AND logic.

| Filter | Type | Description |
|--------|------|-------------|
| `streamsOnly` | `boolean` | Keep only completed live stream recordings |
| `noShorts` | `boolean` | Exclude Shorts (duration ≤ 60s or title contains `#shorts`) |
| `titleExcludeWords` | `string[]` | Drop videos whose title contains any word (case-insensitive) |
| `descriptionTags` | `string[]` | Keep only videos whose description contains ALL tags (case-insensitive) |
| `custom` | `VideoFilter[]` | Custom predicate filters, applied last |

```typescript
// Custom filter example
import type { VideoFilter, Video } from '@your-username/yt-sync';

const longVideoFilter: VideoFilter = {
  name: 'LongVideoFilter',
  apply(video: Video): boolean {
    return video.durationSeconds >= 1800; // 30 minutes minimum
  },
};

client.addChannel({
  channelId: 'UCaaaaa',
  filters: {
    streamsOnly: true,
    titleExcludeWords: ['highlight', 'clip'],
    custom: [longVideoFilter],
  },
});
```

---

### `Video` model

All fields available on a `Video` object:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | YouTube video ID |
| `channelId` | `string` | YouTube channel ID |
| `title` | `string` | Video title |
| `description` | `string` | Full video description |
| `publishedAt` | `Date` | Publication date |
| `duration` | `string` | ISO 8601 duration, e.g. `"PT1H2M3S"` |
| `durationSeconds` | `number` | Duration in seconds |
| `viewCount` | `number` | View count at time of sync |
| `likeCount` | `number` | Like count at time of sync |
| `commentCount` | `number` | Comment count at time of sync |
| `tags` | `string[]` | YouTube tags |
| `thumbnails` | `Record<string, { url, width, height }>` | Thumbnail variants |
| `isStream` | `boolean` | `true` if this was a live broadcast |
| `streamStartedAt` | `Date \| null` | Stream actual start time |
| `streamEndedAt` | `Date \| null` | Stream actual end time |
| `url` | `string` | Full YouTube URL |

**VideoField** — union of all field name strings. Used in `fields` arrays for projection.

---

### `FieldSelector`

Utility for building and applying field projections. Used internally by `SyncManager`.

```typescript
import { FieldSelector, ALL_FIELDS } from '@your-username/yt-sync';

// All fields
const sel = FieldSelector.all();

// Specific fields (id and channelId are always added automatically)
const sel = FieldSelector.from(['title', 'publishedAt', 'url']);

// Merge channel-level and default fields (channel takes priority)
const sel = FieldSelector.forChannel(channelFields, defaultFields);

sel.fields          // VideoField[] — resolved field list
sel.isFullProjection  // true if all fields selected
sel.has('title')    // true/false
sel.project(video)  // Partial<Video> — single video projected
sel.projectAll(videos) // Partial<Video>[] — array projected
```

---

### `SqliteAdapter`

Built-in adapter using `better-sqlite3` + `drizzle-orm`.

```typescript
import { SqliteAdapter } from '@your-username/yt-sync';

const adapter = new SqliteAdapter({
  path: './videos.db',  // or ':memory:' for in-memory
  options: {            // better-sqlite3 options (optional)
    verbose: console.log,
  },
});
```

Tables and indexes are created automatically on `initialize()`.

---

### Custom database adapter

Implement `DatabaseAdapter` to support any database:

```typescript
import type { DatabaseAdapter, Video, AdapterQuery } from '@your-username/yt-sync';

export class PostgresAdapter implements DatabaseAdapter {
  async initialize(): Promise<void> { /* run migrations */ }
  async close(): Promise<void>      { /* close pool */ }

  async save(videos: Partial<Video>[]): Promise<void>           { /* INSERT OR IGNORE */ }
  async update(id: string, data: Partial<Video>): Promise<void> { /* UPDATE */ }
  async delete(id: string): Promise<void>                        { /* DELETE */ }
  async findById(id: string): Promise<Video | null>              { /* SELECT WHERE id */ }
  async findByChannel(channelId: string): Promise<Video[]>       { /* SELECT WHERE channel_id */ }
  async query(filters: AdapterQuery): Promise<Video[]>           { /* dynamic SELECT */ }
}
```

Key contract for `save`: must be **upsert** — duplicate `id` values are silently ignored, never throw or create duplicate rows.

---

### Error handling

```typescript
import { YouTubeQuotaError, YouTubeApiError } from '@your-username/yt-sync';

try {
  await client.sync();
} catch (err) {
  if (err instanceof YouTubeQuotaError) {
    // HTTP 403, reason: quotaExceeded or dailyLimitExceeded
    // YouTube free quota is 10 000 units/day
    console.error('Quota exhausted, retry tomorrow');
  } else if (err instanceof YouTubeApiError) {
    console.error(err.message, err.statusCode, err.reason);
  }
}
```

Per-channel errors (network blips, missing channels) do **not** throw — they are collected in `SyncResult.channels[n].errors` so other channels continue syncing.

---

### YouTube API quota costs

| Operation | Units |
|-----------|-------|
| `getLatestVideosFromPlaylist` (50 items) | 1 |
| `getVideoDetails` (50 items) | 1 |
| `searchVideos` | 100 |

`sync()` uses the playlist approach (1 + 1 = **2 units** per channel). Prefer `sync()` over `searchVideos()` for routine syncing.

---

### Environment variables

| Variable | Description |
|----------|-------------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (required) |

---

### Supported Node.js versions

18.x, 20.x, 22.x
