import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage }    from '../pages/Home'
import { LobbyPage }   from '../pages/Lobby'
import { RatingPage }  from '../pages/Rating'
import { BracketPage } from '../pages/Bracket'
import { MatchPage }   from '../pages/Match'
import { ResultsPage } from '../pages/Results'
import { SetsPage }    from '../pages/Sets'

export function AppRouter() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/"           element={<HomePage />} />
        <Route path="/lobby/:code" element={<LobbyPage />} />
        <Route path="/rate"       element={<RatingPage />} />
        <Route path="/bracket"    element={<BracketPage />} />
        <Route path="/match"      element={<MatchPage />} />
        <Route path="/results"    element={<ResultsPage />} />
        <Route path="/sets"       element={<SetsPage />} />
      </Routes>
    </AppLayout>
  )
}
