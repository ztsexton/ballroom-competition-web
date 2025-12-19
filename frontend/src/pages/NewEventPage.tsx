import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi, couplesApi, judgesApi } from '../api/client';
import { Couple, Judge } from '../types';

const NewEventPage: React.FC = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [couplesRes, judgesRes] = await Promise.all([
        couplesApi.getAll(),
        judgesApi.getAll(),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

  if (loading) return <div className="loading">Loading...</div>;

  const hasData = couples.length > 0;

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Create New Event</h2>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Designation</label>
                <select value={designation} onChange={e => setDesignation(e.target.value)}>
                  <option value="">Select Designation</option>
                  <option value="Pro-Am">Pro-Am</option>
                  <option value="Amateur">Amateur</option>
                  <option value="Professional">Professional</option>
                  <option value="Student">Student</option>
                </select>
              </div>

              <div className="form-group">
                <label>Syllabus Type</label>
                <select value={syllabusType} onChange={e => setSyllabusType(e.target.value)}>
                  <option value="">Select Syllabus</option>
                  <option value="Syllabus">Syllabus</option>
                  <option value="Open">Open</option>
                </select>
              </div>

              <div className="form-group">
                <label>Level</label>
                <select value={level} onChange={e => setLevel(e.target.value)}>
                  <option value="">Select Level</option>
                  <option value="Newcomer">Newcomer</option>
                  <option value="Bronze">Bronze</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Novice">Novice</option>
                  <option value="Pre-Championship">Pre-Championship</option>
                  <option value="Championship">Championship</option>
                </select>
              </div>

              <div className="form-group">
                <label>Style</label>
                <select value={style} onChange={e => {
                  setStyle(e.target.value);
                  setSelectedDances([]); // Reset dances when style changes
                }}>
                  <option value="">Select Style</option>
                  <option value="Standard">Standard</option>
                  <option value="Latin">Latin</option>
                  <option value="Smooth">Smooth</option>
                  <option value="Rhythm">Rhythm</option>
                </select>
              </div>
            </div>

            {style && getDanceOptions().length > 0 && (
              <div className="form-group">
                <label>Select Dances ({selectedDances.length} selected)</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '0.5rem',
                  border: '1px solid #cbd5e0',
                  borderRadius: '4px',
                  padding: '0.75rem'
                }}>
                  {getDanceOptions().map(dance => (
                    <label 
                      key={dance}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDances.includes(dance)}
                        onChange={() => handleDanceToggle(dance)}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <span>{dance}</span>
                    </label>
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
              <label>Select Couples * ({selectedBibs.length} selected)</label>
              <div style={{ 
                border: '1px solid #cbd5e0', 
                borderRadius: '4px', 
                padding: '0.5rem',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {couples.length === 0 ? (
                  <p style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>
                    No couples available
                  </p>
                ) : (
                  couples.map(couple => (
                    <label 
                      key={couple.bib} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '0.5rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #e2e8f0'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBibs.includes(couple.bib)}
                        onChange={() => handleBibToggle(couple.bib)}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <span>
                        <strong>Bib #{couple.bib}:</strong> {couple.leaderName} & {couple.followerName}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Select Judges (optional) ({selectedJudges.length} selected)</label>
              <div style={{ 
                border: '1px solid #cbd5e0', 
                borderRadius: '4px', 
                padding: '0.5rem',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {judges.length === 0 ? (
                  <p style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>
                    No judges available (you can add them later)
                  </p>
                ) : (
                  judges.map(judge => (
                    <label 
                      key={judge.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '0.5rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #e2e8f0'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedJudges.includes(judge.id)}
                        onChange={() => handleJudgeToggle(judge.id)}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <span>
                        <strong>Judge #{judge.judgeNumber}:</strong> {judge.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
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
