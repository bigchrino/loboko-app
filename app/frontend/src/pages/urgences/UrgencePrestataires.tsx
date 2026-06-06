import Layout from '@/components/Layout';

export default function UrgencePrestataires() {
  return (
    <Layout title="Prestataire en urgence">
      <div className="space-y-4">

        <h1 className="text-2xl font-bold">
          Prestataire en urgence
        </h1>

        <p className="text-[var(--loboko-text-secondary)]">
          Trouvez rapidement un prestataire disponible dans votre zone.
        </p >

        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
          <div className="text-sm text-[var(--loboko-text-secondary)]">
            Cette page affichera bientôt :
          </div>

          <ul className="mt-3 text-sm space-y-2">
            <li>• Sélection du service</li>
            <li>• Province</li>
            <li>• Ville</li>
            <li>• Commune</li>
            <li>• Prestataires disponibles</li>
          </ul>
        </div>

      </div>
    </Layout>
  );
}
