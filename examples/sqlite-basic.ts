import {
  YouTubeSyncClient,
  SqliteAdapter,
  YouTubeQuotaError,
} from "../dist/index.js";

async function main() {
  // ── 1. Create adapter and client ──────────────────────────────────────────

  const adapter = new SqliteAdapter({ path: "./videos.db" });

  const client = await new YouTubeSyncClient({
    apiKey: process.env.YOUTUBE_API_KEY ?? "",
    adapter,
    defaultFields: [
      "id",
      "channelId",
      "title",
      "publishedAt",
      "duration",
      "durationSeconds",
      "isStream",
      "streamStartedAt",
      "streamEndedAt",
      "url",
    ],
  }).initialize();

  // ── 2. Register channels with filters ─────────────────────────────────────

  client
    .addChannel({
      channelId: "UCCZHf1CjpVXaYdD2Z-G0zyw",
      filters: {
        streamsOnly: true,
        noShorts: true,
        titleExcludeWords: ["clip", "highlight", "#shorts"],
        descriptionTags: ["#typescript", "#nodejs"],
      },
      fields: [
        "id",
        "channelId",
        "title",
        "publishedAt",
        "durationSeconds",
        "url",
      ],
    })
    .addChannel({
      channelId: "UC80VB6zYZMR2nA9Beh6SO9Q",
      filters: {
        streamsOnly: true,
        noShorts: true,
      },
      // no 'fields' — uses client defaultFields
    });

  // ── 3. Sync latest videos (triggered externally, e.g. by a cron job) ──────

  try {
    const result = await client.sync();

    console.log(`✓ Sync complete in ${result.duration}ms`);
    console.log(`  Synced:  ${result.totalSynced}`);
    console.log(`  Skipped: ${result.totalSkipped}`);

    for (const ch of result.channels) {
      if (ch.errors.length > 0) {
        console.error(`  Channel ${ch.channelId} errors:`, ch.errors);
      }
    }
  } catch (err) {
    if (err instanceof YouTubeQuotaError) {
      console.error("YouTube API quota exhausted. Try again tomorrow.");
    } else {
      throw err;
    }
  }

  // ── 4. Sync older videos for a specific channel ───────────────────────────

  const olderResult = await client.syncOlder({
    channelId: "UCxxxxxx-tech-channel",
    before: new Date("2024-01-01"),
    maxPages: 5, // max 5 × 50 = 250 videos
  });

  console.log(`✓ Older sync: ${olderResult.totalSynced} videos added`);

  // ── 5. Query local DB ─────────────────────────────────────────────────────

  const recentStreams = await client.db.query({
    channelId: "UCxxxxxx-tech-channel",
    isStream: true,
    publishedAfter: new Date("2024-06-01"),
    orderBy: { field: "publishedAt", direction: "desc" },
    limit: 10,
    fields: ["id", "title", "publishedAt", "url"],
  });

  console.log("\nRecent streams:");
  for (const v of recentStreams) {
    console.log(`  ${v.publishedAt?.toLocaleDateString()} — ${v.title}`);
    console.log(`  ${v.url}`);
  }

  // ── 6. Search directly on YouTube (no DB involved) ────────────────────────

  const ytResults = await client.youtube.searchVideos({
    channelId: "UCxxxxxx-tech-channel",
    query: "typescript tutorial",
    eventType: "completed",
    maxResults: 10,
  });

  console.log(`\nYouTube search: ${ytResults.totalResults} total results`);

  // ── 7. Get specific video details from YouTube ────────────────────────────

  const details = await client.youtube.getVideoDetails(["dQw4w9WgXcQ"]);
  console.log("\nVideo details:", details[0]?.title);

  await client.close();
}

main().catch(console.error);
