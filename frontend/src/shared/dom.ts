// Elements shared by every screen.

import { getById, getElement } from '../lib/dom';

/** Elements of the Loading screen. */
export const loadingDom = {
    screen: getElement('.loading-screen', HTMLDivElement),
    spinner: getById('loading-spinner-container', HTMLDivElement),
    error: getById('loading-error-message', HTMLParagraphElement),
    retryButton: getById('loading-retry-btn', HTMLButtonElement)
};

/** The floating message element. */
export const floatingMessage = getById('floating-message', HTMLParagraphElement);
