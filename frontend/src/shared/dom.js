// Elements shared by every screen.

/** Elements of the Loading screen. */
export const loadingDom = {
    screen: document.querySelector('.loading-screen'),
    spinner: document.getElementById('loading-spinner-container'),
    error: document.getElementById('loading-error-message'),
    retryButton: document.getElementById('loading-retry-btn')
};

/** The floating message element. */
export const floatingMessage = document.getElementById('floating-message');
