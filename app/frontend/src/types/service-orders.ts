export type ServiceOrderStatus =
  | 'requested'
  | 'accepted'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface ServiceOrder {
  id: string;

  client_id: string;
  prestataire_id: string;

  service_id?: string | null;

  title: string;
  description?: string | null;

  price: number;

  status: ServiceOrderStatus;
  payment_status: PaymentStatus;

  created_at: string;
  updated_at: string;
}
