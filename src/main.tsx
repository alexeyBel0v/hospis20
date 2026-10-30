import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { Gate } from './components/Gate.tsx';
import { DataProvider } from './hooks/useData.tsx';
import { initTelegram } from './lib/telegram.ts';
import './index.css';

initTelegram();

const root = document.getElementById('root');
if (!root) throw new Error('Нет #root');

createRoot(root).render(
  <StrictMode>
    <Gate>
      <DataProvider>
        <App />
      </DataProvider>
    </Gate>
  </StrictMode>,
);
