'use client';

import { useEffect, useRef, useState } from 'react';

interface MediaDisplayProps {
  fileName: string;
  type: 'images' | 'videos';
  onVideoPlay?: (videoElement: HTMLVideoElement) => void;
}

export default function MediaDisplay({ fileName, type, onVideoPlay }: MediaDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoWatermarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  // Get watermark text from environment variable
  const watermarkText = process.env.NEXT_PUBLIC_WATERMARK_TEXT || '';

  const drawImageToCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
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

      // Draw diagonal repeated watermark text if available
      if (watermarkText) {
        ctx.save();
        ctx.globalAlpha = 0.3; // Semi-transparent watermark
        
        // Calculate font size based on canvas dimensions
        const fontSize = Math.max(20, Math.min(canvas.width, canvas.height) * 0.06);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Measure text width for spacing
        const textMetrics = ctx.measureText(watermarkText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        // Calculate spacing between watermarks (diagonal pattern)
        const spacingX = textWidth * 1.5;
        const spacingY = textHeight * 2;
        
        // Rotate context for diagonal text (approximately -45 degrees)
        const angle = -Math.PI / 4; // -45 degrees in radians
        
        // Calculate diagonal distance to cover entire canvas
        const diagonal = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
        const stepsX = Math.ceil(diagonal / spacingX) + 2;
        const stepsY = Math.ceil(diagonal / spacingY) + 2;
        
        // Draw repeated watermark pattern
        for (let i = -stepsX; i < stepsX; i++) {
          for (let j = -stepsY; j < stepsY; j++) {
            // Calculate position in rotated coordinate system
            const x = canvas.width / 2 + (i * spacingX * Math.cos(angle)) - (j * spacingY * Math.sin(angle));
            const y = canvas.height / 2 + (i * spacingX * Math.sin(angle)) + (j * spacingY * Math.cos(angle));
            
            // Only draw if within canvas bounds (with some margin)
            if (x > -textWidth && x < canvas.width + textWidth && 
                y > -textHeight && y < canvas.height + textHeight) {
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(angle);
              
              // Draw text with stroke for visibility
              ctx.strokeText(watermarkText, 0, 0);
              ctx.fillText(watermarkText, 0, 0);
              
              ctx.restore();
            }
          }
        }
        
        ctx.restore();
      }
    }
  };

  // Draw watermark on video canvas overlay
  const drawVideoWatermark = () => {
    const canvas = videoWatermarkCanvasRef.current;
    if (!canvas || !watermarkText) return;

    const container = canvas.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.3; // Semi-transparent watermark

    // Calculate font size based on canvas dimensions
    const fontSize = Math.max(20, Math.min(canvas.width, canvas.height) * 0.06);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Measure text width for spacing
    const textMetrics = ctx.measureText(watermarkText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Calculate spacing between watermarks (diagonal pattern)
    const spacingX = textWidth * 1.5;
    const spacingY = textHeight * 2;

    // Rotate context for diagonal text (approximately -45 degrees)
    const angle = -Math.PI / 4; // -45 degrees in radians

    // Calculate diagonal distance to cover entire canvas
    const diagonal = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
    const stepsX = Math.ceil(diagonal / spacingX) + 2;
    const stepsY = Math.ceil(diagonal / spacingY) + 2;

    // Draw repeated watermark pattern
    for (let i = -stepsX; i < stepsX; i++) {
      for (let j = -stepsY; j < stepsY; j++) {
        // Calculate position in rotated coordinate system
        const x = canvas.width / 2 + (i * spacingX * Math.cos(angle)) - (j * spacingY * Math.sin(angle));
        const y = canvas.height / 2 + (i * spacingX * Math.sin(angle)) + (j * spacingY * Math.cos(angle));

        // Only draw if within canvas bounds (with some margin)
        if (x > -textWidth && x < canvas.width + textWidth &&
            y > -textHeight && y < canvas.height + textHeight) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);

          // Draw text with stroke for visibility
          ctx.strokeText(watermarkText, 0, 0);
          ctx.fillText(watermarkText, 0, 0);

          ctx.restore();
        }
      }
    }

    ctx.restore();
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
              // Always redraw canvas (watermark text will be added if available)
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
          // Draw watermark after video container is ready
          setTimeout(() => {
            drawVideoWatermark();
          }, 100);
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
      const handleResize = () => {
        drawVideoWatermark();
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }
  }, [fileName, type]);

  // Hide sensitive data (images and videos) on screenshot attempt (Experimental)
  useEffect(() => {
    const hideMediaOnScreenshot = () => {
      setIsHidden(true);
      
      // Restore visibility after a short delay
      setTimeout(() => {
        setIsHidden(false);
      }, 300);
    };

    // Detect PrintScreen key
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        hideMediaOnScreenshot();
      }
    };

    // Detect common screenshot shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Windows+Shift+S (Windows Snipping Tool)
      if (e.key === 'S' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        hideMediaOnScreenshot();
      }
      // Mac: Cmd+Shift+3/4/5
      if ((e.key === '3' || e.key === '4' || e.key === '5') && e.shiftKey && e.metaKey) {
        hideMediaOnScreenshot();
      }
    };

    // Detect clipboard events (when screenshot is copied to clipboard)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page might be hidden for screenshot
        setTimeout(() => {
          if (!document.hidden) {
            hideMediaOnScreenshot();
          }
        }, 100);
      }
    };

    // Additional detection: monitor for focus loss (common when taking screenshots)
    const handleBlur = () => {
      setTimeout(() => {
        if (document.hasFocus()) {
          hideMediaOnScreenshot();
        }
      }, 50);
    };

    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

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
          display: isHidden ? 'none' : 'block',
          imageRendering: 'auto',
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    );
  } else {
    return (
      <div 
        ref={videoContainerRef} 
        className="relative w-full h-full"
        style={{ display: isHidden ? 'none' : 'block' }}
      >
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
            display: isHidden ? 'none' : 'block',
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
            // Redraw watermark when video metadata is loaded
            setTimeout(() => {
              drawVideoWatermark();
            }, 50);
          }}
        />
        {watermarkText && (
          <canvas
            ref={videoWatermarkCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
            style={{
              display: isHidden ? 'none' : 'block',
            }}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        )}
      </div>
    );
  }
}


