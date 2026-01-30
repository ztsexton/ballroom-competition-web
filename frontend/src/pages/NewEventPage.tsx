import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi, couplesApi, judgesApi } from '../api/client';
import { Couple, Judge } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { useAuth } from '../context/AuthContext';

const NewEventPage = () => {
  const navigate = useNavigate();
  const { activeCompetition } = useCompetition();
  const { isAdmin, loading: authLoading } = useAuth();
  const [couples, setCouples] = useState<Couple[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [eventName, setEventName] = useState('');
  const [designation, setDesignation] = useState('');
  const [syllabusType, setSyllabusType] = useState('');
  const [level, setLevel] = useState('');
  const [style, setStyle] = useState('');
  const [selectedDances, setSelectedDances] = useState<string[]>([]);
  const [selectedBibs, setSelectedBibs] = useState<number[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<number[]>([]);
  const [coupleSearch, setCoupleSearch] = useState('');

  useEffect(() => {
    if (activeCompetition) {
      loadData();
    }
  }, [activeCompetition]);

  const loadData = async () => {
    if (!activeCompetition) return;
    
    try {
      const [couplesRes, judgesRes] = await Promise.all([
        couplesApi.getAll(activeCompetition.id),
        judgesApi.getAll(activeCompetition.id),
      ]);
      setCouples(couplesRes.data);
      setJudges(judgesRes.data);
      
      // Auto-select all judges if 3 or fewer
      if (judgesRes.data.length <= 3) {
        setSelectedJudges(judgesRes.data.map(j => j.id));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBibToggle = (bib: number) => {
    setSelectedBibs(prev =>
      prev.includes(bib) ? prev.filter(b => b !== bib) : [...prev, bib]
    );
  };

  const handleJudgeToggle = (judgeId: number) => {
    setSelectedJudges(prev =>
      prev.includes(judgeId) ? prev.filter(j => j !== judgeId) : [...prev, judgeId]
    );
  };

  const handleDanceToggle = (dance: string) => {
    setSelectedDances(prev =>
      prev.includes(dance) ? prev.filter(d => d !== dance) : [...prev, dance]
    );
  };

  // Dance options based on style
  const getDanceOptions = () => {
    if (style === 'Standard') {
      return ['Waltz', 'Tango', 'Viennese Waltz', 'Foxtrot', 'Quickstep'];
    } else if (style === 'Latin') {
      return ['Cha Cha', 'Samba', 'Rumba', 'Paso Doble', 'Jive'];
    } else if (style === 'Smooth') {
      return ['Waltz', 'Tango', 'Foxtrot', 'Viennese Waltz'];
    } else if (style === 'Rhythm') {
      return ['Cha Cha', 'Rumba', 'East Coast Swing', 'Bolero', 'Mambo'];
    }
    return [];
  };

  const filteredCouples = couples.filter(couple => {
    if (!coupleSearch.trim()) return true;
    const q = coupleSearch.toLowerCase().trim();
    return (
      couple.bib.toString().includes(q) ||
      couple.leaderName.toLowerCase().includes(q) ||
      couple.followerName.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!activeCompetition) {
      setError('No active competition selected');
      return;
    }
    
    if (!eventName.trim()) {
      setError('Event name is required');
      return;
    }
    
    if (selectedBibs.length === 0) {
      setError('Please select at least one couple');
      return;
    }
    
    try {
      const response = await eventsApi.create(
        eventName.trim(), 
        selectedBibs, 
        selectedJudges,
        activeCompetition.id,
        designation || undefined,
        syllabusType || undefined,
        level || undefined,
        style || undefined,
        selectedDances.length > 0 ? selectedDances : undefined
      );
      navigate(`/events/${response.data.id}`);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create event');
    }
  };

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to create events.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="container">
        <div className="card">
          <h2>➕ Create New Event</h2>
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>⚠️ No Active Competition</p>
            <p style={{ color: '#78350f' }}>Please select a competition from the dropdown above to create events.</p>
          </div>
        </div>
      </div>
    );
  }

  const hasData = couples.length > 0;

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>➕ Create New Event - {activeCompetition.name}</h2>
          <button onClick={() => navigate('/events')} className="btn btn-secondary">Cancel</button>
        </div>

        {error && <div className="error">{error}</div>}

        {!hasData ? (
          <div style={{ 
            background: '#fef3c7', 
            border: '1px solid #f59e0b', 
            padding: '1.5rem', 
            borderRadius: '4px',
            marginTop: '1rem'
          }}>
            <h3>⚠️ Setup Required</h3>
            <p>Before creating an event, you need to:</p>
            <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>Add people (leaders and followers)</li>
              <li>Create couples from those people</li>
              <li>Optionally add judges</li>
            </ol>
            <div style={{ marginTop: '1rem' }}>
              <button onClick={() => navigate('/people')} className="btn" style={{ marginRight: '0.5rem' }}>
                Go to People
              </button>
              <button onClick={() => navigate('/couples')} className="btn">
                Go to Couples
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Designation</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['Pro-Am', 'Amateur', 'Professional', 'Student'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDesignation(designation === option ? '' : option)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: designation === option ? '2px solid #667eea' : '1px solid #cbd5e0',
                      borderRadius: '4px',
                      background: designation === option ? '#667eea' : 'white',
                      color: designation === option ? 'white' : '#2d3748',
                      cursor: 'pointer',
                      fontWeight: designation === option ? 'bold' : 'normal',
                      transition: 'all 0.2s'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Syllabus Type</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['Syllabus', 'Open'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSyllabusType(syllabusType === option ? '' : option)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: syllabusType === option ? '2px solid #667eea' : '1px solid #cbd5e0',
                      borderRadius: '4px',
                      background: syllabusType === option ? '#667eea' : 'white',
                      color: syllabusType === option ? 'white' : '#2d3748',
                      cursor: 'pointer',
                      fontWeight: syllabusType === option ? 'bold' : 'normal',
                      transition: 'all 0.2s'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Level</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['Newcomer', 'Bronze', 'Silver', 'Gold', 'Novice', 'Pre-Championship', 'Championship'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLevel(level === option ? '' : option)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: level === option ? '2px solid #667eea' : '1px solid #cbd5e0',
                      borderRadius: '4px',
                      background: level === option ? '#667eea' : 'white',
                      color: level === option ? 'white' : '#2d3748',
                      cursor: 'pointer',
                      fontWeight: level === option ? 'bold' : 'normal',
                      transition: 'all 0.2s'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Style</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['Standard', 'Latin', 'Smooth', 'Rhythm'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      if (style === option) {
                        setStyle('');
                        setSelectedDances([]);
                      } else {
                        setStyle(option);
                        setSelectedDances([]);
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      border: style === option ? '2px solid #667eea' : '1px solid #cbd5e0',
                      borderRadius: '4px',
                      background: style === option ? '#667eea' : 'white',
                      color: style === option ? 'white' : '#2d3748',
                      cursor: 'pointer',
                      fontWeight: style === option ? 'bold' : 'normal',
                      transition: 'all 0.2s'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {style && getDanceOptions().length > 0 && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ margin: 0 }}>
                    Select Dances {selectedDances.length > 0 && (
                      <span style={{ 
                        color: '#667eea', 
                        fontWeight: 'bold',
                        marginLeft: '0.5rem'
                      }}>
                        ({selectedDances.length} selected)
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedDances(getDanceOptions())}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #667eea',
                        borderRadius: '4px',
                        background: 'white',
                        color: '#667eea',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Select All
                    </button>
                    {selectedDances.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDances([])}
                        style={{
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.875rem',
                          border: '1px solid #cbd5e0',
                          borderRadius: '4px',
                          background: 'white',
                          color: '#718096',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ 
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  {getDanceOptions().map(dance => (
                    <button
                      key={dance}
                      type="button"
                      onClick={() => handleDanceToggle(dance)}
                      style={{
                        padding: '0.5rem 1rem',
                        border: selectedDances.includes(dance) ? '2px solid #667eea' : '1px solid #cbd5e0',
                        borderRadius: '4px',
                        background: selectedDances.includes(dance) ? '#667eea' : 'white',
                        color: selectedDances.includes(dance) ? 'white' : '#2d3748',
                        cursor: 'pointer',
                        fontWeight: selectedDances.includes(dance) ? 'bold' : 'normal',
                        transition: 'all 0.2s',
                        minWidth: '120px'
                      }}
                    >
                      {dance}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Event Name *</label>
              <input
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="e.g., Bronze Waltz, Silver Foxtrot (or auto-generate based on selections)"
                required
              />
              {designation && level && style && (
                <button
                  type="button"
                  onClick={() => {
                    const parts = [designation, syllabusType, level, style];
                    if (selectedDances.length > 0) {
                      parts.push(selectedDances.join('/'));
                    }
                    setEventName(parts.filter(p => p).join(' '));
                  }}
                  className="btn btn-secondary"
                  style={{ marginTop: '0.5rem', fontSize: '0.875rem', padding: '0.25rem 0.75rem' }}
                >
                  Auto-Generate Name
                </button>
              )}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ margin: 0 }}>
                  Select Couples *
                  {selectedBibs.length > 0 && (
                    <span style={{ color: '#667eea', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                      ({selectedBibs.length} selected)
                    </span>
                  )}
                </label>
                {couples.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const visibleBibs = filteredCouples.map(c => c.bib);
                        setSelectedBibs(prev => {
                          const combined = new Set([...prev, ...visibleBibs]);
                          return Array.from(combined);
                        });
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #667eea',
                        borderRadius: '4px',
                        background: 'white',
                        color: '#667eea',
                        cursor: 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      {coupleSearch ? 'Select Matching' : 'Select All'}
                    </button>
                    {selectedBibs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBibs([])}
                        style={{
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.875rem',
                          border: '1px solid #cbd5e0',
                          borderRadius: '4px',
                          background: 'white',
                          color: '#718096',
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
              {couples.length > 0 && (
                <input
                  type="text"
                  value={coupleSearch}
                  onChange={e => setCoupleSearch(e.target.value)}
                  placeholder="Search by bib #, leader, or follower name..."
                  style={{ marginBottom: '0.5rem' }}
                />
              )}
              {couples.length === 0 ? (
                <p style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>
                  No couples available
                </p>
              ) : filteredCouples.length === 0 ? (
                <p style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>
                  No couples match "{coupleSearch}"
                </p>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '0.5rem',
                  maxHeight: '360px',
                  overflowY: 'auto',
                  padding: '0.25rem',
                }}>
                  {filteredCouples.map(couple => {
                    const isSelected = selectedBibs.includes(couple.bib);
                    return (
                      <div
                        key={couple.bib}
                        onClick={() => handleBibToggle(couple.bib)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.625rem 0.75rem',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #667eea' : '1px solid #e2e8f0',
                          background: isSelected ? '#ebf4ff' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          borderRadius: '6px',
                          background: isSelected ? '#667eea' : '#edf2f7',
                          color: isSelected ? '#fff' : '#4a5568',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          flexShrink: 0,
                        }}>
                          {couple.bib}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {couple.leaderName}
                          </div>
                          <div style={{ color: '#718096', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            & {couple.followerName}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ margin: 0 }}>
                  Select Judges
                  <span style={{ color: '#a0aec0', fontWeight: 'normal', marginLeft: '0.25rem' }}>(optional)</span>
                  {selectedJudges.length > 0 && (
                    <span style={{ color: '#667eea', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                      ({selectedJudges.length} selected)
                    </span>
                  )}
                </label>
                {judges.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedJudges(judges.map(j => j.id))}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #667eea',
                        borderRadius: '4px',
                        background: 'white',
                        color: '#667eea',
                        cursor: 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      Select All
                    </button>
                    {selectedJudges.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedJudges([])}
                        style={{
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.875rem',
                          border: '1px solid #cbd5e0',
                          borderRadius: '4px',
                          background: 'white',
                          color: '#718096',
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
              {judges.length === 0 ? (
                <p style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>
                  No judges available (you can add them later)
                </p>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}>
                  {judges.map(judge => {
                    const isSelected = selectedJudges.includes(judge.id);
                    return (
                      <div
                        key={judge.id}
                        onClick={() => handleJudgeToggle(judge.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.625rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #667eea' : '1px solid #e2e8f0',
                          background: isSelected ? '#ebf4ff' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isSelected ? '#667eea' : '#edf2f7',
                          color: isSelected ? '#fff' : '#4a5568',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          flexShrink: 0,
                        }}>
                          {judge.judgeNumber}
                        </span>
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                          {judge.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ 
              background: '#e6f7ff', 
              border: '1px solid #1890ff', 
              padding: '1rem', 
              borderRadius: '4px',
              marginTop: '1rem'
            }}>
              <strong>ℹ️ Automatic Round Generation</strong>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: 0 }}>
                <li>1-6 couples: Final only</li>
                <li>7-14 couples: Semi-final + Final</li>
                <li>15+ couples: Quarter-final + Semi-final + Final</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn" disabled={selectedBibs.length === 0}>
                Create Event
              </button>
              <button type="button" onClick={() => navigate('/events')} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default NewEventPage;
