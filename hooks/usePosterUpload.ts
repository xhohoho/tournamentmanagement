'use client';

import { useCallback } from 'react';

export function usePosterUpload(adminToken: string | null) {
  const uploadPoster = useCallback(async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/upload', {
      method:  'POST',
      headers: adminToken ? { 'X-Admin-Token': adminToken } : {},
      body:    fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[uploadPoster] failed', res.status, err);
      return null;
    }

    const data = await res.json();
    console.log('[uploadPoster] success', data.url);
    return data.url ?? null;
  }, [adminToken]);

  return { uploadPoster };
}
