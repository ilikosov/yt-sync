import type { Video, AdapterQuery } from '../types/index.js';

// ─── Database Adapter interface ───────────────────────────────────────────────
// Implement this interface to support any database backend.

export interface DatabaseAdapter {
  /**
   * Persist videos. Duplicate IDs must be silently ignored (upsert semantics).
   */
  save(videos: Partial<Video>[]): Promise<void>;

  /**
   * Update specific fields of an existing video by ID.
   * Should be a no-op if the video doesn't exist.
   */
  update(id: string, data: Partial<Video>): Promise<void>;

  /**
   * Delete a video by ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Find a single video by its YouTube ID.
   */
  findById(id: string): Promise<Video | null>;

  /**
   * Find all videos for a given channel ID.
   */
  findByChannel(channelId: string): Promise<Video[]>;

  /**
   * Flexible query with filters, sorting, pagination, and field projection.
   */
  query(filters: AdapterQuery): Promise<Video[]>;

  /**
   * Optional: called once before first use.
   * Use to run migrations, create tables, etc.
   */
  initialize?(): Promise<void>;

  /**
   * Optional: called on graceful shutdown.
   */
  close?(): Promise<void>;
}
