import { useState, type ReactNode, type RefObject } from 'react';
import { useT } from '../i18n/i18n';

interface AuthFieldProps {
    id: string;
    label: string;
    type: 'text' | 'email' | 'password';
    autoComplete: string;
    /** The class of the container, which the stylesheet uses. */
    containerClass: string;
    value: string;
    onChange: (value: string) => void;
    error: string;
    errorId: string;
    /** The ids of every element that describes the input. */
    describedBy: string;
    inputRef?: RefObject<HTMLInputElement | null>;
    /** A hint shown under the field while there is no error. */
    guidance?: ReactNode;
}

/** Draw a form field with its label and error message. */
export function AuthField({
    id, label, type, autoComplete, containerClass, value, onChange, error, errorId, describedBy, inputRef, guidance
}: AuthFieldProps) {
    const t = useT();
    const [isVisible, setIsVisible] = useState(false);
    const isPassword = type === 'password';

    return (
        <div className="auth-field">
            <div className={`input-container ${containerClass}`}>
                <input
                    ref={inputRef}
                    type={isPassword && isVisible ? 'text' : type}
                    className="input"
                    id={id}
                    autoComplete={autoComplete}
                    placeholder=" "
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : undefined}
                    value={value}
                    onChange={(event) => { onChange(event.target.value); }}
                />
                <label className="input-placeholder" htmlFor={id}>{label}</label>
                {isPassword && (
                    <button
                        type="button"
                        className="password-visibility-btn"
                        aria-label={isVisible ? t('auth.hidePassword') : t('auth.showPassword')}
                        onClick={() => { setIsVisible(!isVisible); }}
                    >
                        <svg
                            className="password-show-icon"
                            style={{ display: isVisible ? 'none' : 'block' }}
                            viewBox="0 0 24 24" width="24" height="24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                        >
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>

                        <svg
                            className="password-hide-icon"
                            style={{ display: isVisible ? 'block' : 'none' }}
                            viewBox="0 0 24 24" width="24" height="24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                        >
                            <path d="M3 3l18 18" />
                            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                            <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2 3" />
                            <path d="M6.6 6.6C3.6 8.5 2 12 2 12s3.5 8 10 8a9.8 9.8 0 0 0 4.4-1" />
                        </svg>
                    </button>
                )}
            </div>
            <div className="auth-field-message">
                {guidance}
                <p className="form-error-message" id={errorId} aria-live="polite">{error}</p>
            </div>
        </div>
    );
}
