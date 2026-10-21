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

export const CSV_TEMPLATE_COLUMNS = [
  'headword',
  'definition',
  'part_of_speech',
  'collocation_or_particle',
  'grammar_notes',
  'tags',
  'sentence_target',
  'sentence_native',
  'cloze_target_word',
  'cloze_grammar_hint'
];

export const CSV_SAMPLE_ROWS = [
  {
    headword: 'ricordare',
    definition: 'to remember, to recall',
    part_of_speech: 'verb',
    collocation_or_particle: 'ricordarsi di + inf.',
    grammar_notes: 'Takes essere in pronominal form "ricordarsi"',
    tags: 'verbs, b1, memory',
    sentence_target: 'Ti ricordi di chiudere la porta?',
    sentence_native: 'Do you remember to close the door?',
    cloze_target_word: 'ricordi',
    cloze_grammar_hint: 'present tense, 2nd pers. sing.'
  },
  {
    headword: 'rendersi conto',
    definition: 'to realize, to become aware of',
    part_of_speech: 'idiomatic verb phrase',
    collocation_or_particle: 'rendersi conto di',
    grammar_notes: 'Past participle is "reso conto"',
    tags: 'idioms, b2',
    sentence_target: 'Non mi sono reso conto del ritardo.',
    sentence_native: 'I did not realize the delay.',
    cloze_target_word: 'reso conto',
    cloze_grammar_hint: 'past participle with essere'
  }
];

export function downloadBlankCSVTemplate() {
  const content = CSV_TEMPLATE_COLUMNS.join(',') + '\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'ricordo_blank_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSampleCSVTemplate() {
  const headers = CSV_TEMPLATE_COLUMNS.join(',');
  const rows = CSV_SAMPLE_ROWS.map(r => 
    CSV_TEMPLATE_COLUMNS.map(col => `"${((r as any)[col] || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const content = `${headers}\n${rows}\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'ricordo_sample_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

