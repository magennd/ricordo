import Papa from 'papaparse';
import { db } from '../db/indexedDB';
import { createNoteWithCards } from './deckService';

export interface CSVColumnMapping {
  headwordCol: string;
  definitionCol: string;
  partOfSpeechCol?: string;
  collocationCol?: string;
  grammarNotesCol?: string;
  tagsCol?: string;
  exampleTargetCol?: string;
  exampleNativeCol?: string;
  clozeTargetWordCol?: string;
  clozeGrammarHintCol?: string;
}

export interface CSVParseResult {
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  rawRows: Record<string, string>[];
}

export function parseCSVFile(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rawRows = results.data.filter(row => Object.values(row).some(v => v && v.trim() !== ''));
        resolve({
          headers,
          previewRows: rawRows.slice(0, 5),
          totalRows: rawRows.length,
          rawRows,
        });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export async function importCSVData(
  targetDeckId: string,
  rows: Record<string, string>[],
  mapping: CSVColumnMapping,
  skipDuplicates: boolean = true
): Promise<{ imported: number; skippedDuplicates: number; errors: number }> {
  let imported = 0;
  let skippedDuplicates = 0;
  let errors = 0;

  // Pre-load all headwords in database to check for duplicates efficiently
  const existingNotes = await db.notes.toArray();
  const existingHeadwords = new Set(existingNotes.map(n => n.headword.trim().toLowerCase()));

  for (const row of rows) {
    try {
      const headword = row[mapping.headwordCol]?.trim();
      const definition = row[mapping.definitionCol]?.trim();

      if (!headword || !definition) {
        errors++;
        continue;
      }

      if (skipDuplicates && existingHeadwords.has(headword.toLowerCase())) {
        skippedDuplicates++;
        continue;
      }

      const partOfSpeech = mapping.partOfSpeechCol ? row[mapping.partOfSpeechCol]?.trim() : undefined;
      const collocation = mapping.collocationCol ? row[mapping.collocationCol]?.trim() : undefined;
      const grammarNotes = mapping.grammarNotesCol ? row[mapping.grammarNotesCol]?.trim() : undefined;
      const tags = mapping.tagsCol ? JSON.stringify(row[mapping.tagsCol]?.split(',').map(s => s.trim()).filter(Boolean)) : undefined;

      const sentenceTarget = mapping.exampleTargetCol ? row[mapping.exampleTargetCol]?.trim() : undefined;
      const sentenceNative = mapping.exampleNativeCol ? row[mapping.exampleNativeCol]?.trim() : undefined;
      const clozeTargetWord = mapping.clozeTargetWordCol ? row[mapping.clozeTargetWordCol]?.trim() : headword;
      const clozeGrammarHint = mapping.clozeGrammarHintCol ? row[mapping.clozeGrammarHintCol]?.trim() : undefined;

      const examples = sentenceTarget
        ? [
            {
              sentence_target: sentenceTarget,
              sentence_native: sentenceNative,
              cloze_target_word: clozeTargetWord || headword,
              cloze_grammar_hint: clozeGrammarHint,
            }
          ]
        : undefined;

      await createNoteWithCards({
        deck_id: targetDeckId,
        headword,
        definition,
        part_of_speech: partOfSpeech,
        collocation_or_particle: collocation,
        grammar_notes: grammarNotes,
        tags,
        examples,
      });

      existingHeadwords.add(headword.toLowerCase());
      imported++;
    } catch (e) {
      console.error('Failed importing row:', row, e);
      errors++;
    }
  }

  return { imported, skippedDuplicates, errors };
}
