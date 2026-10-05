import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import ServiceCategorySelect from '@/components/ServiceCategorySelect';
import { toast } from 'sonner';

export default function RoleChangeRequestPage() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(false);

  const [requestedRole, setRequestedRole] = useState<
    'client' | 'prestataire'
  >(
    profile?.role === 'client'
      ? 'prestataire'
      : 'client'
  );

  const [metier, setMetier] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!profile || loading) return;
    if (requestedRole === profile.role) {
      toast.error('Choisissez un rôle différent de votre compte actuel');
      return;
    }

    if (
      requestedRole === 'prestataire' &&
      !serviceId
    ) {
      toast.error('Choisissez un service officiel dans la liste');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('role_change_requests')
        .insert({
          user_id: profile.user_id,

          old_role: profile.role,
          new_role: requestedRole,

          requested_service_id: requestedRole === 'prestataire' ? serviceId : null,
          requested_metier:
            requestedRole === 'prestataire'
              ? metier
              : null,

          reason,
        });

      if (error) throw error;

      toast.success(
        'Demande envoyée aux administrateurs'
      );

      setReason('');
      setMetier('');
      setServiceId(null);
    } catch (e) {
      console.error(e);
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Changement de compte">
      <h1 className="mb-4 text-2xl font-bold">Changement de compte</h1>
      <div className="space-y-4">

        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
          <div className="text-sm mb-2">
            Compte actuel :
            <strong> {profile?.role}</strong>
          </div>

          <div className="space-y-3">

            <select
              aria-label="Type de compte demandé"
              value={requestedRole}
              onChange={(e) =>
                setRequestedRole(
                  e.target.value as
                    | 'client'
                    | 'prestataire'
                )
              }
              className="w-full p-3 rounded-xl bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)]"
            >
              <option value="client">
                Compte client
              </option>

              <option value="prestataire">
                Compte prestataire
              </option>
            </select>

            {requestedRole ===
              'prestataire' && (
              <div>
                <label className="block text-sm font-medium mb-2">Service officiel *</label>
                <ServiceCategorySelect value={serviceId} required
                  onChange={(id, service) => { setServiceId(id); setMetier(service?.name || ''); }} />
              </div>
            )}

            <textarea
              aria-label="Motif du changement de compte"
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
              placeholder="Pourquoi voulez-vous changer de compte ?"
              rows={4}
              className="w-full p-3 rounded-xl bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)] resize-none"
            />

            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-semibold"
            >
              {loading
                ? 'Envoi...'
                : 'Envoyer la demande'}
            </button>

          </div>
        </div>
      </div>
    </Layout>
  );
}
