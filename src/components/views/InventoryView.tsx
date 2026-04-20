import React from 'react';
import { Upload, Download, ScanLine, Trash2, Plus, ChevronRight } from 'lucide-react';
import { AssetFormModal } from '../modals/AssetFormModal';
import { AssetDetailModal } from '../modals/AssetDetailModal';
import { ImportPreviewModal } from '../modals/ImportPreviewModal';
import { QrScannerModal } from '../modals/QrScannerModal';
import { Badge } from '../ui/Badge';
import type {
  Activo,
  DuplicateRiskItem,
  EstadoActivo,
  FormDataState,
  InventoryRiskFilter,
  InventorySortDirection,
  InventorySortField,
  ModalType,
} from '../../types/app';

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

interface LazyQrCanvasLikeProps {
  id: string;
  value: string;
  size: number;
  includeMargin: boolean;
  level: 'L' | 'M' | 'Q' | 'H';
  bgColor: string;
  fgColor: string;
}

interface AssetFormModalConfig {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  formData: FormDataState;
  isSaving: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (updates: Partial<FormDataState>) => void;
}

interface InventoryViewProps {
  inventoryImportInputRef: React.RefObject<HTMLInputElement>;
  handleImportInventory: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  canEdit: boolean;
  isImportingInventory: boolean;
  exportarInventarioFiltrado: () => void;
  setQrManualInput: React.Dispatch<React.SetStateAction<string>>;
  setQrScannerStatus: React.Dispatch<React.SetStateAction<string>>;
  setShowQrScanner: React.Dispatch<React.SetStateAction<boolean>>;
  canManageUsers: boolean;
  activos: Activo[];
  eliminarTodosActivos: () => Promise<boolean>;
  openModal: (type: ModalType | string) => void;
  activosConIp: number;
  activosEvaluablesIp: number;
  activosConMac: number;
  activosEvaluablesMac: number;
  activosSinResponsable: number;
  activosEvaluablesResponsable: number;
  activosVidaAlta: number;
  inventoryDepartmentFilter: string;
  setInventoryDepartmentFilter: React.Dispatch<React.SetStateAction<string>>;
  departamentoOptions: string[];
  inventoryEquipmentFilter: string;
  setInventoryEquipmentFilter: React.Dispatch<React.SetStateAction<string>>;
  equipoOptions: string[];
  inventoryStatusFilter: string | EstadoActivo;
  setInventoryStatusFilter: React.Dispatch<React.SetStateAction<'TODOS' | EstadoActivo>>;
  inventoryRiskFilter: InventoryRiskFilter;
  setInventoryRiskFilter: React.Dispatch<React.SetStateAction<InventoryRiskFilter>>;
  inventorySortField: InventorySortField;
  setInventorySortField: React.Dispatch<React.SetStateAction<InventorySortField>>;
  inventorySortDirection: InventorySortDirection;
  setInventorySortDirection: React.Dispatch<React.SetStateAction<InventorySortDirection>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  applyInventoryFocus: (focus: InventoryRiskFilter | 'FALLA') => void;
  activosEnFalla: number;
  duplicateIpEntries: DuplicateRiskItem[];
  duplicateMacEntries: DuplicateRiskItem[];
  updateInventorySort: (field: InventorySortField) => void;
  getInventorySortIndicator: (field: InventorySortField) => React.ReactNode;
  sortedFilteredActivos: Activo[];
  selectedAsset: Activo | null;
  setSelectedAsset: (asset: Activo) => void;
  selectedAssetQrLoading: boolean;
  selectedAssetQrMode: 'signed' | 'unavailable';
  selectedAssetQrIssuedAt: string;
  effectiveSelectedAssetQrValue: string;
  LazyQRCodeCanvas: React.ComponentType<LazyQrCanvasLikeProps>;
  buildAssetQrCanvasId: (assetId: number) => string;
  formatDateTime: (value?: string) => string;
  openAssetEditModal: () => void;
  descargarQrActivoSeleccionado: () => void;
  imprimirEtiquetaQrActivoSeleccionado: () => void;
  eliminarActivo: (id: number, e?: React.MouseEvent<HTMLElement>) => Promise<boolean>;
  showQrScanner: boolean;
  qrScannerVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  isQrScannerActive: boolean;
  isQrCameraSupported: boolean;
  qrScannerStatus: string;
  qrManualInput: string;
  isResolvingQr: boolean;
  resolveQrFromManualInput: () => void | Promise<void>;
  importPreviewOpen: boolean;
  importPreviewFileName: string;
  importPreviewSummary: ImportPreviewSummary;
  importPreviewLocalInvalidCount: number;
  importIssueRows: ImportIssueRow[];
  isApplyingImport: boolean;
  closeImportPreview: () => void;
  exportImportIssuesCsv: () => void;
  applyImportDraft: () => void;
  assetFormModal: AssetFormModalConfig;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventoryImportInputRef,
  handleImportInventory,
  canEdit,
  isImportingInventory,
  exportarInventarioFiltrado,
  setQrManualInput,
  setQrScannerStatus,
  setShowQrScanner,
  canManageUsers,
  activos,
  eliminarTodosActivos,
  openModal,
  activosConIp,
  activosEvaluablesIp,
  activosConMac,
  activosEvaluablesMac,
  activosSinResponsable,
  activosEvaluablesResponsable,
  activosVidaAlta,
  inventoryDepartmentFilter,
  setInventoryDepartmentFilter,
  departamentoOptions,
  inventoryEquipmentFilter,
  setInventoryEquipmentFilter,
  equipoOptions,
  inventoryStatusFilter,
  setInventoryStatusFilter,
  inventoryRiskFilter,
  setInventoryRiskFilter,
  inventorySortField,
  setInventorySortField,
  inventorySortDirection,
  setInventorySortDirection,
  setSearchTerm,
  applyInventoryFocus,
  activosEnFalla,
  duplicateIpEntries,
  duplicateMacEntries,
  updateInventorySort,
  getInventorySortIndicator,
  sortedFilteredActivos,
  selectedAsset,
  setSelectedAsset,
  selectedAssetQrLoading,
  selectedAssetQrMode,
  selectedAssetQrIssuedAt,
  effectiveSelectedAssetQrValue,
  LazyQRCodeCanvas,
  buildAssetQrCanvasId,
  formatDateTime,
  openAssetEditModal,
  descargarQrActivoSeleccionado,
  imprimirEtiquetaQrActivoSeleccionado,
  eliminarActivo,
  showQrScanner,
  qrScannerVideoRef,
  isQrScannerActive,
  isQrCameraSupported,
  qrScannerStatus,
  qrManualInput,
  isResolvingQr,
  resolveQrFromManualInput,
  importPreviewOpen,
  importPreviewFileName,
  importPreviewSummary,
  importPreviewLocalInvalidCount,
  importIssueRows,
  isApplyingImport,
  closeImportPreview,
  exportImportIssuesCsv,
  applyImportDraft,
  assetFormModal,
}) => {
  return (
    <>
      <div className="glass-panel bg-white/90 rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden">
        <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
          <h3 className="font-black font-['Outfit'] text-slate-800 uppercase tracking-tight text-xl">Activos IT</h3>
          <div className="grid grid-cols-1 min-[460px]:grid-cols-2 xl:flex items-stretch xl:items-center gap-3 w-full xl:w-auto">
            <input
              ref={inventoryImportInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => void handleImportInventory(event)}
            />
            <button
              disabled={!canEdit || isImportingInventory}
              onClick={() => inventoryImportInputRef.current?.click()}
              className="w-full xl:w-auto min-w-0 bg-slate-800 text-white px-5 py-3 sm:px-6 sm:py-4 rounded-2xl font-black text-[11px] uppercase leading-tight flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Upload size={16} /> {isImportingInventory ? 'Importando...' : 'Importar Excel'}
            </button>
            <button
              onClick={exportarInventarioFiltrado}
              className="w-full xl:w-auto min-w-0 bg-white border border-slate-200 text-slate-600 px-5 py-3 sm:px-6 sm:py-4 rounded-2xl font-black text-[11px] uppercase leading-tight flex items-center justify-center gap-2 hover:bg-slate-50"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <button
              onClick={() => {
                setQrManualInput('');
                setQrScannerStatus('Escanea un QR firmado (mtiqr1).');
                setShowQrScanner(true);
              }}
              className="w-full xl:w-auto min-w-0 bg-white border border-blue-200 text-blue-700 px-5 py-3 sm:px-6 sm:py-4 rounded-2xl font-black text-[11px] uppercase leading-tight flex items-center justify-center gap-2 hover:bg-blue-50"
            >
              <ScanLine size={16} /> Escanear QR
            </button>
            {canManageUsers && (
              <button
                disabled={activos.length === 0}
                onClick={() => void eliminarTodosActivos()}
                className="w-full xl:w-auto min-w-0 bg-white border border-red-200 text-red-600 px-5 py-3 sm:px-6 sm:py-4 rounded-2xl font-black text-[11px] uppercase leading-tight flex items-center justify-center gap-2 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={16} /> Vaciar Activos
              </button>
            )}
            <button
              disabled={!canEdit}
              onClick={() => openModal('activo')}
              className="w-full xl:w-auto min-w-0 bg-[#F58220] text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-black text-[11px] uppercase leading-tight flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={18} /> Nuevo Activo
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-50 bg-slate-50/40 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Con IP</p>
              <p className="text-2xl font-black text-slate-800">{activosConIp} <span className="text-sm text-slate-400">/ {activosEvaluablesIp}</span></p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Con MAC</p>
              <p className="text-2xl font-black text-slate-800">{activosConMac} <span className="text-sm text-slate-400">/ {activosEvaluablesMac}</span></p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sin Responsable</p>
              <p className="text-2xl font-black text-red-500">{activosSinResponsable} <span className="text-sm text-slate-400">/ {activosEvaluablesResponsable}</span></p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vida Util Alta (&gt;=4)</p>
              <p className="text-2xl font-black text-amber-500">{activosVidaAlta}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
            <select
              value={inventoryDepartmentFilter}
              onChange={(e) => setInventoryDepartmentFilter(e.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
            >
              <option value="TODOS">Todos los departamentos</option>
              {departamentoOptions.map((departamento) => (
                <option key={departamento} value={departamento}>{departamento}</option>
              ))}
            </select>
            <select
              value={inventoryEquipmentFilter}
              onChange={(e) => setInventoryEquipmentFilter(e.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
            >
              <option value="TODOS">Todos los equipos</option>
              {equipoOptions.map((equipo) => (
                <option key={equipo} value={equipo}>{equipo}</option>
              ))}
            </select>
            <select
              value={inventoryStatusFilter}
              onChange={(e) => setInventoryStatusFilter(e.target.value as 'TODOS' | EstadoActivo)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="Operativo">Operativo</option>
              <option value="Falla">Falla</option>
            </select>
            <select
              value={inventoryRiskFilter}
              onChange={(e) => setInventoryRiskFilter(e.target.value as InventoryRiskFilter)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
            >
              <option value="TODOS">Todos los riesgos</option>
              <option value="SIN_IP">Sin IP</option>
              <option value="SIN_MAC">Sin MAC</option>
              <option value="SIN_RESP">Sin responsable</option>
              <option value="DUP_RED">Duplicado de red</option>
              <option value="VIDA_ALTA">Vida Ãºtil &gt;= 4</option>
            </select>
            <select
              value={inventorySortField}
              onChange={(e) => setInventorySortField(e.target.value as InventorySortField)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
            >
              <option value="tag">Orden: Tag</option>
              <option value="tipo">Orden: Equipo</option>
              <option value="estado">Orden: Estado</option>
              <option value="responsable">Orden: Responsable</option>
              <option value="ubicacion">Orden: Ubicacion</option>
              <option value="aniosVida">Orden: Vida Ãºtil</option>
            </select>
            <select
              value={inventorySortDirection}
              onChange={(e) => setInventorySortDirection(e.target.value as InventorySortDirection)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
            <button
              onClick={() => {
                setInventoryDepartmentFilter('TODOS');
                setInventoryEquipmentFilter('TODOS');
                setInventoryStatusFilter('TODOS');
                setInventoryRiskFilter('TODOS');
                setInventorySortField('tag');
                setInventorySortDirection('asc');
                setSearchTerm('');
              }}
              className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              Limpiar Filtros
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyInventoryFocus('FALLA')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                inventoryStatusFilter === 'Falla' && inventoryRiskFilter === 'TODOS'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Solo Fallas ({activosEnFalla})
            </button>
            <button
              onClick={() => applyInventoryFocus('SIN_RESP')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                inventoryRiskFilter === 'SIN_RESP'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Sin Responsable ({activosSinResponsable})
            </button>
            <button
              onClick={() => applyInventoryFocus('DUP_RED')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                inventoryRiskFilter === 'DUP_RED'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Duplicados Red ({duplicateIpEntries.length + duplicateMacEntries.length})
            </button>
            <button
              onClick={() => applyInventoryFocus('VIDA_ALTA')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                inventoryRiskFilter === 'VIDA_ALTA'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Vida &gt;=4 ({activosVidaAlta})
            </button>
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-6">
                  <button
                    onClick={() => updateInventorySort('tag')}
                    className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                  >
                    TAG / Serial <span>{getInventorySortIndicator('tag')}</span>
                  </button>
                </th>
                <th className="px-6 py-6">
                  <button
                    onClick={() => updateInventorySort('tipo')}
                    className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                  >
                    Equipo <span>{getInventorySortIndicator('tipo')}</span>
                  </button>
                </th>
                <th className="px-6 py-6">Hardware</th>
                <th className="px-6 py-6">
                  <button
                    onClick={() => updateInventorySort('responsable')}
                    className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                  >
                    Red / Responsable <span>{getInventorySortIndicator('responsable')}</span>
                  </button>
                </th>
                <th className="px-6 py-6">
                  <button
                    onClick={() => updateInventorySort('ubicacion')}
                    className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                  >
                    Ubicacion <span>{getInventorySortIndicator('ubicacion')}</span>
                  </button>
                </th>
                <th className="px-6 py-6">
                  <button
                    onClick={() => updateInventorySort('estado')}
                    className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                  >
                    Estado <span>{getInventorySortIndicator('estado')}</span>
                  </button>
                </th>
                <th className="px-6 py-6 text-right">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedFilteredActivos.map((asset) => (
                <tr key={asset.id} onClick={() => setSelectedAsset(asset)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                  <td className="px-6 py-6">
                    <p className="font-black text-slate-800 uppercase text-sm">{asset.tag}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{asset.serial}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{asset.idInterno || 'SIN ID INTERNO'}</p>
                  </td>
                  <td className="px-6 py-6 text-xs">
                    <p className="font-black text-slate-700 uppercase">{asset.tipo}</p>
                    <p className="font-bold text-slate-500 uppercase">
                      {asset.marca}
                      {asset.modelo ? ` | ${asset.modelo}` : ''}
                    </p>
                  </td>
                  <td className="px-6 py-6 text-xs">
                    <p className="font-black text-slate-600 uppercase">
                      {asset.cpu || 'CPU N/D'} | {asset.ram ? `${asset.ram}${asset.ramTipo ? ` ${asset.ramTipo}` : ''}` : 'RAM N/D'}
                    </p>
                    <p className="font-bold text-slate-500 uppercase">
                      {asset.disco ? `${asset.disco}${asset.tipoDisco ? ` ${asset.tipoDisco}` : ''}` : 'DISCO N/D'}
                    </p>
                  </td>
                  <td className="px-6 py-6 text-xs">
                    <p className="font-black text-slate-600">{asset.ipAddress || 'IP N/D'} | {asset.macAddress || 'MAC N/D'}</p>
                    <p className="font-bold text-slate-500 uppercase">
                      {asset.responsable || 'SIN RESPONSABLE'}
                      {asset.departamento ? ` | ${asset.departamento}` : ''}
                    </p>
                  </td>
                  <td className="px-6 py-6 text-xs font-bold text-slate-500 uppercase">{asset.ubicacion}</td>
                  <td className="px-6 py-6">
                    <Badge variant={asset.estado}>{asset.estado}</Badge>
                    <p className="text-[10px] mt-2 text-slate-400 font-black uppercase">{asset.aniosVida || 'N/D'}</p>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex justify-end gap-3 items-center">
                      <button
                        disabled={!canEdit}
                        onClick={(event) => eliminarActivo(asset.id, event)}
                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all z-30 disabled:opacity-40"
                      >
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight className="text-slate-300" />
                    </div>
                  </td>
                </tr>
              ))}
              {sortedFilteredActivos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
                      <div className="w-20 h-20 mb-4 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner">
                        <span className="text-3xl">ðŸ“­</span>
                      </div>
                      <p className="font-black font-['Outfit'] uppercase tracking-tight text-slate-800 text-lg">El inventario se encuentra vacÃ­o</p>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-2">Intenta modificar o limpiar los filtros de bÃºsqueda superior.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AssetFormModal
        isOpen={assetFormModal.isOpen}
        title={assetFormModal.title}
        submitLabel={assetFormModal.submitLabel}
        formData={assetFormModal.formData}
        isSaving={assetFormModal.isSaving}
        canSubmit={assetFormModal.canSubmit}
        onClose={assetFormModal.onClose}
        onSubmit={assetFormModal.onSubmit}
        onChange={assetFormModal.onChange}
      />
      <ImportPreviewModal
        open={importPreviewOpen}
        fileName={importPreviewFileName}
        preview={importPreviewSummary}
        localInvalidCount={importPreviewLocalInvalidCount}
        issues={importIssueRows}
        isApplying={isApplyingImport}
        onClose={closeImportPreview}
        onExportIssues={exportImportIssuesCsv}
        onConfirm={applyImportDraft}
      />

      <QrScannerModal
        open={showQrScanner}
        videoRef={qrScannerVideoRef}
        isScannerActive={isQrScannerActive}
        isCameraSupported={isQrCameraSupported}
        scannerStatus={qrScannerStatus}
        manualInput={qrManualInput}
        isResolving={isResolvingQr}
        onClose={() => setShowQrScanner(false)}
        onManualInputChange={setQrManualInput}
        onResolve={resolveQrFromManualInput}
        onClear={() => setQrManualInput('')}
      />

      <AssetDetailModal
        asset={selectedAsset}
        canEdit={canEdit}
        selectedAssetQrLoading={selectedAssetQrLoading}
        selectedAssetQrMode={selectedAssetQrMode}
        selectedAssetQrIssuedAt={selectedAssetQrIssuedAt}
        effectiveSelectedAssetQrValue={effectiveSelectedAssetQrValue}
        LazyQRCodeCanvas={LazyQRCodeCanvas}
        buildAssetQrCanvasId={buildAssetQrCanvasId}
        formatDateTime={formatDateTime}
        onClose={() => setSelectedAsset(null)}
        onEdit={openAssetEditModal}
        onDownloadQr={descargarQrActivoSeleccionado}
        onPrintQr={imprimirEtiquetaQrActivoSeleccionado}
        onDeleteAsset={eliminarActivo}
      />
    </>
  );
};

export default InventoryView;
