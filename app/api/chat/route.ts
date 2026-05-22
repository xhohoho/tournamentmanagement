import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';
import { randomBytes } from 'crypto';
import type { ChatMessage } from '@/lib/types';

const MAX_MESSAGES = 200;
const MAX_TEXT_LEN = 300;
const MAX_NAME_LEN = 24;

// GET /api/chat — return recent messages
export async function GET() {
  const state = await getState();
  return NextResponse.json({ messages: state.chatMessages ?? [] });
}

// POST /api/chat — send a message (open to all, name required)
export async function POST(req: NextRequest) {
  const { name, text } = await req.json();
  const trimName = name?.trim();
  const trimText = text?.trim();

  if (!trimName || trimName.length > MAX_NAME_LEN)
    return NextResponse.json({ error: 'Valid name required (max 24 chars)' }, { status: 400 });
  if (!trimText || trimText.length > MAX_TEXT_LEN)
    return NextResponse.json({ error: 'Message required (max 300 chars)' }, { status: 400 });

  const msg: ChatMessage = {
    id: randomBytes(8).toString('hex'),
    name: trimName,
    text: trimText,
    ts: Date.now(),
  };

  const next = await updateState(s => ({
    ...s,
    chatMessages: [...(s.chatMessages ?? []).slice(-(MAX_MESSAGES - 1)), msg],
  }));

  return NextResponse.json({ message: msg, messages: next.chatMessages });
}

// DELETE /api/chat — clear all messages (admin only)
export async function DELETE(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const next = await updateState(s => ({ ...s, chatMessages: [] }));
  return NextResponse.json({ messages: next.chatMessages });
}
