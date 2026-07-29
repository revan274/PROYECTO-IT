import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { Button } from './Button';
import { ModalDialog } from './ModalDialog';

function DialogHarness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose();
    setOpen(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
      <ModalDialog
        open={open}
        onClose={close}
        aria-labelledby="test-dialog-title"
        className="bg-white"
      >
        <h2 id="test-dialog-title">Diálogo accesible</h2>
        <Button data-autofocus>Primera acción</Button>
        <Button>Última acción</Button>
      </ModalDialog>
    </>
  );
}

describe('ModalDialog', () => {
  test('expone semántica de diálogo y mantiene el foco dentro', () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Diálogo accesible' });
    const first = screen.getByRole('button', { name: 'Primera acción' });
    const last = screen.getByRole('button', { name: 'Última acción' });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  test('cierra con Escape y restaura el foco al control que lo abrió', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
