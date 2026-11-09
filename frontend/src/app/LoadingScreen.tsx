import { useStore } from '../lib/store';
import { Screen } from '../shared/Screen';
import { loadingStore, retryInitialization } from './startup';

/** Draw the Loading screen. */
export function LoadingScreen() {
    const { hasError, isRetrying } = useStore(loadingStore);

    return (
        <Screen name="loading" className={hasError ? 'loading-screen has-loading-error' : 'loading-screen'}>
            <h1 className="wordmark">ExecutionOS</h1>
            <div className="loading-retry-container">
                <div id="loading-spinner-container" className="loading-spinner-container" style={{ display: hasError ? 'none' : 'flex' }}>
                    <div className="loading-spinner"></div>
                </div>
                <p id="loading-error-message" style={{ display: hasError ? 'flex' : 'none' }}>
                    Couldn't reach the server. Try again in a moment.
                </p>
                <button
                    id="loading-retry-btn"
                    className="normal-button"
                    style={{ display: hasError || isRetrying ? 'flex' : 'none' }}
                    disabled={isRetrying}
                    onClick={() => { void retryInitialization(); }}
                >
                    {isRetrying ? 'Retrying…' : 'Retry'}
                </button>
            </div>
        </Screen>
    );
}
