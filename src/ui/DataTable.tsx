import type { ReactNode } from 'react';
import { cn } from './cn';
import { EmptyState } from './misc';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Celda. Si se omite, se usa row[key]. */
  cell?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  empty?: { title: string; description?: string; action?: ReactNode };
  className?: string;
  dense?: boolean;
}

/**
 * Tabla estilo Linear/Jira: header sticky, filas con hover, click opcional.
 * Para >1k filas envolver el <tbody> con @tanstack/react-virtual (ver guía).
 */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, className, dense }: DataTableProps<T>) {
  const alignCls = (a?: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  if (rows.length === 0 && empty) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <EmptyState {...empty} />
      </div>
    );
  }

  return (
    <div className={cn('bg-surface border border-border rounded-xl overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width }}
                  className={cn(
                    'px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-fg-subtle',
                    alignCls(c.align),
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                className={cn(
                  'border-b border-border last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(dense ? 'px-4 py-2' : 'px-4 py-3', 'text-fg align-middle', alignCls(c.align), c.className)}
                  >
                    {c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
