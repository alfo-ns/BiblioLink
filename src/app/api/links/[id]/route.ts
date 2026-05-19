import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// PUT update a link (admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const link = await prisma.link.update({
      where: { id },
      data: {
        url: body.url,
        type: body.type,
        tags: Array.isArray(body.tags) ? body.tags.join(',') : (body.tags || ''),
        notes: body.notes || '',
      }
    });

    return NextResponse.json({
      ...link,
      tags: link.tags ? link.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      dateAdded: link.dateAdded.toISOString(),
      description: link.description || '',
      notes: link.notes || '',
      imageUrl: link.imageUrl || '',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE a link (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.link.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
