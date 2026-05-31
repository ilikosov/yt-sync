import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Videos table ─────────────────────────────────────────────────────────────

export const videos = sqliteTable('videos', {
  id:              text('id').primaryKey(),
  channelId:       text('channel_id').notNull(),
  title:           text('title').notNull().default(''),
  description:     text('description').notNull().default(''),
  publishedAt:     integer('published_at', { mode: 'timestamp' }).notNull(),
  duration:        text('duration').notNull().default(''),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  viewCount:       integer('view_count').notNull().default(0),
  likeCount:       integer('like_count').notNull().default(0),
  commentCount:    integer('comment_count').notNull().default(0),
  tags:            text('tags').notNull().default('[]'),          // JSON array
  thumbnails:      text('thumbnails').notNull().default('{}'),    // JSON object
  isStream:        integer('is_stream', { mode: 'boolean' }).notNull().default(false),
  streamStartedAt: integer('stream_started_at', { mode: 'timestamp' }),
  streamEndedAt:   integer('stream_ended_at', { mode: 'timestamp' }),
  url:             text('url').notNull().default(''),
});

export type VideoRow = typeof videos.$inferSelect;
export type NewVideoRow = typeof videos.$inferInsert;
