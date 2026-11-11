import { useState } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { closestElement } from '../lib/dom';
import { useStore } from '../lib/store';
import { Header } from '../shared/Header';
import { Screen } from '../shared/Screen';
import { RoomCard } from './RoomCard';
import { CreateRoomModal, JoinRoomModal, RenameRoomModal, RoomCreatedModal } from './RoomModals';
import { setRoomMenuState } from './room';
import { isPollingRooms, pollRooms, retryRooms, setRoomMenuOpen } from './rooms';
import { roomStore, roomsStore } from './state';

/** The modal that is open, and what it needs. */
type OpenModal =
    | { kind: 'create' }
    | { kind: 'join' }
    | { kind: 'rename'; room: { id: number; name: string } }
    | { kind: 'created'; link: { full: string; display: string } };

/** Draw the Rooms screen. */
export function RoomsScreen() {
    const t = useT();
    const { shownRooms, surface, openMenuRoomId, busyAction } = useStore(roomsStore);
    const [modal, setModal] = useState<OpenModal | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    useDocumentEvent('click', /** Close the open room menu when clicking outside it. */ (event) => {
        if (openMenuRoomId === null || busyAction !== null) return;
        if (closestElement(event.target, '.room-menu, .room-menu-toggle, .modal-overlay', Element)) return;
        setRoomMenuOpen(null);
    });

    useDocumentEvent('keydown', /** Close the open modal or room menu with Escape. */ (event) => {
        if (event.key !== 'Escape') return;
        if (modal && !isSubmitting) {
            setModal(null);
        } else if (openMenuRoomId !== null && busyAction === null) {
            setRoomMenuOpen(null);
        } else if (roomStore.get().menuOpen && roomStore.get().busyAction === null) {
            setRoomMenuState(false);
        }
    });

    useDocumentEvent('visibilitychange', /** Refresh the rooms as soon as the tab is visible again. */ () => {
        if (!document.hidden && isPollingRooms()) void pollRooms();
    });

    /** Reload the rooms after a failed first load. */
    async function handleRetry(): Promise<void> {
        if (isRetrying) return;
        setIsRetrying(true);
        try {
            await retryRooms();
        } finally {
            setIsRetrying(false);
        }
    }

    return (
        <Screen name="rooms" className="rooms-screen">

            <Header screen="rooms" className="plan-header rooms-header" />

            <section className="rooms-content">

                <div className="rooms-title-row">
                    <h1 className="rooms-title">{t('rooms.title')}</h1>
                    <div className="rooms-actions">
                        <button type="button" id="rooms-create-btn" className="white-filled-button" onClick={() => { setModal({ kind: 'create' }); }}>{t('rooms.create')}</button>
                        <button type="button" id="rooms-join-btn" className="normal-button" onClick={() => { setModal({ kind: 'join' }); }}>{t('rooms.join')}</button>
                    </div>
                </div>

                <div id="rooms-loading" className="rooms-grid" role="status" aria-label={t('rooms.loading')} style={{ display: surface === 'loading' ? 'grid' : 'none' }}>
                    <div className="dashboard-skeleton rooms-skeleton-card" aria-hidden="true"></div>
                    <div className="dashboard-skeleton rooms-skeleton-card" aria-hidden="true"></div>
                    <div className="dashboard-skeleton rooms-skeleton-card" aria-hidden="true"></div>
                    <div className="dashboard-skeleton rooms-skeleton-card" aria-hidden="true"></div>
                    <div className="dashboard-skeleton rooms-skeleton-card" aria-hidden="true"></div>
                </div>

                <div id="rooms-grid" className="rooms-grid" style={{ display: surface === 'rooms' ? 'grid' : 'none' }}>
                    {shownRooms.map(/** Draw a room card. */ (room) => (
                        <RoomCard
                            key={room.id}
                            room={room}
                            onRename={() => { setRoomMenuOpen(null); setModal({ kind: 'rename', room: { id: room.id, name: room.name } }); }}
                        />
                    ))}
                </div>

                <div id="rooms-empty" className="empty-dashboard-cta-container" style={{ display: surface === 'empty' ? 'flex' : 'none' }}>
                    <h2 className="empty-dashboard-cta-title">{t('rooms.emptyTitle')}</h2>
                    <p className="empty-dashboard-cta-paragraph">{t('rooms.emptyText')}</p>
                    <button type="button" id="rooms-empty-create-btn" className="empty-dashboard-start-mission-btn white-filled-button" onClick={() => { setModal({ kind: 'create' }); }}>
                        {t('rooms.createTitle')}
                    </button>
                </div>

                <div id="rooms-error" className="dashboard-error" role="alert" style={{ display: surface === 'error' ? 'flex' : 'none' }}>
                    <p className="dashboard-error-message">{t('dashboard.unreachable')}<br />{t('dashboard.tryAgainSoon')}</p>
                    <button type="button" id="rooms-retry-btn" disabled={isRetrying} onClick={() => { void handleRetry(); }}>
                        {isRetrying ? t('loading.retrying') : t('common.retry')}
                    </button>
                </div>

            </section>

            {modal?.kind === 'create' && (
                <CreateRoomModal
                    isSubmitting={isSubmitting}
                    setIsSubmitting={setIsSubmitting}
                    onClose={() => { setModal(null); }}
                    onCreated={(link) => { setModal({ kind: 'created', link }); }}
                />
            )}
            {modal?.kind === 'join' && (
                <JoinRoomModal isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} onClose={() => { setModal(null); }} />
            )}
            {modal?.kind === 'rename' && (
                <RenameRoomModal room={modal.room} screen="rooms" onClose={() => { setModal(null); }} />
            )}
            {modal?.kind === 'created' && (
                <RoomCreatedModal link={modal.link} isSubmitting={isSubmitting} onClose={() => { setModal(null); }} />
            )}

        </Screen>
    );
}
