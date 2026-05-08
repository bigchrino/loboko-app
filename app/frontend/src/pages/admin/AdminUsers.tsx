import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Search, ShieldCheck, BadgeCheck } from 'lucide-react';

interface UserRow {
  id: string;
  user_id: string;
  username: string;
  display_name?: string | null;
  role: string;
  is_admin?: boolean;
  is_verified?: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          username,
          display_name,
          role,
          is_admin,
          is_verified
        `)
        .order('id', { ascending: false });

      if (!error) {
        setUsers((data as UserRow[]) || []);
      }

      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return users;

    return users.filter((u) => {
      const name =
        `${u.display_name || ''} ${u.username || ''}`.toLowerCase();

      return name.includes(q);
    });
  }, [users, query]);

  return (
    <Layout title="Utilisateurs">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">
          👥 Utilisateurs
        </h1>

        <p className="text-sm text-[var(--loboko-text-muted)] mt-1">
          Gestion des comptes utilisateurs
        </p >
      </div>

      <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
        <Search size={16} className="text-[var(--loboko-text-muted)]" />

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un utilisateur"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold flex items-center gap-2 flex-wrap">
                    {u.display_name || u.username}

                    {u.is_admin && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[rgba(147,51,234,0.18)] text-[#c084fc] font-semibold">
                        💎 Admin
                      </span>
                    )}

                    {u.is_verified && (
                      <BadgeCheck
                        size={14}
                        className="text-[#60a5fa]"
                      />
                    )}
                  </div>

                  <div className="text-sm text-[var(--loboko-text-muted)]">
                    @{u.username}
                  </div>
                </div>

                <div className="text-xs px-2 py-1 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] capitalize">
                  {u.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
