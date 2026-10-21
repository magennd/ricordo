import { db } from '../db/indexedDB';
import type { Deck, Note, Example, Card, ReviewLog, CardWithContext, CardType, Rating } from '../types/database';
import { processReview, getTodayString, getTomorrowString } from './fsrsService';

export const STAGING_DECK_NAME = 'Dictionary Triage';

export async function ensureDefaultDecks(): Promise<void> {
  const count = await db.decks.count();
  if (count === 0) {
    const now = new Date().toISOString();
    
    // 1. Staging / Triage deck for dictionary integrations
    const stagingDeck: Deck = {
      id: 'deck-staging',
      name: STAGING_DECK_NAME,
      description: 'Incoming words from dictionary bookmarks and repeated lookups ready for triage into active decks.',
      new_cards_per_day: 20,
      is_staging: 1,
      created_at: now,
      updated_at: now,
    };

    // 2. Default starter Italian deck as a high quality example
    const starterDeck: Deck = {
      id: 'deck-italian-core',
      name: 'Italian Essentials',
      description: 'High-frequency verbs, collocations, and expressive phrases with cloze examples.',
      new_cards_per_day: 10,
      is_staging: 0,
      created_at: now,
      updated_at: now,
    };

    await db.decks.bulkAdd([stagingDeck, starterDeck]);

    // Add high quality starter notes to Italian Essentials
    await createNoteWithCards({
      deck_id: starterDeck.id,
      headword: 'ricordare',
      lemma: 'ricordare',
      part_of_speech: 'verb',
      collocation_or_particle: 'ricordarsi di + inf.',
      definition: 'to remember, to recall; to remind',
      grammar_notes: 'Regular -are verb. Pronominal form "ricordarsi" takes "di".',
      tags: '["verbs", "b1", "memory"]',
      examples: [
        {
          sentence_target: 'Ti ricordi di chiudere la finestra prima di uscire?',
          sentence_native: 'Do you remember to close the window before leaving?',
          cloze_target_word: 'ricordi',
          cloze_grammar_hint: 'present tense, 2nd person singular'
        }
      ]
    });

    await createNoteWithCards({
      deck_id: starterDeck.id,
      headword: 'rendersi conto',
      lemma: 'rendersi conto',
      part_of_speech: 'idiomatic verb phrase',
      collocation_or_particle: 'rendersi conto di',
      definition: 'to realize, to become aware of something',
      grammar_notes: 'Uses essere in compound tenses: "mi sono reso conto".',
      tags: '["idioms", "b2"]',
      examples: [
        {
          sentence_target: 'Non mi sono reso conto dell’orario e ho perso il treno.',
          sentence_native: 'I didn’t realize the time and missed the train.',
          cloze_target_word: 'reso conto',
          cloze_grammar_hint: 'past participle with essere'
        }
      ]
    });

    await createNoteWithCards({
      deck_id: starterDeck.id,
      headword: 'accorgersi',
      lemma: 'accorgersi',
      part_of_speech: 'verb',
      collocation_or_particle: 'accorgersi di',
      definition: 'to notice, to perceive, to realize',
      grammar_notes: 'Past participle is "accorto". Requires "essere": mi sono accorto.',
      tags: '["verbs", "b2"]',
      examples: [
        {
          sentence_target: 'Ti sei accorto che hanno cambiato il menù?',
          sentence_native: 'Did you notice that they changed the menu?',
          cloze_target_word: 'accorto',
          cloze_grammar_hint: 'past participle with essere'
        }
      ]
    });

    // Add a staging note for the user to try the triage approval flow
    await createNoteWithCards({
      deck_id: stagingDeck.id,
      headword: 'sfumatura',
      lemma: 'sfumatura',
      part_of_speech: 'noun, feminine',
      collocation_or_particle: 'sfumatura di colore / significato',
      definition: 'nuance, subtle shade, slight difference',
      grammar_notes: 'Plural: sfumature.',
      tags: '["dictionary-lookups", "triage"]',
      lookup_count: 2,
      last_lookup_at: now,
      examples: [
        {
          sentence_target: 'Questa parola possiede una sfumatura poetica.',
          sentence_native: 'This word possesses a poetic nuance.',
          cloze_target_word: 'sfumatura',
          cloze_grammar_hint: 'singular feminine noun'
        }
      ]
    });
  }
}

export async function createNoteWithCards(params: {
  deck_id: string;
  headword: string;
  lemma?: string;
  part_of_speech?: string;
  collocation_or_particle?: string;
  definition: string;
  grammar_notes?: string;
  tags?: string;
  lookup_count?: number;
  last_lookup_at?: string;
  source_dictionary_id?: string;
  examples?: Array<{
    sentence_target: string;
    sentence_native?: string;
    cloze_target_word: string;
    cloze_grammar_hint?: string;
  }>;
}): Promise<string> {
  const now = new Date().toISOString();
  const noteId = crypto.randomUUID();

  const note: Note = {
    id: noteId,
    deck_id: params.deck_id,
    headword: params.headword.trim(),
    lemma: params.lemma?.trim(),
    part_of_speech: params.part_of_speech?.trim(),
    collocation_or_particle: params.collocation_or_particle?.trim(),
    definition: params.definition.trim(),
    grammar_notes: params.grammar_notes?.trim(),
    tags: params.tags,
    lookup_count: params.lookup_count ?? 1,
    last_lookup_at: params.last_lookup_at,
    source_dictionary_id: params.source_dictionary_id,
    created_at: now,
    updated_at: now,
  };

  const examplesList: Example[] = [];
  if (params.examples && params.examples.length > 0) {
    for (const ex of params.examples) {
      if (ex.sentence_target.trim()) {
        examplesList.push({
          id: crypto.randomUUID(),
          note_id: noteId,
          sentence_target: ex.sentence_target.trim(),
          sentence_native: ex.sentence_native?.trim(),
          cloze_target_word: ex.cloze_target_word?.trim() || note.headword,
          cloze_grammar_hint: ex.cloze_grammar_hint?.trim(),
        });
      }
    }
  }

  // Generate cards for this note:
  // 1. Recognition card (always)
  // 2. Production card (native -> target)
  // 3. Cloze card (if valid cloze example exists)
  const cardTypes: CardType[] = ['recognition', 'production'];
  if (examplesList.some(e => e.cloze_target_word)) {
    cardTypes.push('cloze');
  }

  const cardsList: Card[] = cardTypes.map((card_type) => ({
    id: crypto.randomUUID(),
    note_id: noteId,
    deck_id: params.deck_id,
    card_type,
    due_date: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0, // New
    is_leech: 0,
    is_suspended: 0,
    updated_at: now,
  }));

  await db.transaction('rw', [db.notes, db.examples, db.cards, db.sync_queue], async () => {
    await db.notes.add(note);
    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'notes',
      action: 'insert',
      record_id: note.id,
      payload: note,
      timestamp: now,
    });

    if (examplesList.length > 0) {
      await db.examples.bulkAdd(examplesList);
      for (const ex of examplesList) {
        await db.sync_queue.add({
          id: crypto.randomUUID(),
          table: 'examples',
          action: 'insert',
          record_id: ex.id,
          payload: ex,
          timestamp: now,
        });
      }
    }

    await db.cards.bulkAdd(cardsList);
    for (const c of cardsList) {
      await db.sync_queue.add({
        id: crypto.randomUUID(),
        table: 'cards',
        action: 'insert',
        record_id: c.id,
        payload: c,
        timestamp: now,
      });
    }
  });

  return noteId;
}

export async function updateNote(
  noteId: string,
  updates: Partial<Omit<Note, 'id' | 'created_at'>>,
  examples?: Array<{
    id?: string;
    sentence_target: string;
    sentence_native?: string;
    cloze_target_word: string;
    cloze_grammar_hint?: string;
  }>
): Promise<void> {
  const now = new Date().toISOString();
  const existingNote = await db.notes.get(noteId);
  if (!existingNote) return;

  const updatedNote: Note = {
    ...existingNote,
    ...updates,
    updated_at: now,
  };

  await db.transaction('rw', [db.notes, db.examples, db.cards, db.sync_queue], async () => {
    await db.notes.put(updatedNote);
    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'notes',
      action: 'update',
      record_id: noteId,
      payload: updatedNote,
      timestamp: now,
    });

    // If deck changed, update cards deck_id
    if (updates.deck_id && updates.deck_id !== existingNote.deck_id) {
      const cards = await db.cards.where('note_id').equals(noteId).toArray();
      for (const card of cards) {
        const updatedCard = { ...card, deck_id: updates.deck_id, updated_at: now };
        await db.cards.put(updatedCard);
        await db.sync_queue.add({
          id: crypto.randomUUID(),
          table: 'cards',
          action: 'update',
          record_id: card.id,
          payload: updatedCard,
          timestamp: now,
        });
      }
    }

    // Replace examples if provided
    if (examples) {
      await db.examples.where('note_id').equals(noteId).delete();
      const newExamples: Example[] = examples.map(ex => ({
        id: ex.id || crypto.randomUUID(),
        note_id: noteId,
        sentence_target: ex.sentence_target.trim(),
        sentence_native: ex.sentence_native?.trim(),
        cloze_target_word: ex.cloze_target_word?.trim() || updatedNote.headword,
        cloze_grammar_hint: ex.cloze_grammar_hint?.trim(),
      }));

      await db.examples.bulkAdd(newExamples);
      for (const ex of newExamples) {
        await db.sync_queue.add({
          id: crypto.randomUUID(),
          table: 'examples',
          action: 'insert',
          record_id: ex.id,
          payload: ex,
          timestamp: now,
        });
      }
    }
  });
}

export async function deleteNote(noteId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', [db.notes, db.examples, db.cards, db.review_logs, db.sync_queue, db.tombstones], async () => {
    const cards = await db.cards.where('note_id').equals(noteId).toArray();
    for (const card of cards) {
      await db.review_logs.where('card_id').equals(card.id).delete();
      await db.cards.delete(card.id);
      await db.sync_queue.add({
        id: crypto.randomUUID(),
        table: 'cards',
        action: 'delete',
        record_id: card.id,
        payload: null,
        timestamp: now,
      });
      await db.tombstones.put({
        id: `cards_${card.id}`,
        table_name: 'cards',
        record_id: card.id,
        deleted_at: now,
      });
    }

    await db.examples.where('note_id').equals(noteId).delete();
    await db.notes.delete(noteId);
    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'notes',
      action: 'delete',
      record_id: noteId,
      payload: null,
      timestamp: now,
    });
    await db.tombstones.put({
      id: `notes_${noteId}`,
      table_name: 'notes',
      record_id: noteId,
      deleted_at: now,
    });
  });
}

export async function deleteDeck(deckId: string): Promise<boolean> {
  const deck = await db.decks.get(deckId);
  if (!deck || deck.is_staging === 1) return false;

  const now = new Date().toISOString();
  await db.transaction('rw', [db.decks, db.notes, db.examples, db.cards, db.review_logs, db.sync_queue, db.tombstones], async () => {
    const notes = await db.notes.where('deck_id').equals(deckId).toArray();
    for (const note of notes) {
      const cards = await db.cards.where('note_id').equals(note.id).toArray();
      for (const card of cards) {
        await db.review_logs.where('card_id').equals(card.id).delete();
        await db.cards.delete(card.id);
        await db.sync_queue.add({
          id: crypto.randomUUID(),
          table: 'cards',
          action: 'delete',
          record_id: card.id,
          payload: null,
          timestamp: now,
        });
        await db.tombstones.put({
          id: `cards_${card.id}`,
          table_name: 'cards',
          record_id: card.id,
          deleted_at: now,
        });
      }

      await db.examples.where('note_id').equals(note.id).delete();
      await db.notes.delete(note.id);
      await db.sync_queue.add({
        id: crypto.randomUUID(),
        table: 'notes',
        action: 'delete',
        record_id: note.id,
        payload: null,
        timestamp: now,
      });
      await db.tombstones.put({
        id: `notes_${note.id}`,
        table_name: 'notes',
        record_id: note.id,
        deleted_at: now,
      });
    }

    await db.decks.delete(deckId);
    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'decks',
      action: 'delete',
      record_id: deckId,
      payload: null,
      timestamp: now,
    });
    await db.tombstones.put({
      id: `decks_${deckId}`,
      table_name: 'decks',
      record_id: deckId,
      deleted_at: now,
    });
  });

  return true;
}

export async function getDueCardsForDeck(deckId: string): Promise<CardWithContext[]> {
  const deck = await db.decks.get(deckId);
  if (!deck) return [];

  const todayStr = getTodayString();
  const allCards = await db.cards.where('deck_id').equals(deckId).toArray();

  // Filter out suspended cards and buried cards
  const eligibleCards = allCards.filter(card => {
    if (card.is_suspended === 1) return false;
    if (card.buried_until && card.buried_until >= todayStr) return false;
    return true;
  });

  const now = new Date();

  // Due review cards (state !== 0 and due_date <= now)
  const dueReviewCards = eligibleCards.filter(card => {
    if (card.state === 0) return false; // New cards handled separately
    return new Date(card.due_date).getTime() <= now.getTime();
  });

  // Calculate new card daily limit
  // Check how many new cards were reviewed today in this deck
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const cardIds = new Set(allCards.map(c => c.id));
  const todayLogs = await db.review_logs
    .where('reviewed_at')
    .aboveOrEqual(todayStart.toISOString())
    .toArray();

  const deckTodayLogs = todayLogs.filter(log => cardIds.has(log.card_id));
  const newCardsReviewedToday = deckTodayLogs.filter(log => log.state_before === 0).length;

  const newCardsAllowed = Math.max(0, deck.new_cards_per_day - newCardsReviewedToday);

  const newCards = eligibleCards
    .filter(card => card.state === 0)
    .slice(0, newCardsAllowed);

  // Combine: reviews first, then new cards
  const combined = [...dueReviewCards, ...newCards];

  // Populate context (Note and Examples)
  const result: CardWithContext[] = [];
  for (const card of combined) {
    const note = await db.notes.get(card.note_id);
    if (!note) continue;
    const examples = await db.examples.where('note_id').equals(card.note_id).toArray();
    result.push({
      ...card,
      note,
      examples,
      deckName: deck.name,
    });
  }

  return result;
}

export async function submitCardReview(
  cardId: string,
  rating: Rating
): Promise<{ updatedCard: Card; reviewLog: ReviewLog }> {
  const card = await db.cards.get(cardId);
  if (!card) throw new Error('Card not found');

  const now = new Date();
  const { updatedCard, reviewLog } = processReview(card, rating, now);
  const tomorrowStr = getTomorrowString();

  await db.transaction('rw', [db.cards, db.review_logs, db.sync_queue], async () => {
    // 1. Update this card
    await db.cards.put(updatedCard);
    await db.review_logs.add(reviewLog);

    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'cards',
      action: 'update',
      record_id: updatedCard.id,
      payload: updatedCard,
      timestamp: now.toISOString(),
    });

    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'review_logs',
      action: 'insert',
      record_id: reviewLog.id,
      payload: reviewLog,
      timestamp: now.toISOString(),
    });

    // 2. Sibling burying: bury any sibling cards for the same note until tomorrow
    const siblings = await db.cards.where('note_id').equals(card.note_id).toArray();
    for (const sibling of siblings) {
      if (sibling.id !== card.id) {
        const buriedSibling = {
          ...sibling,
          buried_until: tomorrowStr,
          updated_at: now.toISOString(),
        };
        await db.cards.put(buriedSibling);
        await db.sync_queue.add({
          id: crypto.randomUUID(),
          table: 'cards',
          action: 'update',
          record_id: buriedSibling.id,
          payload: buriedSibling,
          timestamp: now.toISOString(),
        });
      }
    }
  });

  return { updatedCard, reviewLog };
}

export async function undoLastReview(): Promise<boolean> {
  const lastLog = await db.review_logs.orderBy('reviewed_at').last();
  if (!lastLog) return false;

  const card = await db.cards.get(lastLog.card_id);
  if (!card) return false;

  const now = new Date().toISOString();

  // Revert card state
  const revertedCard: Card = {
    ...card,
    state: lastLog.state_before,
    stability: lastLog.stability_before ?? 0,
    difficulty: lastLog.difficulty_before ?? 0,
    reps: Math.max(0, card.reps - 1),
    lapses: lastLog.rating === 1 ? Math.max(0, card.lapses - 1) : card.lapses,
    is_leech: lastLog.rating === 1 && card.lapses <= 4 ? 0 : card.is_leech,
    updated_at: now,
  };

  await db.transaction('rw', [db.cards, db.review_logs, db.sync_queue, db.tombstones], async () => {
    await db.cards.put(revertedCard);
    await db.review_logs.delete(lastLog.id);

    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'cards',
      action: 'update',
      record_id: revertedCard.id,
      payload: revertedCard,
      timestamp: now,
    });

    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'review_logs',
      action: 'delete',
      record_id: lastLog.id,
      payload: null,
      timestamp: now,
    });

    await db.tombstones.put({
      id: `review_logs_${lastLog.id}`,
      table_name: 'review_logs',
      record_id: lastLog.id,
      deleted_at: now,
    });
  });

  return true;
}

export async function toggleSuspendCard(cardId: string): Promise<boolean> {
  const card = await db.cards.get(cardId);
  if (!card) return false;

  const updatedCard = {
    ...card,
    is_suspended: card.is_suspended === 1 ? 0 : 1,
    updated_at: new Date().toISOString(),
  };

  await db.cards.put(updatedCard);
  await db.sync_queue.add({
    id: crypto.randomUUID(),
    table: 'cards',
    action: 'update',
    record_id: cardId,
    payload: updatedCard,
    timestamp: updatedCard.updated_at,
  });

  return updatedCard.is_suspended === 1;
}

export async function approveStagingNote(noteId: string, targetDeckId: string): Promise<void> {
  await updateNote(noteId, { deck_id: targetDeckId });
}

export async function getDeckStats(deckId: string): Promise<{
  newCount: number;
  dueCount: number;
  totalCards: number;
  totalNotes: number;
  leechCount: number;
}> {
  const now = new Date();
  const todayStr = getTodayString();
  const cards = await db.cards.where('deck_id').equals(deckId).toArray();
  const notesCount = await db.notes.where('deck_id').equals(deckId).count();

  let newCount = 0;
  let dueCount = 0;
  let leechCount = 0;

  for (const c of cards) {
    if (c.is_suspended) continue;
    if (c.is_leech) leechCount++;
    if (c.buried_until && c.buried_until >= todayStr) continue;

    if (c.state === 0) {
      newCount++;
    } else if (new Date(c.due_date).getTime() <= now.getTime()) {
      dueCount++;
    }
  }

  return {
    newCount,
    dueCount,
    totalCards: cards.length,
    totalNotes: notesCount,
    leechCount,
  };
}

