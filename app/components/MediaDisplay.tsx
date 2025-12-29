'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface MediaDisplayProps {
  fileName: string;
  type: 'images' | 'videos';
  onVideoPlay?: (videoElement: HTMLVideoElement) => void;
}

export default function MediaDisplay({ fileName, type, onVideoPlay }: MediaDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const watermarkRef = useRef<HTMLImageElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watermarkLoaded, setWatermarkLoaded] = useState(false);

  // Get watermark path from environment variable
  const getWatermarkPath = (): string => {
    const envPath = process.env.NEXT_PUBLIC_WATERMARK_PATH;
    if (!envPath) {
      // Fallback to default path
      return '/images/watermark/tmbc.png';
    }
    
    // Convert file system path to web path
    // Remove 'public\' or 'public/' prefix and convert backslashes to forward slashes
    let webPath = envPath.replace(/^public[\\/]/, '').replace(/\\/g, '/');
    
    // Ensure it starts with /
    if (!webPath.startsWith('/')) {
      webPath = '/' + webPath;
    }
    
    return webPath;
  };

  const watermarkPath = getWatermarkPath();

  // Load watermark image
  useEffect(() => {
    const watermark = new window.Image();
    watermark.crossOrigin = 'anonymous';
    watermark.onload = () => {
      watermarkRef.current = watermark;
      setWatermarkLoaded(true);
    };
    watermark.onerror = () => {
      console.warn('Failed to load watermark from:', watermarkPath);
      setWatermarkLoaded(false);
    };
    watermark.src = watermarkPath;
  }, [watermarkPath]);

  // Redraw canvas when watermark loads (for images)
  useEffect(() => {
    if (watermarkLoaded && type === 'images' && imageRef.current && canvasRef.current) {
      // Small delay to ensure everything is ready
      setTimeout(() => {
        drawImageToCanvas();
      }, 50);
    }
  }, [watermarkLoaded, type]);

  const drawImageToCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const watermark = watermarkRef.current;
    if (!canvas || !img) return;

    const container = canvas.parentElement;
    
    // Set low resolution: max 800px for width/height
    const MAX_RESOLUTION = 800;
    let displayWidth = container ? container.clientWidth : img.width;
    let displayHeight = container ? container.clientHeight : img.height;
    
    // Limit to maximum resolution while maintaining aspect ratio
    if (displayWidth > MAX_RESOLUTION || displayHeight > MAX_RESOLUTION) {
      const aspect = displayWidth / displayHeight;
      if (displayWidth > displayHeight) {
        displayWidth = MAX_RESOLUTION;
        displayHeight = MAX_RESOLUTION / aspect;
      } else {
        displayHeight = MAX_RESOLUTION;
        displayWidth = MAX_RESOLUTION * aspect;
      }
    }
    
    // Set canvas to low resolution
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    // Set CSS size to fill container (for display)
    if (container) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Use lower quality image smoothing for performance
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const imgAspect = img.width / img.height;
      const canvasAspect = canvas.width / canvas.height;
      
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let drawX = 0;
      let drawY = 0;

      if (imgAspect > canvasAspect) {
        drawHeight = canvas.height;
        drawWidth = drawHeight * imgAspect;
        drawX = (canvas.width - drawWidth) / 2;
      } else {
        drawWidth = canvas.width;
        drawHeight = drawWidth / imgAspect;
        drawY = (canvas.height - drawHeight) / 2;
      }

      // Draw main image at low resolution
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      // Draw watermark if loaded (check both state and image complete property)
      if (watermark && watermark.complete && watermark.naturalWidth > 0) {
        // Calculate watermark size (15% of canvas width, maintain aspect ratio)
        const watermarkScale = 0.15;
        const watermarkWidth = canvas.width * watermarkScale;
        const watermarkHeight = (watermark.height / watermark.width) * watermarkWidth;

        // Position: Top right corner with padding
        const padding = 10;
        const watermarkX = canvas.width - watermarkWidth - padding;
        const watermarkY = padding;

        // Set opacity for watermark (0.8 = 80% opacity for strong visibility)
        ctx.globalAlpha = 0.8;
        ctx.drawImage(
          watermark,
          watermarkX,
          watermarkY,
          watermarkWidth,
          watermarkHeight
        );
        ctx.globalAlpha = 1.0; // Reset alpha
      }
    }
  };

  useEffect(() => {
    const loadMedia = async () => {
      // Cleanup previous blob URL if exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch media as blob
        const response = await fetch(`/api/media?file=${encodeURIComponent(fileName)}&type=${type}`);
        
        if (!response.ok) {
          throw new Error('Failed to load media');
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;

        if (type === 'images') {
          // Load image and draw on canvas
          const img = new window.Image();
          imageRef.current = img;
          img.onload = () => {
            // Small delay to ensure container is rendered
            setTimeout(() => {
              // Always redraw canvas (watermark will be added if loaded)
              drawImageToCanvas();
              setLoading(false);
            }, 50);
          };
          img.onerror = () => {
            setError('Failed to load image');
            setLoading(false);
          };
          img.src = objectUrl;
        } else {
          // For videos, use blob URL
          setBlobUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading media:', err);
        setError('Failed to load media');
        setLoading(false);
      }
    };

    loadMedia();

    // Handle window resize for canvas
    if (type === 'images') {
      const handleResize = () => {
        if (imageRef.current) {
          drawImageToCanvas();
        }
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    } else {
      return () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }
  }, [fileName, type]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-800">
        <div className="text-zinc-600 dark:text-zinc-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-800">
        <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (type === 'images') {
    return (
      <canvas
        ref={canvasRef}
        className="w-full h-full select-none pointer-events-none"
        style={{ 
          display: 'block',
          imageRendering: 'auto',
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    );
  } else {
    return (
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          src={blobUrl || undefined}
          className="w-full h-full object-cover select-none"
          controls
          preload="metadata"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          controlsList="nodownload"
          playsInline
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            imageRendering: 'auto',
          }}
          onPlay={(e) => {
            const video = e.currentTarget;
            if (onVideoPlay && video) {
              onVideoPlay(video);
            }
          }}
          onLoadedMetadata={(e) => {
            // Limit video quality by constraining display size
            const video = e.currentTarget;
            // Video will be scaled down by CSS, but we ensure lower quality rendering
            if (video.videoWidth > 800 || video.videoHeight > 800) {
              video.style.imageRendering = 'auto';
            }
          }}
        />
        {watermarkLoaded && watermarkRef.current && (
          <div
            className="absolute top-0 right-0 pointer-events-none p-2.5 w-[15%] h-[15%]"
            style={{ opacity: 0.8 }}
          >
            <div className="relative w-full h-full">
              <Image
                src={watermarkPath}
                alt="Watermark"
                fill
                className="object-contain"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                unoptimized
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}

