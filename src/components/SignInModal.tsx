import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  KeyRound, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  unlockVault, 
  createEncryptedVault, 
  cacheSession, 
  saveVaultToStorage, 
  loadVaultFromStorage, 
  loadStaticVault,
  type EncryptedVault, 
  type TursoCredentials 
} from '../services/vaultService';
import { getTursoClient, testTursoConnection } from '../services/tursoService';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { setTursoCreds, syncNow } = useApp();
  const [activeTab, setActiveTab] = useState<'unlock' | 'setup'>('unlock');
  const [vault, setVault] = useState<EncryptedVault | null>(null);

  // Unlock credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Setup credentials
  const [setupUrl, setSetupUrl] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');

  useEffect(() => {
    const checkVault = async () => {
      // Check localStorage first
      const stored = loadVaultFromStorage();
      if (stored) {
        setVault(stored);
        if (stored.usernameHint) setUsername(stored.usernameHint);
        return;
      }
      // Check static ./vault.json next
      const staticV = await loadStaticVault();
      if (staticV) {
        setVault(staticV);
        if (staticV.usernameHint) setUsername(staticV.usernameHint);
      } else {
        setActiveTab('setup');
      }
    };
    if (isOpen) {
      checkVault();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vault || !username.trim() || !password.trim()) return;

    setIsLoading(true);
    setUnlockError(null);

    try {
      const creds = await unlockVault(vault, username.trim(), password);
      cacheSession(creds, username.trim());
      setTursoCreds(creds);
      getTursoClient(creds);
      await syncNow();
      onClose();
    } catch (err: any) {
      setUnlockError(err.message || 'Incorrect password or username. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupUrl.trim() || !setupToken.trim() || !setupUsername.trim() || !setupPassword.trim()) return;

    setIsLoading(true);
    setUnlockError(null);

    try {
      const creds: TursoCredentials = {
        tursoUrl: setupUrl.trim(),
        tursoToken: setupToken.trim(),
      };

      const connected = await testTursoConnection(creds);
      if (!connected) {
        setUnlockError('Could not connect to Turso with these credentials. Please check your URL and Token.');
        setIsLoading(false);
        return;
      }

      const encrypted = await createEncryptedVault(creds, setupUsername.trim(), setupPassword);
      saveVaultToStorage(encrypted);
      cacheSession(creds, setupUsername.trim());
      setTursoCreds(creds);
      getTursoClient(creds);
      await syncNow();
      onClose();
    } catch (err: any) {
      setUnlockError(err.message || 'Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-alabaster dark:bg-forest-panel text-forest dark:text-alabaster rounded-2xl shadow-2xl border border-forest/15 dark:border-alabaster/10 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-forest/10 dark:border-alabaster/10 bg-white/50 dark:bg-forest/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-leaf text-forest flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg tracking-tight">
                {activeTab === 'unlock' ? 'Sign In to Cloud Vault' : 'Connect Turso Database'}
              </h2>
              <p className="text-[11px] text-forest/60 dark:text-alabaster/60 font-sans">
                Zero-backend Web Crypto encryption
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-forest/60 dark:text-alabaster/60 hover:bg-forest/10 dark:hover:bg-alabaster/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher if vault exists */}
        {vault && (
          <div className="flex border-b border-forest/10 dark:border-alabaster/10 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('unlock')}
              className={`flex-1 py-3 text-center transition-colors ${
                activeTab === 'unlock'
                  ? 'border-b-2 border-leaf text-forest dark:text-alabaster bg-white/30 dark:bg-forest/30'
                  : 'text-forest/60 dark:text-alabaster/60 hover:text-forest'
              }`}
            >
              Sign In (Unlock)
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`flex-1 py-3 text-center transition-colors ${
                activeTab === 'setup'
                  ? 'border-b-2 border-leaf text-forest dark:text-alabaster bg-white/30 dark:bg-forest/30'
                  : 'text-forest/60 dark:text-alabaster/60 hover:text-forest'
              }`}
            >
              Configure New Database
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'unlock' && vault ? (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. dan"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Master Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your master password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-sm text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf font-sans"
                  required
                />
              </div>

              {unlockError && (
                <div className="p-3 rounded-xl bg-coral/15 text-coral text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="w-full py-3 rounded-xl bg-forest dark:bg-leaf text-alabaster dark:text-forest font-semibold text-sm hover:opacity-90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                <span>{isLoading ? 'Decrypting Vault...' : 'Unlock & Sync Flashcards'}</span>
              </button>

              <p className="text-[11px] text-center text-forest/50 dark:text-alabaster/50 pt-1 font-sans">
                Derives AES-GCM 256-bit key in memory • Unlocks for 30 days
              </p>
            </form>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              <p className="text-xs text-forest/70 dark:text-alabaster/70 leading-relaxed font-sans mb-3">
                To sync flashcards between your Linux desktop and your mobile phone, connect your free Turso database:
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Turso Database URL *
                </label>
                <input
                  type="text"
                  value={setupUrl}
                  onChange={(e) => setSetupUrl(e.target.value)}
                  placeholder="libsql://ricordo-db-username.turso.io"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-xs font-mono text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                  Turso Auth Token *
                </label>
                <input
                  type="password"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-xs font-mono text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={setupUsername}
                    onChange={(e) => setSetupUsername(e.target.value)}
                    placeholder="e.g. dan"
                    className="w-full px-3 py-2 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-forest/70 dark:text-alabaster/70 mb-1">
                    Master Password *
                  </label>
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="Create password"
                    className="w-full px-3 py-2 rounded-xl border border-forest/20 dark:border-alabaster/20 bg-white dark:bg-forest text-xs text-forest dark:text-alabaster focus:outline-none focus:ring-2 focus:ring-leaf"
                    required
                  />
                </div>
              </div>

              {unlockError && (
                <div className="p-3 rounded-xl bg-coral/15 text-coral text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !setupUrl || !setupToken || !setupUsername || !setupPassword}
                className="w-full py-3 rounded-xl bg-leaf text-forest font-semibold text-sm hover:bg-leaf-hover transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isLoading ? 'Connecting...' : 'Encrypt & Connect Database'}</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
