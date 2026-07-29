import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  test('combina className y reenvía atributos nativos al elemento span', () => {
    render(
      <Badge
        variant="Operativo"
        className="custom-layout"
        data-testid="status-badge"
        aria-label="Estado operativo"
        title="Estado actual"
      >
        Operativo
      </Badge>,
    );

    const badge = screen.getByTestId('status-badge');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('custom-layout');
    expect(badge.className).toContain('bg-lime-50');
    expect(badge.getAttribute('aria-label')).toBe('Estado operativo');
    expect(badge.getAttribute('title')).toBe('Estado actual');
  });
});
