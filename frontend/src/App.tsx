import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CompetitionProvider } from './context/CompetitionContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import PublicLayout from './components/PublicLayout';
import CompetitionHubLayout from './components/CompetitionHubLayout';
import './App.css';

// -- Dashboard --
const Home = React.lazy(() => import('./pages/Home'));

// -- Auth pages --
const LoginPage = React.lazy(() => import('./pages/auth').then(m => ({ default: m.LoginPage })));
const ProfilePage = React.lazy(() => import('./pages/auth').then(m => ({ default: m.ProfilePage })));

// -- Public pages --
const PublicHomePage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PublicHomePage })));
const PublicResultsPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PublicResultsPage })));
const PublicHeatListsPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PublicHeatListsPage })));
const PaymentPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PaymentPage })));
const PricingPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PricingPage })));
const FaqPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.FaqPage })));
const PublicPersonResultsPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PublicPersonResultsPage })));
const PublicHeatListSearchPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PublicHeatListSearchPage })));
const PublicPersonHeatListPage = React.lazy(() => import('./pages/public').then(m => ({ default: m.PublicPersonHeatListPage })));

// -- Participant pages --
const PeoplePage = React.lazy(() => import('./pages/participants').then(m => ({ default: m.PeoplePage })));
const CouplesPage = React.lazy(() => import('./pages/participants').then(m => ({ default: m.CouplesPage })));
const JudgesPage = React.lazy(() => import('./pages/participants').then(m => ({ default: m.JudgesPage })));
const ParticipantPortalPage = React.lazy(() => import('./pages/participants').then(m => ({ default: m.ParticipantPortalPage })));
const InvoicesPage = React.lazy(() => import('./pages/participants').then(m => ({ default: m.InvoicesPage })));
const PersonHeatListPage = React.lazy(() => import('./pages/participants').then(m => ({ default: m.PersonHeatListPage })));

// -- Event pages --
const EventsPage = React.lazy(() => import('./pages/events').then(m => ({ default: m.EventsPage })));
const EventFormPage = React.lazy(() => import('./pages/events').then(m => ({ default: m.EventFormPage })));
const EventEntriesPage = React.lazy(() => import('./pages/events').then(m => ({ default: m.EventEntriesPage })));
const ResultsPage = React.lazy(() => import('./pages/events').then(m => ({ default: m.ResultsPage })));
const ScoreEventPage = React.lazy(() => import('./pages/events').then(m => ({ default: m.ScoreEventPage })));

// -- Competition pages --
const CompetitionsPage = React.lazy(() => import('./pages/competitions').then(m => ({ default: m.CompetitionsPage })));
const CompetitionDetailsPage = React.lazy(() => import('./pages/competitions').then(m => ({ default: m.CompetitionDetailsPage })));
const CompetitionResultsPage = React.lazy(() => import('./pages/competitions').then(m => ({ default: m.CompetitionResultsPage })));
const CompetitionEntriesPage = React.lazy(() => import('./pages/competitions').then(m => ({ default: m.CompetitionEntriesPage })));
const CompetitionSettingsPage = React.lazy(() => import('./pages/competitions').then(m => ({ default: m.CompetitionSettingsPage })));
const CompetitionDayOfPage = React.lazy(() => import('./pages/competitions').then(m => ({ default: m.CompetitionDayOfPage })));
const CompetitionImportPage = React.lazy(() => import('./pages/competitions').then(m => ({ default: m.CompetitionImportPage })));

// -- Admin pages --
const AdminDashboardPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.AdminDashboardPage })));
const UsersPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.UsersPage })));
const StudioPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.StudioPage })));
const OrganizationsPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.OrganizationsPage })));
const SiteSettingsPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.SiteSettingsPage })));
const JudgeProfilesPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.JudgeProfilesPage })));

// -- Day-of pages --
const LiveCompetitionPage = React.lazy(() => import('./pages/dayof').then(m => ({ default: m.LiveCompetitionPage })));
const OnDeckPage = React.lazy(() => import('./pages/dayof').then(m => ({ default: m.OnDeckPage })));
const ScrutineerPage = React.lazy(() => import('./pages/dayof').then(m => ({ default: m.ScrutineerPage })));
const JudgeScoringPage = React.lazy(() => import('./pages/dayof').then(m => ({ default: m.JudgeScoringPage })));
const RunCompetitionPage = React.lazy(() => import('./pages/dayof').then(m => ({ default: m.RunCompetitionPage })));
const SchedulePage = React.lazy(() => import('./pages/dayof').then(m => ({ default: m.SchedulePage })));

// Hide the global nav bar on fullscreen/kiosk pages (judge, on-deck, live)
const ConditionalNavigation = () => {
  const location = useLocation();
  const hideNav = /\/(judge|ondeck|live)$/.test(location.pathname);
  if (hideNav) return null;
  return <Navigation />;
};

// Get base path for router (handles subpath deployments like /ballroomcomp)
const basePath = import.meta.env.BASE_URL || '/';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
  </div>
);

const App = () => {
  return (
    <BrowserRouter
      basename={basePath.replace(/\/$/, '')}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ThemeProvider>
      <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public routes — no auth required */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/results" element={<PublicResultsPage />} />
            <Route path="/results/:competitionId" element={<PublicResultsPage />} />
            <Route path="/competition/:competitionId" element={<PublicResultsPage />} />
            <Route path="/results/:competitionId/heats" element={<PublicHeatListsPage />} />
            <Route path="/results/:competitionId/person/:personId" element={<PublicPersonResultsPage />} />
            <Route path="/results/:competitionId/heatlists" element={<PublicHeatListSearchPage />} />
            <Route path="/results/:competitionId/heatlists/:personId" element={<PublicPersonHeatListPage />} />
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
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/competitions" element={<CompetitionsPage />} />

                    {/* Competition Hub — tabbed layout */}
                    <Route path="/competitions/:id" element={<CompetitionHubLayout />}>
                      <Route index element={<CompetitionDetailsPage />} />
                      <Route path="participants" element={<CompetitionEntriesPage />} />
                      <Route path="events" element={<EventsPage />} />
                      <Route path="results" element={<CompetitionResultsPage />} />
                      <Route path="invoices" element={<InvoicesPage />} />
                      <Route path="settings" element={<CompetitionSettingsPage />} />
                      <Route path="heat-lists" element={<SchedulePage />} />
                      <Route path="run" element={<RunCompetitionPage />} />
                      <Route path="scrutineer" element={<ScrutineerPage />} />
                      <Route path="import" element={<CompetitionImportPage />} />
                      <Route path="day-of" element={<CompetitionDayOfPage />} />
                    </Route>

                    {/* Person heat sheet (authenticated, works before heat lists are published) */}
                    <Route path="/competitions/:id/heat-sheet" element={<PersonHeatListPage />} />

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
                    <Route path="/site-settings" element={<SiteSettingsPage />} />
                    <Route path="/judge-profiles" element={<JudgeProfilesPage />} />
                  </Routes>
                </CompetitionProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
        </Suspense>
      </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
