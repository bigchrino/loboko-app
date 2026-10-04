import Layout from '@/components/Layout';
import { AdminHeader, AdminError } from '@/components/AdminTools';
import { useAdminOverview } from '@/lib/use-admin-overview';
export default function AdminStats(){
 const {data,loading,failed,refresh}=useAdminOverview();
 const values=data?[
 ['Utilisateurs',data.users],['Prestataires',data.prestataires],['Administrateurs',data.admins],['Comptes vérifiés',data.verified],['Comptes restreints',data.restricted],['Publications',data.posts],['Demandes de services',data.requests],['Signalements en attente',data.pending_reports],['KYC en attente',data.pending_kyc],['Changements de rôle en attente',data.pending_roles],['Paiements enregistrés',data.payments],['Paiements en litige',data.disputed_payments]]:[];
 return <Layout title="Statistiques"><div className="mx-auto max-w-3xl"><AdminHeader title="Statistiques" description="Chiffres actuels de la plateforme" busy={loading} refresh={refresh} />{failed?<AdminError retry={refresh} />:loading?<p role="status">Chargement…</p>:<div className="grid grid-cols-2 gap-3">{values.map(([label,value])=><div key={label} className="rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-4"><p className="text-sm text-[var(--loboko-text-secondary)]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>}</div></Layout>;
}
