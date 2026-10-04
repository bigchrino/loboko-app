// Inactive payment boundary. No aggregator has been selected.
import { paymentUnavailable } from '../_shared/payment-unavailable.ts';
Deno.serve(paymentUnavailable);
