import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { TicketResolutionModal } from './TicketResolutionModal';

test('resolver requires a nonblank accessible solution', async () => {
  const resolve = vi.fn();
  render(<TicketResolutionModal ticketId={8} onClose={vi.fn()} onResolve={resolve} />);
  fireEvent.change(screen.getByLabelText('Solución aplicada (obligatoria)'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar solución' }));
  expect(resolve).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('Describe la solución');
  expect(screen.getByLabelText('Solución aplicada (obligatoria)').getAttribute('aria-invalid')).toBe('true');
});

test('resolution preserves text on failure and submits solution and optional diagnosis on retry', async () => {
  const close = vi.fn();
  const resolve = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<TicketResolutionModal ticketId={8} onClose={close} onResolve={resolve} />);
  const solution = screen.getByLabelText('Solución aplicada (obligatoria)') as HTMLTextAreaElement;
  fireEvent.change(solution, { target: { value: ' Se reemplazó el cable. ' } });
  fireEvent.change(screen.getByLabelText('Diagnóstico (opcional)'), { target: { value: 'Cable dañado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar solución' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar'));
  expect(solution.value).toBe(' Se reemplazó el cable. ');
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar solución' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(resolve).toHaveBeenLastCalledWith(8, 'Se reemplazó el cable.', 'Cable dañado');
});
