import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Plus, 
  Inbox, 
  ChevronRight, 
  FolderPlus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { db } from '../db/indexedDB';
import type { Deck, Note } from '../types/database';
import { getDeckStats } from '../services/deckService';
import { NoteModal } from '../components/NoteModal';

interface DeckWithStats extends Deck {
  stats: {
    newCount: number;
    dueCount: number;
    totalCards: number;
    totalNotes: number;
    leechCount: number;
  };
}

export const DecksView: React.FC = () => {
  const { setCurrentView, setActiveDeckId, stagingCount } = useApp();
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedDeckForNewNote, setSelectedDeckForNewNote] = useState<string | null>(null);
  const [isNewDeckModalOpen, setIsNewDeckModalOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [newDeckCap, setNewDeckCap] = useState(15);

  const loadData = useCallback(async () => {
    const allDecks = await db.decks.toArray();
    const decksWithStats: DeckWithStats[] = [];

    for (const deck of allDecks) {
      const stats = await getDeckStats(deck.id);
      decksWithStats.push({
        ...deck,
        stats,
      });
    }

    setDecks(decksWithStats);

    // Get 6 most recently added notes
    const recent = await db.notes.orderBy('created_at').reverse().limit(6).toArray();
    setRecentNotes(recent);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartStudy = (deckId: string) => {
    setActiveDeckId(deckId);
    setCurrentView('study');
  };

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    const now = new Date().toISOString();
    const newDeck: Deck = {
      id: crypto.randomUUID(),
      name: newDeckName.trim(),
      description: newDeckDesc.trim() || undefined,
      new_cards_per_day: newDeckCap || 15,
      is_staging: 0,
      created_at: now,
      updated_at: now,
    };

    await db.decks.add(newDeck);
    await db.sync_queue.add({
      id: crypto.randomUUID(),
      table: 'decks',
      action: 'insert',
      record_id: newDeck.id,
      payload: newDeck,
      timestamp: now,
    });

    setNewDeckName('');
    setNewDeckDesc('');
    setIsNewDeckModalOpen(false);
    await loadData();
  };

  const openAddNoteModal = (deckId?: string) => {
    setSelectedDeckForNewNote(deckId || null);
    setIsNoteModalOpen(true);
  };

  // Separate regular study decks from staging deck
  const studyDecks = decks.filter(d => d.is_staging === 0);
  const stagingDeck = decks.find(d => d.is_staging === 1);

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-8 safe-bottom">
      
      {/* Top Banner / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-forest/10 dark:border-alabaster/10 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-forest dark:text-alabaster">
            Study Decks
          </h1>
          <p className="text-sm text-forest/70 dark:text-alabaster/70 mt-1 font-sans">
            Spaced repetition flashcards with Free Spaced Repetition Scheduler (FSRS).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewDeckModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 font-medium text-sm text-forest dark:text-alabaster hover:bg-forest/5 dark:hover:bg-alabaster/5 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-leaf" />
            <span>New Deck</span>
          </button>

          <button
            onClick={() => openAddNoteModal()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest font-semibold text-sm hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Word</span>
          </button>
        </div>
      </div>

      {/* Dictionary Triage Deck Callout (if items waiting) */}
      {stagingCount > 0 && stagingDeck && (
        <div className="bg-leaf/15 dark:bg-forest-panel border border-leaf/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-leaf text-forest flex items-center justify-center shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-forest dark:text-alabaster">
                  Dictionary Triage Queue
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-leaf text-forest tabular-nums">
                  {stagingCount} new
                </span>
              </div>
              <p className="text-xs text-forest/80 dark:text-alabaster/80 mt-0.5 font-sans">
                Words from dictionary lookups ready to be approved into your active study decks.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('triage')}
            className="px-4 py-2 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest text-xs font-semibold hover:opacity-90 shrink-0"
          >
            Review & Approve
          </button>
        </div>
      )}

      {/* Main Content: Decks Grid + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Decks Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-forest/60 dark:text-alabaster/60 font-sans">
            Active Decks ({studyDecks.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studyDecks.map((deck) => {
              const hasDue = deck.stats.dueCount > 0 || deck.stats.newCount > 0;
              return (
                <div
                  key={deck.id}
                  className="bg-white dark:bg-forest-panel rounded-2xl p-5 border border-forest/15 dark:border-alabaster/10 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-display font-bold text-lg text-forest dark:text-alabaster line-clamp-1">
                        {deck.name}
                      </h3>
                      <button
                        onClick={() => openAddNoteModal(deck.id)}
                        title="Add word directly to this deck"
                        className="p-1 rounded-lg text-forest/60 dark:text-alabaster/60 hover:text-leaf transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {deck.description && (
                      <p className="text-xs text-forest/70 dark:text-alabaster/70 line-clamp-2 mb-4 font-sans leading-relaxed">
                        {deck.description}
                      </p>
                    )}

                    {/* Stats Pill Badges */}
                    <div className="flex items-center gap-2 mb-5">
                      {/* Due reviews */}
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums ${
                        deck.stats.dueCount > 0
                          ? 'bg-coral/15 text-coral'
                          : 'bg-forest/5 dark:bg-alabaster/5 text-forest/60 dark:text-alabaster/60'
                      }`}>
                        {deck.stats.dueCount} Due
                      </span>

                      {/* New cards */}
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-leaf/20 text-leaf tabular-nums">
                        {deck.stats.newCount} New
                      </span>

                      {/* Total */}
                      <span className="text-xs text-forest/50 dark:text-alabaster/50 tabular-nums ml-auto font-sans">
                        {deck.stats.totalCards} cards ({deck.stats.totalNotes} notes)
                      </span>
                    </div>
                  </div>

                  {/* Study Button */}
                  <button
                    onClick={() => handleStartStudy(deck.id)}
                    disabled={!hasDue}
                    className={`w-full py-2.5 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      hasDue
                        ? 'bg-forest dark:bg-leaf text-alabaster dark:text-forest hover:opacity-90 shadow-sm active:scale-[0.98]'
                        : 'bg-forest/10 dark:bg-alabaster/10 text-forest/40 dark:text-alabaster/40 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{hasDue ? 'Study Deck' : 'Completed for Today'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Recently Added Words */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-forest/60 dark:text-alabaster/60 font-sans">
              Recently Added Words
            </h2>
            <button
              onClick={() => setCurrentView('cards')}
              className="text-xs text-leaf font-semibold hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-4 space-y-3 shadow-sm">
            {recentNotes.length === 0 ? (
              <p className="text-xs text-forest/60 dark:text-alabaster/60 text-center py-6">
                No vocabulary words added yet.
              </p>
            ) : (
              recentNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-xl bg-alabaster/60 dark:bg-forest/60 border border-forest/5 dark:border-alabaster/5 hover:border-leaf/40 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-display font-bold text-sm text-forest dark:text-alabaster">
                      {note.headword}
                    </h4>
                    {note.part_of_speech && (
                      <span className="text-[10px] text-forest/50 dark:text-alabaster/50 italic">
                        {note.part_of_speech}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-forest/80 dark:text-alabaster/80 mt-1 line-clamp-1 font-sans">
                    {note.definition}
                  </p>
                  {note.collocation_or_particle && (
                    <span className="inline-block mt-1 text-[11px] font-medium text-leaf">
                      + {note.collocation_or_particle}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Note Creation Modal */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        defaultDeckId={selectedDeckForNewNote}
        onSaved={loadData}
      />

      {/* New Deck Modal */}
      {isNewDeckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-alabaster dark:bg-forest-panel text-forest dark:text-alabaster rounded-2xl p-6 shadow-2xl border border-forest/15 dark:border-alabaster/10">
            <h3 className="font-display font-bold text-xl mb-4">Create New Deck</h3>
            <form onSubmit={handleCreateDeck} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Deck Name *
                </label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="e.g. Spanish B2 Subjunctive"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-display font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Description
                </label>
                <textarea
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  placeholder="What will you learn with this deck?"
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Daily New Cards Cap
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newDeckCap}
                  onChange={(e) => setNewDeckCap(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans tabular-nums"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewDeckModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest/10 dark:hover:bg-alabaster/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDeckName.trim()}
                  className="px-5 py-2 rounded-xl bg-leaf text-forest font-semibold text-sm hover:bg-leaf-hover disabled:opacity-50"
                >
                  Create Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
