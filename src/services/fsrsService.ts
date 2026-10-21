import {
  fsrs,
  type Card as FSRSCard,
  type RecordLogItem,
  State as FSRSState
} from 'ts-fsrs';
import type { Card, CardState, Rating, ReviewLog } from '../types/database';

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
});

export function toFSRSCard(card: Card): FSRSCard {
  return {
    due: new Date(card.due_date),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as unknown as FSRSState,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

export function calculateNextIntervals(card: Card, now: Date = new Date()): Record<Rating, { intervalDays: number; label: string; scheduledCard: FSRSCard }> {
  const fsrsCard = toFSRSCard(card);
  const schedulingRecord = scheduler.repeat(fsrsCard, now) as unknown as Record<number, RecordLogItem>;

  const getDays = (rec: RecordLogItem) => {
    const diffMs = rec.card.due.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (60 * 1000));
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 60) {
      return `${Math.max(1, diffMins)}m`;
    }
    if (diffHours < 24) {
      return `${diffHours}h`;
    }
    if (diffDays <= 30) {
      return `${diffDays}d`;
    }
    const months = (diffDays / 30).toFixed(1);
    return `${months}mo`;
  };

  const ratings: Rating[] = [1, 2, 3, 4];
  const result: any = {};

  for (const r of ratings) {
    const rec = schedulingRecord[r];
    const diffMs = rec.card.due.getTime() - now.getTime();
    const days = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));

    result[r] = {
      intervalDays: days,
      label: getDays(rec),
      scheduledCard: rec.card,
    };
  }

  return result;
}

export function processReview(
  card: Card,
  rating: Rating,
  now: Date = new Date()
): {
  updatedCard: Card;
  reviewLog: ReviewLog;
} {
  const fsrsCard = toFSRSCard(card);
  const schedulingRecord = scheduler.repeat(fsrsCard, now) as unknown as Record<number, RecordLogItem>;
  const nextItem = schedulingRecord[rating];
  const nextCard = nextItem.card;

  const newLapses = rating === 1 ? card.lapses + 1 : card.lapses;
  const isLeech = newLapses >= 4 ? 1 : card.is_leech;

  const reviewLog: ReviewLog = {
    id: crypto.randomUUID(),
    card_id: card.id,
    rating,
    state_before: card.state,
    stability_before: card.stability,
    difficulty_before: card.difficulty,
    elapsed_days: nextCard.elapsed_days,
    scheduled_days: nextCard.scheduled_days,
    reviewed_at: now.toISOString(),
  };

  const updatedCard: Card = {
    ...card,
    due_date: nextCard.due.toISOString(),
    stability: Number(nextCard.stability.toFixed(4)),
    difficulty: Number(nextCard.difficulty.toFixed(4)),
    elapsed_days: nextCard.elapsed_days,
    scheduled_days: nextCard.scheduled_days,
    reps: nextCard.reps,
    lapses: newLapses,
    state: nextCard.state as unknown as CardState,
    last_review: now.toISOString(),
    is_leech: isLeech,
    updated_at: now.toISOString(),
  };

  return { updatedCard, reviewLog };
}

export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
