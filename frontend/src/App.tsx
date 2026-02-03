import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompetitionProvider } from './context/CompetitionContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import PublicLayout from './components/PublicLayout';
import CompetitionHubLayout from './components/CompetitionHubLayout';
import LoginPage from './pages/LoginPage';
import Home from './pages/Home';
import PublicHomePage from './pages/PublicHomePage';
import PublicResultsPage from './pages/PublicResultsPage';
import PricingPage from './pages/PricingPage';
import FaqPage from './pages/FaqPage';
import PeoplePage from './pages/PeoplePage';
import CouplesPage from './pages/CouplesPage';
import JudgesPage from './pages/JudgesPage';
import EventsPage from './pages/EventsPage';
import EventFormPage from './pages/EventFormPage';
import ScoreEventPage from './pages/ScoreEventPage';
import ResultsPage from './pages/ResultsPage';
import CompetitionsPage from './pages/CompetitionsPage';
import CompetitionDetailsPage from './pages/CompetitionDetailsPage';
import CompetitionEntriesPage from './pages/CompetitionEntriesPage';
import CompetitionDayOfPage from './pages/CompetitionDayOfPage';
import StudioPage from './pages/StudioPage';
import UsersPage from './pages/UsersPage';
import SchedulePage from './pages/Schedule';
import RunCompetitionPage from './pages/RunCompetition';
import JudgeScoringPage from './pages/JudgeScoring';
import EventEntriesPage from './pages/EventEntriesPage';
import InvoicesPage from './pages/InvoicesPage';
import OnDeckPage from './pages/OnDeckPage';
import LiveCompetitionPage from './pages/LiveCompetitionPage';
import ProfilePage from './pages/ProfilePage';
import ParticipantPortalPage from './pages/ParticipantPortalPage';
import './App.css';

// Hide the global nav bar on fullscreen/kiosk pages (judge, on-deck, live)
const ConditionalNavigation = () => {
  const location = useLocation();
  const hideNav = /\/(judge|ondeck|live)$/.test(location.pathname);
  if (hideNav) return null;
  return <Navigation />;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no auth required */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/results" element={<PublicResultsPage />} />
            <Route path="/results/:competitionId" element={<PublicResultsPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/faq" element={<FaqPage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes — auth required */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <CompetitionProvider>
                  <ConditionalNavigation />
                  <Routes>
                    <Route path="/dashboard" element={<Home />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/portal" element={<ParticipantPortalPage />} />
                    <Route path="/competitions" element={<CompetitionsPage />} />

                    {/* Competition Hub — tabbed layout */}
                    <Route path="/competitions/:id" element={<CompetitionHubLayout />}>
                      <Route index element={<CompetitionDetailsPage />} />
                      <Route path="participants" element={<CompetitionEntriesPage />} />
                      <Route path="events" element={<EventsPage />} />
                      <Route path="invoices" element={<InvoicesPage />} />
                      <Route path="schedule" element={<SchedulePage />} />
                      <Route path="run" element={<RunCompetitionPage />} />
                      <Route path="day-of" element={<CompetitionDayOfPage />} />
                    </Route>

                    {/* Day-of standalone pages (NOT inside hub tabs) */}
                    <Route path="/competitions/:id/ondeck" element={<OnDeckPage />} />
                    <Route path="/competitions/:id/live" element={<LiveCompetitionPage />} />
                    <Route path="/competitions/:id/judge" element={<JudgeScoringPage />} />

                    {/* Standalone pages (backward compat) */}
                    <Route path="/people" element={<PeoplePage />} />
                    <Route path="/couples" element={<CouplesPage />} />
                    <Route path="/judges" element={<JudgesPage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/events/new" element={<EventFormPage />} />
                    <Route path="/events/:id/entries" element={<EventEntriesPage />} />
                    <Route path="/events/:id/edit" element={<EventFormPage />} />
                    <Route path="/events/:id" element={<ResultsPage />} />
                    <Route path="/events/:id/score" element={<ScoreEventPage />} />
                    <Route path="/events/:id/score/:round" element={<ScoreEventPage />} />
                    <Route path="/events/:id/results" element={<ResultsPage />} />
                    <Route path="/events/:id/results/:round" element={<ResultsPage />} />
                    <Route path="/studios" element={<StudioPage />} />
                    <Route path="/users" element={<UsersPage />} />
                  </Routes>
                </CompetitionProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
