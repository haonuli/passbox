import { useState, type FormEvent } from 'react';
import { Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import type { Message, MessageResponse } from '../types';

interface LoginProps {
  mode: 'login' | 'unlock';
  onSuccess: () => void;
}

function sendMessage<T>(message: Message): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

export function Login({ mode, onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const message: Message =
      mode === 'login'
        ? { type: 'LOGIN', email, masterPassword: password }
        : { type: 'UNLOCK', masterPassword: password };

    const response = await sendMessage<null>(message);

    if (response.ok) {
      onSuccess();
    } else {
      setError(response.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mb-3">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">PassBox</h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'login' ? '登录您的账户' : '解锁保险库'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-3">
        {mode === 'login' && (
          <input
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="主密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === 'login' ? '登录' : '解锁'}
        </button>
      </form>
    </div>
  );
}
