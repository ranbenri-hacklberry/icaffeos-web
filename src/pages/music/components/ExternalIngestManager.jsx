import React, { useState, useEffect } from 'react';
import { Play, Check, AlertCircle, HardDrive, RefreshCw } from 'lucide-react';
import { useAlbums } from '../../../hooks/useAlbums';

const ExternalIngestManager = () => {
    const [status, setStatus] = useState('idle'); // idle, scanning, review, importing, complete
    const [scannedTracks, setScannedTracks] = useState([]);
    const [selectedTracks, setSelectedTracks] = useState(new Set());
    const [error, setError] = useState(null);
    const [scanPath, setScanPath] = useState('');
    const { refreshAlbums } = useAlbums();

    // Mock platform check for UI
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const defaultPath = isMac ? '/Volumes/RANTUNES' : '/mnt/music_ssd';

    const handleScan = async () => {
        setStatus('scanning');
        setError(null);
        try {
            // Use the exposed API
            const result = await window.electron.music.scanDisk(scanPath || undefined);

            if (result.success) {
                setScannedTracks(result.tracks);
                // Select all by default
                setSelectedTracks(new Set(result.tracks.map(t => t.filePath)));
                setStatus('review');
            } else {
                setError(result.error);
                setStatus('idle');
            }
        } catch (err) {
            setError(err.message);
            setStatus('idle');
        }
    };

    const toggleTrack = (path) => {
        const newSelected = new Set(selectedTracks);
        if (newSelected.has(path)) {
            newSelected.delete(path);
        } else {
            newSelected.add(path);
        }
        setSelectedTracks(newSelected);
    };

    const handleImport = async () => {
        setStatus('importing');
        try {
            const tracksToImport = scannedTracks.filter(t => selectedTracks.has(t.filePath));

            // 1. Send to backend/main to copy or just confirm
            // For plug-and-play, we might just update DB with existing paths

            // We use the same API for "confirming" import (Optional - mostly for logging)
            await window.electron.music.confirmImport(tracksToImport);

            // 2. Trigger DB sync (Backend-side)
            const response = await fetch(`${import.meta.env.VITE_MUSIC_API_URL || 'http://localhost:8081'}/api/music/sync-external`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tracks: tracksToImport })
            });

            if (!response.ok) throw new Error('Sync failed');

            const result = await response.json();
            console.log('Import result:', result);

            // Refresh view
            setStatus('complete');
            refreshAlbums();

        } catch (err) {
            setError(err.message);
            setStatus('review');
        }
    };

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <HardDrive className="text-blue-400" />
                External Drive Ingestion
            </h2>

            {/* ERROR STATE */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-lg mb-4 flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* IDLE STATE */}
            {status === 'idle' && (
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Scan external drive for music. Defaults to
                        <code className="bg-slate-900 px-2 py-1 rounded ml-1 text-sm text-yellow-500">
                            {defaultPath}
                        </code>
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Custom Path (Optional)"
                            className="bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 flex-1"
                            value={scanPath}
                            onChange={(e) => setScanPath(e.target.value)}
                        />
                        <button
                            onClick={handleScan}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <RefreshCw size={18} />
                            Scan Drive
                        </button>
                    </div>
                </div>
            )}

            {/* SCANNING STATE */}
            {status === 'scanning' && (
                <div className="text-center py-8">
                    <div className="animate-spin text-blue-500 mb-2">
                        <RefreshCw size={32} className="mx-auto" />
                    </div>
                    <p className="text-slate-300">Scanning drive for metadata...</p>
                </div>
            )}

            {/* REVIEW STATE */}
            {status === 'review' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm text-slate-400">
                        <span>Found {scannedTracks.length} tracks</span>
                        <span>{selectedTracks.size} selected</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto bg-slate-900 rounded-lg border border-slate-700">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-800 sticky top-0">
                                <tr>
                                    <th className="p-2 w-8">
                                        <input
                                            type="checkbox"
                                            checked={selectedTracks.size === scannedTracks.length}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedTracks(new Set(scannedTracks.map(t => t.filePath)));
                                                else setSelectedTracks(new Set());
                                            }}
                                        />
                                    </th>
                                    <th className="p-2">Title</th>
                                    <th className="p-2">Artist</th>
                                    <th className="p-2">Album</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scannedTracks.map((track) => (
                                    <tr key={track.filePath} className="border-t border-slate-800 hover:bg-slate-800/50">
                                        <td className="p-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedTracks.has(track.filePath)}
                                                onChange={() => toggleTrack(track.filePath)}
                                            />
                                        </td>
                                        <td className="p-2 font-medium text-white">{track.title}</td>
                                        <td className="p-2">{track.artist}</td>
                                        <td className="p-2">{track.album}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            onClick={() => setStatus('idle')}
                            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={selectedTracks.size === 0}
                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Check size={18} />
                            Import Selected
                        </button>
                    </div>
                </div>
            )}

            {/* COMPLETE STATE */}
            {status === 'complete' && (
                <div className="text-center py-6">
                    <div className="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Import Successful</h3>
                    <p className="text-slate-400 mb-4">Tracks have been added to your library.</p>
                    <button
                        onClick={() => setStatus('idle')}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                        Scan Another Drive
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExternalIngestManager;
