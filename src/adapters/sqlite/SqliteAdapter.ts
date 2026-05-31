import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, lt, gt, and, desc, asc, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../DatabaseAdapter.js';
import type { Video, AdapterQuery } from '../../types/index.js';
import { videos, type VideoRow } from './schema.js';

// ─── SQLite adapter config ────────────────────────────────────────────────────

export interface SqliteAdapterConfig {
  /** Path to the SQLite file, or ':memory:' for in-memory */
  path: string;
  /** Extra options passed to better-sqlite3 */
  options?: Database.Options;
}

// ─── SQLite Adapter ───────────────────────────────────────────────────────────

export class SqliteAdapter implements DatabaseAdapter {
  private db: BetterSQLite3Database;
  private rawDb: Database.Database;

  constructor(private config: SqliteAdapterConfig) {
    this.rawDb = new Database(config.path, config.options);
    this.rawDb.pragma('journal_mode = WAL');
    this.db = drizzle(this.rawDb);
  }

  async initialize(): Promise<void> {
    this.rawDb.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id               TEXT PRIMARY KEY,
        channel_id       TEXT NOT NULL,
        title            TEXT NOT NULL DEFAULT '',
        description      TEXT NOT NULL DEFAULT '',
        published_at     INTEGER NOT NULL,
        duration         TEXT NOT NULL DEFAULT '',
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        view_count       INTEGER NOT NULL DEFAULT 0,
        like_count       INTEGER NOT NULL DEFAULT 0,
        comment_count    INTEGER NOT NULL DEFAULT 0,
        tags             TEXT NOT NULL DEFAULT '[]',
        thumbnails       TEXT NOT NULL DEFAULT '{}',
        is_stream        INTEGER NOT NULL DEFAULT 0,
        stream_started_at INTEGER,
        stream_ended_at  INTEGER,
        url              TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
      CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at);
    `);
  }

  async close(): Promise<void> {
    this.rawDb.close();
  }

  // ─── save (upsert) ──────────────────────────────────────────────────────────

  async save(videoList: Partial<Video>[]): Promise<void> {
    if (videoList.length === 0) return;

    const rows = videoList.map(toRow);

    // Drizzle doesn't have a native onConflictDoNothing for sqlite without
    // a proper insert, so we use raw SQL for upsert semantics.
    const insert = this.rawDb.prepare(`
      INSERT OR IGNORE INTO videos (
        id, channel_id, title, description, published_at,
        duration, duration_seconds, view_count, like_count, comment_count,
        tags, thumbnails, is_stream, stream_started_at, stream_ended_at, url
      ) VALUES (
        @id, @channelId, @title, @description, @publishedAt,
        @duration, @durationSeconds, @viewCount, @likeCount, @commentCount,
        @tags, @thumbnails, @isStream, @streamStartedAt, @streamEndedAt, @url
      )
    `);

    const insertMany = this.rawDb.transaction((items: ReturnType<typeof toFlatRow>[]) => {
      for (const item of items) {
        insert.run(item);
      }
    });

    insertMany(rows.map(toFlatRow));
  }

  // ─── update ─────────────────────────────────────────────────────────────────

  async update(id: string, data: Partial<Video>): Promise<void> {
    const row = toRow(data);
    await this.db
      .update(videos)
      .set(row)
      .where(eq(videos.id, id));
  }

  // ─── delete ─────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    await this.db.delete(videos).where(eq(videos.id, id));
  }

  // ─── findById ───────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Video | null> {
    const rows = await this.db
      .select()
      .from(videos)
      .where(eq(videos.id, id))
      .limit(1);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  // ─── findByChannel ──────────────────────────────────────────────────────────

  async findByChannel(channelId: string): Promise<Video[]> {
    const rows = await this.db
      .select()
      .from(videos)
      .where(eq(videos.channelId, channelId));
    return rows.map(fromRow);
  }

  // ─── query ──────────────────────────────────────────────────────────────────

  async query(filters: AdapterQuery): Promise<Video[]> {
    const conditions = [];

    if (filters.channelId) {
      conditions.push(eq(videos.channelId, filters.channelId));
    }
    if (filters.publishedAfter) {
      conditions.push(gt(videos.publishedAt, filters.publishedAfter));
    }
    if (filters.publishedBefore) {
      conditions.push(lt(videos.publishedAt, filters.publishedBefore));
    }
    if (filters.isStream !== undefined) {
      conditions.push(eq(videos.isStream, filters.isStream));
    }

    // Build ORDER BY
    const orderByField = filters.orderBy?.field ?? 'publishedAt';
    const orderByDir = filters.orderBy?.direction ?? 'desc';
    const column = fieldToColumn(orderByField);
    const orderExpr = orderByDir === 'asc' ? asc(column) : desc(column);

    let q = this.db
      .select()
      .from(videos)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderExpr);

    if (filters.limit !== undefined) {
      q = q.limit(filters.limit) as typeof q;
    }
    if (filters.offset !== undefined) {
      q = q.offset(filters.offset) as typeof q;
    }

    const rows = await q;
    const result = rows.map(fromRow);

    // Field projection — keep only requested fields
    if (filters.fields && filters.fields.length > 0) {
      return projectFields(result, filters.fields);
    }

    return result;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRow(v: Partial<Video>): Partial<VideoRow> {
  const row: Partial<VideoRow> = {};
  if (v.id !== undefined)              row.id = v.id;
  if (v.channelId !== undefined)       row.channelId = v.channelId;
  if (v.title !== undefined)           row.title = v.title;
  if (v.description !== undefined)     row.description = v.description;
  if (v.publishedAt !== undefined)     row.publishedAt = v.publishedAt;
  if (v.duration !== undefined)        row.duration = v.duration;
  if (v.durationSeconds !== undefined) row.durationSeconds = v.durationSeconds;
  if (v.viewCount !== undefined)       row.viewCount = v.viewCount;
  if (v.likeCount !== undefined)       row.likeCount = v.likeCount;
  if (v.commentCount !== undefined)    row.commentCount = v.commentCount;
  if (v.tags !== undefined)            row.tags = JSON.stringify(v.tags);
  if (v.thumbnails !== undefined)      row.thumbnails = JSON.stringify(v.thumbnails);
  if (v.isStream !== undefined)        row.isStream = v.isStream;
  if (v.streamStartedAt !== undefined) row.streamStartedAt = v.streamStartedAt;
  if (v.streamEndedAt !== undefined)   row.streamEndedAt = v.streamEndedAt;
  if (v.url !== undefined)             row.url = v.url;
  return row;
}

function toFlatRow(row: Partial<VideoRow>) {
  return {
    id:              row.id ?? '',
    channelId:       row.channelId ?? '',
    title:           row.title ?? '',
    description:     row.description ?? '',
    publishedAt:     row.publishedAt ? Math.floor(row.publishedAt.getTime() / 1000) : 0,
    duration:        row.duration ?? '',
    durationSeconds: row.durationSeconds ?? 0,
    viewCount:       row.viewCount ?? 0,
    likeCount:       row.likeCount ?? 0,
    commentCount:    row.commentCount ?? 0,
    tags:            row.tags ?? '[]',
    thumbnails:      row.thumbnails ?? '{}',
    isStream:        row.isStream ? 1 : 0,
    streamStartedAt: row.streamStartedAt ? Math.floor(row.streamStartedAt.getTime() / 1000) : null,
    streamEndedAt:   row.streamEndedAt ? Math.floor(row.streamEndedAt.getTime() / 1000) : null,
    url:             row.url ?? '',
  };
}

function fromRow(row: VideoRow): Video {
  return {
    id:              row.id,
    channelId:       row.channelId,
    title:           row.title,
    description:     row.description,
    publishedAt:     row.publishedAt,
    duration:        row.duration,
    durationSeconds: row.durationSeconds,
    viewCount:       row.viewCount,
    likeCount:       row.likeCount,
    commentCount:    row.commentCount,
    tags:            JSON.parse(row.tags),
    thumbnails:      JSON.parse(row.thumbnails),
    isStream:        row.isStream,
    streamStartedAt: row.streamStartedAt ?? null,
    streamEndedAt:   row.streamEndedAt ?? null,
    url:             row.url,
  };
}

function fieldToColumn(field: string) {
  const map: Record<string, any> = {
    id:              videos.id,
    channelId:       videos.channelId,
    title:           videos.title,
    publishedAt:     videos.publishedAt,
    durationSeconds: videos.durationSeconds,
    viewCount:       videos.viewCount,
    likeCount:       videos.likeCount,
    commentCount:    videos.commentCount,
    isStream:        videos.isStream,
  };
  return map[field] ?? videos.publishedAt;
}

function projectFields(videoList: Video[], fields: string[]): Video[] {
  return videoList.map(v => {
    const projected: Partial<Video> = {};
    for (const f of fields) {
      (projected as any)[f] = (v as any)[f];
    }
    return projected as Video;
  });
}
