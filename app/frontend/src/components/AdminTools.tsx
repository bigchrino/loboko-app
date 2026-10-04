import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
export function AdminHeader({ title, description, busy, refresh }: { title: string; description: string; busy?: boolean; refresh?: () => void }) {
  return <div className="mb-5"><Link to="/admin" className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm text-[#60a5fa]"><ArrowLeft size={16} />Administration</Link>
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold">{title}</h1><p className="mt-1 text-sm text-[var(--loboko-text-secondary)]">{description}</p></div>
    {refresh && <button type="button" onClick={refresh} disabled={busy} aria-label="Actualiser" className="rounded-xl border border-[var(--loboko-border)] p-3 disabled:opacity-50"><RefreshCw size={18} className={busy ? 'animate-spin' : ''} /></button>}</div></div>;
}
export function AdminPagination({ page, total, size = 50, busy, onChange }: { page: number; total: number; size?: number; busy: boolean; onChange: (page: number) => void }) {
  return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{total} résultat{total>1?'s':''} · Page {page+1}/{Math.max(1,Math.ceil(total/size))}</span><div className="flex gap-2"><button type="button" disabled={busy || page===0} onClick={()=>onChange(page-1)} className="rounded-xl border border-[var(--loboko-border)] px-3 py-2 disabled:opacity-40">Précédent</button><button type="button" disabled={busy || (page+1)*size>=total} onClick={()=>onChange(page+1)} className="rounded-xl border border-[var(--loboko-border)] px-3 py-2 disabled:opacity-40">Suivant</button></div></div>;
}
export function AdminError({ retry }: { retry: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm">Chargement impossible. Aucune donnée n’a été modifiée.<button type="button" className="ml-2 text-[#60a5fa]" onClick={retry}>Réessayer</button></div>;
}
/** Native modal provides focus management and escape/backdrop handling. */
export function AdminDialog({ open, title, busy, onClose, children }: { open: boolean; title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog=ref.current; if (!dialog) return; if(open&&!dialog.open) dialog.showModal(); else if(!open&&dialog.open) dialog.close(); }, [open]);
  return <dialog ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} onClick={event=>{if(event.target!==event.currentTarget||busy)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}
    className="max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-5 text-[var(--loboko-text)] backdrop:bg-black/70"><h2 className="mb-3 text-lg font-semibold">{title}</h2>{children}</dialog>;
}
