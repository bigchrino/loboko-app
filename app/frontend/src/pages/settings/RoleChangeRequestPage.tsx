import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
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
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!profile) return;

    if (
      requestedRole === 'prestataire' &&
      !metier.trim()
    ) {
      toast.error('Précisez votre métier');
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
    } catch (e) {
      console.error(e);
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Changement de compte">
      <div className="space-y-4">

        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
          <div className="text-sm mb-2">
            Compte actuel :
            <strong> {profile?.role}</strong>
          </div>

          <div className="space-y-3">

            <select
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
              <input
                value={metier}
                onChange={(e) =>
                  setMetier(e.target.value)
                }
                placeholder="Votre métier"
                className="w-full p-3 rounded-xl bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)]"
              />
            )}

            <textarea
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
