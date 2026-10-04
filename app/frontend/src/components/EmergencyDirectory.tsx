import Layout from '@/components/Layout';
import { Link } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, ExternalLink, Hospital, Shield, Flame } from 'lucide-react';
import { EMERGENCY_CONTACTS, type EmergencyCategory } from '@/lib/emergency-contacts';

const categories = {
  hospital: { title: 'Hôpitaux', Icon: Hospital, color: '#ef4444' },
  police: { title: 'Police', Icon: Shield, color: '#2563eb' },
  fire: { title: 'Pompiers', Icon: Flame, color: '#f97316' },
};
export default function EmergencyDirectory({ category }: { category: EmergencyCategory }) {
  const { title, Icon, color } = categories[category];
  const contacts = EMERGENCY_CONTACTS.filter(contact => contact.category === category);
  return (
    <Layout title={title}>
      <Link to="/urgences" className="inline-flex items-center gap-2 text-sm mb-4">
        <ArrowLeft size={16} /> Retour aux urgences
      </Link>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-3"><Icon size={24} style={{ color }} />{title}</h1>
        <p className="text-sm text-[var(--loboko-text-secondary)]">
          Contacts documentés à Kinshasa, en République démocratique du Congo.
          Cet annuaire ne couvre pas encore les autres villes.
        </p>
        {category === 'hospital' && (
          <div className="rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-4 text-sm">
            <p>La source GOV.UK n’indique pas de numéro médical d’urgence général en RDC et conseille de contacter un hôpital pour demander une ambulance.</p>
            <a href="https://www.gov.uk/foreign-travel-advice/democratic-republic-of-the-congo/getting-help"
              target="_blank" rel="noopener noreferrer" className="inline-block text-[#2563eb] mt-2">Consulter cette information</a>
          </div>
        )}
        {contacts.map(contact => (
          <article key={contact.id} className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold">{contact.name}</h2>
            <p className="flex items-center gap-2 text-sm text-[var(--loboko-text-secondary)]">
              <MapPin size={16} aria-hidden="true" />{contact.city} · RDC
            </p>
            {contact.address && <p className="text-sm">{contact.address}</p>}
            <p className="text-sm text-[var(--loboko-text-secondary)]">{contact.note}</p>
            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 bg-[#2563eb] text-white font-semibold text-sm">
              <Phone size={16} aria-hidden="true" />{contact.callLabel} · {contact.phoneLabel}
            </a>
            <div className="text-xs text-[var(--loboko-text-muted)] space-y-1">
              <a href={contact.source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#2563eb]">
                <ExternalLink size={12} aria-hidden="true" />Source : {contact.source.name}
              </a>
              <p>Source consultée le {new Date(contact.sourceCheckedAt + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })}. Disponibilité téléphonique non testée.</p>
            </div>
          </article>
        ))}
        {category === 'hospital' && (
          <a href="https://sante.gouv.cd/hopitaux" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[#2563eb]">
            <ExternalLink size={14} />Annuaire des hôpitaux du ministère de la Santé
          </a>
        )}
      </div>
    </Layout>
  );
}
