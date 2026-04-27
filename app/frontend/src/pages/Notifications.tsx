import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Heart, MessageCircle, UserPlus } from 'lucide-react';

interface Notif {
  id: string;
  user_id: string;
  from_user_id?: string;
  type: string;
  post_id?: string;
  message?: string;
  read?: boolean;
  created_at?: string;
}

const iconFor = (type: string) => {
  if (type === 'like') return Heart;
  if (type === 'comment' || type === 'message') return MessageCircle;
  if (type === 'follow') return UserPlus;
  return Bell;
};

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        setItems((data as Notif[]) || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <Layout title="Notifications">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Notifications</h1>
      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-4">
            <Bell size={24} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">Aucune notification</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Vous serez prévenu ici des nouvelles activités
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <div
                key={n.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition ${
                  n.read
                    ? 'bg-[var(--loboko-surface)] border-[var(--loboko-border)]'
                    : 'bg-[rgba(37,99,235,0.08)] border-[#2563eb]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{n.message || `Nouvelle ${n.type}`}</div>
                  {n.created_at && (
                    <div className="text-xs text-[var(--loboko-text-muted)] mt-0.5">
                      {new Date(n.created_at).toLocaleString('fr-FR')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}