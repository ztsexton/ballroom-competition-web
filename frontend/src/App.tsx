import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompetitionProvider } from './context/CompetitionContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import LoginPage from './pages/LoginPage';
import Home from './pages/Home';
import PeoplePage from './pages/PeoplePage';
import CouplesPage from './pages/CouplesPage';
import JudgesPage from './pages/JudgesPage';
import EventsPage from './pages/EventsPage';
import NewEventPage from './pages/NewEventPage';
import ScoreEventPage from './pages/ScoreEventPage';
import ResultsPage from './pages/ResultsPage';
import CompetitionsPage from './pages/CompetitionsPage';
import CompetitionDetailsPage from './pages/CompetitionDetailsPage';
import StudioPage from './pages/StudioPage';
import UsersPage from './pages/UsersPage';
import SchedulePage from './pages/SchedulePage';
import RunCompetitionPage from './pages/RunCompetitionPage';
import JudgeScoringPage from './pages/JudgeScoringPage';
import './App.css';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <CompetitionProvider>
                  <Navigation />
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/competitions" element={<CompetitionsPage />} />
                    <Route path="/competitions/:id" element={<CompetitionDetailsPage />} />
                    <Route path="/people" element={<PeoplePage />} />
                    <Route path="/couples" element={<CouplesPage />} />
                    <Route path="/judges" element={<JudgesPage />} />
                    <Route path="/events" element={<EventsPage />} />

                    <Route path="/events/new" element={<NewEventPage />} />
                    <Route path="/events/:id" element={<ResultsPage />} />
                    <Route path="/events/:id/score" element={<ScoreEventPage />} />
                    <Route path="/events/:id/score/:round" element={<ScoreEventPage />} />
                    <Route path="/events/:id/results" element={<ResultsPage />} />
                    <Route path="/events/:id/results/:round" element={<ResultsPage />} />
                    <Route path="/competitions/:id/schedule" element={<SchedulePage />} />
                    <Route path="/competitions/:id/run" element={<RunCompetitionPage />} />
                    <Route path="/competitions/:id/judge" element={<JudgeScoringPage />} />
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
