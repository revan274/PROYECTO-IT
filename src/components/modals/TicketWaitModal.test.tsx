import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { TicketWaitModal } from './TicketWaitModal';

test('exige un motivo y explica si la regla pausa el SLA', async () => {
  const apply = vi.fn().mockResolvedValue(true);
  const close = vi.fn();
  render(<TicketWaitModal ticketId={12} onClose={close} onApply={apply} />);
  fireEvent.click(screen.getByRole('button', { name: 'Poner en espera' }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('Selecciona el motivo');

  fireEvent.change(screen.getByLabelText('Motivo de espera'), { target: { value: 'AUTORIZACION' } });
  expect(screen.getByRole('status').textContent).toContain('no pausa el SLA');
  fireEvent.click(screen.getByRole('button', { name: 'Poner en espera' }));
  await waitFor(() => expect(apply).toHaveBeenCalledWith(12, 'AUTORIZACION'));
  expect(close).toHaveBeenCalledTimes(1);
});

test('los motivos externos informan la extensión por minutos hábiles', () => {
  render(<TicketWaitModal ticketId={13} onClose={vi.fn()} onApply={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Motivo de espera'), { target: { value: 'PROVEEDOR' } });
  expect(screen.getByRole('status').textContent).toContain('pausa el SLA');
  expect(screen.getByRole('status').textContent).toContain('minutos hábiles');
});
