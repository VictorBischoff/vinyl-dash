import { useState, useEffect } from 'react';
import { fetchCollection, fetchBpm } from './api';
import type { VinylRecord, BpmInfo } from './types';
import './index.css';

function App() {
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [bpmMap, setBpmMap] = useState<Record<number, BpmInfo>>({});
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingBpm, setLoadingBpm] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadCollection();
  }, []);

  async function loadCollection() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCollection();
      setRecords(data.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  }

  async function loadBpm(record: VinylRecord) {
    if (bpmMap[record.id]) {
      return; // Already loaded
    }

    try {
      setLoadingBpm((prev) => ({ ...prev, [record.id]: true }));
      const bpmData = await fetchBpm(record.title, record.artist);
      setBpmMap((prev) => ({ ...prev, [record.id]: bpmData }));
    } catch (err) {
      console.error('Failed to load BPM:', err);
      // Optionally show error to user
    } finally {
      setLoadingBpm((prev) => ({ ...prev, [record.id]: false }));
    }
  }

  const filteredRecords = records.filter((record) => {
    const searchText = filterText.toLowerCase();
    return (
      record.title.toLowerCase().includes(searchText) ||
      record.artist.toLowerCase().includes(searchText) ||
      record.label.toLowerCase().includes(searchText) ||
      (record.year && record.year.toString().includes(searchText))
    );
  });

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading collection...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Vinyl Dashboard</h1>
        <input
          type="text"
          className="filter-input"
          placeholder="Filter by artist, title, label, or year..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {error && <div className="error">Error: {error}</div>}

      <div className="records-grid">
        {filteredRecords.map((record) => {
          const bpmInfo = bpmMap[record.id];
          const isLoadingBpm = loadingBpm[record.id];

          return (
            <div key={record.id} className="record-card">
              {record.coverImage ? (
                <img
                  src={record.coverImage}
                  alt={`${record.artist} - ${record.title}`}
                  className="record-cover"
                />
              ) : (
                <div className="record-cover" />
              )}
              <div className="record-info">
                <div className="record-title">{record.title}</div>
                <div className="record-artist">{record.artist}</div>
                <div className="record-meta">
                  {record.label} {record.year && `• ${record.year}`}
                </div>
                <button
                  className="bpm-button"
                  onClick={() => loadBpm(record)}
                  disabled={isLoadingBpm || !!bpmInfo}
                >
                  {isLoadingBpm
                    ? 'Loading...'
                    : bpmInfo
                    ? 'BPM Loaded'
                    : 'Load BPM / Key'}
                </button>
                {bpmInfo && (
                  <div className="bpm-info">
                    <div className="bpm-info-item">
                      <span className="bpm-info-label">BPM:</span> {bpmInfo.tempo}
                    </div>
                    {bpmInfo.key && (
                      <div className="bpm-info-item">
                        <span className="bpm-info-label">Key:</span> {bpmInfo.key}
                      </div>
                    )}
                    {bpmInfo.danceability !== undefined && (
                      <div className="bpm-info-item">
                        <span className="bpm-info-label">Danceability:</span>{' '}
                        {bpmInfo.danceability}
                      </div>
                    )}
                    {bpmInfo.acousticness !== undefined && (
                      <div className="bpm-info-item">
                        <span className="bpm-info-label">Acousticness:</span>{' '}
                        {bpmInfo.acousticness}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredRecords.length === 0 && !loading && (
        <div className="loading">No records found</div>
      )}

      <footer className="app-footer">
        <p>
          BPM data provided by{' '}
          <a
            href="https://getsongbpm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            GetSongBPM
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;

