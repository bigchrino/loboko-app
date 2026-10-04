import { supabase } from './supabase';

export type DeliveryStatus = 'preparing' | 'shipped' | 'delivered';
export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  preparing: 'En préparation', shipped: 'Expédiée', delivered: 'Livrée',
};
export interface ProductShipment {
  id: string;
  order_id: string;
  status: DeliveryStatus;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  expected_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  updated_at: string;
  events: { id: string; status: DeliveryStatus; details: string | null; created_at: string }[];
}

export async function fetchProductShipment(orderId: string): Promise<ProductShipment | null> {
  const { data, error } = await supabase.from('product_shipments')
    .select('*, events:product_shipment_events(id,status,details,created_at)').eq('order_id', orderId).maybeSingle();
  if (error) throw new Error('Le suivi de livraison est momentanément indisponible.');
  if (!data) return null;
  const shipment = data as ProductShipment;
  shipment.events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return shipment;
}

export async function updateProductShipment(orderId: string, patch: {
  status: DeliveryStatus; carrier: string; tracking_number: string; tracking_url: string;
  expected_delivery: string; note: string;
}): Promise<void> {
  if (patch.tracking_url) {
    let url: URL;
    try { url = new URL(patch.tracking_url); } catch { throw new Error('Entrez un lien de suivi complet (https://…).'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Le lien de suivi doit utiliser http ou https.');
  }
  const { error } = await supabase.rpc('update_product_shipment', {
    p_order_id: orderId, p_status: patch.status, p_carrier: patch.carrier,
    p_tracking_number: patch.tracking_number, p_tracking_url: patch.tracking_url,
    p_expected_delivery: patch.expected_delivery || null, p_note: patch.note,
  });
  if (error) throw new Error(error.message || 'Impossible de mettre à jour la livraison.');
}
