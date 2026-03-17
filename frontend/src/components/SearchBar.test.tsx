import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchBar } from './SearchBar';
import { useConversationStore } from '../store/useConversationStore';

describe('SearchBar', () => {
  beforeEach(() => {
    useConversationStore.setState({
      searchQuery: '',
      showArchived: false,
      selectedAgent: 'none',
    });
  });

  it('renders anchored suggestions and lets the user pick one', () => {
    render(<SearchBar suggestions={['Claude bug fix plan', 'Codex refactor session']} />);

    const input = screen.getByPlaceholderText('Search conversations...');
    fireEvent.focus(input);

    expect(screen.getByRole('listbox', { name: 'Conversation suggestions' })).toBeInTheDocument();
    const claudeSuggestion = screen.getByRole('button', { name: 'Claude bug fix plan' });
    expect(claudeSuggestion).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Codex refactor session' })).toBeInTheDocument();

    fireEvent.mouseDown(claudeSuggestion);

    expect(useConversationStore.getState().searchQuery).toBe('Claude bug fix plan');
  });
});
