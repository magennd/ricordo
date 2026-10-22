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
  BookOpen,
  Table,
  LayoutList,
  Copy,
  FolderMinus,
  CheckSquare,
  Square,
  Check,
  X
} from 'lucide-react';
import { db } from '../db/indexedDB';
import type { Deck, Note, Card, Example } from '../types/database';
import { 
  deleteNote, 
  toggleSuspendCard, 
  moveNoteToDeck, 
  removeNoteFromDeck, 
  copyNoteToDeck,
  bulkMoveNotesToDeck,
  bulkRemoveNotesFromDeck,
  bulkCopyNotesToDeck,
  bulkDeleteNotes
} from '../services/deckService';
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

  // Management Mode & Multi-selection
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // Copy Modals
  const [copyModalNote, setCopyModalNote] = useState<Note | null>(null);
  const [isBulkCopyModalOpen, setIsBulkCopyModalOpen] = useState(false);
  const [targetCopyDeckId, setTargetCopyDeckId] = useState<string>('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3200);
  };

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

  const validDeckIds = new Set(decks.map(d => d.id));
  const isUnassigned = (deckId?: string) => !deckId || !validDeckIds.has(deckId);
  const unassignedCount = notes.filter(n => isUnassigned(n.deck_id)).length;

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this word and all its cards?')) return;
    await deleteNote(noteId);
    showToast('Deleted vocabulary note');
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

  // Inline deck assignment
  const handleInlineDeckChange = async (noteId: string, newDeckId: string) => {
    if (!newDeckId) {
      await removeNoteFromDeck(noteId);
      showToast('Removed from deck (now unassigned)');
    } else {
      await moveNoteToDeck(noteId, newDeckId);
      const targetDeck = decks.find(d => d.id === newDeckId);
      showToast(`Assigned to "${targetDeck?.name || 'Deck'}"`);
    }
    await refreshStagingCount();
    await loadData();
  };

  const handleRemoveFromDeck = async (noteId: string) => {
    await removeNoteFromDeck(noteId);
    showToast('Removed from deck (now unassigned)');
    await refreshStagingCount();
    await loadData();
  };

  const openCopyModal = (note: Note) => {
    setCopyModalNote(note);
    const preferredDeck = decks.find(d => d.id !== note.deck_id && d.is_staging === 0) || decks[0];
    setTargetCopyDeckId(preferredDeck?.id || '');
  };

  const handleConfirmSingleCopy = async () => {
    if (!copyModalNote || !targetCopyDeckId) return;
    await copyNoteToDeck(copyModalNote.id, targetCopyDeckId);
    const targetDeck = decks.find(d => d.id === targetCopyDeckId);
    showToast(`Copied "${copyModalNote.headword}" to "${targetDeck?.name || 'Deck'}"`);
    setCopyModalNote(null);
    await refreshStagingCount();
    await loadData();
  };

  // Bulk actions
  const handleToggleSelectRow = (noteId: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (filteredList: Note[]) => {
    if (selectedNoteIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(filteredList.map(n => n.id)));
    }
  };

  const handleBulkMove = async (targetDeckId: string) => {
    if (!targetDeckId || selectedNoteIds.size === 0) return;
    const count = await bulkMoveNotesToDeck(Array.from(selectedNoteIds), targetDeckId);
    const targetDeck = decks.find(d => d.id === targetDeckId);
    showToast(`Moved ${count} card${count === 1 ? '' : 's'} to "${targetDeck?.name || 'Deck'}"`);
    setSelectedNoteIds(new Set());
    await refreshStagingCount();
    await loadData();
  };

  const handleBulkRemove = async () => {
    if (selectedNoteIds.size === 0) return;
    if (!window.confirm(`Remove ${selectedNoteIds.size} cards from their decks (make them unassigned)?`)) return;
    const count = await bulkRemoveNotesFromDeck(Array.from(selectedNoteIds));
    showToast(`Removed ${count} card${count === 1 ? '' : 's'} from decks`);
    setSelectedNoteIds(new Set());
    await refreshStagingCount();
    await loadData();
  };

  const openBulkCopyModal = () => {
    const preferredDeck = decks.find(d => d.is_staging === 0) || decks[0];
    setTargetCopyDeckId(preferredDeck?.id || '');
    setIsBulkCopyModalOpen(true);
  };

  const handleConfirmBulkCopy = async () => {
    if (!targetCopyDeckId || selectedNoteIds.size === 0) return;
    const count = await bulkCopyNotesToDeck(Array.from(selectedNoteIds), targetCopyDeckId);
    const targetDeck = decks.find(d => d.id === targetCopyDeckId);
    showToast(`Copied ${count} card${count === 1 ? '' : 's'} to "${targetDeck?.name || 'Deck'}"`);
    setIsBulkCopyModalOpen(false);
    setSelectedNoteIds(new Set());
    await refreshStagingCount();
    await loadData();
  };

  const handleBulkDelete = async () => {
    if (selectedNoteIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedNoteIds.size} words and all their cards? This cannot be undone.`)) return;
    const count = await bulkDeleteNotes(Array.from(selectedNoteIds));
    showToast(`Deleted ${count} words and their flashcards`);
    setSelectedNoteIds(new Set());
    await refreshLeechCount();
    await refreshStagingCount();
    await loadData();
  };

  // Filter notes by search and deck
  const filteredNotes = notes.filter((n) => {
    if (selectedDeckFilter === 'unassigned') {
      if (!isUnassigned(n.deck_id)) return false;
    } else if (selectedDeckFilter !== 'all') {
      if (n.deck_id !== selectedDeckFilter) return false;
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

  const isAllSelected = filteredNotes.length > 0 && selectedNoteIds.size === filteredNotes.length;

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 safe-bottom-nav relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-forest dark:bg-forest-panel text-alabaster border border-leaf/40 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 animate-fadeIn text-xs font-medium font-sans">
          <Check className="w-4 h-4 text-leaf shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-forest/10 dark:border-alabaster/10 pb-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-forest dark:text-alabaster">
            Vocabulary & Cards
          </h1>
          <p className="text-sm text-forest/70 dark:text-alabaster/70 mt-1 font-sans">
            Search, edit, and manage deck assignments for all source notes and cards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Manage Mode Toggle Button */}
          <button
            onClick={() => {
              setIsManageMode(prev => !prev);
              setSelectedNoteIds(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border shadow-sm ${
              isManageMode
                ? 'bg-leaf text-forest border-leaf shadow-md'
                : 'bg-white dark:bg-forest-panel text-forest dark:text-alabaster border-forest/20 dark:border-alabaster/20 hover:border-leaf/50'
            }`}
          >
            {isManageMode ? (
              <>
                <LayoutList className="w-4 h-4" />
                <span>Card View</span>
              </>
            ) : (
              <>
                <Table className="w-4 h-4 text-leaf" />
                <span>Manage Decks</span>
                {unassignedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-coral/20 text-coral tabular-nums">
                    {unassignedCount} no deck
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={() => {
              setEditingNote(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest font-semibold text-sm hover:opacity-90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Word</span>
          </button>
        </div>
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
            className="w-full md:w-64 px-3 py-2.5 rounded-xl bg-white dark:bg-forest-panel border border-forest/15 dark:border-alabaster/10 text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans font-medium"
          >
            <option value="all">All Decks ({notes.length} total)</option>
            <option value="unassigned">
              ⚠️ Unassigned / No Deck ({unassignedCount})
            </option>
            {decks.map(d => {
              const count = notes.filter(n => n.deck_id === d.id).length;
              return (
                <option key={d.id} value={d.id}>
                  {d.name} {d.is_staging ? '(Triage)' : ''} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Main Content Area: Tabular Manage Mode VS Card Grid Mode */}
      {isLoading ? (
        <p className="text-center py-12 text-sm text-forest/60 dark:text-alabaster/60 font-sans">
          Loading vocabulary...
        </p>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-forest-panel rounded-2xl p-12 text-center border border-forest/15 dark:border-alabaster/10">
          <BookOpen className="w-10 h-10 text-forest/30 dark:text-alabaster/30 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-lg text-forest dark:text-alabaster">
            No vocabulary matches found
          </h3>
          <p className="text-xs text-forest/60 dark:text-alabaster/60 mt-1 max-w-sm mx-auto font-sans">
            {selectedDeckFilter === 'unassigned'
              ? 'Great news! All of your cards are currently assigned to decks.'
              : 'Try adjusting your search query or add new vocabulary words.'}
          </p>
        </div>
      ) : isManageMode ? (
        /* TABULAR MANAGEMENT VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-forest/70 dark:text-alabaster/70 font-sans px-1">
            <span>
              Showing <strong className="text-forest dark:text-alabaster">{filteredNotes.length}</strong> entries
              {selectedNoteIds.size > 0 && ` (${selectedNoteIds.size} selected)`}
            </span>
            <span className="text-[11px] text-forest/50 dark:text-alabaster/50">
              Change deck assignments directly using the dropdown in each row or select multiple for bulk actions.
            </span>
          </div>

          <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-sans border-collapse">
                <thead>
                  <tr className="border-b border-forest/10 dark:border-alabaster/10 bg-forest/5 dark:bg-forest/50 text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 select-none">
                    <th className="py-3 px-4 w-12 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAll(filteredNotes)}
                        className="text-forest/70 dark:text-alabaster/70 hover:text-leaf transition-colors"
                        title={isAllSelected ? 'Deselect All' : 'Select All'}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-leaf" />
                        ) : selectedNoteIds.size > 0 ? (
                          <div className="w-4 h-4 rounded border-2 border-leaf bg-leaf/20 flex items-center justify-center">
                            <span className="w-2 h-0.5 bg-leaf" />
                          </div>
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 min-w-[150px]">Word (Headword)</th>
                    <th className="py-3 px-4 min-w-[200px]">Definition</th>
                    <th className="py-3 px-4 hidden lg:table-cell min-w-[140px]">Grammar / Collocation</th>
                    <th className="py-3 px-4 hidden sm:table-cell w-28 text-center">Cards</th>
                    <th className="py-3 px-4 min-w-[220px]">Deck Assignment</th>
                    <th className="py-3 px-4 w-32 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/10 dark:divide-alabaster/10">
                  {filteredNotes.map((note) => {
                    const isSelected = selectedNoteIds.has(note.id);
                    const associatedCards = cardsMap[note.id] || [];
                    const unassigned = isUnassigned(note.deck_id);

                    return (
                      <tr 
                        key={note.id}
                        className={`transition-colors ${
                          isSelected 
                            ? 'bg-leaf/10 dark:bg-leaf/15' 
                            : 'hover:bg-forest/[0.02] dark:hover:bg-alabaster/[0.02]'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(note.id)}
                            className="w-4 h-4 rounded text-leaf focus:ring-leaf accent-leaf cursor-pointer"
                          />
                        </td>

                        {/* Headword */}
                        <td className="py-3 px-4">
                          <div className="flex items-baseline gap-2">
                            <span className="font-display font-bold text-base text-forest dark:text-alabaster">
                              {note.headword}
                            </span>
                            {note.part_of_speech && (
                              <span className="text-[11px] italic text-forest/50 dark:text-alabaster/50">
                                {note.part_of_speech}
                              </span>
                            )}
                          </div>
                          {note.tags && (
                            <span className="text-[10px] text-forest/40 dark:text-alabaster/40 font-mono">
                              {JSON.parse(note.tags).join(', ')}
                            </span>
                          )}
                        </td>

                        {/* Definition */}
                        <td className="py-3 px-4 text-forest/90 dark:text-alabaster/90">
                          <span className="line-clamp-2">{note.definition}</span>
                        </td>

                        {/* Grammar / Collocation */}
                        <td className="py-3 px-4 hidden lg:table-cell text-xs">
                          {note.collocation_or_particle && (
                            <span className="block font-medium text-leaf">
                              + {note.collocation_or_particle}
                            </span>
                          )}
                          {note.grammar_notes && (
                            <span className="block text-forest/60 dark:text-alabaster/60 italic line-clamp-1 mt-0.5">
                              {note.grammar_notes}
                            </span>
                          )}
                        </td>

                        {/* Cards badge */}
                        <td className="py-3 px-4 hidden sm:table-cell text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-forest/10 dark:bg-alabaster/10 text-forest/80 dark:text-alabaster/80 tabular-nums">
                            {associatedCards.length} {associatedCards.length === 1 ? 'card' : 'cards'}
                          </span>
                        </td>

                        {/* Deck Dropdown */}
                        <td className="py-3 px-4">
                          <select
                            value={unassigned ? '' : note.deck_id}
                            onChange={(e) => handleInlineDeckChange(note.id, e.target.value)}
                            className={`w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-leaf transition-colors ${
                              unassigned
                                ? 'bg-coral/10 border-coral/40 text-coral font-semibold'
                                : 'bg-white dark:bg-forest border-forest/20 dark:border-alabaster/20 text-forest dark:text-alabaster'
                            }`}
                          >
                            <option value="">— No Deck (Unassigned) —</option>
                            {decks.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} {d.is_staging ? '(Triage)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openCopyModal(note)}
                              title="Copy to another deck"
                              className="p-1.5 rounded-lg text-forest/60 dark:text-alabaster/60 hover:text-leaf hover:bg-forest/5 dark:hover:bg-alabaster/5 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {!unassigned && (
                              <button
                                onClick={() => handleRemoveFromDeck(note.id)}
                                title="Remove from current deck (unassign)"
                                className="p-1.5 rounded-lg text-forest/60 dark:text-alabaster/60 hover:text-coral hover:bg-forest/5 dark:hover:bg-alabaster/5 transition-colors"
                              >
                                <FolderMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(note)}
                              title="Edit note"
                              className="p-1.5 rounded-lg text-forest/60 dark:text-alabaster/60 hover:text-leaf hover:bg-forest/5 dark:hover:bg-alabaster/5 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(note.id)}
                              title="Delete note"
                              className="p-1.5 rounded-lg text-forest/60 dark:text-alabaster/60 hover:text-coral hover:bg-forest/5 dark:hover:bg-alabaster/5 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD CARD VIEW */
        <div className="space-y-4">
          {filteredNotes.map((note) => {
            const associatedCards = cardsMap[note.id] || [];
            const associatedExamples = examplesMap[note.id] || [];
            const deck = decks.find(d => d.id === note.deck_id);
            const unassigned = isUnassigned(note.deck_id);

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
                      {deck ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-alabaster dark:bg-forest text-forest/70 dark:text-alabaster/70 border border-forest/10 dark:border-alabaster/10">
                          {deck.name} {deck.is_staging ? '(Triage)' : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-coral/15 text-coral border border-coral/30">
                          No Deck (Unassigned)
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
                    {/* Quick deck selector in card view */}
                    <select
                      value={unassigned ? '' : note.deck_id}
                      onChange={(e) => handleInlineDeckChange(note.id, e.target.value)}
                      className="text-xs font-medium py-1.5 px-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-forest dark:text-alabaster focus:outline-none focus:ring-1 focus:ring-leaf"
                      title="Change or assign deck"
                    >
                      <option value="">No Deck</option>
                      {decks.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.is_staging ? '(Triage)' : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => openCopyModal(note)}
                      className="p-2 rounded-lg text-forest/70 dark:text-alabaster/70 hover:bg-forest/5 dark:hover:bg-alabaster/5 hover:text-leaf transition-colors"
                      title="Copy note to another deck"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
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
          })}
        </div>
      )}

      {/* Floating / Sticky Multi-Select Toolbar (when 1 or more rows selected) */}
      {selectedNoteIds.size > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto max-w-4xl bg-forest dark:bg-forest-panel text-alabaster rounded-2xl p-4 shadow-2xl border border-leaf/40 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-leaf text-forest font-bold text-xs tabular-nums">
              {selectedNoteIds.size} selected
            </span>
            <button
              onClick={() => setSelectedNoteIds(new Set())}
              className="text-xs text-alabaster/70 hover:text-alabaster underline font-sans"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Move to Deck dropdown */}
            <div className="flex items-center gap-1 bg-white/10 dark:bg-forest px-2 py-1 rounded-xl border border-alabaster/20">
              <span className="text-[11px] text-alabaster/70 font-semibold uppercase">Move to:</span>
              <select
                className="bg-transparent text-xs text-alabaster font-medium py-1 px-1.5 focus:outline-none cursor-pointer"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkMove(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="" disabled className="text-forest">Choose Deck...</option>
                {decks.map(d => (
                  <option key={d.id} value={d.id} className="text-forest">
                    {d.name} {d.is_staging ? '(Triage)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Copy to Deck button */}
            <button
              onClick={openBulkCopyModal}
              className="px-3 py-2 rounded-xl border border-alabaster/20 hover:bg-alabaster/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-leaf" />
              <span>Copy to Deck</span>
            </button>

            {/* Remove from Deck button */}
            <button
              onClick={handleBulkRemove}
              className="px-3 py-2 rounded-xl border border-alabaster/20 hover:bg-alabaster/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FolderMinus className="w-3.5 h-3.5 text-coral" />
              <span>Remove from Deck</span>
            </button>

            {/* Delete button */}
            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 rounded-xl bg-coral/20 hover:bg-coral/30 text-coral text-xs font-semibold flex items-center gap-1.5 border border-coral/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Note Creation/Edit Modal */}
      <NoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        noteToEdit={editingNote}
        onSaved={loadData}
      />

      {/* Single Copy Modal */}
      {copyModalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/70 backdrop-blur-sm overflow-y-auto safe-top safe-bottom">
          <div className="w-full max-w-md bg-alabaster dark:bg-forest-panel text-forest dark:text-alabaster rounded-2xl p-6 shadow-2xl border border-forest/15 dark:border-alabaster/10 my-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-leaf/20 text-leaf flex items-center justify-center shrink-0">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Copy Word to Deck</h3>
                  <p className="text-xs text-forest/70 dark:text-alabaster/70 font-sans">
                    Duplicate word and flashcards into another deck
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCopyModalNote(null)}
                className="p-1 rounded-lg text-forest/50 hover:text-forest"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-forest/80 dark:text-alabaster/80 font-sans mb-4">
              Copying <span className="font-bold text-forest dark:text-alabaster">"{copyModalNote.headword}"</span> will create an independent duplicate with new flashcards in the chosen deck.
            </p>

            <div className="space-y-1.5 mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70">
                Destination Deck
              </label>
              <select
                value={targetCopyDeckId}
                onChange={(e) => setTargetCopyDeckId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-medium"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.is_staging ? '(Triage)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCopyModalNote(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest/10 dark:hover:bg-alabaster/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleCopy}
                disabled={!targetCopyDeckId}
                className="px-5 py-2.5 rounded-xl bg-leaf text-forest font-semibold text-sm hover:bg-leaf-hover transition-colors shadow-sm disabled:opacity-50"
              >
                Copy Word
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Copy Modal */}
      {isBulkCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/70 backdrop-blur-sm overflow-y-auto safe-top safe-bottom">
          <div className="w-full max-w-md bg-alabaster dark:bg-forest-panel text-forest dark:text-alabaster rounded-2xl p-6 shadow-2xl border border-forest/15 dark:border-alabaster/10 my-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-leaf/20 text-leaf flex items-center justify-center shrink-0">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Copy {selectedNoteIds.size} Words to Deck</h3>
                  <p className="text-xs text-forest/70 dark:text-alabaster/70 font-sans">
                    Batch copy selected entries
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkCopyModalOpen(false)}
                className="p-1 rounded-lg text-forest/50 hover:text-forest"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-forest/80 dark:text-alabaster/80 font-sans mb-4">
              All <strong className="text-forest dark:text-alabaster">{selectedNoteIds.size}</strong> selected vocabulary entries will be duplicated with their flashcards into the chosen destination deck.
            </p>

            <div className="space-y-1.5 mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70">
                Destination Deck
              </label>
              <select
                value={targetCopyDeckId}
                onChange={(e) => setTargetCopyDeckId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-medium"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.is_staging ? '(Triage)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkCopyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest/10 dark:hover:bg-alabaster/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkCopy}
                disabled={!targetCopyDeckId}
                className="px-5 py-2.5 rounded-xl bg-leaf text-forest font-semibold text-sm hover:bg-leaf-hover transition-colors shadow-sm disabled:opacity-50"
              >
                Copy {selectedNoteIds.size} Words
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
