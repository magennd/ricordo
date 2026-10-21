import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Lock, 
  Unlock, 
  Database, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  createEncryptedVault, 
  unlockVault, 
  saveVaultToStorage, 
  loadVaultFromStorage, 
  cacheSession, 
  clearSession, 
  type EncryptedVault, 
  type TursoCredentials 
} from '../services/vaultService';
import { getTursoClient, testTursoConnection } from '../services/tursoService';
import { db } from '../db/indexedDB';

export const SettingsView: React.FC = () => {
  const { 
    tursoCreds, 
    setTursoCreds, 
    syncNow, 
    isSyncing, 
    lastSyncTime
  } = useApp();

  const [existingVault, setExistingVault] = useState<EncryptedVault | null>(null);

  // Setup / Encryption Form
  const [tursoUrl, setTursoUrl] = useState('');
  const [tursoToken, setTursoToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // Unlock Form
  const [unlockUsername, setUnlockUsername] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    const v = loadVaultFromStorage();
    if (v) {
      setExistingVault(v);
      if (v.usernameHint) {
        setUnlockUsername(v.usernameHint);
      }
    }
  }, []);

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tursoUrl.trim() || !tursoToken.trim() || !username.trim() || !password.trim()) return;

    setIsEncrypting(true);
    setSetupSuccess(false);

    try {
      const creds: TursoCredentials = {
        tursoUrl: tursoUrl.trim(),
        tursoToken: tursoToken.trim(),
      };

      // Test connection first
      const connected = await testTursoConnection(creds);
      if (!connected) {
        alert('Could not connect to Turso with these credentials. Please check your Database URL and Auth Token.');
        setIsEncrypting(false);
        return;
      }

      const encrypted = await createEncryptedVault(creds, username.trim(), password);
      saveVaultToStorage(encrypted);
      setExistingVault(encrypted);

      // Cache session and activate in app
      cacheSession(creds, username.trim());
      setTursoCreds(creds);
      getTursoClient(creds);
      setSetupSuccess(true);
      await syncNow();
    } catch (err) {
      console.error('Failed to create vault:', err);
      alert('Error creating secure vault. Please try again.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingVault || !unlockUsername.trim() || !unlockPassword.trim()) return;

    setIsUnlocking(true);
    setUnlockError(null);

    try {
      const creds = await unlockVault(existingVault, unlockUsername.trim(), unlockPassword);
      cacheSession(creds, unlockUsername.trim());
      setTursoCreds(creds);
      getTursoClient(creds);
      await syncNow();
    } catch (err: any) {
      setUnlockError(err.message || 'Incorrect password or username.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleDisconnect = () => {
    clearSession();
    setTursoCreds(null);
  };

  const handleDownloadVaultJson = () => {
    if (!existingVault) return;
    const blob = new Blob([JSON.stringify(existingVault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vault.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLocalData = async () => {
    if (window.confirm('Are you sure you want to delete all local flashcards and decks? This cannot be undone unless backed up.')) {
      await db.delete();
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-8 safe-bottom-nav">
      
      {/* Header */}
      <div className="border-b border-forest/10 dark:border-alabaster/10 pb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-forest dark:text-alabaster">
          Settings & Cloud Vault
        </h1>
        <p className="text-sm text-forest/70 dark:text-alabaster/70 mt-1 font-sans">
          Zero-backend encrypted credentials (PBKDF2 + AES-GCM) with Turso Serverless SQLite sync.
        </p>
      </div>

      {/* Sync Status Banner */}
      <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            tursoCreds ? 'bg-leaf/20 text-leaf' : 'bg-sand/30 text-forest dark:text-alabaster'
          }`}>
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-forest dark:text-alabaster">
                {tursoCreds ? 'Turso Cloud Sync Connected' : 'Running in Local-Only Mode'}
              </h2>
              <span className={`w-2.5 h-2.5 rounded-full ${tursoCreds ? 'bg-leaf' : 'bg-sand'}`} />
            </div>
            <p className="text-xs text-forest/70 dark:text-alabaster/70 font-sans mt-0.5">
              {tursoCreds
                ? `Last sync: ${lastSyncTime || 'Just now'} • All changes sync automatically when online.`
                : 'All decks and reviews are saved directly in your browser (IndexedDB).'}
            </p>
          </div>
        </div>

        {tursoCreds ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={syncNow}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl bg-leaf text-forest font-semibold text-xs hover:bg-leaf-hover transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3.5 py-2 rounded-xl border border-forest/20 dark:border-alabaster/20 text-xs font-medium hover:bg-forest/5 dark:hover:bg-alabaster/5"
            >
              Lock Vault
            </button>
          </div>
        ) : null}
      </div>

      {/* Setup / Unlock Forms */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* If Vault already created and currently locked: Show Unlock Form */}
        {existingVault && !tursoCreds && (
          <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-coral/20 text-coral flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-forest dark:text-alabaster">
                  Unlock Encrypted Vault
                </h3>
                <p className="text-xs text-forest/60 dark:text-alabaster/60 font-sans">
                  Enter your master password to decrypt your Turso credentials in memory.
                </p>
              </div>
            </div>

            <form onSubmit={handleUnlockVault} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={unlockUsername}
                  onChange={(e) => setUnlockUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-sm font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Master Password
                </label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-sm font-sans"
                  required
                />
              </div>

              {unlockError && (
                <p className="text-xs text-coral font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{unlockError}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isUnlocking}
                className="w-full py-2.5 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                <span>{isUnlocking ? 'Unlocking...' : 'Unlock & Sync'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Configure / Encrypt Turso Credentials */}
        <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-leaf/20 text-leaf flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-forest dark:text-alabaster">
                  {existingVault ? 'Reconfigure Turso Vault' : 'Set Up Turso Cloud Vault'}
                </h3>
                <p className="text-xs text-forest/60 dark:text-alabaster/60 font-sans">
                  Zero-backend Web Crypto encryption. Credentials are NEVER committed to GitHub in plain text.
                </p>
              </div>
            </div>

            {existingVault && (
              <button
                onClick={handleDownloadVaultJson}
                className="flex items-center gap-1.5 text-xs text-leaf font-semibold hover:underline"
              >
                <Download className="w-4 h-4" />
                <span>Export vault.json</span>
              </button>
            )}
          </div>

          <form onSubmit={handleCreateVault} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Turso Database URL *
                </label>
                <input
                  type="text"
                  value={tursoUrl}
                  onChange={(e) => setTursoUrl(e.target.value)}
                  placeholder="libsql://your-db-username.turso.io"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-sm font-mono text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Turso Auth Token *
                </label>
                <input
                  type="password"
                  value={tursoToken}
                  onChange={(e) => setTursoToken(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-sm font-mono text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Vault Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. dan"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Master Password *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Strong memorable password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-alabaster/50 dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-forest/60 dark:text-alabaster/60 flex items-center gap-1.5 font-sans">
                <ShieldCheck className="w-4 h-4 text-leaf" />
                <span>Derived using PBKDF2 (120,000 iterations) + AES-GCM 256-bit</span>
              </span>

              <button
                type="submit"
                disabled={isEncrypting || !tursoUrl || !tursoToken || !username || !password}
                className="px-6 py-2.5 rounded-xl bg-leaf text-forest font-semibold text-sm hover:bg-leaf-hover transition-colors shadow-sm disabled:opacity-50"
              >
                {isEncrypting ? 'Encrypting & Testing...' : 'Encrypt & Save Vault'}
              </button>
            </div>
          </form>

          {setupSuccess && (
            <div className="p-4 rounded-xl bg-leaf/15 border border-leaf/30 text-xs text-forest dark:text-alabaster flex items-center gap-2 font-sans">
              <CheckCircle2 className="w-4 h-4 text-leaf shrink-0" />
              <span>Vault successfully encrypted and verified! Your cloud sync is active.</span>
            </div>
          )}
        </div>

        {/* Local Storage & Reset */}
        <div className="bg-white dark:bg-forest-panel rounded-2xl border border-forest/15 dark:border-alabaster/10 p-6 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-lg text-forest dark:text-alabaster">
            Local Data Management
          </h3>
          <p className="text-xs text-forest/70 dark:text-alabaster/70 font-sans">
            IndexedDB storage contains your cached flashcard decks, notes, and local review logs.
          </p>

          <button
            onClick={handleClearLocalData}
            className="px-4 py-2 rounded-xl border border-coral/30 text-coral text-xs font-semibold hover:bg-coral/10 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Local Database (Start Clean)</span>
          </button>
        </div>

      </div>

    </div>
  );
};
