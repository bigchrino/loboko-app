import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { toast } from 'sonner';
import { DeliveryStatus, deliveryStatusLabels, fetchProductShipment, ProductShipment, updateProductShipment } from '@/lib/product-delivery';

export default function ProductShipmentPanel({ orderId, editable = false, onUpdated }: {
  orderId: string; editable?: boolean; onUpdated?: () => void;
}) {
  const [shipment, setShipment] = useState<ProductShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: 'preparing' as DeliveryStatus, carrier: '', tracking_number: '', tracking_url: '', expected_delivery: '', note: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchProductShipment(orderId).then((data) => {
      if (cancelled) return;
      setShipment(data);
      if (data) setForm({ status: data.status, carrier: data.carrier || '', tracking_number: data.tracking_number || '', tracking_url: data.tracking_url || '', expected_delivery: data.expected_delivery || '', note: '' });
      setError('');
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Suivi indisponible.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProductShipment(orderId, form);
      setShipment(await fetchProductShipment(orderId));
      setEditing(false);
      toast.success('Suivi de livraison mis à jour');
      onUpdated?.();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Mise à jour impossible.'); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="mt-3 text-xs text-[var(--loboko-text-muted)]" role="status">Chargement du suivi…</p>;
  if (error) return <p className="mt-3 text-xs text-red-500">{error}</p>;
  if (!shipment) return <p className="mt-3 text-xs text-[var(--loboko-text-muted)]">Le suivi apparaît après confirmation du paiement.</p>;
  const safeTrackingUrl = shipment.tracking_url && /^https?:\/\//i.test(shipment.tracking_url) ? shipment.tracking_url : null;
  const fieldClass = 'w-full rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-bg)] px-3 py-2 text-sm';

  return <section className="mt-3 border-t border-[var(--loboko-border)] pt-3">
    <div className="flex items-center gap-2 text-sm font-semibold"><Truck size={16} className="text-[#2563eb]" />{deliveryStatusLabels[shipment.status]}</div>
    {shipment.carrier && <p className="mt-1 text-xs">Transporteur : {shipment.carrier}</p>}
    {shipment.tracking_number && <p className="mt-1 break-all text-xs">N° de suivi : {shipment.tracking_number}</p>}
    {shipment.expected_delivery && <p className="mt-1 text-xs text-[var(--loboko-text-muted)]">Livraison prévue : {new Date(`${shipment.expected_delivery}T12:00:00`).toLocaleDateString('fr-FR')}</p>}
    {safeTrackingUrl && <a href={safeTrackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#2563eb]">Suivre chez le transporteur ↗</a>}
    <ol className="mt-2 space-y-1.5 text-xs text-[var(--loboko-text-muted)]">
      {shipment.events.map((event) => <li key={event.id}><span className="font-medium text-[var(--loboko-text-secondary)]">{deliveryStatusLabels[event.status]}</span> · {new Date(event.created_at).toLocaleString('fr-FR')} {event.details && <span className="block">{event.details}</span>}</li>)}
    </ol>
    <p className="mt-2 text-[11px] text-[var(--loboko-text-muted)]">Suivi mis à jour par le vendeur.</p>
    {editable && <button type="button" onClick={() => setEditing(!editing)} className="mt-3 rounded-xl bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white">{editing ? 'Fermer' : 'Mettre à jour la livraison'}</button>}
    {editable && editing && <form onSubmit={save} className="mt-3 space-y-2">
      <label className="block text-xs">Étape de livraison<select className={`${fieldClass} mt-1`} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DeliveryStatus })}>
        {Object.entries(deliveryStatusLabels).map(([value, label]) => <option key={value} value={value} disabled={(shipment.status === 'shipped' && value === 'preparing') || (shipment.status === 'delivered' && value !== 'delivered') || (shipment.status === 'preparing' && value === 'delivered')}>{label}</option>)}
      </select></label>
      <label className="block text-xs">Transporteur / livreur<input className={`${fieldClass} mt-1`} maxLength={120} value={form.carrier} onChange={(event) => setForm({ ...form, carrier: event.target.value })} /></label>
      <label className="block text-xs">Numéro de suivi<input className={`${fieldClass} mt-1`} maxLength={160} value={form.tracking_number} onChange={(event) => setForm({ ...form, tracking_number: event.target.value })} /></label>
      <label className="block text-xs">Lien de suivi<input type="url" className={`${fieldClass} mt-1`} maxLength={1000} placeholder="https://…" value={form.tracking_url} onChange={(event) => setForm({ ...form, tracking_url: event.target.value })} /></label>
      <label className="block text-xs">Livraison prévue<input type="date" className={`${fieldClass} mt-1`} value={form.expected_delivery} onChange={(event) => setForm({ ...form, expected_delivery: event.target.value })} /></label>
      <label className="block text-xs">Information pour le client<textarea className={`${fieldClass} mt-1`} maxLength={500} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
      <button disabled={saving} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>}
  </section>;
}
