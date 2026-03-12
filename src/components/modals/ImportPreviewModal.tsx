import { X } from 'lucide-react';

interface ImportPreviewSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
}

interface ImportIssueRow {
  rowNumber: number;
  status: string;
  tag?: string;
  reason?: string;
}

interface ImportPreviewModalProps {
  open: boolean;
  fileName: string;
  preview: ImportPreviewSummary;
  localInvalidCount: number;
  issues: ImportIssueRow[];
  isApplying: boolean;
  onClose: () => void;
  onExportIssues: () => void;
  onConfirm: () => void;
}

export function ImportPreviewModal({
  open,
  fileName,
  preview,
  localInvalidCount,
  issues,
  isApplying,
  onClose,
  onExportIssues,
  onConfirm,
}: ImportPreviewModalProps) {
  if (!open) return null;

  const invalidTotal = Number(preview.invalid || 0) + Number(localInvalidCount || 0);
  const canConfirm = Number(preview.created || 0) + Number(preview.updated || 0) > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vista Previa Dry-Run</p>
            <h3 className="text-lg font-black uppercase text-slate-800">{fileName}</h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-red-500">
            <X size={22} />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[10px] uppercase font-black text-slate-400">Filas</p>
              <p className="text-xl font-black text-slate-800">{preview.totalRows}</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-4">
              <p className="text-[10px] uppercase font-black text-green-500">Nuevos</p>
              <p className="text-xl font-black text-green-700">{preview.created}</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-[10px] uppercase font-black text-blue-500">Actualizados</p>
              <p className="text-xl font-black text-blue-700">{preview.updated}</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-[10px] uppercase font-black text-amber-500">Omitidos</p>
              <p className="text-xl font-black text-amber-700">{preview.skipped}</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-4">
              <p className="text-[10px] uppercase font-black text-red-500">Invalidos</p>
              <p className="text-xl font-black text-red-700">{invalidTotal}</p>
            </div>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 flex justify-between items-center">
              <p className="text-xs font-black uppercase text-slate-500">Incidencias ({issues.length})</p>
              <button
                onClick={onExportIssues}
                className="text-xs font-black uppercase text-[#F58220] hover:text-orange-600"
              >
                Exportar Errores CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Fila</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Tag</th>
                    <th className="px-4 py-3">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {issues.slice(0, 120).map((issue, index) => (
                    <tr key={`${issue.status}-${issue.rowNumber}-${index}`}>
                      <td className="px-4 py-3 text-xs font-black text-slate-700">{issue.rowNumber}</td>
                      <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">{issue.status}</td>
                      <td className="px-4 py-3 text-xs font-black text-slate-700 uppercase">{issue.tag || '-'}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{issue.reason || '-'}</td>
                    </tr>
                  ))}
                  {issues.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs font-black uppercase text-slate-400">
                        Sin incidencias detectadas en el dry-run.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-slate-50 bg-white flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            disabled={isApplying || !canConfirm}
            onClick={onConfirm}
            className="px-6 py-3 rounded-2xl bg-[#F58220] text-white text-xs font-black uppercase disabled:opacity-50"
          >
            {isApplying ? 'Aplicando...' : 'Confirmar Importación'}
          </button>
        </div>
      </div>
    </div>
  );
}
