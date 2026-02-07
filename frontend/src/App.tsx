import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompetitionProvider } from './context/CompetitionContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import PublicLayout from './components/PublicLayout';
import CompetitionHubLayout from './components/CompetitionHubLayout';
import Home from './pages/Home';
import { LoginPage, ProfilePage } from './pages/auth';
import {
  PublicHomePage,
  PublicResultsPage,
  PublicHeatListsPage,
  PaymentPage,
  PricingPage,
  FaqPage,
} from './pages/public';
import {
  PeoplePage,
  CouplesPage,
  JudgesPage,
  ParticipantPortalPage,
  InvoicesPage,
} from './pages/participants';
import {
  EventsPage,
  EventFormPage,
  EventEntriesPage,
  ResultsPage,
  ScoreEventPage,
} from './pages/events';
import {
  CompetitionsPage,
  CompetitionDetailsPage,
  CompetitionEntriesPage,
  CompetitionSettingsPage,
  CompetitionDayOfPage,
} from './pages/competitions';
import { OrganizationsPage, StudioPage, UsersPage } from './pages/admin';
import {
  LiveCompetitionPage,
  OnDeckPage,
  ScrutineerPage,
  JudgeScoringPage,
  RunCompetitionPage,
  SchedulePage,
} from './pages/dayof';
import './App.css';

// Hide the global nav bar on fullscreen/kiosk pages (judge, on-deck, live)
const ConditionalNavigation = () => {
  const location = useLocation();
  const hideNav = /\/(judge|ondeck|live)$/.test(location.pathname);
  if (hideNav) return null;
  return <Navigation />;
};

// Get base path for router (handles subpath deployments like /ballroomcomp)
const basePath = import.meta.env.BASE_URL || '/';

const App = () => {
  return (
    <BrowserRouter
      basename={basePath.replace(/\/$/, '')}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <Routes>
          {/* Public routes — no auth required */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/results" element={<PublicResultsPage />} />
            <Route path="/results/:competitionId" element={<PublicResultsPage />} />
            <Route path="/competition/:competitionId" element={<PublicResultsPage />} />
            <Route path="/results/:competitionId/heats" element={<PublicHeatListsPage />} />
            <Route path="/pay/:competitionId" element={<PaymentPage />} />
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
                      <Route path="settings" element={<CompetitionSettingsPage />} />
                      <Route path="heat-lists" element={<SchedulePage />} />
                      <Route path="run" element={<RunCompetitionPage />} />
                      <Route path="scrutineer" element={<ScrutineerPage />} />
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
                    <Route path="/organizations" element={<OrganizationsPage />} />
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
