import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, AlertCircle } from 'lucide-react';
import {
  fetchActiveCategories,
  ServiceCategory,
} from '@/lib/service-categories';

/**
 * ServiceCategorySelect
 *
 * Searchable single-select dropdown for prestataire service categories.
 * Enforces picking from the official catalog (no free text).
 *
 * If the user can't find their domain, we show a clear message asking them
 * to contact LOBOKO — we NEVER let them submit a free value.
 */

interface Props {
  value: string | null;
  onChange: (categoryId: string | null, category: ServiceCategory | null) => void;
  required?: boolean;
  placeholder?: string;
  /** Optional legacy free-text metier to display as a hint only. */
  legacyMetier?: string;
}

export default function ServiceCategorySelect({
  value,
  onChange,
  required,
  placeholder = 'Choisissez votre service…',
  legacyMetier,
}: Props) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchActiveCategories();
      if (cancelled) return;
      setCategories(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = useMemo(
    () => categories.find((c) => c.id === value) || null,
    [categories, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q),
    );
  }, [categories, query]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-left text-[var(--loboko-text)] focus:outline-none focus:border-[#2563eb]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'text-[var(--loboko-text-muted)]'}>
          {selected ? selected.name : placeholder}
        </span>
        <Search size={16} className="text-[var(--loboko-text-muted)] flex-shrink-0" />
      </button>

      {!selected && legacyMetier && (
        <p className="mt-1.5 text-[11px] text-[var(--loboko-text-muted)]">
          Ancien service renseigné : <span className="italic">{legacyMetier}</span>.
          Merci de choisir une catégorie officielle.
        </p>
      )}

      {required && !selected && (
        <input
          aria-hidden="true"
          tabIndex={-1}
          required
          value=""
          onChange={() => undefined}
          className="sr-only"
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 mt-1 z-20 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--loboko-border)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--loboko-elevated)]">
              <Search size={14} className="text-[var(--loboko-text-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un service…"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--loboko-text-muted)]">
                Chargement des catégories…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-[var(--loboko-text-secondary)] mb-2">
                  <AlertCircle size={14} />
                  Aucun service trouvé
                </div>
                <p className="text-[11px] text-[var(--loboko-text-muted)] leading-relaxed">
                  Ce domaine n'est pas encore disponible.
                  <br />
                  Contactez LOBOKO pour l'ajouter.
                </p>
              </div>
            ) : (
              <ul role="listbox" className="py-1">
                {filtered.map((c) => {
                  const isSel = c.id === value;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        onClick={() => {
                          onChange(c.id, c);
                          setQuery('');
                          setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left hover:bg-[var(--loboko-elevated)] ${
                          isSel ? 'bg-[rgba(37,99,235,0.12)] text-[#60a5fa]' : ''
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {isSel && <Check size={14} className="text-[#60a5fa]" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}