import Layout from '@/components/Layout';
import { Lightbulb, Target, Users } from 'lucide-react';

export default function Suggestion() {
  return (
    <Layout title="Suggestion">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <Lightbulb size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Suggestion</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Retrouvez vos amis, partagez des moments et restez informé. Découvrez des
          suggestions personnalisées.
        </p>

        <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Target size={22} className="text-[#2563eb]" />
            <h2 className="text-lg font-semibold">Pour vous</h2>
          </div>
          <p className="text-sm text-[var(--loboko-text-secondary)]">
            Des contenus sélectionnés spécialement pour vous, basés sur vos préférences.
          </p>
        </div>

        <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Users size={22} className="text-[#2563eb]" />
            <h2 className="text-lg font-semibold">Personnes à suivre</h2>
          </div>
          <p className="text-sm text-[var(--loboko-text-secondary)]">
            Découvrez des personnes intéressantes dans votre réseau étendu.
          </p>
        </div>
      </div>
    </Layout>
  );
}