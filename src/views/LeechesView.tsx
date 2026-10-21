import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  PauseCircle, 
  PlayCircle, 
  RotateCcw, 
  Edit3, 
  CheckCircle2 
} from 'lucide-react';
import { db } from '../db/indexedDB';
import type { Card, Note, Example } from '../types/database';
import { toggleSuspendCard } from '../services/deckService';
import { NoteModal } from '../components/NoteModal';
import { useApp } from '../context/AppContext';

export const LeechesView: React.FC = () => {
  const { refreshLeechCount } = useApp();
  const [leechCards, setLeechCards] = useState<Array<{ card: Card; note: Note; examples: Example[] }>>([]);
  const [editingNote, setEditingNote] = useState<{ note: Note; examples: Example[] } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const cards = await db.cards.where('is_leech').equals(1).toArray();
    const result: Array<{ card: Card; note: Note; examples: Example[] }> = [];

    for (const card of cards) {
      const note = await db.notes.get(card.note_id);
      if (note) {
        const exs = await db.examples.where('note_id').equals(note.id).toArray();
        result.push({ card, note, examples: exs });
      }
    }

    setLeechCards(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleSuspend = async (cardId: string) => {
    await toggleSuspendCard(cardId);
    await loadData();
  };

  const handleResetLeech = async (cardId: string) => {
    const card = await db.cards.get(cardId);
    if (!card) return;

    const updated = {
      ...card,
      lapses: 0,
      is_leech: 0,
      updated_at: new Date().toISOString()
    };

    await db.cards.put(updated);
    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'cards',
      action: 'update',
      record_id: cardId,
      payload: updated,
      timestamp: updated.updated_at,
    });

    await refreshLeechCount();
    await loadData();
  };

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6 safe-bottom">
      
      {/* Header */}
      <div className="border-b border-forest/10 dark:border-alabaster/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-coral/20 text-coral flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-forest dark:text-alabaster">
              Leech Management
            </h1>
            <p className="text-sm text-forest/70 dark:text-alabaster/70 mt-0.5 font-sans">
              Cards that failed 4 or more times. Review their definitions, suspend them, or rewrite example sentences.
            </p>
          </div>
        </div>
      </div>

      {/* Main List */}
      {isLoading ? (
        <p className="text-center py-12 text-sm text-forest/60 dark:text-alabaster/60 font-sans">
          Scanning for leech cards...
        </p>
      ) : leechCards.length === 0 ? (
        <div className="bg-white dark:bg-forest-panel rounded-2xl p-12 text-center border border-forest/15 dark:border-alabaster/10 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-leaf/20 text-leaf flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-xl text-forest dark:text-alabaster">
            No Leech Cards!
          </h3>
          <p className="text-xs text-forest/60 dark:text-alabaster/60 mt-2 font-sans leading-relaxed">
            All your flashcards have healthy retention rates. Cards will appear here only if they fail 4 or more times during review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {leechCards.map(({ card, note, examples }) => {
            const isSuspended = card.is_suspended === 1;

            return (
              <div
                key={card.id}
                className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-display font-bold text-xl text-forest dark:text-alabaster">
                        {note.headword}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-alabaster dark:bg-forest text-forest/70 dark:text-alabaster/70 capitalize">
                        {card.card_type} card
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-coral text-white tabular-nums">
                        {card.lapses} failures
                      </span>
                      {isSuspended && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-forest/10 dark:bg-alabaster/10 text-forest/60 dark:text-alabaster/60">
                          Suspended
                        </span>
                      )}
                    </div>

                    <p className="font-sans text-sm text-forest/90 dark:text-alabaster/90 mt-1 font-medium">
                      {note.definition}
                    </p>

                    {note.collocation_or_particle && (
                      <p className="text-xs text-leaf font-semibold mt-1">
                        + {note.collocation_or_particle}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      onClick={() => handleToggleSuspend(card.id)}
                      className="px-3.5 py-2 rounded-xl border border-forest/20 dark:border-alabaster/20 text-xs font-semibold hover:bg-forest/5 dark:hover:bg-alabaster/5 flex items-center gap-1.5"
                    >
                      {isSuspended ? (
                        <>
                          <PlayCircle className="w-4 h-4 text-leaf" />
                          <span>Unsuspend</span>
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-4 h-4 text-coral" />
                          <span>Suspend</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setEditingNote({ note, examples });
                        setIsModalOpen(true);
                      }}
                      className="p-2 rounded-xl text-forest/70 dark:text-alabaster/70 hover:bg-forest/5 dark:hover:bg-alabaster/5 transition-colors"
                      title="Edit note"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleResetLeech(card.id)}
                      className="p-2 rounded-xl text-leaf hover:bg-leaf/10 transition-colors"
                      title="Reset failure count"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {examples.length > 0 && (
                  <div className="bg-alabaster/50 dark:bg-forest/50 p-2.5 rounded-xl border border-forest/5 dark:border-alabaster/5 text-xs text-forest/70 dark:text-alabaster/70 italic font-sans">
                    "{examples[0].sentence_target}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Note Modal */}
      <NoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        noteToEdit={editingNote}
        onSaved={loadData}
      />

    </div>
  );
};

