import type { Video, VideoField } from '../types/index.js';

// ─── All available fields ─────────────────────────────────────────────────────

export const ALL_FIELDS: VideoField[] = [
  'id',
  'channelId',
  'title',
  'description',
  'publishedAt',
  'duration',
  'durationSeconds',
  'viewCount',
  'likeCount',
  'commentCount',
  'tags',
  'thumbnails',
  'isStream',
  'streamStartedAt',
  'streamEndedAt',
  'url',
];

// Fields that must always be present for DB identity — cannot be excluded
const REQUIRED_FIELDS: VideoField[] = ['id', 'channelId'];

// ─── FieldSelector ────────────────────────────────────────────────────────────

export class FieldSelector {
  private resolved: VideoField[];

  /**
   * @param fields  Requested fields. Pass undefined or empty array to get all fields.
   */
  constructor(fields?: VideoField[]) {
    this.resolved = this.resolve(fields);
  }

  // ─── Factory helpers ───────────────────────────────────────────────────────

  static all(): FieldSelector {
    return new FieldSelector();
  }

  static from(fields: VideoField[]): FieldSelector {
    return new FieldSelector(fields);
  }

  /**
   * Merge channel-level fields with client default fields.
   * Channel-level takes priority; falls back to defaults; falls back to all.
   */
  static forChannel(
    channelFields: VideoField[] | undefined,
    defaultFields: VideoField[] | undefined,
  ): FieldSelector {
    return new FieldSelector(channelFields ?? defaultFields);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Returns the resolved, validated list of fields */
  get fields(): VideoField[] {
    return this.resolved;
  }

  /** True when all fields are selected (no projection needed) */
  get isFullProjection(): boolean {
    return this.resolved.length === ALL_FIELDS.length;
  }

  /** True when the given field is included in this selector */
  has(field: VideoField): boolean {
    return this.resolved.includes(field);
  }

  /**
   * Project a Video object — keep only the selected fields.
   * Required fields (id, channelId) are always preserved.
   */
  project(video: Video): Partial<Video> {
    if (this.isFullProjection) return video;

    const out: Partial<Video> = {};
    for (const f of this.resolved) {
      (out as any)[f] = (video as any)[f];
    }
    return out;
  }

  /**
   * Project an array of Video objects.
   */
  projectAll(videos: Video[]): Partial<Video>[] {
    if (this.isFullProjection) return videos;
    return videos.map(v => this.project(v));
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private resolve(fields?: VideoField[]): VideoField[] {
    if (!fields || fields.length === 0) {
      return [...ALL_FIELDS];
    }

    const invalid = fields.filter(f => !(ALL_FIELDS as string[]).includes(f));
    if (invalid.length > 0) {
      throw new Error(
        `FieldSelector: unknown fields: ${invalid.join(', ')}. ` +
        `Valid fields: ${ALL_FIELDS.join(', ')}`,
      );
    }

    // Always add required fields if missing
    const withRequired = new Set<VideoField>([...REQUIRED_FIELDS, ...fields]);
    return [...withRequired];
  }
}
