import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'images' or 'videos'

  try {
    const publicPath = join(process.cwd(), 'public');
    const folderPath = type === 'images' 
      ? join(publicPath, 'images')
      : join(publicPath, 'videos');

    const files = await readdir(folderPath);
    
    // Filter out non-image/video files and return file names
    const filteredFiles = files.filter(file => {
      if (type === 'images') {
        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file);
      } else {
        return /\.(mp4|webm|ogg|mov)$/i.test(file);
      }
    });

    return NextResponse.json({ files: filteredFiles });
  } catch (error) {
    console.error('Error reading files:', error);
    return NextResponse.json(
      { error: 'Failed to read files' },
      { status: 500 }
    );
  }
}

