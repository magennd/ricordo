import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  PauseCircle, 
  PlayCircle,
  Plus,
  BookOpen
} from 'lucide-react';
import { db } from '../db/indexedDB';
import type { Deck, Note, Card, Example } from '../types/database';
import { deleteNote, toggleSuspendCard } from '../services/deckService';
import { NoteModal } from '../components/NoteModal';
import { useApp } from '../context/AppContext';

export const CardsBrowserView: React.FC = () => {
  const { refreshLeechCount, refreshStagingCount } = useApp();
  const [notes, setNotes] = useState<Note[]>([]);
  const [cardsMap, setCardsMap] = useState<Record<string, Card[]>>({});
  const [examplesMap, setExamplesMap] = useState<Record<string, Example[]>>({});
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckFilter, setSelectedDeckFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<{ note: Note; examples: Example[] } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const allDecks = await db.decks.toArray();
    const allNotes = await db.notes.toArray();
    const allCards = await db.cards.toArray();
    const allExamples = await db.examples.toArray();

    setDecks(allDecks);
    setNotes(allNotes);

    const cMap: Record<string, Card[]> = {};
    for (const card of allCards) {
      if (!cMap[card.note_id]) cMap[card.note_id] = [];
      cMap[card.note_id].push(card);
    }
    setCardsMap(cMap);

    const eMap: Record<string, Example[]> = {};
    for (const ex of allExamples) {
      if (!eMap[ex.note_id]) eMap[ex.note_id] = [];
      eMap[ex.note_id].push(ex);
    }
    setExamplesMap(eMap);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this word and all its cards?')) return;
    await deleteNote(noteId);
    await refreshLeechCount();
    await refreshStagingCount();
    await loadData();
  };

  const handleToggleSuspend = async (cardId: string) => {
    await toggleSuspendCard(cardId);
    await loadData();
  };

  const handleEdit = (note: Note) => {
    const exs = examplesMap[note.id] || [];
    setEditingNote({ note, examples: exs });
    setIsModalOpen(true);
  };

  // Filter notes by search and deck
  const filteredNotes = notes.filter((n) => {
    if (selectedDeckFilter !== 'all' && n.deck_id !== selectedDeckFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inHeadword = n.headword.toLowerCase().includes(q);
      const inDef = n.definition.toLowerCase().includes(q);
      const inGrammar = n.grammar_notes?.toLowerCase().includes(q);
      const inColloc = n.collocation_or_particle?.toLowerCase().includes(q);
      const inTags = n.tags?.toLowerCase().includes(q);
      return inHeadword || inDef || inGrammar || inColloc || inTags;
    }
    return true;
  });

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 safe-bottom">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-forest/10 dark:border-alabaster/10 pb-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-forest dark:text-alabaster">
            Vocabulary & Cards
          </h1>
          <p className="text-sm text-forest/70 dark:text-alabaster/70 mt-1 font-sans">
            Search, edit, and inspect all source notes and generated flashcards.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingNote(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest font-semibold text-sm hover:opacity-90 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Word</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-forest/50 dark:text-alabaster/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search headwords, definitions, grammar notes, tags..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-forest-panel border border-forest/15 dark:border-alabaster/10 text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans"
          />
        </div>

        {/* Deck Dropdown Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-forest/60 dark:text-alabaster/60 shrink-0" />
          <select
            value={selectedDeckFilter}
            onChange={(e) => setSelectedDeckFilter(e.target.value)}
            className="w-full md:w-56 px-3 py-2.5 rounded-xl bg-white dark:bg-forest-panel border border-forest/15 dark:border-alabaster/10 text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans font-medium"
          >
            <option value="all">All Decks ({notes.length} notes)</option>
            {decks.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} {d.is_staging ? '(Triage)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-center py-12 text-sm text-forest/60 dark:text-alabaster/60">
            Loading vocabulary...
          </p>
        ) : filteredNotes.length === 0 ? (
          <div className="bg-white dark:bg-forest-panel rounded-2xl p-12 text-center border border-forest/15 dark:border-alabaster/10">
            <BookOpen className="w-10 h-10 text-forest/30 dark:text-alabaster/30 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-lg text-forest dark:text-alabaster">
              No vocabulary matches found
            </h3>
            <p className="text-xs text-forest/60 dark:text-alabaster/60 mt-1 max-w-sm mx-auto font-sans">
              Try adjusting your search query or add new vocabulary words to your decks.
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const associatedCards = cardsMap[note.id] || [];
            const associatedExamples = examplesMap[note.id] || [];
            const deck = decks.find(d => d.id === note.deck_id);

            return (
              <div
                key={note.id}
                className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-5 shadow-sm space-y-4 hover:border-leaf/30 transition-all"
              >
                {/* Note Header & Action Buttons */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-display font-bold text-xl text-forest dark:text-alabaster">
                        {note.headword}
                      </h3>
                      {note.part_of_speech && (
                        <span className="text-xs italic text-forest/60 dark:text-alabaster/60 font-sans">
                          {note.part_of_speech}
                        </span>
                      )}
                      {deck && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-alabaster dark:bg-forest text-forest/70 dark:text-alabaster/70 border border-forest/10 dark:border-alabaster/10">
                          {deck.name}
                        </span>
                      )}
                    </div>

                    <p className="font-sans text-sm text-forest/90 dark:text-alabaster/90 mt-1 font-medium">
                      {note.definition}
                    </p>

                    {note.collocation_or_particle && (
                      <p className="text-xs text-leaf font-semibold mt-1">
                        Collocation: {note.collocation_or_particle}
                      </p>
                    )}

                    {note.grammar_notes && (
                      <p className="text-xs italic text-forest/70 dark:text-alabaster/70 mt-1 font-sans">
                        Note: {note.grammar_notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-start shrink-0">
                    <button
                      onClick={() => handleEdit(note)}
                      className="p-2 rounded-lg text-forest/70 dark:text-alabaster/70 hover:bg-forest/5 dark:hover:bg-alabaster/5 hover:text-leaf transition-colors"
                      title="Edit note"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-2 rounded-lg text-coral hover:bg-coral/10 transition-colors"
                      title="Delete note and cards"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Example Sentences */}
                {associatedExamples.length > 0 && (
                  <div className="bg-alabaster/60 dark:bg-forest/50 p-3 rounded-xl border border-forest/5 dark:border-alabaster/5 text-xs space-y-1 font-sans">
                    {associatedExamples.map((ex) => (
                      <div key={ex.id}>
                        <p className="font-medium text-forest dark:text-alabaster">
                          "{ex.sentence_target}"
                        </p>
                        {ex.sentence_native && (
                          <p className="text-forest/60 dark:text-alabaster/60 italic">
                            "{ex.sentence_native}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Associated Generated Cards (Recognition, Production, Cloze) */}
                <div className="pt-2 border-t border-forest/10 dark:border-alabaster/10">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-forest/50 dark:text-alabaster/50 block mb-2 font-sans">
                    Generated Flashcards ({associatedCards.length})
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {associatedCards.map((card) => {
                      const isSuspended = card.is_suspended === 1;
                      const isLeech = card.is_leech === 1;

                      return (
                        <div
                          key={card.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                            isSuspended
                              ? 'bg-forest/5 dark:bg-alabaster/5 border-dashed border-forest/20 text-forest/40 dark:text-alabaster/40'
                              : 'bg-white dark:bg-forest border-forest/10 dark:border-alabaster/10'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold capitalize font-sans">
                              <span>{card.card_type}</span>
                              {isLeech && (
                                <span className="text-[10px] text-coral font-bold flex items-center">
                                  <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                                  Leech
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-forest/60 dark:text-alabaster/60 tabular-nums mt-0.5">
                              {card.state === 0 ? 'New' : `Reps: ${card.reps} | Lapses: ${card.lapses}`}
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggleSuspend(card.id)}
                            title={isSuspended ? 'Unsuspend Card' : 'Suspend Card'}
                            className="p-1 text-forest/50 dark:text-alabaster/50 hover:text-coral transition-colors"
                          >
                            {isSuspended ? (
                              <PlayCircle className="w-4 h-4 text-leaf" />
                            ) : (
                              <PauseCircle className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

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

