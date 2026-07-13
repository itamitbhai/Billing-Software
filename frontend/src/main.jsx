import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster 
        theme="dark" 
        position="top-right" 
        richColors 
        closeButton 
        toastOptions={{
          style: {
            background: '#111827',
            border: '1px solid #1f2937',
            color: '#f9fafb',
          }
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
