import { supabase } from '@/lib/supabase';

export type PaymentCurrency = 'USD' | 'CDF';

export type PaymentStatus =
  | 'pending'
  | 'held'
  | 'released'
  | 'refunded'
  | 'failed'
  | 'disputed';

export interface PaymentRow {
  id: string;
  order_id: string;
  client_id: string;
  provider_id: string;
  amount: number;
  commission_amount: number;
  total_amount: number;
  currency: PaymentCurrency;
  exchange_rate?: number | null;
  status: PaymentStatus;
  provider_confirmed: boolean;
  provider_confirmed_at?: string | null;
  paid_at?: string | null;
  released_at?: string | null;
  refunded_at?: string | null;
  gateway?: string | null;
  gateway_transaction_id?: string | null;
  created_at: string;
  updated_at: string;
}

export function calculateLobokoCommission(amount: number): number {
  return Math.round(amount * 0.1 * 100) / 100;
}

export function calculateTotalPayment(amount: number): {
  commission: number;
  total: number;
} {
  const commission = calculateLobokoCommission(amount);

  return {
    commission,
    total: Math.round((amount + commission) * 100) / 100,
  };
}

export async function createPaymentForOrder(params: {
  orderId: string;
  clientId: string;
  providerId: string;
  amount: number;
  currency: PaymentCurrency;
}): Promise<PaymentRow | null> {
  const { commission, total } = calculateTotalPayment(params.amount);

  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_id: params.orderId,
      client_id: params.clientId,
      provider_id: params.providerId,
      amount: params.amount,
      commission_amount: commission,
      total_amount: total,
      currency: params.currency,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[payments] create failed', error);
    throw error;
  }

  return data as PaymentRow;
}
