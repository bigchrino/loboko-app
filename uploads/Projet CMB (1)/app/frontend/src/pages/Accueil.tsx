import { useState } from 'react'
import { Link } from 'react-router-dom'

/* ============================================
   STORIES
   ============================================ */
const stories = [
  { name: 'Ma story', icon: '+', gradient: '', isAdd: true },
  { name: 'Jean P.', icon: '🔧', gradient: 'linear-gradient(135deg, #f97316, #ef4444)' },
  { name: 'Marie K.', icon: '✂️', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
  { name: 'Patrick M.', icon: '⚡', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { name: 'Sarah L.', icon: '🏗️', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  { name: 'David N.', icon: '🎨', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { name: 'Alice B.', icon: '🚿', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
]

function Stories() {
  return (
    <div className="flex gap-3.5 overflow-x-auto pb-4 mb-4 scrollbar-hide">
      {stories.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl p-0.5 transition-all group-hover:scale-[1.08] group-hover:shadow-[0_4px_16px_rgba(139,92,246,0.3)]
              ${s.isAdd
                ? 'border-[3px] border-dashed border-[var(--text-muted)] bg-[var(--bg-surface)] group-hover:border-[var(--accent)]'
                : 'border-[3px] border-[var(--accent)] bg-[var(--bg-surface)]'
              }`}
            style={s.gradient ? { background: s.gradient } : undefined}
          >
            <span className={s.isAdd ? 'text-2xl text-[var(--text-muted)] font-light group-hover:text-[var(--accent)]' : ''}>
              {s.icon}
            </span>
          </div>
          <span className="text-[0.7rem] text-[var(--text-secondary)] max-w-[64px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
            {s.name}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ============================================
   WELCOME BANNER
   ============================================ */
function WelcomeBanner() {
  return (
    <div className="bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] rounded-2xl p-6 mb-5 relative overflow-hidden">
      <div className="absolute -top-[30%] -right-[10%] w-[150px] h-[150px] bg-white/[0.08] rounded-full" />
      <div className="absolute -bottom-[20%] -left-[5%] w-[100px] h-[100px] bg-white/[0.05] rounded-full" />
      <div className="relative z-[1]">
        <h2 className="text-[1.15rem] font-bold text-white mb-2">👋 Bienvenue sur LOBOKO !</h2>
        <p className="text-sm text-white/85 leading-relaxed mb-4">
          Trouvez rapidement des professionnels qualifiés : plombiers, électriciens, coiffeurs, menuisiers et bien plus.
        </p>
        <Link
          to="/recherches"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white/20 backdrop-blur-[10px] border border-white/30 rounded-full text-white text-sm font-semibold hover:bg-white/30 hover:-translate-y-0.5 transition-all"
        >
          🔍 Rechercher un prestataire
        </Link>
      </div>
    </div>
  )
}

/* ============================================
   CATEGORIES
   ============================================ */
const categories = [
  { icon: '🔧', label: 'Plombier' },
  { icon: '⚡', label: 'Électricien' },
  { icon: '✂️', label: 'Coiffeur' },
  { icon: '🏗️', label: 'Menuisier' },
  { icon: '🎨', label: 'Peintre' },
  { icon: '🚚', label: 'Déménageur' },
  { icon: '📱', label: 'Réparateur' },
  { icon: '🧹', label: 'Nettoyage' },
]

function QuickCategories() {
  return (
    <div className="mb-6">
      <h3 className="text-base font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
        🏷️ Catégories populaires
      </h3>
      <div className="grid grid-cols-4 gap-2.5">
        {categories.map((c, i) => (
          <Link
            key={i}
            to="/recherches"
            className="flex flex-col items-center gap-1.5 py-3.5 px-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[0.72rem] text-[var(--text-secondary)] font-medium text-center hover:bg-[var(--accent-light)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 transition-all"
          >
            <span className="text-xl">{c.icon}</span>
            <span>{c.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ============================================
   POST CARD
   ============================================ */
interface Post {
  username: string
  badge: string
  badgeClass?: string
  avatar: string
  avatarGradient: string
  time: string
  text: string
  image?: { icon: string; label: string; gradient?: string }
  likes: number
  comments: number
  isAnnouncement?: boolean
}

const posts: Post[] = [
  {
    username: 'Jean Plomberie', badge: 'Plombier', avatar: '🔧',
    avatarGradient: 'linear-gradient(135deg, #f97316, #ef4444)', time: 'Il y a 2h',
    text: '🚿 Nouveau service disponible ! Installation de chauffe-eau solaire à des prix imbattables. Contactez-moi pour un devis gratuit. Disponible dans toute la zone de Kinshasa.',
    image: { icon: '🚿', label: 'Installation chauffe-eau' },
    likes: 24, comments: 8,
  },
  {
    username: 'Marie Coiffure', badge: 'Coiffeuse', avatar: '✂️',
    avatarGradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)', time: 'Il y a 4h',
    text: '💇‍♀️ Promo spéciale week-end ! Tresses, tissages et soins capillaires à -30%. Prenez rendez-vous dès maintenant. Salon situé à Gombe, avenue du Commerce.',
    image: { icon: '💇‍♀️', label: 'Promo coiffure -30%', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))' },
    likes: 56, comments: 15,
  },
  {
    username: 'Patrick Électricité', badge: 'Électricien', avatar: '⚡',
    avatarGradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)', time: 'Il y a 6h',
    text: '⚡ Besoin d\'une installation électrique fiable ? Je suis disponible 7j/7 pour tous vos travaux : câblage, dépannage, mise aux normes. Plus de 10 ans d\'expérience. Appelez-moi !',
    likes: 18, comments: 5,
  },
  {
    username: 'Sarah Construction', badge: 'Menuisière', avatar: '🏗️',
    avatarGradient: 'linear-gradient(135deg, #10b981, #059669)', time: 'Il y a 8h',
    text: '🪵 Fabrication de meubles sur mesure ! Armoires, tables, lits, étagères... Tout en bois massif de qualité. Livraison gratuite à Kinshasa. Demandez votre devis personnalisé.',
    image: { icon: '🪵', label: 'Meubles sur mesure', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))' },
    likes: 42, comments: 12,
  },
  {
    username: 'LOBOKO Officiel', badge: 'Officiel', badgeClass: 'official', avatar: '📢',
    avatarGradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', time: 'Il y a 1j',
    text: '🎉 Nouveauté LOBOKO ! Vous pouvez maintenant noter et évaluer les prestataires après chaque service. Partagez votre expérience pour aider la communauté à trouver les meilleurs professionnels !',
    likes: 128, comments: 34, isAnnouncement: true,
  },
]

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes)

  const handleLike = () => {
    setLiked(!liked)
    setLikeCount(prev => liked ? prev - 1 : prev + 1)
  }

  return (
    <div className={`bg-[var(--bg-surface)] border rounded-2xl mb-4 overflow-hidden transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]
      ${post.isAnnouncement ? 'border-[var(--accent)] hover:border-[var(--accent-hover)]' : 'border-[var(--border-color)] hover:border-[#333]'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: post.avatarGradient }}>
          {post.avatar}
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[0.9rem] font-semibold text-[var(--text-primary)]">{post.username}</span>
          <span className={`inline-flex items-center text-[0.7rem] font-medium px-2 py-0.5 rounded-full w-fit
            ${post.badgeClass === 'official'
              ? 'bg-[rgba(139,92,246,0.2)] text-[#a78bfa]'
              : 'bg-[var(--accent-light)] text-[var(--accent)]'
            }`}>
            {post.badge}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{post.time}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-[0.9rem] text-[var(--text-secondary)] leading-relaxed">{post.text}</p>
      </div>

      {/* Image */}
      {post.image && (
        <div className="px-4 pb-2">
          <div
            className="w-full h-[180px] rounded-xl flex flex-col items-center justify-center gap-2"
            style={{ background: post.image.gradient || 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(239,68,68,0.15))' }}
          >
            <span className="text-4xl">{post.image.icon}</span>
            <small className="text-sm text-[var(--text-muted)] font-medium">{post.image.label}</small>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-4 py-2 border-t border-[var(--border-color)] mx-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-2 bg-transparent border-none rounded-full text-sm cursor-pointer transition-all hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]
            ${liked ? 'text-red-500' : 'text-[var(--text-muted)]'}`}
        >
          <span className={liked ? 'animate-[likeAnim_0.3s_ease]' : ''}>❤️</span>
          <span className="font-medium">{likeCount}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-transparent border-none rounded-full text-[var(--text-muted)] text-sm cursor-pointer hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-all">
          <span>💬</span>
          <span className="font-medium">{post.comments}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-transparent border-none rounded-full text-[var(--text-muted)] text-sm cursor-pointer hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-all">
          <span>🔗</span>
          <span className="font-medium">Partager</span>
        </button>
        <button
          onClick={() => setSaved(!saved)}
          className={`flex items-center gap-1.5 px-3 py-2 bg-transparent border-none rounded-full text-sm cursor-pointer ml-auto hover:bg-[var(--bg-surface-hover)] transition-all
            ${saved ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
        >
          <span>🔖</span>
        </button>
      </div>
    </div>
  )
}

/* ============================================
   ACCUEIL PAGE
   ============================================ */
export default function Accueil() {
  return (
    <>
      <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-[var(--border-color)]">
        <span className="text-2xl">🏠</span>
        <h1 className="text-xl font-bold">Accueil</h1>
      </div>

      <Stories />
      <WelcomeBanner />
      <QuickCategories />

      <div className="mb-6">
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
          📰 Fil d&apos;actualité
        </h3>
        {posts.map((post, i) => (
          <PostCard key={i} post={post} />
        ))}
      </div>
    </>
  )
}