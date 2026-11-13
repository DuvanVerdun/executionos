import { useRef, useState } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT, type PlainTranslationKey } from '../i18n/i18n';

interface FilterMenuProps<Value extends string> {
    /** The name of the menu, for screen readers. */
    label: PlainTranslationKey;
    options: readonly { value: Value; label: PlainTranslationKey }[];
    selected: Value;
    onSelect: (value: Value) => void;
}

/** Draw a round filter button that opens a menu of options, with the selected one checked. */
export function FilterMenu<Value extends string>({ label, options, selected, onSelect }: FilterMenuProps<Value>) {
    const t = useT();
    const [isOpen, setIsOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useDocumentEvent('click', /** Close the menu when a click occurs outside it. */ (event) => {
        if (event.target instanceof Node && filterRef.current?.contains(event.target)) return;
        setIsOpen(false);
    }, isOpen);

    return (
        <div ref={filterRef} className="dashboard-filter">
            <button
                type="button"
                className="dashboard-filter-btn"
                aria-label={t(label)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => { setIsOpen(!isOpen); }}
            >
                <span className="material-symbols-outlined" aria-hidden="true">filter_list</span>
            </button>
            {isOpen && (
                <div className="dashboard-filter-menu" role="menu" aria-label={t(label)}>
                    {options.map(/** Draw the button of one option. The selected one is checked. */ (option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={option.value === selected}
                            onClick={() => { setIsOpen(false); onSelect(option.value); }}
                        >
                            {t(option.label)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
