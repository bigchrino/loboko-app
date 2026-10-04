import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string; label: string; hint?: string };

export default function PasswordField({ label, hint, id, disabled, className, onKeyDown, onKeyUp, onBlur, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input {...props} id={id} type={visible ? 'text' : 'password'} disabled={disabled}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-describedby={[props['aria-describedby'], hintId, capsLock ? `${id}-caps` : undefined].filter(Boolean).join(' ') || undefined}
          onKeyDown={event => { setCapsLock(event.getModifierState('CapsLock')); onKeyDown?.(event); }}
          onKeyUp={event => { setCapsLock(event.getModifierState('CapsLock')); onKeyUp?.(event); }}
          onBlur={event => { setCapsLock(false); onBlur?.(event); }}
          className={`${className ?? ''} pr-14`} />
        <button type="button" disabled={disabled} aria-controls={id} aria-pressed={visible}
          aria-label={`${visible ? 'Masquer' : 'Afficher'} ${label.toLowerCase()}`}
          onMouseDown={event => event.preventDefault()} onClick={() => setVisible(value => !value)}
          className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] disabled:opacity-50">
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {hint && <p id={hintId} className="mt-2 text-xs text-[var(--loboko-text-secondary)]">{hint}</p>}
      {capsLock && <p id={`${id}-caps`} role="status" className="mt-2 text-xs text-amber-500">La touche Majuscule est activée.</p>}
    </div>
  );
}
