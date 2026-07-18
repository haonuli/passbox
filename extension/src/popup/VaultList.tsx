import { useEffect, useMemo, useState } from 'react';
import { Search, Lock, Loader2, KeyRound, FileText, CreditCard } from 'lucide-react';
import type { VaultItem, Message, MessageResponse } from '../types';

interface VaultListProps {
  onLock: () => void;
}

function sendMessage<T>(message: Message): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

function getItemIcon(itemTypeCode: string) {
  switch (itemTypeCode) {
    case 'login':
      return KeyRound;
    case 'secure_note':
      return FileText;
    case 'credit_card':
      return CreditCard;
    default:
      return Lock;
  }
}

export function VaultList({ onLock }: VaultListProps) {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await sendMessage<VaultItem[]>({ type: 'GET_ITEMS' });
      if (response.ok) {
        setItems(response.data);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (copiedId === null) return;
    const timer = setTimeout(() => setCopiedId(null), 3000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.data.username?.toLowerCase().includes(q)) return true;
      if (item.data.url?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [items, query]);

  async function handleCopy(item: VaultItem) {
    const response = await sendMessage<string | null>({
      type: 'COPY_PASSWORD',
      itemId: item.id,
    });
    if (response.ok && response.data) {
      await navigator.clipboard.writeText(response.data);
      setCopiedId(item.id);
    }
  }

  async function handleLock() {
    await sendMessage<null>({ type: 'LOCK' });
    onLock();
  }

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-gray-200">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索条目..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleLock}
          title="锁定"
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <p className="text-sm">{items.length === 0 ? '暂无条目' : '无匹配结果'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredItems.map((item) => {
              const Icon = getItemIcon(item.itemTypeCode);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleCopy(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      {item.data.username && (
                        <p className="text-xs text-gray-500 truncate">{item.data.username}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {copiedId !== null && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-md shadow-lg">
          已复制
        </div>
      )}
    </div>
  );
}
