import { useState } from 'react';
import Layout from '@/components/Layout';
import { Search } from 'lucide-react';

export default function Recherches() {
  const [query, setQuery] = useState('');

  return (
    <Layout title="Recherches">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <Search size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Recherches</h1>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-center gap-2 bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-xl px-4 py-3"
        >
          <Search size={18} className="text-[var(--loboko-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recherchez des personnes, contenus..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </form>

        <p className="text-[var(--loboko-text-secondary)]">
          Retrouvez vos amis, partagez des moments et restez informé. Utilisez la barre
          de recherche pour faire vos différentes recherches.
        </p>

        {query && (
          <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-5 text-center text-sm text-[var(--loboko-text-secondary)]">
            Aucun résultat pour « {query} »
          </div>
        )}
      </div>
    </Layout>
  );
}