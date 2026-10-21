import { createClient, type Client } from '@libsql/client/web';
import { db } from '../db/indexedDB';
import type { Deck, Note, Example, Card, ReviewLog } from '../types/database';
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
    `CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(deck_id, due_date, is_suspended, buried_until);`,
    `CREATE INDEX IF NOT EXISTS idx_notes_headword ON notes(headword);`
  ];

  for (const q of queries) {
    await client.execute(q);
  }
}

export async function syncWithTurso(): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
  if (!tursoClient) {
    return { success: false, pushed: 0, pulled: 0, error: 'Turso client not initialized' };
  }

  try {
    await initTursoSchema(tursoClient);

    // 1. Push local changes from sync_queue
    const queueItems = await db.sync_queue.toArray();
    let pushedCount = 0;

    for (const item of queueItems) {
      const { table, action, payload } = item;

      if (action === 'delete') {
        await tursoClient.execute({
          sql: `DELETE FROM ${table} WHERE id = ?`,
          args: [item.record_id]
        });
      } else if (action === 'insert' || action === 'update') {
        const keys = Object.keys(payload);
        const placeholders = keys.map(() => '?').join(', ');
        const updateAssignments = keys.map(k => `${k} = excluded.${k}`).join(', ');

        const sql = `
          INSERT INTO ${table} (${keys.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT(id) DO UPDATE SET ${updateAssignments}
        `;
        const args = keys.map(k => payload[k] ?? null);

        await tursoClient.execute({ sql, args });
      }

      await db.sync_queue.delete(item.id);
      pushedCount++;
    }

    // 2. Pull remote records
    let pulledCount = 0;

    // Pull decks
    const remoteDecks = await tursoClient.execute('SELECT * FROM decks');
    for (const row of remoteDecks.rows) {
      const deck = row as unknown as Deck;
      const local = await db.decks.get(deck.id);
      if (!local || new Date(deck.updated_at) > new Date(local.updated_at)) {
        await db.decks.put(deck);
        pulledCount++;
      }
    }

    // Pull notes
    const remoteNotes = await tursoClient.execute('SELECT * FROM notes');
    for (const row of remoteNotes.rows) {
      const note = row as unknown as Note;
      const local = await db.notes.get(note.id);
      if (!local || new Date(note.updated_at) > new Date(local.updated_at)) {
        await db.notes.put(note);
        pulledCount++;
      }
    }

    // Pull examples
    const remoteExamples = await tursoClient.execute('SELECT * FROM examples');
    for (const row of remoteExamples.rows) {
      const example = row as unknown as Example;
      await db.examples.put(example);
      pulledCount++;
    }

    // Pull cards
    const remoteCards = await tursoClient.execute('SELECT * FROM cards');
    for (const row of remoteCards.rows) {
      const card = row as unknown as Card;
      const local = await db.cards.get(card.id);
      if (!local || new Date(card.updated_at) > new Date(local.updated_at)) {
        await db.cards.put(card);
        pulledCount++;
      }
    }

    // Pull review logs
    const remoteLogs = await tursoClient.execute('SELECT * FROM review_logs');
    for (const row of remoteLogs.rows) {
      const log = row as unknown as ReviewLog;
      await db.review_logs.put(log);
    }

    return { success: true, pushed: pushedCount, pulled: pulledCount };
  } catch (err: any) {
    console.error('Error during Turso sync:', err);
    return { success: false, pushed: 0, pulled: 0, error: err.message || 'Sync failed' };
  }
}
