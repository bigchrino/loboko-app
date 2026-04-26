import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTheme, ThemeToggle } from '../components/Layout'

/* ============================================
   DATA
   ============================================ */
interface Message {
  type: 'sent' | 'received'
  text: string
  time: string
  read?: boolean
  isVoice?: boolean
  isImage?: boolean
}

interface Contact {
  name: string
  avatar: string
  status: string
  online: boolean
  messages: Message[]
}

const contactsData: Record<string, Contact> = {
  jean: {
    name: 'Jean Mukendi', avatar: '👤', status: 'En ligne', online: true,
    messages: [
      { type: 'received', text: 'Salut ! Comment ça va aujourd\'hui ?', time: '14:20' },
      { type: 'sent', text: 'Ça va bien merci ! Et toi ?', time: '14:22', read: true },
      { type: 'received', text: 'Super bien ! Tu as vu les nouvelles offres sur LOBOKO ?', time: '14:25' },
      { type: 'sent', text: 'Pas encore, je vais regarder ça tout de suite 😄', time: '14:28', read: true },
      { type: 'received', text: 'Il y a des promotions incroyables en ce moment, surtout dans la catégorie électronique', time: '14:30' },
      { type: 'sent', text: 'Ah super ! Merci pour l\'info 🙏', time: '14:32', read: false },
    ],
  },
  marie: {
    name: 'Marie Kabila', avatar: '👩', status: 'En ligne', online: true,
    messages: [
      { type: 'sent', text: 'Salut Marie ! Prête pour le projet demain ?', time: '11:45', read: true },
      { type: 'received', text: 'Oui ! J\'ai déjà préparé ma partie 📝', time: '11:50' },
      { type: 'sent', text: 'Parfait ! On se retrouve à quelle heure ?', time: '12:00', read: true },
      { type: 'received', text: 'On se voit demain pour le projet ? Disons 10h au café ?', time: '12:15' },
      { type: 'sent', text: '10h c\'est parfait ! À demain alors 👋', time: '12:18', read: true },
    ],
  },
  patrick: {
    name: 'Patrick Lumumba', avatar: '👨', status: 'Hors ligne', online: false,
    messages: [
      { type: 'received', text: 'Hey, tu peux m\'envoyer le document dont on a parlé ?', time: 'Hier 16:30' },
      { type: 'sent', text: 'Bien sûr ! Je te l\'envoie ce soir', time: 'Hier 17:00', read: true },
      { type: 'received', text: 'Merci pour l\'info !', time: 'Hier 17:05' },
      { type: 'sent', text: 'De rien ! N\'hésite pas si tu as des questions', time: 'Hier 17:10', read: true },
    ],
  },
}

const autoReplies: Record<string, string[]> = {
  jean: ['C\'est génial ! 😊', 'Tu veux qu\'on se retrouve pour en discuter ?', 'Oui, je suis d\'accord avec toi !', 'Haha, trop drôle 😂', 'Bonne idée, on fait comme ça !', 'Je t\'envoie les détails plus tard', 'D\'accord, pas de souci 👍'],
  marie: ['Super, merci ! 🙏', 'On en reparle demain alors', 'Oui, c\'est exactement ce que je pensais', 'Je vais vérifier et je te dis', 'Parfait ! 😄', 'N\'oublie pas d\'apporter ton laptop'],
  patrick: ['Ok, merci beaucoup !', 'Je regarde ça et je te tiens au courant', 'C\'est noté 📝', 'Pas de problème, prends ton temps', 'Super, à bientôt !'],
}

const emojis = ['😀', '😂', '🥰', '😎', '🤔', '😅', '😊', '👍', '👋', '🙏', '❤️', '🔥', '⭐', '🎉', '😢', '😡', '🤣', '😍', '🥳', '😴', '🤗', '👏', '💪', '✨', '💯', '🙌', '😘', '🤝']

/* ============================================
   MESSAGES LIST PAGE
   ============================================ */
export function Messages() {
  return (
    <>
      <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-[var(--border-color)]">
        <span className="text-2xl">💬</span>
        <h1 className="text-xl font-bold">Messages</h1>
      </div>

      <div className="mb-5">
        <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full px-4 py-2.5 max-w-[600px] mx-auto transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-light)]">
          <input type="text" placeholder="Rechercher une conversation..." className="flex-1 border-none bg-transparent text-[0.95rem] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
          <span>🔍</span>
        </div>
      </div>

      <p className="text-[var(--text-secondary)] text-[0.95rem] leading-relaxed mb-5">
        Retrouvez vos amis, partagez des moments et restez informé.<br />
        Envoyez et recevez des messages.
      </p>

      {[
        { id: 'jean', avatar: '👤', name: 'Jean Mukendi', preview: 'Salut ! Comment ça va aujourd\'hui ?', time: '14:32' },
        { id: 'marie', avatar: '👩', name: 'Marie Kabila', preview: 'On se voit demain pour le projet ?', time: '12:15' },
        { id: 'patrick', avatar: '👨', name: 'Patrick Lumumba', preview: 'Merci pour l\'info !', time: 'Hier' },
      ].map(msg => (
        <Link
          key={msg.id}
          to={`/chat?contact=${msg.id}`}
          className="flex items-center gap-3.5 py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl mb-2.5 transition-all cursor-pointer hover:bg-[var(--bg-surface-hover)] hover:border-[#333]"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-xl flex-shrink-0">
            {msg.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.95rem] font-semibold text-[var(--text-primary)] mb-0.5">{msg.name}</div>
            <div className="text-sm text-[var(--text-muted)] whitespace-nowrap overflow-hidden text-ellipsis">{msg.preview}</div>
          </div>
          <div className="text-[0.7rem] text-[var(--text-muted)] flex-shrink-0">{msg.time}</div>
        </Link>
      ))}
    </>
  )
}

/* ============================================
   CHAT PAGE
   ============================================ */
export function Chat() {
  const { theme, toggle } = useTheme()
  const [searchParams] = useSearchParams()
  const contactId = searchParams.get('contact') || 'jean'
  const contact = contactsData[contactId] || contactsData.jean

  const [messages, setMessages] = useState<Message[]>([...contact.messages])
  const [inputText, setInputText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  const getNow = () => {
    const now = new Date()
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
  }

  const simulateReply = useCallback(() => {
    setIsTyping(true)
    const delay = 1500 + Math.random() * 2000
    setTimeout(() => {
      setIsTyping(false)
      const replies = autoReplies[contactId] || autoReplies.jean
      const randomReply = replies[Math.floor(Math.random() * replies.length)]
      setMessages(prev => [...prev, { type: 'received', text: randomReply, time: getNow() }])
    }, delay)
  }, [contactId])

  const sendMessage = () => {
    const text = inputText.trim()
    if (!text) return
    setMessages(prev => [...prev, { type: 'sent', text, time: getNow(), read: false }])
    setInputText('')
    setShowEmoji(false)
    simulateReply()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendVoice = () => {
    setMessages(prev => [...prev, { type: 'sent', text: '', time: getNow(), read: false, isVoice: true }])
    setTimeout(() => simulateReply(), 500)
  }

  const sendImage = () => {
    setMessages(prev => [...prev, { type: 'sent', text: '', time: getNow(), read: false, isImage: true }])
    setTimeout(() => simulateReply(), 500)
  }

  const insertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji)
    inputRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-inter">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] sticky top-0 z-[100] backdrop-blur-[20px]">
        <img src="/logo.jpg" alt="LOBOKO" className="h-8 w-auto rounded-lg" />
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} toggle={toggle} />
          <Link to="/profil" className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all">
            👤 Dashboard
          </Link>
        </div>
      </header>

      <div className="flex flex-col h-[calc(100vh-140px)] max-w-[700px] mx-auto px-4">
        {/* Chat Header */}
        <div className="flex items-center gap-3 py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl mb-3 sticky top-0 z-10">
          <Link to="/messages" className="text-xl cursor-pointer text-[var(--text-primary)] p-1 px-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-all">
            ←
          </Link>
          <div className="w-[42px] h-[42px] rounded-full bg-[var(--accent-light)] flex items-center justify-center text-lg flex-shrink-0">
            {contact.avatar}
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-[var(--text-primary)]">{contact.name}</div>
            <div className={`text-xs ${contact.online ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
              {contact.status}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer text-base hover:bg-[var(--accent-light)] hover:border-[var(--accent)] transition-all">📞</button>
            <button className="w-9 h-9 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer text-base hover:bg-[var(--accent-light)] hover:border-[var(--accent)] transition-all">📹</button>
            <button className="w-9 h-9 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer text-base hover:bg-[var(--accent-light)] hover:border-[var(--accent)] transition-all">⋮</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2 scroll-smooth scrollbar-thin">
          <div className="text-center py-3">
            <span className="text-[0.7rem] text-[var(--text-muted)] bg-[var(--bg-primary)] px-3.5 py-1 rounded-full border border-[var(--border-color)]">
              Aujourd&apos;hui
            </span>
          </div>

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[75%] px-3.5 py-2.5 rounded-[18px] text-[0.88rem] leading-relaxed animate-[bubbleIn_0.3s_ease]
                ${msg.type === 'sent'
                  ? 'self-end bg-[var(--accent)] text-white rounded-br-[4px]'
                  : 'self-start bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-bl-[4px]'
                }`}
            >
              {msg.isVoice ? (
                <div className="flex items-center gap-2 min-w-[180px]">
                  <button className="bg-transparent border-none text-inherit cursor-pointer text-base">▶️</button>
                  <div className="flex-1 h-6 flex items-center gap-0.5">
                    {Array.from({ length: 20 }).map((_, j) => (
                      <div key={j} className="w-[3px] rounded-sm opacity-60" style={{ height: `${4 + Math.random() * 18}px`, background: 'currentColor' }} />
                    ))}
                  </div>
                  <span className="text-[0.7rem] opacity-70">0:{(5 + Math.floor(Math.random() * 25)).toString().padStart(2, '0')}</span>
                </div>
              ) : msg.isImage ? (
                <div className="bg-[var(--accent-light)] rounded-xl p-[30px] text-center text-[var(--text-muted)] text-sm">
                  📷 Photo envoyée
                </div>
              ) : (
                <div>{msg.text}</div>
              )}
              <div className={`text-[0.6rem] mt-1 ${msg.type === 'sent' ? 'text-right text-white/70' : 'text-[var(--text-muted)]'}`}>
                {msg.time}
                {msg.type === 'sent' && <span className="ml-1">{msg.read ? '✓✓' : '✓'}</span>}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="self-start px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[18px] rounded-bl-[4px] flex gap-1 items-center">
              {[0, 1, 2].map(j => (
                <div key={j} className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: `${j * 0.2}s` }} />
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex items-end gap-2 py-3 bg-[var(--bg-primary)] sticky bottom-0">
          <div className="flex gap-1 pb-1.5">
            <button onClick={sendImage} className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer text-base hover:bg-[var(--accent-light)] hover:border-[var(--accent)] transition-all" title="Joindre un fichier">📎</button>
            <button onClick={sendVoice} className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer text-base hover:bg-[var(--accent-light)] hover:border-[var(--accent)] transition-all" title="Message vocal">🎤</button>
          </div>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrire un message..."
              rows={1}
              className="w-full py-2.5 pl-4 pr-11 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl text-[var(--text-primary)] text-[0.9rem] outline-none resize-none max-h-[120px] min-h-[42px] leading-relaxed transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]"
            />
            <button onClick={() => setShowEmoji(!showEmoji)} className="absolute right-2.5 bottom-2 bg-transparent border-none text-xl cursor-pointer opacity-50 hover:opacity-100 transition-all">😊</button>
            {showEmoji && (
              <div className="absolute bottom-[50px] right-0 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3 shadow-[0_4px_24px_rgba(0,0,0,0.3)] z-20 w-[280px] animate-[bubbleIn_0.2s_ease]">
                <div className="grid grid-cols-7 gap-1">
                  {emojis.map((emoji, i) => (
                    <button key={i} onClick={() => insertEmoji(emoji)} className="w-[34px] h-[34px] flex items-center justify-center text-xl cursor-pointer rounded-lg hover:bg-[var(--bg-surface-hover)] hover:scale-[1.2] transition-all bg-transparent border-none">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputText.trim()}
            className={`w-[42px] h-[42px] rounded-full bg-[var(--accent)] border-none flex items-center justify-center cursor-pointer text-lg text-white flex-shrink-0 hover:bg-[var(--accent-hover)] hover:scale-105 active:scale-95 transition-all
              ${!inputText.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
            title="Envoyer"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}