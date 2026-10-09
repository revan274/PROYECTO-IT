import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { TicketFormModal } from './TicketFormModal';

test('todos los controles del formulario de ticket tienen nombre accesible', () => {
  const { container } = render(
    <TicketFormModal
      isOpen
      title="Nuevo ticket"
      submitLabel="Guardar ticket"
      formData={{ sucursal: 'TJ01', areaId: 'AREA_CAJA', categoriaId: 'CAT_POS' }}
      isSaving={false}
      canSubmit
      canEdit
      activeTicketBranches={[{ code: 'TJ01', name: 'Tijuana', activo: true }]}
      ticketAreas={[{ id: 'AREA_CAJA', nombre: 'Caja', activo: true }]}
      ticketCategories={[{ id: 'CAT_POS', areaId: 'AREA_CAJA', nombre: 'POS', activo: true }]}
      ticketAssetOptions={[{ tag: 'POS-001', label: 'Caja 1' }]}
      selectedIssueArea="AREA_CAJA"
      issueOptionsForSelectedArea={['No enciende']}
      selectedTicketAssetContext={null}
      users={[{ id: 1, nombre: 'Admin', rol: 'admin', activo: true }]}
      sessionUser={{ id: 1, nombre: 'Admin', username: 'admin', rol: 'admin' }}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      onChange={vi.fn()}
      formatTicketBranchFromCatalog={(value) => value || ''}
      formatCargoFromCatalog={(value) => value || ''}
      normalizeTicketAttentionType={(value) => value === 'REMOTO' ? 'REMOTO' : null}
      formatTicketAttentionType={(value) => String(value)}
    />,
  );

  const unnamed = Array.from(container.querySelectorAll('input, select, textarea, button'))
    .filter((element) => {
      const control = element as HTMLInputElement;
      const labels = 'labels' in control ? control.labels : null;
      const text = element.textContent?.trim();
      return !labels?.length
        && !element.getAttribute('aria-label')
        && !element.getAttribute('aria-labelledby')
        && !text;
    });

  expect(unnamed).toEqual([]);
});
