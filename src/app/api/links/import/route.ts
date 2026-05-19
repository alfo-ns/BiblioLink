import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// POST import links from JSON (admin only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid format: expected array' }, { status: 400 });
    }

    // Validate and filter safe URLs
    const validItems = body.filter(item => {
      if (!item.url || !item.title) return false;
      const urlLower = String(item.url).toLowerCase();
      return urlLower.startsWith('http://') || urlLower.startsWith('https://');
    });

    let imported = 0;
    for (const item of validItems) {
      await prisma.link.create({
        data: {
          url: item.url,
          title: item.title,
          description: item.description || '',
          type: item.type || 'article',
          tags: Array.isArray(item.tags) ? item.tags.join(',') : (item.tags || ''),
          notes: item.notes || '',
          imageUrl: item.imageUrl || '',
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : new Date(),
        }
      });
      imported++;
    }

    return NextResponse.json({ success: true, imported });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
