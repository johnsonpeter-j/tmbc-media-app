import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('file');
  const type = searchParams.get('type'); // 'images' or 'videos'

  if (!fileName || !type) {
    return NextResponse.json(
      { error: 'Missing file or type parameter' },
      { status: 400 }
    );
  }

  try {
    const publicPath = join(process.cwd(), 'public');
    const folderPath = type === 'images' 
      ? join(publicPath, 'images')
      : join(publicPath, 'videos');

    const filePath = join(folderPath, fileName);

    // Security: Check if file exists and is within the allowed directory
    if (!existsSync(filePath) || !filePath.startsWith(folderPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file as buffer
    const fileBuffer = await readFile(filePath);

    // Determine content type based on file extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    if (type === 'images') {
      const imageTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
      };
      contentType = imageTypes[ext || ''] || 'image/jpeg';
    } else {
      const videoTypes: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        ogg: 'video/ogg',
        mov: 'video/quicktime',
      };
      contentType = videoTypes[ext || ''] || 'video/mp4';
    }

    // Return file as blob with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error serving media file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}

