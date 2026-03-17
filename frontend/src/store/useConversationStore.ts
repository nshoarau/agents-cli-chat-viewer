import { create } from 'zustand';

import type { AgentType } from '../types';

interface ConversationState {
  searchQuery: string;
  showArchived: boolean;
  selectedAgent: 'none' | 'all' | AgentType;
  setSearchQuery: (query: string) => void;
  setShowArchived: (show: boolean) => void;
  setSelectedAgent: (agent: 'none' | 'all' | AgentType) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  searchQuery: '',
  showArchived: false,
  selectedAgent: 'none',
  setSearchQuery: (query) => set({ searchQuery: query }),
  setShowArchived: (show) => set({ showArchived: show }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
}));
