import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/apiClient';
import { Dashboard } from './components/Dashboard';
import './index.css';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

export default App;
