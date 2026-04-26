import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/* ============================================
   SHARED COMPONENTS
   ============================================ */
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-[var(--border-color)]">
      <span className="text-2xl">{icon}</span>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  )
}

function BackButton({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full text-[var(--text-secondary)] text-[0.9rem] font-medium mb-5 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all">
      ← Retour
    </Link>
  )
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 mb-4 transition-all hover:bg-[var(--bg-surface-hover)] hover:border-[#333] hover:-translate-y-0.5 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
      <div className="text-base font-semibold text-[var(--text-primary)] mb-2">{title}</div>
      <div className="text-[0.9rem] text-[var(--text-secondary)] leading-relaxed">{text}</div>
    </div>
  )
}

function LinkCard({ to, icon, title, desc }: { to: string; icon: string; title: string; desc: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl py-[18px] px-5 mb-3 transition-all text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--accent)] hover:translate-x-1">
      <span className="text-3xl flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="text-base font-semibold text-[var(--text-primary)] mb-0.5">{title}</div>
        <div className="text-sm text-[var(--text-muted)]">{desc}</div>
      </div>
      <span className="text-lg text-[var(--text-muted)] transition-all group-hover:text-[var(--accent)] group-hover:translate-x-1">→</span>
    </Link>
  )
}

/* ============================================
   DECOUVERTE
   ============================================ */
export function Decouverte() {
  return (
    <>
      <SectionTitle icon="🔍" title="Découverte" />
      <div className="mb-5">
        <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full px-4 py-2.5 max-w-[600px] mx-auto transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-light)]">
          <input type="text" placeholder="Rechercher des contenus, personnes, tendances..." className="flex-1 border-none bg-transparent text-[0.95rem] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
          <span>🔍</span>
        </div>
      </div>
      <Card title="🌍 Explorer" text="Découvrez de nouveaux contenus, personnes et tendances autour de vous." />
      <Card title="🔥 Tendances" text="Les sujets les plus populaires du moment dans votre communauté." />
      <Card title="⭐ Recommandations" text="Des suggestions personnalisées basées sur vos centres d'intérêt." />
    </>
  )
}

/* ============================================
   SUGGESTION
   ============================================ */
export function Suggestion() {
  return (
    <>
      <SectionTitle icon="💡" title="Suggestion" />
      <p className="text-[var(--text-secondary)] text-[0.95rem] leading-relaxed mb-5">
        Retrouvez vos amis, partagez des moments et restez informé.<br />
        Découvrez des suggestions personnalisées.
      </p>
      <Card title="🎯 Pour vous" text="Des contenus sélectionnés spécialement pour vous, basés sur vos préférences." />
      <Card title="👥 Personnes à suivre" text="Découvrez des personnes intéressantes dans votre réseau étendu." />
    </>
  )
}

/* ============================================
   NOTIFICATIONS
   ============================================ */
export function Notifications() {
  const notifs = [
    { icon: '❤️', text: '<strong>Marie Kabila</strong> a aimé votre publication.', time: 'Il y a 2 heures' },
    { icon: '💬', text: '<strong>Jean Mukendi</strong> a commenté votre photo.', time: 'Il y a 5 heures' },
    { icon: '👥', text: '<strong>Patrick Lumumba</strong> vous a envoyé une demande d\'ami.', time: 'Hier' },
  ]

  return (
    <>
      <SectionTitle icon="🔔" title="Notifications" />
      <p className="text-[var(--text-secondary)] text-[0.95rem] leading-relaxed mb-5">
        Retrouvez vos amis, partagez des moments et restez informés.<br />
        Recevez vos notifications ici.
      </p>
      {notifs.map((n, i) => (
        <div key={i} className="flex items-start gap-3.5 p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl mb-2.5 transition-all hover:bg-[var(--bg-surface-hover)]">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-lg flex-shrink-0">{n.icon}</div>
          <div className="flex-1">
            <div className="text-[0.9rem] text-[var(--text-primary)] mb-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: n.text }} />
            <div className="text-xs text-[var(--text-muted)]">{n.time}</div>
          </div>
        </div>
      ))}
    </>
  )
}

/* ============================================
   PANIER
   ============================================ */
export function Panier() {
  return (
    <>
      <SectionTitle icon="🛒" title="Panier" />
      <p className="text-[var(--text-secondary)] text-[0.95rem] leading-relaxed mb-5">
        Achetez vos articles et gardez-les ici pour les payer plus tard.
      </p>
      <div className="text-center py-[60px] px-5">
        <div className="text-5xl mb-4 opacity-50">🛒</div>
        <div className="text-[var(--text-muted)] text-[0.95rem]">
          Votre panier est vide.<br />Explorez les offres pour ajouter des articles.
        </div>
      </div>
    </>
  )
}

/* ============================================
   RECHERCHES
   ============================================ */
export function Recherches() {
  return (
    <>
      <SectionTitle icon="🔎" title="Recherches" />
      <div className="mb-5">
        <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full px-4 py-2.5 max-w-[600px] mx-auto transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-light)]">
          <input type="text" placeholder="Recherchez des personnes, contenus..." className="flex-1 border-none bg-transparent text-[0.95rem] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
          <span>🔍</span>
        </div>
      </div>
      <p className="text-[var(--text-secondary)] text-[0.95rem] leading-relaxed mb-5">
        Retrouvez vos amis, partagez des moments et restez informé.<br />
        Utilisez la barre de recherche pour faire vos différentes recherches.
      </p>
    </>
  )
}

/* ============================================
   ENTREPRISE
   ============================================ */
export function Entreprise() {
  return (
    <>
      <SectionTitle icon="🏢" title="Entreprise" />
      <LinkCard to="/entreprise/offre" icon="📋" title="Offres" desc="Consultez les offres disponibles" />
      <LinkCard to="/entreprise/musala" icon="🏪" title="Musala" desc="Découvrez Musala et ses services" />
    </>
  )
}

export function EntrepriseOffre() {
  return (
    <>
      <BackButton to="/entreprise" />
      <SectionTitle icon="📋" title="Offres" />
      <Card title="📦 Offres disponibles" text="Consultez les dernières offres d'emploi et de services proposées par les entreprises partenaires de LOBOKO." />
      <Card title="💼 Postuler" text="Envoyez votre candidature directement depuis l'application et suivez l'état de vos candidatures." />
    </>
  )
}

export function EntrepriseMusala() {
  return (
    <>
      <BackButton to="/entreprise" />
      <SectionTitle icon="🏪" title="Musala" />
      <Card title="🏪 À propos de Musala" text="Musala est un service de LOBOKO dédié aux petites entreprises et artisans locaux. Découvrez leurs produits et services." />
      <Card title="🤝 Devenir partenaire" text="Rejoignez le réseau Musala et proposez vos services à des milliers de clients potentiels." />
    </>
  )
}

/* ============================================
   URGENCES
   ============================================ */
export function Urgences() {
  return (
    <>
      <SectionTitle icon="🚨" title="Urgences" />
      <p className="text-[var(--text-secondary)] text-[0.95rem] leading-relaxed mb-5">
        Contactez les urgences pour un quelconque problème grave.
      </p>
      <LinkCard to="/urgences/hopitaux" icon="🏥" title="Hôpitaux" desc="Trouvez un hôpital proche de vous" />
      <LinkCard to="/urgences/polices" icon="🚔" title="Polices" desc="Contactez les forces de l'ordre" />
      <LinkCard to="/urgences/casernes" icon="🚒" title="Casernes" desc="Appelez les pompiers en cas d'urgence" />
    </>
  )
}

export function UrgencesHopitaux() {
  return (
    <>
      <BackButton to="/urgences" />
      <SectionTitle icon="🏥" title="Hôpitaux" />
      <Card title="🏥 Hôpital Général de Kinshasa" text="Avenue de l'Hôpital, Commune de la Gombe. Urgences 24h/24. Tél: +243 XXX XXX XXX" />
      <Card title="🏥 Clinique Ngaliema" text="Boulevard du 30 Juin, Ngaliema. Services spécialisés. Tél: +243 XXX XXX XXX" />
    </>
  )
}

export function UrgencesPolices() {
  return (
    <>
      <BackButton to="/urgences" />
      <SectionTitle icon="🚔" title="Polices" />
      <Card title="🚔 Commissariat Central" text="Avenue Kabinda, Commune de la Gombe. Disponible 24h/24. Tél: +243 XXX XXX XXX" />
      <Card title="🚔 Police d'intervention rapide" text="Numéro d'urgence : 112. Intervention rapide sur tout Kinshasa." />
    </>
  )
}

export function UrgencesCasernes() {
  return (
    <>
      <BackButton to="/urgences" />
      <SectionTitle icon="🚒" title="Casernes" />
      <Card title="🚒 Caserne Centrale" text="Avenue des Pompiers, Commune de Lingwala. Urgences incendie 24h/24. Tél: +243 XXX XXX XXX" />
      <Card title="🚒 Protection Civile" text="Service de protection civile. Numéro d'urgence pour les catastrophes naturelles." />
    </>
  )
}

/* ============================================
   PROFIL
   ============================================ */

const mockPosts = [
  { id: 1, emoji: '🌅', likes: 124, comments: 18, caption: 'Coucher de soleil sur le fleuve Congo' },
  { id: 2, emoji: '🍽️', likes: 89, comments: 7, caption: 'Cuisine congolaise traditionnelle' },
  { id: 3, emoji: '🎵', likes: 256, comments: 34, caption: 'Concert live à Kinshasa' },
  { id: 4, emoji: '📚', likes: 45, comments: 12, caption: 'Nouvelle collection de livres' },
  { id: 5, emoji: '⚽', likes: 312, comments: 56, caption: 'Match au stade des Martyrs' },
  { id: 6, emoji: '🎨', likes: 78, comments: 9, caption: 'Art contemporain congolais' },
  { id: 7, emoji: '🏙️', likes: 167, comments: 23, caption: 'Vue panoramique de Kinshasa' },
  { id: 8, emoji: '🎉', likes: 198, comments: 41, caption: 'Fête entre amis' },
  { id: 9, emoji: '🌿', likes: 56, comments: 5, caption: 'Nature et biodiversité' },
]

const mockHighlights = [
  { id: 1, emoji: '✈️', label: 'Voyages' },
  { id: 2, emoji: '🍔', label: 'Food' },
  { id: 3, emoji: '🎵', label: 'Musique' },
  { id: 4, emoji: '⚽', label: 'Sport' },
  { id: 5, emoji: '📸', label: 'Photos' },
]

export function Profil() {
  const [activeTab, setActiveTab] = useState<'grid' | 'list' | 'saved'>('grid')
  const [showEditModal, setShowEditModal] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [selectedPost, setSelectedPost] = useState<typeof mockPosts[0] | null>(null)
  const navigate = useNavigate()

  const stats = { posts: 42, followers: 1283, following: 567 }

  return (
    <>
      <BackButton to="/accueil" />

      {/* ===== COVER PHOTO ===== */}
      <div className="relative -mx-5 -mt-2 mb-0 h-[180px] bg-gradient-to-br from-[var(--accent)] via-purple-600 to-indigo-700 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-60" />
        <div className="absolute bottom-3 right-4">
          <button className="px-3 py-1.5 bg-black/30 backdrop-blur-md text-white text-xs rounded-full border border-white/20 hover:bg-black/50 transition-all">
            📷 Modifier la couverture
          </button>
        </div>
      </div>

      {/* ===== PROFILE INFO ===== */}
      <div className="relative -mt-[50px] mb-5 px-1">
        {/* Avatar */}
        <div className="relative w-[100px] h-[100px] mx-auto mb-4">
          <div className="w-full h-full rounded-full bg-[var(--bg-surface)] border-4 border-[var(--bg-primary)] shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center text-[2.5rem] overflow-hidden">
            👤
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center text-white text-sm shadow-lg hover:scale-110 transition-transform">
            📷
          </button>
          {/* Online indicator */}
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-[var(--bg-primary)]" />
        </div>

        {/* Name & Bio */}
        <div className="text-center mb-4">
          <h1 className="text-[1.4rem] font-bold text-[var(--text-primary)] mb-0.5">Utilisateur LOBOKO</h1>
          <p className="text-sm text-[var(--text-muted)] mb-2">@utilisateur_loboko</p>
          <p className="text-[0.9rem] text-[var(--text-secondary)] leading-relaxed max-w-[400px] mx-auto">
            🇨🇩 Kinshasa, RD Congo • Passionné de technologie et de culture congolaise. Créateur de contenu sur LOBOKO. ✨
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
            <span>📍 Kinshasa</span>
            <span>•</span>
            <span>🔗 loboko.com/utilisateur</span>
            <span>•</span>
            <span>📅 Rejoint en Mars 2025</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mb-5">
          {[
            { value: stats.posts, label: 'Publications' },
            { value: stats.followers.toLocaleString(), label: 'Abonnés' },
            { value: stats.following, label: 'Abonnements' },
          ].map((s) => (
            <button key={s.label} className="text-center group cursor-pointer">
              <div className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{s.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center mb-6">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_var(--accent-light)] transition-all active:scale-[0.96]"
          >
            ✏️ Modifier le profil
          </button>
          <button
            onClick={() => navigate('/parametres')}
            className="px-5 py-2.5 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-sm font-semibold hover:bg-[var(--bg-surface-hover)] hover:border-[var(--accent)] transition-all active:scale-[0.96]"
          >
            ⚙️
          </button>
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.96] ${
              isFollowing
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-red-400 hover:text-red-400'
                : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
            }`}
          >
            {isFollowing ? '✓ Abonné' : '+ Suivre'}
          </button>
        </div>
      </div>

      {/* ===== HIGHLIGHTS ===== */}
      <div className="mb-6">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 px-1">
          {mockHighlights.map((h) => (
            <div key={h.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-2xl group-hover:bg-[var(--bg-surface-hover)] transition-colors">
                  {h.emoji}
                </div>
              </div>
              <span className="text-[0.7rem] text-[var(--text-muted)] font-medium">{h.label}</span>
            </div>
          ))}
          {/* Add new highlight */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-[var(--border-color)] flex items-center justify-center text-2xl text-[var(--text-muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
              +
            </div>
            <span className="text-[0.7rem] text-[var(--text-muted)] font-medium">Nouveau</span>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex border-b border-[var(--border-color)] mb-5">
        {([
          { key: 'grid' as const, icon: '▦', label: 'Grille' },
          { key: 'list' as const, icon: '☰', label: 'Liste' },
          { key: 'saved' as const, icon: '🔖', label: 'Sauvegardés' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-center text-sm font-medium transition-all relative ${
              activeTab === tab.key
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-[var(--accent)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ===== GRID VIEW ===== */}
      {activeTab === 'grid' && (
        <div className="grid grid-cols-3 gap-1.5 mb-6">
          {mockPosts.map((post) => (
            <button
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="relative aspect-square bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl flex items-center justify-center text-3xl overflow-hidden group cursor-pointer hover:opacity-90 transition-all"
            >
              <span className="group-hover:scale-110 transition-transform">{post.emoji}</span>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <span className="text-white text-sm font-semibold flex items-center gap-1">❤️ {post.likes}</span>
                <span className="text-white text-sm font-semibold flex items-center gap-1">💬 {post.comments}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ===== LIST VIEW ===== */}
      {activeTab === 'list' && (
        <div className="space-y-3 mb-6">
          {mockPosts.map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
              onClick={() => setSelectedPost(post)}
            >
              <div className="w-14 h-14 rounded-xl bg-[var(--bg-surface-hover)] flex items-center justify-center text-2xl flex-shrink-0">
                {post.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[0.9rem] font-medium text-[var(--text-primary)] truncate">{post.caption}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                  <span>❤️ {post.likes}</span>
                  <span>💬 {post.comments}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== SAVED VIEW ===== */}
      {activeTab === 'saved' && (
        <div className="text-center py-[60px] px-5">
          <div className="text-5xl mb-4 opacity-50">🔖</div>
          <div className="text-[var(--text-muted)] text-[0.95rem]">
            Aucune publication sauvegardée.<br />Les publications que vous sauvegardez apparaîtront ici.
          </div>
        </div>
      )}

      {/* ===== POST DETAIL MODAL ===== */}
      {selectedPost && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-end sm:items-center justify-center z-[1000] p-0 sm:p-5 animate-[fadeIn_0.2s_ease]"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedPost(null) }}
        >
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-[440px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden">
            {/* Post image area */}
            <div className="w-full aspect-square bg-gradient-to-br from-[var(--accent-light)] to-[var(--bg-surface-hover)] flex items-center justify-center text-[5rem]">
              {selectedPost.emoji}
            </div>
            {/* Post info */}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-lg">👤</div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Utilisateur LOBOKO</div>
                  <div className="text-xs text-[var(--text-muted)]">Il y a 2 heures</div>
                </div>
              </div>
              <p className="text-[0.9rem] text-[var(--text-primary)] leading-relaxed mb-4">{selectedPost.caption}</p>
              <div className="flex items-center gap-6 pt-3 border-t border-[var(--border-color)]">
                <button className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-red-400 transition-colors">❤️ {selectedPost.likes}</button>
                <button className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">💬 {selectedPost.comments}</button>
                <button className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">🔗 Partager</button>
                <button className="ml-auto text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">🔖</button>
              </div>
            </div>
            <button
              onClick={() => setSelectedPost(null)}
              className="w-full py-3.5 text-center text-sm font-semibold text-[var(--text-muted)] border-t border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ===== EDIT PROFILE MODAL ===== */}
      {showEditModal && (
        <ProfilEditModal onClose={() => setShowEditModal(false)} />
      )}
    </>
  )
}

function ProfilEditModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('Utilisateur LOBOKO')
  const [username, setUsername] = useState('utilisateur_loboko')
  const [bio, setBio] = useState('🇨🇩 Kinshasa, RD Congo • Passionné de technologie et de culture congolaise. Créateur de contenu sur LOBOKO. ✨')
  const [website, setWebsite] = useState('loboko.com/utilisateur')

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-end sm:items-center justify-center z-[1000] p-0 sm:p-5 animate-[fadeIn_0.2s_ease]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-[440px] max-h-[85vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Modifier le profil</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">✕</button>
        </div>

        {/* Avatar edit */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-surface-hover)] border-[3px] border-[var(--accent)] flex items-center justify-center text-3xl">👤</div>
            <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-surface)] flex items-center justify-center text-white text-xs">📷</button>
          </div>
          <button className="text-sm text-[var(--accent)] font-medium mt-2 hover:underline">Changer la photo</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Nom</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Nom d&apos;utilisateur</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">@</span>
              <input value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={150} className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all resize-none" />
            <div className="text-right text-xs text-[var(--text-muted)] mt-1">{bio.length}/150</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Site web</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3.5 bg-[var(--accent)] text-white rounded-xl text-[0.95rem] font-semibold hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_var(--accent-light)] transition-all"
        >
          Enregistrer les modifications
        </button>
      </div>
    </div>
  )
}

/* ============================================
   MENU
   ============================================ */
export function Menu() {
  const [showLogout, setShowLogout] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <SectionTitle icon="☰" title="Menu" />
      <LinkCard to="/profil" icon="👤" title="Mon Profil" desc="Voir et modifier votre profil" />
      <LinkCard to="/recherches" icon="🔎" title="Recherches" desc="Rechercher des personnes et contenus" />
      <LinkCard to="/entreprise" icon="🏢" title="Entreprise" desc="Offres et services entreprise" />
      <LinkCard to="/urgences" icon="🚨" title="Urgences" desc="Services d'urgence" />
      <LinkCard to="/parametres" icon="⚙️" title="Paramètres" desc="Gérer vos préférences" />

      {/* Logout button */}
      <button
        onClick={() => setShowLogout(true)}
        className="flex items-center gap-4 w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl py-[18px] px-5 mb-3 transition-all text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-surface-hover)] hover:border-[var(--accent)] hover:translate-x-1 text-left"
      >
        <span className="text-3xl flex-shrink-0">🚪</span>
        <div className="flex-1">
          <div className="text-base font-semibold text-[var(--text-primary)] mb-0.5">Déconnexion</div>
          <div className="text-sm text-[var(--text-muted)]">Se déconnecter de LOBOKO</div>
        </div>
        <span className="text-lg text-[var(--text-muted)]">→</span>
      </button>

      {/* Logout Modal */}
      {showLogout && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-center justify-center z-[1000] p-5 animate-[fadeIn_0.3s_ease]"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogout(false) }}
        >
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 max-w-[380px] w-full text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
            <div className="text-4xl mb-4">🚪</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Déconnexion</h2>
            <p className="text-[0.9rem] text-[var(--text-secondary)] leading-relaxed mb-6">
              Êtes-vous sûr de vouloir vous déconnecter de LOBOKO ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 py-3 px-5 bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-[0.9rem] font-semibold cursor-pointer hover:bg-[var(--border-color)] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-3 px-5 bg-red-500 text-white border-none rounded-xl text-[0.9rem] font-semibold cursor-pointer hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}