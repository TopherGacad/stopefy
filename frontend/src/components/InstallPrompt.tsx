import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt__content">
        <Download size={20} />
        <span>Install Stopefy for a better experience</span>
      </div>
      <div className="install-prompt__actions">
        <button className="install-prompt__btn install-prompt__btn--install" onClick={handleInstall}>
          Install
        </button>
        <button className="install-prompt__btn install-prompt__btn--dismiss" onClick={handleDismiss}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
