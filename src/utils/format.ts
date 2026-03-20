import type { KeyboardEvent } from 'react';

export function formatDateTime(value?: string): string {
  if (!value) return 'N/D';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function normalizeLooseDateString(value?: string): string {
  return String(value || '')
    .trim()
    .replace(/\sa\.\s*m\./gi, ' AM')
    .replace(/\sp\.\s*m\./gi, ' PM')
    .replace(/\./g, '');
}

export function parseDateToTimestamp(value?: string): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const localDate = new Date(year, month - 1, day);
    if (
      localDate.getFullYear() === year
      && localDate.getMonth() === month - 1
      && localDate.getDate() === day
    ) {
      return localDate.getTime();
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();

  const normalized = normalizeLooseDateString(raw);
  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime();
}

export function formatBytes(value?: number): string {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round((size / 1024) * 10) / 10} KB`;
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

export function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function tokenizeSearchQuery(value: string): string[] {
  const normalized = normalizeForCompare(value).replace(/\s+/g, ' ');
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

export function includesAllSearchTokens(normalizedHaystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((token) => normalizedHaystack.includes(token));
}

export function preventInvalidIntegerInputKeys(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-' || event.key === '.') {
    event.preventDefault();
  }
}

export function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, '');
}

export function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeFileToken(value: string): string {
  const normalized = normalizeForCompare(value).replace(/[^a-z0-9]+/g, '-');
  const compact = normalized.replace(/^-+|-+$/g, '');
  return compact || 'activo';
}
