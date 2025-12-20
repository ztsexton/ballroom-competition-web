import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Competition } from '../types';
import { competitionsApi } from '../api/client';

interface CompetitionContextType {
  activeCompetition: Competition | null;
  competitions: Competition[];
  setActiveCompetition: (competition: Competition | null) => void;
  loading: boolean;
  refreshCompetitions: () => Promise<void>;
}

const CompetitionContext = createContext<CompetitionContextType | undefined>(undefined);

export const useCompetition = () => {
  const context = useContext(CompetitionContext);
  if (!context) {
    throw new Error('useCompetition must be used within CompetitionProvider');
  }
  return context;
};

interface CompetitionProviderProps {
  children: ReactNode;
}

export const CompetitionProvider = ({ children }: CompetitionProviderProps) => {
  const [activeCompetition, setActiveCompetitionState] = useState<Competition | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompetitions = async () => {
    try {
      const response = await competitionsApi.getAll();
      setCompetitions(response.data);
      
      // Load saved active competition from localStorage
      const savedCompId = localStorage.getItem('activeCompetitionId');
      if (savedCompId) {
        const saved = response.data.find(c => c.id === parseInt(savedCompId));
        if (saved) {
          setActiveCompetitionState(saved);
          return;
        }
      }
      
      // If no saved competition or it doesn't exist, set the most recent one
      if (response.data.length > 0) {
        const mostRecent = response.data.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
        setActiveCompetitionState(mostRecent);
      }
    } catch (error) {
      console.error('Failed to load competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitions();
  }, []);

  const setActiveCompetition = (competition: Competition | null) => {
    setActiveCompetitionState(competition);
    if (competition) {
      localStorage.setItem('activeCompetitionId', competition.id.toString());
    } else {
      localStorage.removeItem('activeCompetitionId');
    }
  };

  const refreshCompetitions = async () => {
    await loadCompetitions();
  };

  return (
    <CompetitionContext.Provider
      value={{
        activeCompetition,
        competitions,
        setActiveCompetition,
        loading,
        refreshCompetitions,
      }}
    >
      {children}
    </CompetitionContext.Provider>
  );
};
