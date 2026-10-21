import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { db } from '../db/indexedDB';
import type { Deck, Note, Example } from '../types/database';
import { createNoteWithCards, updateNote } from '../services/deckService';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToEdit?: { note: Note; examples: Example[] } | null;
  defaultDeckId?: string | null;
  onSaved: () => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  noteToEdit,
  defaultDeckId,
  onSaved,
}) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState<string>('');
  const [headword, setHeadword] = useState('');
  const [definition, setDefinition] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [collocation, setCollocation] = useState('');
  const [grammarNotes, setGrammarNotes] = useState('');
  const [tags, setTags] = useState('');

  // Example sentence fields
  const [examples, setExamples] = useState<Array<{
    id?: string;
    sentence_target: string;
    sentence_native: string;
    cloze_target_word: string;
    cloze_grammar_hint: string;
  }>>([
    { sentence_target: '', sentence_native: '', cloze_target_word: '', cloze_grammar_hint: '' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadDecks = async () => {
      const allDecks = await db.decks.toArray();
      setDecks(allDecks);
      if (!deckId && allDecks.length > 0) {
        // Prefer defaultDeckId or first non-staging deck
        const preferred = allDecks.find(d => d.id === defaultDeckId) || allDecks.find(d => d.is_staging === 0) || allDecks[0];
        setDeckId(preferred.id);
      }
    };
    if (isOpen) {
      loadDecks();
    }
  }, [isOpen, defaultDeckId]);

  useEffect(() => {
    if (noteToEdit) {
      setDeckId(noteToEdit.note.deck_id);
      setHeadword(noteToEdit.note.headword);
      setDefinition(noteToEdit.note.definition);
      setPartOfSpeech(noteToEdit.note.part_of_speech || '');
      setCollocation(noteToEdit.note.collocation_or_particle || '');
      setGrammarNotes(noteToEdit.note.grammar_notes || '');
      setTags(noteToEdit.note.tags ? JSON.parse(noteToEdit.note.tags).join(', ') : '');

      if (noteToEdit.examples.length > 0) {
        setExamples(noteToEdit.examples.map(ex => ({
          id: ex.id,
          sentence_target: ex.sentence_target,
          sentence_native: ex.sentence_native || '',
          cloze_target_word: ex.cloze_target_word,
          cloze_grammar_hint: ex.cloze_grammar_hint || '',
        })));
      } else {
        setExamples([{ sentence_target: '', sentence_native: '', cloze_target_word: '', cloze_grammar_hint: '' }]);
      }
    } else {
      // Reset form
      setHeadword('');
      setDefinition('');
      setPartOfSpeech('');
      setCollocation('');
      setGrammarNotes('');
      setTags('');
      setExamples([{ sentence_target: '', sentence_native: '', cloze_target_word: '', cloze_grammar_hint: '' }]);
    }
  }, [noteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headword.trim() || !definition.trim() || !deckId) return;

    setIsSubmitting(true);
    try {
      const parsedTags = tags.trim()
        ? JSON.stringify(tags.split(',').map(t => t.trim()).filter(Boolean))
        : undefined;

      const validExamples = examples.filter(ex => ex.sentence_target.trim().length > 0);

      if (noteToEdit) {
        await updateNote(
          noteToEdit.note.id,
          {
            deck_id: deckId,
            headword: headword.trim(),
            definition: definition.trim(),
            part_of_speech: partOfSpeech.trim() || undefined,
            collocation_or_particle: collocation.trim() || undefined,
            grammar_notes: grammarNotes.trim() || undefined,
            tags: parsedTags,
          },
          validExamples
        );
      } else {
        await createNoteWithCards({
          deck_id: deckId,
          headword: headword.trim(),
          definition: definition.trim(),
          part_of_speech: partOfSpeech.trim() || undefined,
          collocation_or_particle: collocation.trim() || undefined,
          grammar_notes: grammarNotes.trim() || undefined,
          tags: parsedTags,
          examples: validExamples,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExampleChange = (index: number, field: string, value: string) => {
    const updated = [...examples];
    updated[index] = { ...updated[index], [field]: value };
    setExamples(updated);
  };

  const addExampleSlot = () => {
    setExamples(prev => [
      ...prev,
      { sentence_target: '', sentence_native: '', cloze_target_word: headword, cloze_grammar_hint: '' }
    ]);
  };

  const removeExampleSlot = (index: number) => {
    if (examples.length === 1) {
      setExamples([{ sentence_target: '', sentence_native: '', cloze_target_word: '', cloze_grammar_hint: '' }]);
    } else {
      setExamples(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-alabaster dark:bg-forest-panel text-forest dark:text-alabaster rounded-2xl shadow-2xl border border-forest/15 dark:border-alabaster/10 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-forest/10 dark:border-alabaster/10 bg-white/50 dark:bg-forest/50">
          <div>
            <h2 className="font-display font-bold text-xl tracking-tight">
              {noteToEdit ? 'Edit Vocabulary Note' : 'Add New Vocabulary Note'}
            </h2>
            <p className="text-xs text-forest/70 dark:text-alabaster/70 mt-0.5">
              Creates Recognition, Production, and Cloze flashcards automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-forest/60 dark:text-alabaster/60 hover:bg-forest/10 dark:hover:bg-alabaster/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Deck Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
              Target Deck
            </label>
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster text-sm focus:outline-none focus:ring-2 focus:ring-leaf font-medium"
              required
            >
              {decks.map(deck => (
                <option key={deck.id} value={deck.id}>
                  {deck.name} {deck.is_staging ? '(Triage Staging)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Word & Definition */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
                Headword (Target Language) *
              </label>
              <input
                type="text"
                value={headword}
                onChange={(e) => setHeadword(e.target.value)}
                placeholder="e.g., ricordare"
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster text-sm focus:outline-none focus:ring-2 focus:ring-leaf font-display font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
                Definition (Native Meaning) *
              </label>
              <input
                type="text"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="e.g., to remember, to recall"
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster text-sm focus:outline-none focus:ring-2 focus:ring-leaf font-sans"
                required
              />
            </div>
          </div>

          {/* Grammar & Collocation Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
                Part of Speech
              </label>
              <input
                type="text"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="e.g., verb, feminine noun, idiom"
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster text-sm focus:outline-none focus:ring-2 focus:ring-leaf"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
                Collocation / Particle Slot
              </label>
              <input
                type="text"
                value={collocation}
                onChange={(e) => setCollocation(e.target.value)}
                placeholder="e.g., ricordarsi di + inf."
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster text-sm focus:outline-none focus:ring-2 focus:ring-leaf font-medium"
              />
            </div>
          </div>

          {/* Grammar Notes & Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
                Grammar Notes
              </label>
              <input
                type="text"
                value={grammarNotes}
                onChange={(e) => setGrammarNotes(e.target.value)}
                placeholder="e.g., Requires essere in compound tenses"
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster text-sm focus:outline-none focus:ring-2 focus:ring-leaf italic"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="verbs, b2, expressions"
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster text-sm focus:outline-none focus:ring-2 focus:ring-leaf"
              />
            </div>
          </div>

          {/* Example Sentences & Dynamic Cloze */}
          <div className="pt-2 border-t border-forest/10 dark:border-alabaster/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display font-semibold text-sm">Example Sentence & Cloze</h3>
                <p className="text-xs text-forest/60 dark:text-alabaster/60">
                  Used for Recognition cards and generates Dynamic Cloze fill-in-the-blank cards.
                </p>
              </div>
              <button
                type="button"
                onClick={addExampleSlot}
                className="flex items-center gap-1.5 text-xs text-leaf font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Example
              </button>
            </div>

            <div className="space-y-4">
              {examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white/70 dark:bg-forest/70 border border-forest/10 dark:border-alabaster/10 space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-leaf">Example #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeExampleSlot(idx)}
                      className="text-coral hover:opacity-80 p-1"
                      title="Remove example"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-forest/70 dark:text-alabaster/70 mb-1">
                      Target Sentence
                    </label>
                    <input
                      type="text"
                      value={ex.sentence_target}
                      onChange={(e) => handleExampleChange(idx, 'sentence_target', e.target.value)}
                      placeholder="Ti ricordi di chiudere la finestra?"
                      className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest-panel text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-forest/70 dark:text-alabaster/70 mb-1">
                      English Translation
                    </label>
                    <input
                      type="text"
                      value={ex.sentence_native}
                      onChange={(e) => handleExampleChange(idx, 'sentence_native', e.target.value)}
                      placeholder="Do you remember to close the window?"
                      className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest-panel text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-forest/70 dark:text-alabaster/70 mb-1">
                        Cloze Word to Blank Out
                      </label>
                      <input
                        type="text"
                        value={ex.cloze_target_word}
                        onChange={(e) => handleExampleChange(idx, 'cloze_target_word', e.target.value)}
                        placeholder={headword || 'Word to hide'}
                        className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest-panel text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-forest/70 dark:text-alabaster/70 mb-1">
                        Grammar Micro-Prompt (inside brackets)
                      </label>
                      <input
                        type="text"
                        value={ex.cloze_grammar_hint}
                        onChange={(e) => handleExampleChange(idx, 'cloze_grammar_hint', e.target.value)}
                        placeholder="e.g., verb | past tense, 2nd pers. sing."
                        className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest-panel text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf italic text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-forest/10 dark:border-alabaster/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-forest/80 dark:text-alabaster/80 hover:bg-forest/10 dark:hover:bg-alabaster/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !headword.trim() || !definition.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-leaf text-forest hover:bg-leaf-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : noteToEdit ? 'Save Changes' : 'Create Vocabulary Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
