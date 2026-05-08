import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';

interface Stats {
  users: number;
  prestataires: number;
  admins: number;
  verified: number;
  posts: number;
  requests: number;
}

export default function AdminStats() {
  const [stats, setStats] = useState<Stats>({
    users: 0,
    prestataires: 0,
    admins: 0,
    verified: 0,
    posts: 0,
    requests: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [
        usersRes,
        prestatairesRes,
        adminsRes,
        verifiedRes,
        postsRes,
        requestsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),

        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'prestataire'),

        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_admin', true),

        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_verified', true),

        supabase.from('posts').select('*', {
          count: 'exact',
          head: true,
        }),

        supabase.from('service_requests').select('*', {
          count: 'exact',
          head: true,
        }),
      ]);

      setStats({
        users: usersRes.count || 0,
        prestataires: prestatairesRes.count || 0,
        admins: adminsRes.count || 0,
        verified: verifiedRes.count || 0,
        posts: postsRes.count || 0,
        requests: requestsRes.count || 0,
      });

      setLoading(false);
    })();
  }, []);

  const cards = [
    {
      label: 'Utilisateurs',
      value: stats.users,
    },
    {
      label: 'Prestataires',
      value: stats.prestataires,
    },
    {
      label: 'Admins',
      value: stats.admins,
    },
    {
      label: 'Comptes vérifiés',
      value: stats.verified,
    },
    {
      label: 'Publications',
      value: stats.posts,
    },
    {
      label: 'Demandes',
      value: stats.requests,
    },
  ];

  return (
    <Layout title="Statistiques">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">
          📊 Statistiques
        </h1>

        <p className="text-sm text-[var(--loboko-text-muted)] mt-1">
          Chiffres de la plateforme
        </p >
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <div className="text-sm text-[var(--loboko-text-muted)] mb-1">
                {card.label}
              </div>

              <div className="text-2xl font-bold">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
