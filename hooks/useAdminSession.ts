'use client';

import { useState } from 'react';

const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_INFO_KEY  = 'adminInfo';

export interface AdminInfo {
  adminId: string;
  name: string;
  isSuperAdmin: boolean;
}

function getStorage() {
  return typeof window !== 'undefined' ? sessionStorage : null;
}

export function useAdminSession() {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  });

  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(ADMIN_INFO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // ── Login ────────────────────────────────────────────────────────────────
  const login = async (
    name: string,
    password: string,
  ): Promise<{ error?: string }> => {
    const res  = await fetch('/api/admin/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: name.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Wrong name or password.' };

    const info: AdminInfo = {
      adminId:      data.adminId,
      name:         data.name,
      isSuperAdmin: data.isSuperAdmin,
    };
    getStorage()?.setItem(ADMIN_TOKEN_KEY, data.token);
    getStorage()?.setItem(ADMIN_INFO_KEY,  JSON.stringify(info));
    setAdminToken(data.token);
    setAdminInfo(info);
    return {};
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = () => {
    if (adminToken) {
      fetch('/api/admin/auth', {
        method:  'DELETE',
        headers: { 'X-Admin-Token': adminToken },
      }).catch(() => {});
    }
    getStorage()?.removeItem(ADMIN_TOKEN_KEY);
    getStorage()?.removeItem(ADMIN_INFO_KEY);
    setAdminToken(null);
    setAdminInfo(null);
  };

  // ── Change password ──────────────────────────────────────────────────────
  const changePassword = async (newPassword: string): Promise<{ error?: string; ok?: string }> => {
    if (!adminToken || !adminInfo?.adminId) return { error: 'Not logged in.' };
    if (!newPassword.trim())               return { error: 'Enter a new password.' };

    const res = await fetch('/api/admin/auth', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
      body:    JSON.stringify({
        action:      'changePassword',
        adminId:     adminInfo.adminId,
        newPassword: newPassword.trim(),
      }),
    });
    if (!res.ok) return { error: 'Failed to update password.' };
    return { ok: 'Password updated!' };
  };

  // ── Expire session (403 received) ────────────────────────────────────────
  const expireSession = () => {
    getStorage()?.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
  };

  return {
    adminToken,
    adminInfo,
    isAdmin: !!adminToken,
    login,
    logout,
    changePassword,
    expireSession,
  };
}
