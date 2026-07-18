import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ExtensionStatus, Message, MessageResponse } from '../types';
import { Login } from './Login';
import { VaultList } from './VaultList';

type ViewState = 'loading' | 'logged_out' | 'locked' | 'unlocked';

function sendMessage<T>(message: Message): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

export function App() {
  const [view, setView] = useState<ViewState>('loading');

  useEffect(() => {
    void (async () => {
      const response = await sendMessage<ExtensionStatus>({ type: 'GET_STATUS' });
      if (response.ok) {
        setView(response.data);
      } else {
        setView('logged_out');
      }
    })();
  }, []);

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (view === 'logged_out' || view === 'locked') {
    return (
      <Login
        mode={view === 'logged_out' ? 'login' : 'unlock'}
        onSuccess={() => setView('unlocked')}
      />
    );
  }

  return <VaultList onLock={() => setView('locked')} />;
}
