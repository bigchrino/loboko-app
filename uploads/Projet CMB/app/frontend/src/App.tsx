import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Accueil from './pages/Accueil'
import { Login, Register } from './pages/Auth'
import { Messages, Chat } from './pages/Chat'
import {
  Decouverte,
  Suggestion,
  Notifications,
  Panier,
  Recherches,
  Entreprise,
  EntrepriseOffre,
  EntrepriseMusala,
  Urgences,
  UrgencesHopitaux,
  UrgencesPolices,
  UrgencesCasernes,
  Profil,
  Menu,
} from './pages/Secondary'
import Parametres from './pages/Parametres'

export default function App() {
  return (
    <Routes>
      {/* Auth pages - no layout */}
      <Route path="/" element={<Login />} />
      <Route path="/inscription" element={<Register />} />

      {/* App pages - with layout */}
      <Route element={<Layout />}>
        <Route path="/accueil" element={<Accueil />} />
        <Route path="/decouverte" element={<Decouverte />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/suggestion" element={<Suggestion />} />
        <Route path="/entreprise" element={<Entreprise />} />
        <Route path="/entreprise/offre" element={<EntrepriseOffre />} />
        <Route path="/entreprise/musala" element={<EntrepriseMusala />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/panier" element={<Panier />} />
        <Route path="/urgences" element={<Urgences />} />
        <Route path="/urgences/hopitaux" element={<UrgencesHopitaux />} />
        <Route path="/urgences/polices" element={<UrgencesPolices />} />
        <Route path="/urgences/casernes" element={<UrgencesCasernes />} />
        <Route path="/recherches" element={<Recherches />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/parametres" element={<Parametres />} />
        <Route path="/menu" element={<Menu />} />
      </Route>

      {/* Chat - separate layout */}
      <Route path="/chat" element={<Chat />} />
    </Routes>
  )
}