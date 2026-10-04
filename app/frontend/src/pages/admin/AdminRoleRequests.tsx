import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAdminAction } from '@/lib/admin-controls';
import Layout from '@/components/Layout';
import { AdminHeader, AdminPagination } from '@/components/AdminTools';
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
  const [processing, setProcessing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const generation = useRef(0);

  const loadRequests = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setFailed(false);
    try {
  
    const { data, error, count } = await supabase
      .from('role_change_requests')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49);
    if (current !== generation.current) return;
  
    if (error) {
      console.error(error);
      setFailed(true);
      toast.error('Erreur chargement');
      setLoading(false);
      return;
    }
  
    const list = (data as RoleRequest[]) || [];
    const ids = [...new Set(list.map((r) => r.user_id))];
  
    let profileMap: Record<string, { username: string; display_name: string | null }> = {};
  
    if (ids.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .in('user_id', ids);
  
      if (current !== generation.current) return;
      if (profileError) { setFailed(true); setLoading(false); return; }
      profileMap = Object.fromEntries(
        ((profiles || []) as any[]).map((p) => [
          p.user_id,
          {
            username: p.username,
            display_name: p.display_name,
          },
        ]),
      );
    }
  
    if (current !== generation.current) return;
    setTotal(count ?? 0);
    setRequests(
      list.map((r) => ({
        ...r,
        profiles: profileMap[r.user_id],
      })),
    );
  
    setLoading(false);
    } catch {
      if (current === generation.current) { setFailed(true); setLoading(false); }
    }
  }, [page]);

  useEffect(() => {
    void loadRequests();
    return () => { generation.current++; };
  }, [loadRequests]);

  const review = async (id: string, approved: boolean) => {
    if (processing) return;
    const note = approved ? '' : prompt('Motif du refus (obligatoire) :');
    if (note === null) return;
    if (!approved && note.trim().length < 3) { toast.error('Indiquez un motif de refus.'); return; }
    if (approved && !confirm('Approuver ce changement de rôle ?')) return;
    setProcessing(id);
    try {
      await applyAdminAction(approved ? 'role_approve' : 'role_reject', id, note);
      toast.success(approved ? 'Demande approuvée' : 'Demande refusée');
      await loadRequests();
    } catch { toast.error('Décision impossible. Actualisez la liste et réessayez.'); }
    finally { setProcessing(null); }
  };

  return (
    <Layout title="Demandes rôles">
      <AdminHeader title="Demandes de changement de rôle" description="Vérifiez le métier demandé avant de valider le compte." busy={loading || !!processing} refresh={loadRequests} />
      {failed ? <p role="alert">Chargement impossible. Réessayez.</p> : loading ? (
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
                {r.profiles?.display_name ||
                  r.profiles?.username ||
                  `Utilisateur : ${r.user_id}`}
              </div>

              <div className="text-sm mt-1">
                {r.old_role} → {r.new_role}
              </div>

              {r.requested_metier && (
                <div className="text-sm text-[#2563eb] mt-1">
                  Métier : {r.requested_metier}
                </div>
              )}

              {r.reason && <p className="mt-2 text-sm">Motif : {r.reason}</p>}
              <div className="flex gap-2 mt-4">
                <button
                  disabled={!!processing} onClick={() => review(r.id, true)}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white"
                >
                  Accepter
                </button>

                <button
                  disabled={!!processing} onClick={() => review(r.id, false)}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!failed && <AdminPagination page={page} total={total} busy={loading || !!processing} onChange={setPage} />}
    </Layout>
  );
}
