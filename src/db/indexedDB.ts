import Dexie, { type Table } from 'dexie';
import type { Deck, Note, Example, Card, ReviewLog, SyncItem, Tombstone } from '../types/database';

export class RicordoDB extends Dexie {
  decks!: Table<Deck, string>;
  notes!: Table<Note, string>;
  examples!: Table<Example, string>;
  cards!: Table<Card, string>;
  review_logs!: Table<ReviewLog, string>;
  sync_queue!: Table<SyncItem, string>;
  tombstones!: Table<Tombstone, string>;

  constructor() {
    super('RicordoLocalDB');
    this.version(1).stores({
      decks: 'id, name, is_staging, created_at, updated_at',
      notes: 'id, deck_id, headword, lemma, lookup_count, updated_at',
      examples: 'id, note_id',
      cards: 'id, note_id, deck_id, card_type, due_date, state, is_leech, is_suspended, buried_until, updated_at, [deck_id+due_date]',
      review_logs: 'id, card_id, reviewed_at',
      sync_queue: 'id, timestamp, table, action'
    });

    this.version(2).stores({
      cards: 'id, note_id, deck_id, card_type, due_date, state, is_leech, is_suspended, buried_until, updated_at, [deck_id+due_date]'
    });

    this.version(3).stores({
      tombstones: 'id, table_name, record_id, deleted_at'
    });

    this.version(4).stores({
      sync_queue: 'id, timestamp, table, action, record_id'
    });
  }
}

export const db = new RicordoDB();

