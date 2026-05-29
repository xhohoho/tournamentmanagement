import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

// POST /api/upload — upload a poster image to Vercel Blob (admin only)
// Expects multipart/form-data with a single field named "file"
export async function POST(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Allow only image types
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
  }

  // Max 5 MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 });
  }

  const blob = await put(`posters/${Date.now()}-${file.name}`, file, {
    access: 'public',
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
