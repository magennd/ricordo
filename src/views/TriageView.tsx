import React, { useState, useEffect, useCallback } from 'react';
import { 
  Inbox, 
  Check, 
  Trash2, 
  BookMarked 
} from 'lucide-react';
import { db } from '../db/indexedDB';
import type { Deck, Note, Example } from '../types/database';
import { approveStagingNote, deleteNote } from '../services/deckService';
import { useApp } from '../context/AppContext';

export const TriageView: React.FC = () => {
  const { refreshStagingCount } = useApp();
  const [stagingNotes, setStagingNotes] = useState<Note[]>([]);
  const [examplesMap, setExamplesMap] = useState<Record<string, Example[]>>({});
  const [studyDecks, setStudyDecks] = useState<Deck[]>([]);
  const [selectedDeckMap, setSelectedDeckMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const allDecks = await db.decks.toArray();
    const stagingDeck = allDecks.find(d => d.is_staging === 1);
    const regularDecks = allDecks.filter(d => d.is_staging === 0);
    setStudyDecks(regularDecks);

    if (stagingDeck) {
      const notes = await db.notes.where('deck_id').equals(stagingDeck.id).toArray();
      setStagingNotes(notes);

      const eMap: Record<string, Example[]> = {};
      for (const n of notes) {
        const exs = await db.examples.where('note_id').equals(n.id).toArray();
        eMap[n.id] = exs;
      }
      setExamplesMap(eMap);

      // Default selection for approval target
      const initialMap: Record<string, string> = {};
      for (const n of notes) {
        initialMap[n.id] = regularDecks[0]?.id || '';
      }
      setSelectedDeckMap(initialMap);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (noteId: string) => {
    const targetDeckId = selectedDeckMap[noteId] || studyDecks[0]?.id;
    if (!targetDeckId) return;

    await approveStagingNote(noteId, targetDeckId);
    await refreshStagingCount();
    await loadData();
  };

  const handleApproveAll = async (targetDeckId: string) => {
    if (!targetDeckId) return;
    for (const note of stagingNotes) {
      await approveStagingNote(note.id, targetDeckId);
    }
    await refreshStagingCount();
    await loadData();
  };

  const handleDismiss = async (noteId: string) => {
    await deleteNote(noteId);
    await refreshStagingCount();
    await loadData();
  };

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6 safe-bottom">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-forest/10 dark:border-alabaster/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold tracking-tight text-forest dark:text-alabaster">
              Dictionary Triage Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-leaf text-forest tabular-nums">
              {stagingNotes.length} pending
            </span>
          </div>
          <p className="text-sm text-forest/70 dark:text-alabaster/70 mt-1 font-sans">
            Words bookmarked or looked up multiple times in your dictionary appear here for one-click approval into active study decks.
          </p>
        </div>

        {stagingNotes.length > 0 && studyDecks.length > 0 && (
          <button
            onClick={() => handleApproveAll(studyDecks[0].id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest font-semibold text-xs hover:opacity-90 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Check className="w-4 h-4" />
            <span>Approve All to "{studyDecks[0].name}"</span>
          </button>
        )}
      </div>

      {/* Main List */}
      {isLoading ? (
        <p className="text-center py-12 text-sm text-forest/60 dark:text-alabaster/60 font-sans">
          Loading triage queue...
        </p>
      ) : stagingNotes.length === 0 ? (
        <div className="bg-white dark:bg-forest-panel rounded-2xl p-12 text-center border border-forest/15 dark:border-alabaster/10 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-leaf/20 text-leaf flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-xl text-forest dark:text-alabaster">
            Triage Queue is Empty
          </h3>
          <p className="text-xs text-forest/60 dark:text-alabaster/60 mt-2 font-sans leading-relaxed">
            When you look up or bookmark words in your dictionary, or when you import new word batches, they will wait here until you approve them into active study decks.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {stagingNotes.map((note) => {
            const examples = examplesMap[note.id] || [];
            const selectedDeck = selectedDeckMap[note.id] || studyDecks[0]?.id;

            return (
              <div
                key={note.id}
                className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-5 shadow-sm space-y-3 hover:border-leaf/40 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-display font-bold text-2xl text-forest dark:text-alabaster">
                        {note.headword}
                      </h3>
                      {note.part_of_speech && (
                        <span className="text-xs italic text-forest/60 dark:text-alabaster/60 font-sans">
                          {note.part_of_speech}
                        </span>
                      )}
                      {note.lookup_count && note.lookup_count > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-coral/15 text-coral flex items-center gap-1">
                          <BookMarked className="w-3 h-3" />
                          Looked up {note.lookup_count}×
                        </span>
                      )}
                    </div>

                    <p className="font-sans text-base text-forest dark:text-alabaster mt-1 font-medium">
                      {note.definition}
                    </p>

                    {note.collocation_or_particle && (
                      <p className="text-xs text-leaf font-semibold mt-1">
                        Collocation: {note.collocation_or_particle}
                      </p>
                    )}
                  </div>

                  {/* Approval Action Form */}
                  <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                    <select
                      value={selectedDeck}
                      onChange={(e) => setSelectedDeckMap(prev => ({ ...prev, [note.id]: e.target.value }))}
                      className="px-3 py-2 rounded-xl bg-alabaster dark:bg-forest border border-forest/15 dark:border-alabaster/15 text-xs text-forest dark:text-alabaster font-sans font-medium focus:outline-none focus:ring-1 focus:ring-leaf"
                    >
                      {studyDecks.map(d => (
                        <option key={d.id} value={d.id}>
                          Move to {d.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleApprove(note.id)}
                      className="px-4 py-2 rounded-xl bg-leaf text-forest font-semibold text-xs hover:bg-leaf-hover transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => handleDismiss(note.id)}
                      className="p-2 text-forest/40 dark:text-alabaster/40 hover:text-coral transition-colors rounded-lg"
                      title="Dismiss word"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Example sentence preview */}
                {examples.length > 0 && (
                  <div className="bg-alabaster/50 dark:bg-forest/50 p-3 rounded-xl border border-forest/5 dark:border-alabaster/5 text-xs text-forest/80 dark:text-alabaster/80 italic font-sans">
                    "{examples[0].sentence_target}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
