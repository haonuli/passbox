/**
 * 智能文件夹（已保存搜索）状态管理
 *
 * 将用户常用的搜索条件保存为「智能文件夹」，
 * 点击侧边栏中的智能文件夹可快速应用对应搜索。
 * 持久化到 localStorage。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdAt: number;
}

interface SavedSearchState {
  searches: SavedSearch[];
  addSearch: (name: string, query: string) => void;
  removeSearch: (id: string) => void;
}

export const useSavedSearchStore = create<SavedSearchState>()(
  persist(
    (set) => ({
      searches: [],
      addSearch: (name, query) =>
        set((state) => ({
          searches: [
            {
              id: crypto.randomUUID(),
              name,
              query,
              createdAt: Date.now(),
            },
            ...state.searches,
          ],
        })),
      removeSearch: (id) =>
        set((state) => ({
          searches: state.searches.filter((s) => s.id !== id),
        })),
    }),
    { name: 'passbox-saved-searches' },
  ),
);
