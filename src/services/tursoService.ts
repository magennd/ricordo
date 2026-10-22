import { createClient, type Client } from '@libsql/client/web';
import { db } from '../db/indexedDB';
import type { Deck, Note, Example, Card, ReviewLog, Tombstone } from '../types/database';
import type { TursoCredentials } from './vaultService';

let tursoClient: Client | null = null;

export function getTursoClient(credentials?: TursoCredentials): Client | null {
  if (credentials) {
    // Turso client web uses https:// schema
    let url = credentials.tursoUrl.trim();
    if (url.startsWith('libsql://')) {
      url = url.replace('libsql://', 'https://');
    }
    tursoClient = createClient({
      url,
      authToken: credentials.tursoToken.trim(),
    });
  }
  return tursoClient;
}

export function isTursoConnected(): boolean {
  return tursoClient !== null;
}

export async function testTursoConnection(credentials: TursoCredentials): Promise<boolean> {
  const client = getTursoClient(credentials);
  if (!client) return false;
  try {
    await client.execute('SELECT 1');
    return true;
  } catch (err) {
    console.error('Turso connection failed:', err);
    return false;
  }
}

export async function initTursoSchema(client: Client): Promise<void> {
  const queries = [
    `CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      new_cards_per_day INTEGER DEFAULT 15,
      is_staging INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      headword TEXT NOT NULL,
      lemma TEXT,
      part_of_speech TEXT,
      collocation_or_particle TEXT,
      definition TEXT NOT NULL,
      grammar_notes TEXT,
      tags TEXT,
      lookup_count INTEGER DEFAULT 1,
      last_lookup_at TEXT,
      source_dictionary_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS examples (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      sentence_target TEXT NOT NULL,
      sentence_native TEXT,
      cloze_target_word TEXT NOT NULL,
      cloze_grammar_hint TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      deck_id TEXT NOT NULL,
      card_type TEXT NOT NULL CHECK(card_type IN ('recognition', 'production', 'cloze')),
      due_date TEXT NOT NULL,
      stability REAL DEFAULT 0,
      difficulty REAL DEFAULT 0,
      elapsed_days INTEGER DEFAULT 0,
      scheduled_days INTEGER DEFAULT 0,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      state INTEGER DEFAULT 0,
      last_review TEXT,
      buried_until TEXT,
      is_leech INTEGER DEFAULT 0,
      is_suspended INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      state_before INTEGER NOT NULL,
      stability_before REAL,
      difficulty_before REAL,
      elapsed_days INTEGER,
      scheduled_days INTEGER,
      reviewed_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS sync_tombstones (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(deck_id, due_date, is_suspended, buried_until);`,
    `CREATE INDEX IF NOT EXISTS idx_notes_headword ON notes(headword);`,
    `CREATE INDEX IF NOT EXISTS idx_sync_tombstones ON sync_tombstones(table_name, record_id);`
  ];

  for (const q of queries) {
    await client.execute(q);
  }
}

async function upsertTursoRecord(client: Client, table: string, record: any): Promise<void> {
  const keys = Object.keys(record);
  const placeholders = keys.map(() => '?').join(', ');
  const updateAssignments = keys.map(k => `${k} = excluded.${k}`).join(', ');
  const sql = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updateAssignments}
  `;
  const args = keys.map(k => record[k] ?? null);
  await client.execute({ sql, args });
}

export async function syncWithTurso(): Promise<{
  success: boolean;
  pushed: number;
  pulled: number;
  deleted?: number;
  error?: string;
}> {
  if (!tursoClient) {
    return { success: false, pushed: 0, pulled: 0, deleted: 0, error: 'Turso client not initialized' };
  }

  try {
    await initTursoSchema(tursoClient);

    // 1. Push local changes from sync_queue
    const queueItems = await db.sync_queue.toArray();
    let pushedCount = 0;

    for (const item of queueItems) {
      const { table, action, payload, record_id, timestamp } = item;

      if (action === 'delete') {
        // Delete record from Turso table
        await tursoClient.execute({
          sql: `DELETE FROM ${table} WHERE id = ?`,
          args: [record_id]
        });

        // Insert or update tombstone on Turso
        const tombstoneId = `${table}_${record_id}`;
        await tursoClient.execute({
          sql: `
            INSERT INTO sync_tombstones (id, table_name, record_id, deleted_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at
          `,
          args: [tombstoneId, table, record_id, timestamp]
        });

        // Store tombstone in local IndexedDB
        await db.tombstones.put({
          id: tombstoneId,
          table_name: table,
          record_id,
          deleted_at: timestamp
        });
      } else if (action === 'insert' || action === 'update') {
        const tombstoneId = `${table}_${record_id}`;
        const localTombstone = await db.tombstones.get(tombstoneId);

        // Discard stale change if an existing tombstone is newer
        if (localTombstone && new Date(localTombstone.deleted_at) >= new Date(timestamp)) {
          await db.sync_queue.delete(item.id);
          continue;
        }

        await upsertTursoRecord(tursoClient, table, payload);

        // If newly inserted/updated after a previous tombstone, clear the tombstone
        if (localTombstone) {
          await db.tombstones.delete(tombstoneId);
          await tursoClient.execute({
            sql: `DELETE FROM sync_tombstones WHERE id = ?`,
            args: [tombstoneId]
          });
        }
      }

      await db.sync_queue.delete(item.id);
      pushedCount++;
    }

    // 2. Sync tombstones bidirectionally
    let deletedCount = 0;

    // Pull remote tombstones and apply deletions to local IndexedDB
    const remoteTombstones = await tursoClient.execute('SELECT * FROM sync_tombstones');
    const remoteTombstoneMap = new Map<string, string>();
    for (const row of remoteTombstones.rows) {
      const ts = row as unknown as Tombstone;
      remoteTombstoneMap.set(ts.id, ts.deleted_at);
      await db.tombstones.put(ts);

      if (ts.table_name === 'notes') {
        const localNote = await db.notes.get(ts.record_id);
        if (localNote) {
          await db.notes.delete(ts.record_id);
          const cards = await db.cards.where('note_id').equals(ts.record_id).toArray();
          for (const c of cards) {
            await db.cards.delete(c.id);
            await db.review_logs.where('card_id').equals(c.id).delete();
          }
          await db.examples.where('note_id').equals(ts.record_id).delete();
          deletedCount++;
        }
      } else if (ts.table_name === 'cards') {
        const localCard = await db.cards.get(ts.record_id);
        if (localCard) {
          await db.cards.delete(ts.record_id);
          await db.review_logs.where('card_id').equals(ts.record_id).delete();
          deletedCount++;
        }
      } else if (ts.table_name === 'decks') {
        const localDeck = await db.decks.get(ts.record_id);
        if (localDeck && localDeck.is_staging !== 1) {
          await db.decks.delete(ts.record_id);
          deletedCount++;
        }
      } else if (ts.table_name === 'review_logs') {
        await db.review_logs.delete(ts.record_id);
      } else if (ts.table_name === 'examples') {
        await db.examples.delete(ts.record_id);
      }
    }

    // Push local tombstones that Turso doesn't have yet
    const localTombstones = await db.tombstones.toArray();
    for (const ts of localTombstones) {
      if (!remoteTombstoneMap.has(ts.id)) {
        await tursoClient.execute({
          sql: `
            INSERT INTO sync_tombstones (id, table_name, record_id, deleted_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at
          `,
          args: [ts.id, ts.table_name, ts.record_id, ts.deleted_at]
        });
        remoteTombstoneMap.set(ts.id, ts.deleted_at);
      }
    }

    // 3. Pull remote records from Turso into local IndexedDB
    let pulledCount = 0;

    // Pull decks
    const remoteDecks = await tursoClient.execute('SELECT * FROM decks');
    const remoteDeckIds = new Set<string>();
    for (const row of remoteDecks.rows) {
      const deck = row as unknown as Deck;
      remoteDeckIds.add(deck.id);
      const tombstone = await db.tombstones.get(`decks_${deck.id}`);
      if (tombstone && new Date(tombstone.deleted_at) >= new Date(deck.updated_at)) {
        continue;
      }
      const local = await db.decks.get(deck.id);
      if (!local || new Date(deck.updated_at) > new Date(local.updated_at)) {
        await db.decks.put(deck);
        pulledCount++;
      }
    }

    // Pull notes
    const remoteNotes = await tursoClient.execute('SELECT * FROM notes');
    const remoteNoteIds = new Set<string>();
    for (const row of remoteNotes.rows) {
      const note = row as unknown as Note;
      remoteNoteIds.add(note.id);
      const tombstone = await db.tombstones.get(`notes_${note.id}`);
      if (tombstone && new Date(tombstone.deleted_at) >= new Date(note.updated_at)) {
        continue;
      }
      const local = await db.notes.get(note.id);
      if (!local || new Date(note.updated_at) > new Date(local.updated_at)) {
        await db.notes.put(note);
        pulledCount++;
      }
    }

    // Pull examples
    const remoteExamples = await tursoClient.execute('SELECT * FROM examples');
    const remoteExampleIds = new Set<string>();
    for (const row of remoteExamples.rows) {
      const example = row as unknown as Example;
      remoteExampleIds.add(example.id);
      const tombstone = await db.tombstones.get(`examples_${example.id}`);
      if (tombstone) continue;
      await db.examples.put(example);
      pulledCount++;
    }

    // Pull cards
    const remoteCards = await tursoClient.execute('SELECT * FROM cards');
    const remoteCardIds = new Set<string>();
    for (const row of remoteCards.rows) {
      const card = row as unknown as Card;
      remoteCardIds.add(card.id);
      const tombstone = await db.tombstones.get(`cards_${card.id}`);
      if (tombstone && new Date(tombstone.deleted_at) >= new Date(card.updated_at)) {
        continue;
      }
      const local = await db.cards.get(card.id);
      if (!local || new Date(card.updated_at) > new Date(local.updated_at)) {
        await db.cards.put(card);
        pulledCount++;
      }
    }

    // Pull review logs
    const remoteLogs = await tursoClient.execute('SELECT * FROM review_logs');
    const remoteLogIds = new Set<string>();
    for (const row of remoteLogs.rows) {
      const log = row as unknown as ReviewLog;
      remoteLogIds.add(log.id);
      const tombstone = await db.tombstones.get(`review_logs_${log.id}`);
      if (tombstone) continue;
      await db.review_logs.put(log);
    }

    // 4. Push any local records that don't exist on remote and have not been deleted
    // This ensures local decks, notes, cards created before sync or while offline are safely uploaded
    const localDecks = await db.decks.toArray();
    for (const local of localDecks) {
      if (!remoteDeckIds.has(local.id)) {
        const tombstone = await db.tombstones.get(`decks_${local.id}`);
        if (!tombstone) {
          await upsertTursoRecord(tursoClient, 'decks', local);
          pushedCount++;
        }
      }
    }

    const localNotes = await db.notes.toArray();
    for (const local of localNotes) {
      if (!remoteNoteIds.has(local.id)) {
        const tombstone = await db.tombstones.get(`notes_${local.id}`);
        if (!tombstone) {
          await upsertTursoRecord(tursoClient, 'notes', local);
          pushedCount++;
        }
      }
    }

    const localExamples = await db.examples.toArray();
    for (const local of localExamples) {
      if (!remoteExampleIds.has(local.id)) {
        const tombstone = await db.tombstones.get(`examples_${local.id}`);
        if (!tombstone) {
          await upsertTursoRecord(tursoClient, 'examples', local);
          pushedCount++;
        }
      }
    }

    const localCards = await db.cards.toArray();
    for (const local of localCards) {
      if (!remoteCardIds.has(local.id)) {
        const tombstone = await db.tombstones.get(`cards_${local.id}`);
        if (!tombstone) {
          await upsertTursoRecord(tursoClient, 'cards', local);
          pushedCount++;
        }
      }
    }

    const localLogs = await db.review_logs.toArray();
    for (const local of localLogs) {
      if (!remoteLogIds.has(local.id)) {
        const tombstone = await db.tombstones.get(`review_logs_${local.id}`);
        if (!tombstone) {
          await upsertTursoRecord(tursoClient, 'review_logs', local);
          pushedCount++;
        }
      }
    }

    return { success: true, pushed: pushedCount, pulled: pulledCount, deleted: deletedCount };
  } catch (err: any) {
    console.error('Error during Turso sync:', err);
    return { success: false, pushed: 0, pulled: 0, deleted: 0, error: err.message || 'Sync failed' };
  }
}
