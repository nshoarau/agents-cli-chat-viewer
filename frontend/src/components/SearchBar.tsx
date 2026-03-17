import React, { useMemo, useState } from 'react';
import { useConversationStore } from '../store/useConversationStore';

interface SearchBarProps {
  suggestions?: string[];
}

export const SearchBar: React.FC<SearchBarProps> = ({ suggestions = [] }) => {
  const { searchQuery, setSearchQuery } = useConversationStore();
  const [isOpen, setIsOpen] = useState(false);

  const visibleSuggestions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? suggestions.filter((suggestion) => suggestion.toLocaleLowerCase().includes(normalizedQuery))
      : suggestions;

    return filtered.slice(0, 8);
  }, [searchQuery, suggestions]);

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search conversations..."
        value={searchQuery}
        autoComplete="off"
        aria-expanded={isOpen && visibleSuggestions.length > 0}
        aria-haspopup="listbox"
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setIsOpen(false);
          }, 120);
        }}
      />
      {isOpen && visibleSuggestions.length > 0 ? (
        <div className="search-suggestions" role="listbox" aria-label="Conversation suggestions">
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="search-suggestion-item"
              onMouseDown={(event) => {
                event.preventDefault();
                setSearchQuery(suggestion);
                setIsOpen(false);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
