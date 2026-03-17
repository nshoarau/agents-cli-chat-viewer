import React from 'react';
import { useConversationStore } from '../store/useConversationStore';

export const SearchBar: React.FC = () => {
  const { searchQuery, setSearchQuery } = useConversationStore();

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search conversations..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
};
