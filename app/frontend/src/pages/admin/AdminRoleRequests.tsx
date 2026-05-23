import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface RoleRequest {
  id: string;
  user_id: string;
  old_role: 'client' | 'prestataire';
  new_role: 'client' | 'prestataire';
  requested_metier: string | null;
  requested_service_id: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: {
    username: string;
    display_name: string | null;
  };
}

export default function AdminRoleRequests() {
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('role_change_requests')
      .select(`
        *,
        profiles:user_id (
          username,
          display_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      toast.error('Erreur chargement');
    } else {
      setRequests((data as RoleRequest[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const approveRequest = async (req: RoleRequest) => {
    try {
      const updates: any = {
        role: req.new_role,
      };
      
      if (req.new_role === 'prestataire') {
        updates.metier = req.requested_metier || null;
      } else {
        updates.metier = null;
        updates.service_id = null;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', req.user_id);

      if (profileError) throw profileError;

      const { error: requestError } = await supabase
        .from('role_change_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id);

      if (requestError) throw requestError;

      toast.success('Demande approuvée');
      loadRequests();
    } catch (e) {
      console.error(e);
      toast.error('Erreur');
    }
  };

  const rejectRequest = async (id: string) => {
    const { error } = await supabase
      .from('role_change_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Erreur');
      return;
    }

    toast.success('Demande refusée');
    loadRequests();
  };

  return (
    <Layout title="Demandes rôles">
      <h1 className="text-2xl font-bold mb-4">
        Demandes changement compte
      </h1>

      {loading ? (
        <div>Chargement...</div>
      ) : requests.length === 0 ? (
        <div>Aucune demande</div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4"
            >
              <div className="font-semibold">
                {r.profiles?.display_name || r.profiles?.username}
              </div>

              <div className="text-sm mt-1">
                {r.old_role} → {r.new_role}
              </div>

              {r.requested_metier && (
                <div className="text-sm text-[#2563eb] mt-1">
                  Métier : {r.requested_metier}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => approveRequest(r)}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white"
                >
                  Accepter
                </button>

                <button
                  onClick={() => rejectRequest(r.id)}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
