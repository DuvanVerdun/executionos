import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../style.css';
import { App } from './App';
import { registerNavigationHooks } from './app/hooks';
import { languageStore } from './i18n/i18n';
import { initializeApp } from './app/startup';
import { syncOfflineWork } from './session/sync';

document.documentElement.lang = languageStore.get().language;
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
