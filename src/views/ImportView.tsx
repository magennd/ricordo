import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  RefreshCw, 
  Table,
  Download,
  FileSpreadsheet,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { db } from '../db/indexedDB';
import type { Deck } from '../types/database';
import { 
  parseCSVFile, 
  importCSVData, 
  downloadBlankCSVTemplate, 
  downloadSampleCSVTemplate,
  CSV_TEMPLATE_COLUMNS,
  CSV_SAMPLE_ROWS,
  type CSVParseResult, 
  type CSVColumnMapping 
} from '../services/csvService';
import { useApp } from '../context/AppContext';

export const ImportView: React.FC = () => {
  const { setCurrentView, refreshStagingCount } = useApp();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [showTemplateGuide, setShowTemplateGuide] = useState(true);

  // Column mapping state
  const [mapping, setMapping] = useState<CSVColumnMapping>({
    headwordCol: '',
    definitionCol: '',
    partOfSpeechCol: '',
    collocationCol: '',
    grammarNotesCol: '',
    tagsCol: '',
    exampleTargetCol: '',
    exampleNativeCol: '',
    clozeTargetWordCol: '',
    clozeGrammarHintCol: '',
  });

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skippedDuplicates: number;
    errors: number;
  } | null>(null);

  useEffect(() => {
    const loadDecks = async () => {
      const allDecks = await db.decks.toArray();
      setDecks(allDecks);
      if (allDecks.length > 0) {
        setSelectedDeckId(allDecks[0].id);
      }
    };
    loadDecks();
  }, []);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    try {
      const parsed = await parseCSVFile(selectedFile);
      setCsvData(parsed);

      // Heuristic auto-mapping based on header names
      const headers = parsed.headers.map(h => h.trim());
      const findHeader = (patterns: string[]) =>
        headers.find(h => patterns.some(p => h.toLowerCase().includes(p))) || '';

      setMapping({
        headwordCol: findHeader(['headword', 'word', 'term', 'target', 'italian', 'spanish', 'french', 'front']),
        definitionCol: findHeader(['definition', 'def', 'meaning', 'translation', 'english', 'native', 'back']),
        partOfSpeechCol: findHeader(['part_of_speech', 'pos', 'type', 'category']),
        collocationCol: findHeader(['collocation_or_particle', 'collocation', 'particle', 'preposition']),
        grammarNotesCol: findHeader(['grammar_notes', 'grammar', 'note', 'inflection']),
        tagsCol: findHeader(['tags', 'tag', 'level', 'topic']),
        exampleTargetCol: findHeader(['sentence_target', 'example', 'sentence', 'context']),
        exampleNativeCol: findHeader(['sentence_native', 'sentence translation', 'example translation', 'native sentence']),
        clozeTargetWordCol: findHeader(['cloze_target_word', 'cloze word', 'target word', 'blank']),
        clozeGrammarHintCol: findHeader(['cloze_grammar_hint', 'cloze hint', 'micro prompt', 'grammar hint']),
      });
    } catch (err) {
      console.error('Failed to parse CSV file:', err);
      alert('Could not parse this CSV file. Please verify it is a valid CSV.');
    }
  };

  const handleImport = async () => {
    if (!csvData || !mapping.headwordCol || !mapping.definitionCol || !selectedDeckId) {
      alert('Please select a target deck, headword column, and definition column.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await importCSVData(
        selectedDeckId,
        csvData.rawRows,
        mapping,
        skipDuplicates
      );
      setImportResult(result);
      await refreshStagingCount();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-8 safe-bottom">
      
      {/* Header */}
      <div className="border-b border-forest/10 dark:border-alabaster/10 pb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-forest dark:text-alabaster">
          Import Vocabulary CSV
        </h1>
        <p className="text-sm text-forest/70 dark:text-alabaster/70 mt-1 font-sans">
          Import word lists from spreadsheets or other apps with automatic column mapping and duplicate headword protection.
        </p>
      </div>

      {/* Template Download & Guide Banner */}
      <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-leaf/20 text-leaf flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-forest dark:text-alabaster">
                CSV Template & Column Guide
              </h2>
              <p className="text-xs text-forest/60 dark:text-alabaster/60 font-sans">
                Use our pre-formatted template to quickly prepare your vocabulary in Excel, Google Sheets, or LibreOffice.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={downloadBlankCSVTemplate}
              className="px-3.5 py-2 rounded-xl bg-forest dark:bg-alabaster text-alabaster dark:text-forest font-semibold text-xs hover:opacity-90 transition-colors flex items-center gap-1.5 shadow-sm"
              title="Download a clean CSV template with only headers"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Blank Template</span>
            </button>

            <button
              onClick={downloadSampleCSVTemplate}
              className="px-3.5 py-2 rounded-xl border border-forest/20 dark:border-alabaster/20 font-semibold text-xs text-forest dark:text-alabaster hover:bg-forest/5 dark:hover:bg-alabaster/5 transition-colors flex items-center gap-1.5"
              title="Download a template with sample phrases and cloze examples"
            >
              <Download className="w-3.5 h-3.5 text-leaf" />
              <span>Sample CSV</span>
            </button>

            <button
              onClick={() => setShowTemplateGuide(!showTemplateGuide)}
              className="p-2 text-forest/50 dark:text-alabaster/50 hover:text-forest dark:hover:text-alabaster"
              aria-label="Toggle template preview"
            >
              {showTemplateGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Template Table Preview */}
        {showTemplateGuide && (
          <div className="pt-3 border-t border-forest/10 dark:border-alabaster/10 space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-forest/70 dark:text-alabaster/70 font-sans">
              <Info className="w-4 h-4 text-leaf shrink-0" />
              <span>
                <strong>headword</strong> and <strong>definition</strong> are required. All other columns are optional and enrich your recognition and cloze flashcards.
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-forest/15 dark:border-alabaster/10 bg-alabaster/40 dark:bg-forest/50">
              <table className="w-full text-left text-xs">
                <thead className="bg-forest/5 dark:bg-alabaster/5 border-b border-forest/10 dark:border-alabaster/10 text-forest/80 dark:text-alabaster/80 font-mono text-[11px]">
                  <tr>
                    {CSV_TEMPLATE_COLUMNS.map((col) => (
                      <th key={col} className="p-2.5 whitespace-nowrap">
                        {col}
                        {(col === 'headword' || col === 'definition') && (
                          <span className="text-coral ml-0.5">*</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/10 dark:divide-alabaster/10">
                  {CSV_SAMPLE_ROWS.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-display font-semibold text-forest dark:text-alabaster whitespace-nowrap">
                        {row.headword}
                      </td>
                      <td className="p-2.5 font-sans whitespace-nowrap">{row.definition}</td>
                      <td className="p-2.5 text-forest/60 dark:text-alabaster/60 italic whitespace-nowrap">{row.part_of_speech}</td>
                      <td className="p-2.5 text-leaf font-medium whitespace-nowrap">{row.collocation_or_particle}</td>
                      <td className="p-2.5 text-forest/70 dark:text-alabaster/70 italic text-[11px] whitespace-nowrap">{row.grammar_notes}</td>
                      <td className="p-2.5 text-forest/50 dark:text-alabaster/50 whitespace-nowrap">{row.tags}</td>
                      <td className="p-2.5 italic text-forest/80 dark:text-alabaster/80 whitespace-nowrap">{row.sentence_target}</td>
                      <td className="p-2.5 italic text-forest/60 dark:text-alabaster/60 whitespace-nowrap">{row.sentence_native}</td>
                      <td className="p-2.5 font-mono text-xs text-coral whitespace-nowrap">{row.cloze_target_word}</td>
                      <td className="p-2.5 italic text-forest/60 dark:text-alabaster/60 text-[11px] whitespace-nowrap">{row.cloze_grammar_hint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 1: Upload or Select File */}
      <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-6 shadow-sm space-y-5">
        <h2 className="font-display font-bold text-lg text-forest dark:text-alabaster flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-leaf" />
          <span>Upload CSV File</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
              Destination Study Deck *
            </label>
            <select
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-medium"
            >
              {decks.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.is_staging ? '(Triage Staging)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1.5">
              Choose File (.csv) *
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelected}
              className="w-full text-xs text-forest/80 dark:text-alabaster/80 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-forest dark:file:bg-leaf file:text-alabaster dark:file:text-forest hover:file:opacity-90 cursor-pointer"
            />
          </div>
        </div>

        {file && csvData && (
          <div className="flex items-center gap-2 text-xs font-medium text-leaf font-sans">
            <CheckCircle2 className="w-4 h-4" />
            <span>Loaded "{file.name}" with {csvData.totalRows} rows and {csvData.headers.length} columns.</span>
          </div>
        )}
      </div>

      {/* Step 2: Column Mapping */}
      {csvData && (
        <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-forest dark:text-alabaster flex items-center gap-2">
              <Table className="w-5 h-5 text-leaf" />
              <span>Verify Column Mapping</span>
            </h2>
            <label className="flex items-center gap-2 text-xs text-forest/80 dark:text-alabaster/80 font-sans cursor-pointer">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded border-forest/30 text-leaf focus:ring-leaf"
              />
              <span>Skip existing headwords (duplicate protection)</span>
            </label>
          </div>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            
            {/* Required: Headword */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/80 dark:text-alabaster/80 mb-1">
                Headword (Target Word) *
              </label>
              <select
                value={mapping.headwordCol}
                onChange={(e) => setMapping(prev => ({ ...prev, headwordCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-medium"
              >
                <option value="">-- Choose Column --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Required: Definition */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/80 dark:text-alabaster/80 mb-1">
                Definition (Native Meaning) *
              </label>
              <select
                value={mapping.definitionCol}
                onChange={(e) => setMapping(prev => ({ ...prev, definitionCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-medium"
              >
                <option value="">-- Choose Column --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Part of Speech */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                Part of Speech
              </label>
              <select
                value={mapping.partOfSpeechCol}
                onChange={(e) => setMapping(prev => ({ ...prev, partOfSpeechCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
              >
                <option value="">-- None / Skip --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Collocation */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                Collocation / Particle
              </label>
              <select
                value={mapping.collocationCol}
                onChange={(e) => setMapping(prev => ({ ...prev, collocationCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
              >
                <option value="">-- None / Skip --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Grammar Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                Grammar Notes
              </label>
              <select
                value={mapping.grammarNotesCol}
                onChange={(e) => setMapping(prev => ({ ...prev, grammarNotesCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
              >
                <option value="">-- None / Skip --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Example Target Sentence */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                Example Sentence (Target)
              </label>
              <select
                value={mapping.exampleTargetCol}
                onChange={(e) => setMapping(prev => ({ ...prev, exampleTargetCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
              >
                <option value="">-- None / Skip --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Example Native Translation */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                Example Translation (Native)
              </label>
              <select
                value={mapping.exampleNativeCol}
                onChange={(e) => setMapping(prev => ({ ...prev, exampleNativeCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
              >
                <option value="">-- None / Skip --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Cloze Grammar Hint */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                Cloze Grammar Micro-Prompt
              </label>
              <select
                value={mapping.clozeGrammarHintCol}
                onChange={(e) => setMapping(prev => ({ ...prev, clozeGrammarHintCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
              >
                <option value="">-- None / Skip --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                Tags
              </label>
              <select
                value={mapping.tagsCol}
                onChange={(e) => setMapping(prev => ({ ...prev, tagsCol: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
              >
                <option value="">-- None / Skip --</option>
                {csvData.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Live Preview */}
          <div className="pt-4 border-t border-forest/10 dark:border-alabaster/10">
            <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-2">
              Preview (First 3 Rows)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-forest/15 dark:border-alabaster/10 bg-alabaster/40 dark:bg-forest/50">
              <table className="w-full text-left text-xs">
                <thead className="bg-forest/5 dark:bg-alabaster/5 border-b border-forest/10 dark:border-alabaster/10 text-forest/70 dark:text-alabaster/70">
                  <tr>
                    <th className="p-2.5 font-semibold">Headword</th>
                    <th className="p-2.5 font-semibold">Definition</th>
                    <th className="p-2.5 font-semibold">Collocation</th>
                    <th className="p-2.5 font-semibold">Example Sentence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/10 dark:divide-alabaster/10">
                  {csvData.previewRows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-display font-semibold text-forest dark:text-alabaster">
                        {mapping.headwordCol ? row[mapping.headwordCol] : '—'}
                      </td>
                      <td className="p-2.5 font-sans">
                        {mapping.definitionCol ? row[mapping.definitionCol] : '—'}
                      </td>
                      <td className="p-2.5 text-leaf font-medium">
                        {mapping.collocationCol ? row[mapping.collocationCol] || '—' : '—'}
                      </td>
                      <td className="p-2.5 text-forest/70 dark:text-alabaster/70 italic">
                        {mapping.exampleTargetCol ? row[mapping.exampleTargetCol] || '—' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleImport}
              disabled={isImporting || !mapping.headwordCol || !mapping.definitionCol}
              className="px-6 py-2.5 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest font-semibold text-sm hover:opacity-90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing Cards...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Import {csvData.totalRows} Vocabulary Notes</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Result Notification */}
      {importResult && (
        <div className="bg-leaf/15 border border-leaf/40 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-forest dark:text-alabaster font-display font-bold text-lg">
            <CheckCircle2 className="w-6 h-6 text-leaf" />
            <span>Import Completed Successfully!</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-forest/80 dark:text-alabaster/80 font-sans tabular-nums">
            <div><strong>{importResult.imported}</strong> notes created</div>
            <div><strong>{importResult.skippedDuplicates}</strong> duplicates skipped</div>
            {importResult.errors > 0 && (
              <div className="text-coral"><strong>{importResult.errors}</strong> errors</div>
            )}
          </div>
          <button
            onClick={() => setCurrentView('decks')}
            className="mt-2 px-5 py-2 rounded-xl bg-forest text-alabaster text-xs font-semibold hover:opacity-90"
          >
            Go to Decks & Study
          </button>
        </div>
      )}

    </div>
  );
};
