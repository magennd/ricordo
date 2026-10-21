export type CardType = 'recognition' | 'production' | 'cloze';

export type CardState = 0 | 1 | 2 | 3; // 0: New, 1: Learning, 2: Review, 3: Relearning

export type Rating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export interface Deck {
  id: string;
  name: string;
  description?: string;
  new_cards_per_day: number;
  is_staging: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  deck_id: string;
  headword: string;
  lemma?: string;
  part_of_speech?: string;
  collocation_or_particle?: string;
  definition: string;
  grammar_notes?: string;
  tags?: string; // JSON string e.g. '["b1", "verbs"]'
  lookup_count?: number;
  last_lookup_at?: string;
  source_dictionary_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Example {
  id: string;
  note_id: string;
  sentence_target: string;
  sentence_native?: string;
  cloze_target_word: string;
  cloze_grammar_hint?: string;
}

export interface Card {
  id: string;
  note_id: string;
  deck_id: string;
  card_type: CardType;
  due_date: string; // ISO date string YYYY-MM-DD or full ISO
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review?: string;
  buried_until?: string; // ISO date string YYYY-MM-DD
  is_leech: number; // 0 or 1
  is_suspended: number; // 0 or 1
  updated_at: string;
}

export interface ReviewLog {
  id: string;
  card_id: string;
  rating: Rating;
  state_before: CardState;
  stability_before?: number;
  difficulty_before?: number;
  elapsed_days?: number;
  scheduled_days?: number;
  reviewed_at: string;
}

export interface SyncItem {
  id: string;
  table: 'decks' | 'notes' | 'examples' | 'cards' | 'review_logs';
  action: 'insert' | 'update' | 'delete';
  record_id: string;
  payload: any;
  timestamp: string;
}

export interface CardWithContext extends Card {
  note: Note;
  examples: Example[];
  deckName?: string;
}

