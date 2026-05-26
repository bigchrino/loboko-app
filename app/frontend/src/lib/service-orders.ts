import { supabase } from '@/lib/supabase';
import { ServiceOrder } from '@/types/service-orders';

interface CreateOrderInput {
  client_id: string;
  prestataire_id: string;

  title: string;
  description?: string;

  price: number;

  service_id?: string;
}

export async function createServiceOrder(
  input: CreateOrderInput
) {
  const { data, error } = await supabase
    .from('service_orders')
    .insert({
      client_id: input.client_id,
      prestataire_id: input.prestataire_id,

      title: input.title,
      description: input.description || null,

      price: input.price,

      service_id: input.service_id || null,

      status: 'requested',
      payment_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as ServiceOrder;
}
