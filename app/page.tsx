'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Grid } from 'react-virtualized';
import 'react-virtualized/styles.css';
import MediaDisplay from './components/MediaDisplay';

type FileType = 'images' | 'videos';

interface FileListResponse {
  files: string[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<FileType>('images');
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [columnCount, setColumnCount] = useState(4);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [selectedMedia, setSelectedMedia] = useState<{ fileName: string; type: FileType } | null>(null);
  const currentlyPlayingVideoRef = useRef<HTMLVideoElement | null>(null);
  const gridRef = useRef<Grid>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Function to handle video play - pause all other videos
  const handleVideoPlay = useCallback((videoElement: HTMLVideoElement) => {
    // Pause the previously playing video if it exists and is different
    if (currentlyPlayingVideoRef.current && currentlyPlayingVideoRef.current !== videoElement) {
      currentlyPlayingVideoRef.current.pause();
    }
    // Set the new video as currently playing
    currentlyPlayingVideoRef.current = videoElement;
  }, []);

  const fetchFiles = async (type: FileType) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/files?type=${type}`);
      const data: FileListResponse = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(activeTab);
  }, [activeTab]);

  // Calculate column count based on container width
  const calculateColumnCount = useCallback((width: number) => {
    if (width >= 1024) return 4; // lg
    if (width >= 768) return 3;  // md
    if (width >= 640) return 2;   // sm
    return 1;                     // default
  }, []);

  // Handle window resize and initial dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth || window.innerWidth - 64; // Account for padding
        const height = containerRef.current.clientHeight || window.innerHeight - 300;
        setContainerWidth(width);
        setContainerHeight(height);
        setColumnCount(calculateColumnCount(width));
        // Recompute grid size after dimensions change
        setTimeout(() => {
          if (gridRef.current) {
            gridRef.current.recomputeGridSize();
          }
        }, 0);
      }
    };

    // Initial update with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateDimensions, 100);
    window.addEventListener('resize', updateDimensions);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [calculateColumnCount]);

  // Update grid when files change
  useEffect(() => {
    if (gridRef.current && files.length > 0) {
      setTimeout(() => {
        gridRef.current?.recomputeGridSize();
      }, 0);
    }
  }, [files.length]);

  // Calculate row count
  const rowCount = Math.ceil(files.length / columnCount);
  const cellSize = containerWidth > 0 ? Math.floor((containerWidth - 16) / columnCount) : 200;

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedMedia) {
        setSelectedMedia(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedMedia]);

  // Disable right-click and keyboard shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Ctrl+S (Save)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        return false;
      }
      // Disable Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      // Disable F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      // Disable Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (activeTab === 'images' && !isImage) {
      setUploadMessage('Please select an image file');
      return;
    }
    
    if (activeTab === 'videos' && !isVideo) {
      setUploadMessage('Please select a video file');
      return;
    }

    setUploading(true);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', activeTab);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        setUploadMessage('File uploaded successfully!');
        // Refresh the file list
        fetchFiles(activeTab);
        // Clear the input
        event.target.value = '';
        // Recompute grid
        if (gridRef.current) {
          gridRef.current.recomputeGridSize();
        }
      } else {
        setUploadMessage(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadMessage('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Cell renderer for Grid
  const cellRenderer = useCallback(({ columnIndex, rowIndex, key, style }: any) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= files.length) {
      return null;
    }

    const fileName = files[index];
    return (
      <div
        key={key}
        style={{
          ...style,
          padding: '8px',
        }}
      >
        <div
          className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden group select-none w-full h-full cursor-pointer"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          onClick={() => {
            // Only open modal for images, videos handle their own clicks
            if (activeTab === 'images') {
              setSelectedMedia({ fileName, type: activeTab });
            }
          }}
        >
          <MediaDisplay 
            fileName={fileName} 
            type={activeTab} 
            onVideoPlay={activeTab === 'videos' ? handleVideoPlay : undefined}
            onVideoClick={activeTab === 'videos' ? () => setSelectedMedia({ fileName, type: activeTab }) : undefined}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity truncate">
            {fileName}
          </div>
        </div>
      </div>
    );
  }, [files, columnCount, activeTab, handleVideoPlay]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-4xl font-bold mb-8 text-center text-black dark:text-zinc-50">
          TMBC Gallery
        </h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('images')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'images'
                ? 'text-black dark:text-zinc-50 border-b-2 border-black dark:border-zinc-50'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50'
            }`}
          >
            Images
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'videos'
                ? 'text-black dark:text-zinc-50 border-b-2 border-black dark:border-zinc-50'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50'
            }`}
          >
            Videos
          </button>
        </div>

        {/* Upload Button */}
        <div className="mb-6 flex items-center gap-4 justify-end">
          <label
            htmlFor="file-upload"
            className={`px-6 py-2 rounded-lg font-medium cursor-pointer transition-colors ${
              uploading
                ? 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed'
                : 'bg-black dark:bg-zinc-50 text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
            }`}
          >
            {uploading ? 'Uploading...' : `Upload ${activeTab === 'images' ? 'Image' : 'Video'}`}
          </label>
          <input
            id="file-upload"
            type="file"
            accept={activeTab === 'images' ? 'image/*' : 'video/*'}
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          {uploadMessage && (
            <span
              className={`text-sm ${
                uploadMessage.includes('success')
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {uploadMessage}
            </span>
          )}
        </div>

        {/* File Grid */}
        {loading ? (
          <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
            Loading...
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
            No {activeTab} found. Upload some files to get started!
          </div>
        ) : (
          <div 
            ref={containerRef}
            className="w-full"
            style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
          >
            <Grid
              ref={gridRef}
              cellRenderer={cellRenderer}
              columnCount={columnCount}
              columnWidth={cellSize}
              height={containerHeight}
              rowCount={rowCount}
              rowHeight={cellSize}
              width={containerWidth || 800}
              style={{ outline: 'none' }}
            />
          </div>
        )}
      </main>

      {/* Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="relative w-full max-w-7xl max-h-[92vh] mx-4 my-4 flex flex-col items-center justify-center transform transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className="w-full flex items-center justify-between mb-3 px-1">
              <div className="flex-1"></div>
              <h2 className="flex-1 text-center text-white text-base sm:text-lg font-semibold truncate px-4">
                {selectedMedia.fileName}
              </h2>
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2.5 transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl"
                  aria-label="Close modal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Media Container */}
            <div className="relative w-full bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 rounded-2xl overflow-hidden shadow-2xl border border-white/20 backdrop-blur-sm">
              <div className="w-full h-[calc(92vh-100px)] min-h-[500px] max-h-[85vh] flex items-center justify-center p-4 sm:p-6">
                <div className={`w-full h-full flex items-center justify-center ${selectedMedia.type === 'videos' ? 'justify-center' : ''}`}>
                  <MediaDisplay
                    fileName={selectedMedia.fileName}
                    type={selectedMedia.type}
                    onVideoPlay={selectedMedia.type === 'videos' ? handleVideoPlay : undefined}
                    fullSize={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
