import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Link } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET all links (public)
export async function GET() {
  try {
    const links = await prisma.link.findMany({
      orderBy: { dateAdded: 'desc' }
    });

    // Convert tags from comma-separated string to array
    const formatted = links.map((link: Link) => ({
      ...link,
      tags: link.tags ? link.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      dateAdded: link.dateAdded.toISOString(),
      description: link.description || '',
      notes: link.notes || '',
      imageUrl: link.imageUrl || '',
    }));

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST create a new link (admin only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const link = await prisma.link.create({
      data: {
        url: body.url,
        title: body.title,
        description: body.description || '',
        type: body.type || 'article',
        tags: Array.isArray(body.tags) ? body.tags.join(',') : (body.tags || ''),
        notes: body.notes || '',
        imageUrl: body.imageUrl || '',
      }
    });

    return NextResponse.json({
      ...link,
      tags: link.tags ? link.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      dateAdded: link.dateAdded.toISOString(),
      description: link.description || '',
      notes: link.notes || '',
      imageUrl: link.imageUrl || '',
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
