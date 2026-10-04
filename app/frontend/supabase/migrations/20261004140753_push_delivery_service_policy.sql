create policy push_delivery_service_only on loboko_private.push_delivery_claims for all to service_role using (true) with check (true);
