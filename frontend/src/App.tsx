import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CompetitionProvider } from './context/CompetitionContext';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import PeoplePage from './pages/PeoplePage';
import CouplesPage from './pages/CouplesPage';
import JudgesPage from './pages/JudgesPage';
import EventsPage from './pages/EventsPage';
import NewEventPage from './pages/NewEventPage';
import ScoreEventPage from './pages/ScoreEventPage';
import ResultsPage from './pages/ResultsPage';
import CompetitionsPage from './pages/CompetitionsPage';
import './App.css';

const App = () => {
  return (
    <BrowserRouter>
      <CompetitionProvider>
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
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
        </Routes>
      </CompetitionProvider>
    </BrowserRouter>
  );
};

export default App;
