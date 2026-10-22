import React, { useState, useEffect, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  ArrowLeft, 
  RotateCcw, 
  Eye, 
  CheckCircle2, 
  PenTool, 
  Clock, 
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDueCardsForDeck, getReviseAllCards, submitCardReview, undoLastReview } from '../services/deckService';
import { calculateNextIntervals } from '../services/fsrsService';
import type { CardWithContext, Rating, Example } from '../types/database';

export const StudyView: React.FC = () => {
  const { activeDeckId, setCurrentView, refreshLeechCount, reviseAllLimit } = useApp();
  const [cards, setCards] = useState<CardWithContext[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const isReviseAll = activeDeckId === 'revise-all';

  // Ephemeral Active Recall: Force Sentence Creation
  const [enableRecallPrompt, setEnableRecallPrompt] = useState(false);
  const [ephemeralSentence, setEphemeralSentence] = useState('');

  // Load cards (either due deck cards or random seen cards for revise all)
  const loadCards = useCallback(async () => {
    if (!activeDeckId) {
      setCurrentView('decks');
      return;
    }
    setIsLoading(true);
    let sessionCards: CardWithContext[] = [];
    if (activeDeckId === 'revise-all') {
      sessionCards = await getReviseAllCards(reviseAllLimit);
    } else {
      sessionCards = await getDueCardsForDeck(activeDeckId);
    }
    setCards(sessionCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsLoading(false);
  }, [activeDeckId, setCurrentView, reviseAllLimit]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const currentCard = cards[currentIndex] || null;

  // Selected example for cloze cards (pick stable one or first)
  const selectedExample: Example | null = useMemo(() => {
    if (!currentCard || currentCard.examples.length === 0) return null;
    return currentCard.examples[0];
  }, [currentCard]);

  // Interval predictions for current card
  const intervalPredictions = useMemo(() => {
    if (!currentCard) return null;
    return calculateNextIntervals(currentCard);
  }, [currentCard]);

  // Handle Card Rating
  const handleRate = useCallback(async (rating: Rating) => {
    if (!currentCard || !isFlipped) return;

    try {
      await submitCardReview(currentCard.id, rating);
    } catch (err) {
      console.error('Error submitting review:', err);
    }

    // Refresh counters without blocking UI progression
    refreshLeechCount().catch(console.warn);

    setCanUndo(true);
    setReviewedCount(prev => prev + 1);
    setEphemeralSentence('');

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setSessionCompleted(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#65A603', '#E4774F', '#F6EFEB']
      });
    }
  }, [currentCard, isFlipped, currentIndex, cards.length, refreshLeechCount]);

  // Handle Undo Review
  const handleUndo = useCallback(async () => {
    if (!canUndo) return;
    const success = await undoLastReview();
    if (success) {
      setCanUndo(false);
      setReviewedCount(prev => Math.max(0, prev - 1));
      if (sessionCompleted) {
        setSessionCompleted(false);
        setCurrentIndex(cards.length - 1);
        setIsFlipped(true);
      } else if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setIsFlipped(true);
      }
      refreshLeechCount().catch(console.warn);
    }
  }, [canUndo, sessionCompleted, currentIndex, cards.length, refreshLeechCount]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!isFlipped) {
          setIsFlipped(true);
        }
      } else if (isFlipped) {
        if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          handleRate(1);
        } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          handleRate(2);
        } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          handleRate(3);
        } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
          e.preventDefault();
          handleRate(4);
        }
      }

      if (e.key === 'z' || e.key === 'u' || e.code === 'KeyZ') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleRate, handleUndo]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3 text-forest/70 dark:text-alabaster/70">
          <Clock className="w-8 h-8 animate-spin text-leaf" />
          <p className="font-display font-medium">Preparing study session...</p>
        </div>
      </div>
    );
  }

  // No due cards or session completed
  if (cards.length === 0 || sessionCompleted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[80vh] text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-leaf/20 text-leaf flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="font-display text-3xl font-bold text-forest dark:text-alabaster mb-2">
          {sessionCompleted
            ? isReviseAll ? 'Revision Complete!' : 'Session Complete!'
            : isReviseAll ? 'No Seen Cards Yet' : 'All Caught Up!'}
        </h2>
        <p className="text-forest/70 dark:text-alabaster/70 font-sans mb-8 leading-relaxed">
          {sessionCompleted
            ? `You reviewed ${reviewedCount} random card${reviewedCount === 1 ? '' : 's'} across your decks. Excellent practice!`
            : isReviseAll
              ? 'No reviewed cards found in your active decks. Study some new cards first to unlock the revision pool!'
              : 'No cards are due for review right now. Come back later or add new vocabulary.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {isReviseAll && sessionCompleted && (
            <button
              onClick={() => {
                setSessionCompleted(false);
                loadCards();
              }}
              className="px-5 py-2.5 rounded-xl bg-leaf text-forest font-semibold text-sm hover:bg-leaf-hover transition-colors shadow-sm flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Revise Another Batch</span>
            </button>
          )}
          {canUndo && (
            <button
              onClick={handleUndo}
              className="px-4 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 font-medium text-sm flex items-center gap-2 hover:bg-forest/5 dark:hover:bg-alabaster/5"
            >
              <RotateCcw className="w-4 h-4" />
              Undo Last Review
            </button>
          )}
          <button
            onClick={() => setCurrentView('decks')}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm ${
              isReviseAll && sessionCompleted
                ? 'border border-forest/20 dark:border-alabaster/20 text-forest dark:text-alabaster hover:bg-forest/5 dark:hover:bg-alabaster/5'
                : 'bg-forest dark:bg-leaf text-alabaster dark:text-forest hover:opacity-90'
            }`}
          >
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  // Cloze Card sentence rendering
  const renderClozeFront = (sentence: string, targetWord: string, hint?: string) => {
    if (!sentence || !targetWord) return sentence;
    const parts = sentence.split(new RegExp(`(${targetWord})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => {
          if (part.toLowerCase() === targetWord.toLowerCase()) {
            return (
              <span
                key={i}
                className="inline-block px-2.5 py-0.5 mx-1 rounded-md bg-coral/15 border-b-2 border-coral text-coral font-bold"
              >
                [ ... {hint ? <span className="text-xs font-normal italic opacity-90">({hint})</span> : null} ]
              </span>
            );
          }
          return part;
        })}
      </span>
    );
  };

  const renderClozeBack = (sentence: string, targetWord: string) => {
    if (!sentence || !targetWord) return sentence;
    const parts = sentence.split(new RegExp(`(${targetWord})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => {
          if (part.toLowerCase() === targetWord.toLowerCase()) {
            return (
              <span
                key={i}
                className="inline-block px-1.5 py-0.5 rounded bg-leaf/20 text-leaf dark:text-leaf font-bold"
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </span>
    );
  };

  const progressPercent = Math.round(((currentIndex) / cards.length) * 100);

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-4 min-h-screen safe-bottom">
      
      {/* Top Header / Progress Bar */}
      <div className="w-full mb-4">
        <div className="flex items-center justify-between mb-2 text-xs font-medium text-forest/70 dark:text-alabaster/70">
          <button
            onClick={() => setCurrentView('decks')}
            className="flex items-center gap-1 hover:text-forest dark:hover:text-alabaster"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isReviseAll ? 'Leave Revision' : 'Leave Study'}</span>
          </button>

          <div className="flex items-center gap-2">
            {isReviseAll && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-leaf/20 text-leaf uppercase tracking-wider">
                Revise All
              </span>
            )}
            <span className="font-display font-medium text-forest dark:text-alabaster truncate max-w-[150px] sm:max-w-xs">
              {currentCard.deckName}
            </span>
            <span>•</span>
            <span className="tabular-nums font-semibold text-leaf">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>
        </div>

        {/* Segmented Progress Bar */}
        <div className="w-full h-1.5 bg-forest/10 dark:bg-alabaster/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-leaf transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Flashcard Container */}
      <div className="flex-1 flex flex-col justify-center my-auto">
        <div
          onClick={() => !isFlipped && setIsFlipped(true)}
          className={`relative w-full min-h-[340px] rounded-2xl p-7 md:p-9 shadow-md transition-all duration-200 cursor-pointer border ${
            isFlipped
              ? 'bg-white dark:bg-forest-panel border-forest/15 dark:border-alabaster/10'
              : 'bg-white dark:bg-forest-panel border-forest/15 dark:border-alabaster/10 hover:border-leaf/50'
          }`}
        >
          {/* Card Type Badge & Leech Indicator */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-alabaster dark:bg-forest text-forest/80 dark:text-alabaster/80 border border-forest/10 dark:border-alabaster/10 font-sans">
              {currentCard.card_type === 'recognition' && 'Recognition (Recall Definition)'}
              {currentCard.card_type === 'production' && 'Production (Recall Word)'}
              {currentCard.card_type === 'cloze' && 'Dynamic Cloze (Sentence Recall)'}
            </span>

            {currentCard.is_leech === 1 && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-coral/15 text-coral">
                <AlertTriangle className="w-3 h-3" />
                Leech
              </span>
            )}
          </div>

          {/* FRONT OF CARD */}
          <div className="text-center py-4">
            {currentCard.card_type === 'recognition' && (
              <>
                <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-forest dark:text-alabaster mb-3">
                  {currentCard.note.headword}
                </h1>
                {currentCard.note.collocation_or_particle && (
                  <p className="font-sans text-sm font-medium text-forest/80 dark:text-alabaster/80 mb-3 bg-alabaster/80 dark:bg-forest px-3 py-1 rounded-lg inline-block">
                    {currentCard.note.collocation_or_particle}
                  </p>
                )}
                {selectedExample && (
                  <p className="text-base text-forest/75 dark:text-alabaster/75 italic mt-4 font-sans max-w-md mx-auto">
                    "{selectedExample.sentence_target}"
                  </p>
                )}
              </>
            )}

            {currentCard.card_type === 'production' && (
              <>
                <p className="text-xs uppercase tracking-widest text-forest/60 dark:text-alabaster/60 mb-2 font-semibold">
                  How do you say:
                </p>
                <h1 className="font-sans text-2xl md:text-3xl font-bold text-forest dark:text-alabaster mb-3 leading-snug">
                  {currentCard.note.definition}
                </h1>
                {currentCard.note.part_of_speech && (
                  <span className="text-xs italic text-forest/60 dark:text-alabaster/60 font-sans">
                    ({currentCard.note.part_of_speech})
                  </span>
                )}
                {currentCard.note.collocation_or_particle && (
                  <p className="text-xs text-forest/70 dark:text-alabaster/70 mt-3 font-medium">
                    Hint: paired with <span className="font-semibold">{currentCard.note.collocation_or_particle}</span>
                  </p>
                )}
              </>
            )}

            {currentCard.card_type === 'cloze' && (
              <>
                <p className="text-xs uppercase tracking-widest text-forest/60 dark:text-alabaster/60 mb-3 font-semibold">
                  Fill in the missing word:
                </p>
                <p className="text-xl md:text-2xl leading-relaxed font-sans text-forest dark:text-alabaster max-w-lg mx-auto">
                  {selectedExample
                    ? renderClozeFront(
                        selectedExample.sentence_target,
                        selectedExample.cloze_target_word,
                        selectedExample.cloze_grammar_hint
                      )
                    : currentCard.note.headword}
                </p>
                {selectedExample?.sentence_native && (
                  <p className="text-xs text-forest/60 dark:text-alabaster/60 mt-4 italic font-sans">
                    "{selectedExample.sentence_native}"
                  </p>
                )}
              </>
            )}
          </div>

          {/* BACK OF CARD (REVEALED) */}
          {isFlipped ? (
            <div className="pt-6 mt-6 border-t border-forest/10 dark:border-alabaster/10 text-center animate-fadeIn">
              {currentCard.card_type === 'recognition' && (
                <>
                  <p className="font-sans text-2xl font-bold text-forest dark:text-alabaster mb-2">
                    {currentCard.note.definition}
                  </p>
                  {currentCard.note.part_of_speech && (
                    <span className="text-xs font-medium text-forest/60 dark:text-alabaster/60 block mb-2">
                      {currentCard.note.part_of_speech}
                    </span>
                  )}
                  {currentCard.note.grammar_notes && (
                    <p className="text-xs italic text-forest/75 dark:text-alabaster/75 mt-2 bg-alabaster dark:bg-forest p-2.5 rounded-lg max-w-md mx-auto">
                      {currentCard.note.grammar_notes}
                    </p>
                  )}
                  {selectedExample?.sentence_native && (
                    <p className="text-xs text-forest/60 dark:text-alabaster/60 mt-3">
                      Translation: "{selectedExample.sentence_native}"
                    </p>
                  )}
                </>
              )}

              {currentCard.card_type === 'production' && (
                <>
                  <h2 className="font-display text-4xl font-bold text-forest dark:text-alabaster mb-2">
                    {currentCard.note.headword}
                  </h2>
                  {currentCard.note.collocation_or_particle && (
                    <p className="text-sm font-semibold text-leaf mb-2">
                      {currentCard.note.collocation_or_particle}
                    </p>
                  )}
                  {selectedExample && (
                    <div className="mt-3 text-left bg-alabaster dark:bg-forest p-3 rounded-xl max-w-md mx-auto text-xs space-y-1">
                      <p className="font-medium text-forest dark:text-alabaster">"{selectedExample.sentence_target}"</p>
                      {selectedExample.sentence_native && (
                        <p className="text-forest/60 dark:text-alabaster/60 italic">"{selectedExample.sentence_native}"</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {currentCard.card_type === 'cloze' && (
                <>
                  <div className="text-xl md:text-2xl leading-relaxed font-sans text-forest dark:text-alabaster max-w-lg mx-auto mb-3">
                    {selectedExample
                      ? renderClozeBack(selectedExample.sentence_target, selectedExample.cloze_target_word)
                      : currentCard.note.headword}
                  </div>
                  <div className="text-sm font-medium text-forest/80 dark:text-alabaster/80">
                    Target: <span className="font-display font-bold text-forest dark:text-alabaster">{currentCard.note.headword}</span> — {currentCard.note.definition}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center pt-8 text-xs text-forest/50 dark:text-alabaster/50 flex items-center justify-center gap-1.5 font-sans">
              <Eye className="w-4 h-4" />
              <span>Tap card or press Space to reveal</span>
            </div>
          )}
        </div>

        {/* Ephemeral Sentence Recall Friction Prompt */}
        <div className="mt-4">
          {!enableRecallPrompt ? (
            <button
              onClick={() => setEnableRecallPrompt(true)}
              className="text-xs text-forest/60 dark:text-alabaster/60 hover:text-leaf flex items-center gap-1.5 mx-auto font-sans"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Type original sentence before rating?</span>
            </button>
          ) : (
            <div className="bg-white/80 dark:bg-forest-panel p-3 rounded-xl border border-forest/10 dark:border-alabaster/10 text-xs space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-forest/70 dark:text-alabaster/70">
                <span className="font-semibold flex items-center gap-1.5 text-forest dark:text-alabaster">
                  <PenTool className="w-3.5 h-3.5 text-coral" />
                  Active Recall Sentence (Ephemeral)
                </span>
                <button
                  onClick={() => setEnableRecallPrompt(false)}
                  className="text-xs hover:text-coral"
                >
                  Close
                </button>
              </div>
              <input
                type="text"
                value={ephemeralSentence}
                onChange={(e) => setEphemeralSentence(e.target.value)}
                placeholder="Type a quick 5-word sentence using this word..."
                className="w-full px-3 py-2 rounded-lg bg-alabaster/60 dark:bg-forest border border-forest/20 dark:border-alabaster/20 text-forest dark:text-alabaster focus:outline-none focus:ring-1 focus:ring-leaf font-sans text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Rating Controls */}
      <div className="w-full pt-4 safe-bottom">
        {!isFlipped ? (
          <button
            onClick={() => setIsFlipped(true)}
            className="w-full py-4 rounded-xl bg-forest dark:bg-alabaster text-alabaster dark:text-forest font-display font-bold text-base hover:opacity-95 transition-transform active:scale-[0.99] shadow-md flex items-center justify-center gap-2"
          >
            <span>Show Answer</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="space-y-3">
            {/* 4 Thumb-Friendly FSRS Rating Buttons */}
            <div className="grid grid-cols-4 gap-2 md:gap-3">
              {/* AGAIN (1) - Terracotta Coral #E4774F */}
              <button
                onClick={() => handleRate(1)}
                className="flex flex-col items-center justify-center py-3.5 px-1 rounded-xl bg-coral text-white font-sans hover:bg-coral-hover transition-transform active:scale-95 shadow-sm"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Again</span>
                <span className="text-[11px] opacity-90 tabular-nums">
                  {intervalPredictions?.[1].label || '10m'}
                </span>
                <span className="hidden md:inline text-[9px] opacity-75 mt-0.5 font-mono">1</span>
              </button>

              {/* HARD (2) - Warm Muted Sand #D9C5B8 with #012615 text */}
              <button
                onClick={() => handleRate(2)}
                className="flex flex-col items-center justify-center py-3.5 px-1 rounded-xl bg-sand text-forest font-sans hover:bg-sand-hover transition-transform active:scale-95 shadow-sm font-semibold"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Hard</span>
                <span className="text-[11px] opacity-90 tabular-nums">
                  {intervalPredictions?.[2].label || '1d'}
                </span>
                <span className="hidden md:inline text-[9px] opacity-75 mt-0.5 font-mono">2</span>
              </button>

              {/* GOOD (3) - Leaf Green #65A603 with #012615 text */}
              <button
                onClick={() => handleRate(3)}
                className="flex flex-col items-center justify-center py-3.5 px-1 rounded-xl bg-leaf text-forest font-sans hover:bg-leaf-hover transition-transform active:scale-95 shadow-sm font-bold"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Good</span>
                <span className="text-[11px] opacity-90 tabular-nums font-semibold">
                  {intervalPredictions?.[3].label || '4d'}
                </span>
                <span className="hidden md:inline text-[9px] opacity-75 mt-0.5 font-mono">3</span>
              </button>

              {/* EASY (4) - Crisp #F6EFEB with #012615 text */}
              <button
                onClick={() => handleRate(4)}
                className="flex flex-col items-center justify-center py-3.5 px-1 rounded-xl bg-alabaster text-forest font-sans border border-forest/15 hover:bg-alabaster-dark transition-transform active:scale-95 shadow-sm font-semibold"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Easy</span>
                <span className="text-[11px] opacity-90 tabular-nums">
                  {intervalPredictions?.[4].label || '12d'}
                </span>
                <span className="hidden md:inline text-[9px] opacity-75 mt-0.5 font-mono">4</span>
              </button>
            </div>

            {/* Undo Rating Button */}
            {canUndo && (
              <div className="flex justify-center">
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-1.5 text-xs text-forest/70 dark:text-alabaster/70 hover:text-coral transition-colors py-1 px-3 rounded-lg font-sans"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo last review (Z)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
