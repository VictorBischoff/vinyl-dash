import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllCollectionPages, fetchBpm, fetchReleaseDetails } from './api';
import type { VinylRecord, BpmInfo, Track } from './types';
import { Heading1 } from './components/Heading1';
import { Heading2 } from './components/Heading2';
import { Heading3 } from './components/Heading3';
import { BodyText } from './components/BodyText';
import { Caption } from './components/Caption';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { TextInput } from './components/TextInput';

// Client-side logging utility
function logError(level: 'error' | 'warn', message: string, context: Record<string, any> = {}, error?: Error | unknown) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.warn(JSON.stringify(logEntry));
  }
}

function App() {
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [bpmMap, setBpmMap] = useState<Record<number, BpmInfo>>({});
  const [trackBpmMap, setTrackBpmMap] = useState<Record<string, BpmInfo>>({});
  const [tracklists, setTracklists] = useState<Record<number, Track[]>>({});
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingBpm, setLoadingBpm] = useState<Record<number, boolean>>({});
  const [loadingTracks, setLoadingTracks] = useState<Record<number, boolean>>({});
  const [loadingTrackBpm, setLoadingTrackBpm] = useState<Record<string, boolean>>({});
  const [expandedAlbums, setExpandedAlbums] = useState<Set<number>>(new Set());
  
  // Use refs to access latest state in useEffect without causing re-renders
  const trackBpmMapRef = useRef(trackBpmMap);
  const loadingTrackBpmRef = useRef(loadingTrackBpm);
  
  // Keep refs in sync with state
  useEffect(() => {
    trackBpmMapRef.current = trackBpmMap;
  }, [trackBpmMap]);
  
  useEffect(() => {
    loadingTrackBpmRef.current = loadingTrackBpm;
  }, [loadingTrackBpm]);

  useEffect(() => {
    loadCollection();
  }, []);

  const loadTrackBpm = useCallback(async (record: VinylRecord, track: Track) => {
    const trackKey = `${record.id}-${track.title}`;
    try {
      setLoadingTrackBpm((prev) => ({ ...prev, [trackKey]: true }));
      const bpmData = await fetchBpm(track.title, record.artist);
      setTrackBpmMap((prev) => {
        if (prev[trackKey]) {
          return prev; // Already loaded, don't overwrite
        }
        return { ...prev, [trackKey]: bpmData };
      });
    } catch (err) {
      // Handle "no data found" case as a warning, not an error
      const isNoDataFound = err instanceof Error && err.message.includes('No BPM data found');
      if (!isNoDataFound) {
        logError('error', 'Failed to load BPM for track', {
          operation: 'loadTrackBpm',
          trackKey,
          trackTitle: track.title,
          trackPosition: track.position,
          recordId: record.id,
          recordTitle: record.title,
          recordArtist: record.artist,
        }, err);
      }
      // Don't set error state, just log it
    } finally {
      setLoadingTrackBpm((prev) => ({ ...prev, [trackKey]: false }));
    }
  }, []);

  // Fetch BPM for tracks when album is expanded and tracks are visible
  useEffect(() => {
    const fetchTrackBpms = async () => {
      for (const recordId of expandedAlbums) {
        const record = records.find(r => r.id === recordId);
        if (!record) continue;
        
        const tracks = tracklists[recordId];
        if (tracks && tracks.length > 0) {
          // Fetch all track BPMs in parallel
          const bpmPromises = tracks.map((track) => {
            const trackKey = `${recordId}-${track.title}`;
            // Use refs to check current state without stale closures
            if (!trackBpmMapRef.current[trackKey] && !loadingTrackBpmRef.current[trackKey]) {
              return loadTrackBpm(record, track);
            }
            return Promise.resolve();
          });
          
          await Promise.all(bpmPromises);
        }
      }
    };

    fetchTrackBpms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedAlbums, tracklists, loadTrackBpm]);

  const loadTracklist = useCallback(async (record: VinylRecord) => {
    try {
      setLoadingTracks((prev) => ({ ...prev, [record.id]: true }));
      const releaseData = await fetchReleaseDetails(record.id);
      setTracklists((prev) => {
        if (prev[record.id]) {
          return prev; // Already loaded, don't overwrite
        }
        return { ...prev, [record.id]: releaseData.tracks };
      });
    } catch (err) {
      logError('error', 'Failed to load tracklist', {
        operation: 'loadTracklist',
        recordId: record.id,
        recordTitle: record.title,
        recordArtist: record.artist,
      }, err);
      // Set empty array on error to prevent retrying
      setTracklists((prev) => {
        if (prev[record.id]) {
          return prev; // Already set, don't overwrite
        }
        return { ...prev, [record.id]: [] };
      });
    } finally {
      setLoadingTracks((prev) => ({ ...prev, [record.id]: false }));
    }
  }, []);


  async function loadCollection() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllCollectionPages();
      setRecords(data.records);
    } catch (err) {
      logError('error', 'Failed to load collection', {
        operation: 'loadCollection',
        recordCount: records.length,
      }, err);
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
      // Handle "no data found" case as a warning, not an error
      const isNoDataFound = err instanceof Error && err.message.includes('No BPM data found');
      logError(isNoDataFound ? 'warn' : 'error', 'Failed to load BPM for record', {
        operation: 'loadBpm',
        recordId: record.id,
        recordTitle: record.title,
        recordArtist: record.artist,
        recordLabel: record.label,
        recordYear: record.year,
      }, err);
      // Optionally show error to user
    } finally {
      setLoadingBpm((prev) => ({ ...prev, [record.id]: false }));
    }
  }

  const toggleAlbum = (recordId: number) => {
    setExpandedAlbums((prev) => {
      const newSet = new Set(prev);
      const isExpanding = !newSet.has(recordId);
      
      if (isExpanding) {
        newSet.add(recordId);
        // Fetch tracklist if not already loaded
        const record = records.find(r => r.id === recordId);
        if (record && !tracklists[recordId] && !loadingTracks[recordId]) {
          loadTracklist(record);
        }
      } else {
        newSet.delete(recordId);
      }
      return newSet;
    });
  };

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
      <div className="max-w-screen-xl mx-auto px-xl py-2xl">
        <div className="text-center py-2xl text-textSecondary">
          <BodyText>Loading collection...</BodyText>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-xl py-2xl">
      <header className="mb-2xl">
        <Heading1 className="mb-sm">Vinyl Dashboard</Heading1>
        <TextInput
          placeholder="Filter by artist, title, label, or year..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="max-w-sm"
        />
      </header>

      {error && (
        <div className="bg-destructiveSoft text-errorText p-md rounded-md mb-lg" role="alert">
          <BodyText className="font-medium">Error: {error}</BodyText>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-lg">
        {filteredRecords.map((record) => {
          const bpmInfo = bpmMap[record.id];
          const isLoadingBpm = loadingBpm[record.id];
          const tracks = tracklists[record.id] || [];
          const isLoadingTracks = loadingTracks[record.id];

          return (
            <Card key={record.id} className="overflow-hidden p-0">
              {record.coverImage ? (
                <img
                  src={record.coverImage}
                  alt={`${record.artist} - ${record.title}`}
                  className="w-full h-64 object-cover bg-surfaceSubtle"
                />
              ) : (
                <div className="w-full h-64 bg-surfaceSubtle" />
              )}
              <div className="p-md">
                <Heading3 className="mb-xs text-textPrimary">{record.title}</Heading3>
                <BodyText className="mb-xs text-textSecondary">{record.artist}</BodyText>
                <Caption className="mb-md text-textMuted">
                  {record.label} {record.year && `• ${record.year}`}
                </Caption>
                <Button
                  variant="primary"
                  onClick={() => loadBpm(record)}
                  disabled={isLoadingBpm || !!bpmInfo}
                  className="w-full mb-md"
                >
                  {isLoadingBpm
                    ? 'Loading...'
                    : bpmInfo
                    ? 'BPM Loaded'
                    : 'Load BPM / Key'}
                </Button>
                {bpmInfo && (
                  <div className="mt-lg pt-lg border-t border-borderSubtle">
                    <div className="mb-xs">
                      <Caption className="font-semibold text-textSecondary">BPM:</Caption>{' '}
                      <Caption className="text-textPrimary">{bpmInfo.tempo}</Caption>
                    </div>
                    {bpmInfo.key && (
                      <div className="mb-xs">
                        <Caption className="font-semibold text-textSecondary">Key:</Caption>{' '}
                        <Caption className="text-textPrimary">{bpmInfo.key}</Caption>
                      </div>
                    )}
                    {bpmInfo.danceability !== undefined && (
                      <div className="mb-xs">
                        <Caption className="font-semibold text-textSecondary">Danceability:</Caption>{' '}
                        <Caption className="text-textPrimary">{bpmInfo.danceability}</Caption>
                      </div>
                    )}
                    {bpmInfo.acousticness !== undefined && (
                      <div className="mb-xs">
                        <Caption className="font-semibold text-textSecondary">Acousticness:</Caption>{' '}
                        <Caption className="text-textPrimary">{bpmInfo.acousticness}</Caption>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  variant="secondary"
                  onClick={() => toggleAlbum(record.id)}
                  disabled={isLoadingTracks}
                  className="w-full mt-md flex items-center justify-center gap-sm"
                >
                  <span className="flex-1 text-center">
                    {expandedAlbums.has(record.id) ? 'Hide Tracks' : 'Show Tracks'}
                  </span>
                  <span
                    className={`text-caption transition-transform duration-medium ${
                      expandedAlbums.has(record.id) ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </Button>
                {isLoadingTracks && (
                  <div className="mt-md text-center">
                    <Caption className="text-textMuted italic">Loading tracks...</Caption>
                  </div>
                )}
                {expandedAlbums.has(record.id) && !isLoadingTracks && tracks.length === 0 && (
                  <div className="mt-md text-center">
                    <Caption className="text-textMuted italic">No tracks available for this release</Caption>
                  </div>
                )}
                {expandedAlbums.has(record.id) && tracks.length > 0 && (
                  <div className="mt-md pt-md border-t border-borderSubtle animate-slide-down">
                    <Heading3 className="mb-sm text-textSecondary text-heading3">Tracks</Heading3>
                    <ul className="list-none p-0 m-0">
                      {tracks.map((track) => {
                        const trackKey = `${record.id}-${track.title}`;
                        const trackBpm = trackBpmMap[trackKey];
                        const isLoadingTrackBpm = loadingTrackBpm[trackKey];
                        return (
                          <li key={trackKey} className="py-sm border-b border-borderSubtle last:border-b-0">
                            <div className="flex items-center gap-sm flex-wrap">
                              <Caption className="font-semibold text-textMuted min-w-xl">
                                {track.position}
                              </Caption>
                              <BodyText className="flex-1 text-textPrimary text-body">
                                {track.title}
                                {isLoadingTrackBpm && (
                                  <Caption className="text-textMuted italic text-caption ml-sm">
                                    (Loading tempo...)
                                  </Caption>
                                )}
                                {trackBpm && !isLoadingTrackBpm && (
                                  <>
                                    <Caption className="text-primary ml-sm">
                                      {' - '}
                                      <span className="font-semibold">{trackBpm.tempo} BPM</span>
                                    </Caption>
                                    {trackBpm.key && (
                                      <Caption className="text-primary ml-xs">
                                        {', Key: '}
                                        <span className="font-semibold">{trackBpm.key}</span>
                                      </Caption>
                                    )}
                                  </>
                                )}
                              </BodyText>
                              <div className="flex items-center gap-xs">
                                {track.duration && (
                                  <Caption className="text-textMuted">{track.duration}</Caption>
                                )}
                                <Button
                                  variant="tertiary"
                                  onClick={() => loadTrackBpm(record, track)}
                                  disabled={isLoadingTrackBpm || !!trackBpm}
                                  className="min-h-0 h-7 px-xs text-caption whitespace-nowrap"
                                  title={trackBpm ? 'BPM loaded' : isLoadingTrackBpm ? 'Loading BPM...' : 'Load BPM for this track'}
                                >
                                  {isLoadingTrackBpm
                                    ? 'Loading...'
                                    : trackBpm
                                    ? 'BPM'
                                    : 'Load BPM'}
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {filteredRecords.length === 0 && !loading && (
        <div className="text-center py-2xl">
          <BodyText className="text-textSecondary">No records found</BodyText>
        </div>
      )}

      <footer className="mt-2xl pt-2xl border-t border-borderSubtle text-center">
        <BodyText className="text-textMuted text-body">
          BPM data provided by{' '}
          <a
            href="https://getsongbpm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-focusRing focus:ring-offset-2 rounded-sm"
          >
            GetSongBPM
          </a>
        </BodyText>
      </footer>
    </div>
  );
}

export default App;
