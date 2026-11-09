import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../style.css';
import { App } from './App';
import { registerNavigationHooks } from './app/hooks';
import { initializeApp } from './app/startup';
import { syncOfflineWork } from './session/sync';

registerNavigationHooks();

/** Retry queued submissions when connectivity returns. */
window.addEventListener('online', () => { void syncOfflineWork(); });

const root = document.getElementById('root');
if (!root) throw new Error('The page has no element with the id "root".');
createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>
);

void initializeApp();
