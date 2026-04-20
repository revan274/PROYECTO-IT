import { useCallback, useMemo, useState } from 'react';
import type {
  Activo,
  AssetRiskSummary,
  EstadoActivo,
  FormDataState,
  ImportDraftState,
  Insumo,
  InsumoErrors,
  InsumoField,
  InsumoTouchedState,
  InventoryRiskFilter,
  InventorySortDirection,
  InventorySortField,
  ModalType,
  SupplyAuditMovement,
  SupplyStatusFilter,
} from '../types/app';
import { createEmptyInsumoTouched } from '../utils/app';
import { normalizeForCompare } from '../utils/format';

interface UseInventoryUiStateOptions {
  insumos: Insumo[];
}

export function useInventoryUiState({ insumos }: UseInventoryUiStateOptions) {
  const [showModal, setShowModal] = useState<ModalType>(null);
  const [selectedAsset, setSelectedAsset] = useState<Activo | null>(null);
  const [selectedSupplyHistoryItem, setSelectedSupplyHistoryItem] = useState<Insumo | null>(null);
  const [selectedSupplyHistoryRemoteMovements, setSelectedSupplyHistoryRemoteMovements] = useState<SupplyAuditMovement[] | null>(null);

  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScannerStatus, setQrScannerStatus] = useState('Escanea un QR firmado (mtiqr1).');
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const [isResolvingQr, setIsResolvingQr] = useState(false);
  const [qrManualInput, setQrManualInput] = useState('');

  const [selectedAssetQrValue, setSelectedAssetQrValue] = useState('');
  const [selectedAssetQrMode, setSelectedAssetQrMode] = useState<'signed' | 'unavailable'>('unavailable');
  const [selectedAssetQrIssuedAt, setSelectedAssetQrIssuedAt] = useState('');
  const [selectedAssetQrLoading, setSelectedAssetQrLoading] = useState(false);

  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingInsumoId, setEditingInsumoId] = useState<number | null>(null);
  const [isModalSaving, setIsModalSaving] = useState(false);

  const [formData, setFormData] = useState<FormDataState>({});
  const [insumoTouched, setInsumoTouched] = useState<InsumoTouchedState>(() => createEmptyInsumoTouched());

  const [supplyStockDrafts, setSupplyStockDrafts] = useState<Record<number, string>>({});

  const [isImportingInventory, setIsImportingInventory] = useState(false);
  const [inventoryDepartmentFilter, setInventoryDepartmentFilter] = useState('TODOS');
  const [inventoryEquipmentFilter, setInventoryEquipmentFilter] = useState('TODOS');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'TODOS' | EstadoActivo>('TODOS');
  const [inventoryRiskFilter, setInventoryRiskFilter] = useState<InventoryRiskFilter>('TODOS');
  const [inventorySortField, setInventorySortField] = useState<InventorySortField>('tag');
  const [inventorySortDirection, setInventorySortDirection] = useState<InventorySortDirection>('asc');

  const [supplySearchTerm, setSupplySearchTerm] = useState('');
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<string>('TODAS');
  const [supplyStatusFilter, setSupplyStatusFilter] = useState<SupplyStatusFilter>('TODOS');

  const [importDraft, setImportDraft] = useState<ImportDraftState | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  const [assetRiskSummary, setAssetRiskSummary] = useState<AssetRiskSummary | null>(null);

  const markInsumoTouched = useCallback((field: InsumoField) => {
    setInsumoTouched((prev) => {
      if (prev[field]) return prev;
      return { ...prev, [field]: true };
    });
  }, []);

  const insumoFormValidation = useMemo(() => {
    const nombre = String(formData.nombre || '').trim();
    const unidad = String(formData.unidad || '').trim();
    const categoria = String(formData.categoria || '').trim().toUpperCase();
    const stockInput = String(formData.stock ?? '').trim();
    const minInput = String(formData.min ?? '').trim();
    const errors: InsumoErrors = {};
    let stock: number | null = null;
    let min: number | null = null;

    if (!nombre) errors.nombre = 'Nombre requerido.';
    if (!unidad) errors.unidad = 'Unidad requerida.';
    if (!categoria) errors.categoria = 'Selecciona una categoría.';

    if (!stockInput) {
      errors.stock = 'Stock requerido.';
    } else {
      const value = Number(stockInput);
      if (!Number.isFinite(value)) errors.stock = 'Stock debe ser numérico.';
      else if (value < 0) errors.stock = 'Stock debe ser mayor o igual a 0.';
      else if (!Number.isInteger(value)) errors.stock = 'Stock debe ser entero.';
      else stock = Math.trunc(value);
    }

    if (!minInput) {
      errors.min = 'Mínimo requerido.';
    } else {
      const value = Number(minInput);
      if (!Number.isFinite(value)) errors.min = 'Mínimo debe ser numérico.';
      else if (value < 0) errors.min = 'Mínimo debe ser mayor o igual a 0.';
      else if (!Number.isInteger(value)) errors.min = 'Mínimo debe ser entero.';
      else min = Math.trunc(value);
    }

    if (stock !== null && min !== null && min > stock) {
      errors.min = 'El mínimo no puede ser mayor al stock inicial.';
    }

    if (!errors.nombre && nombre && categoria) {
      const duplicateLocal = insumos.some(
        (item) =>
          item.id !== editingInsumoId
          && normalizeForCompare(item.nombre) === normalizeForCompare(nombre)
          && normalizeForCompare(item.categoria) === normalizeForCompare(categoria),
      );
      if (duplicateLocal) errors.nombre = 'Ya existe un insumo con ese nombre y categoría.';
    }

    const firstError = errors.nombre || errors.unidad || errors.stock || errors.min || errors.categoria || '';
    return {
      nombre,
      unidad,
      categoria,
      stock,
      min,
      errors,
      firstError,
      isValid: !firstError,
    };
  }, [editingInsumoId, formData.categoria, formData.min, formData.nombre, formData.stock, formData.unidad, insumos]);

  return {
    showModal, setShowModal,
    selectedAsset, setSelectedAsset,
    selectedSupplyHistoryItem, setSelectedSupplyHistoryItem,
    selectedSupplyHistoryRemoteMovements, setSelectedSupplyHistoryRemoteMovements,
    showQrScanner, setShowQrScanner,
    qrScannerStatus, setQrScannerStatus,
    isQrScannerActive, setIsQrScannerActive,
    isResolvingQr, setIsResolvingQr,
    qrManualInput, setQrManualInput,
    selectedAssetQrValue, setSelectedAssetQrValue,
    selectedAssetQrMode, setSelectedAssetQrMode,
    selectedAssetQrIssuedAt, setSelectedAssetQrIssuedAt,
    selectedAssetQrLoading, setSelectedAssetQrLoading,
    editingAssetId, setEditingAssetId,
    editingInsumoId, setEditingInsumoId,
    isModalSaving, setIsModalSaving,
    formData, setFormData,
    insumoTouched, setInsumoTouched,
    markInsumoTouched,
    insumoFormValidation,
    supplyStockDrafts, setSupplyStockDrafts,
    isImportingInventory, setIsImportingInventory,
    inventoryDepartmentFilter, setInventoryDepartmentFilter,
    inventoryEquipmentFilter, setInventoryEquipmentFilter,
    inventoryStatusFilter, setInventoryStatusFilter,
    inventoryRiskFilter, setInventoryRiskFilter,
    inventorySortField, setInventorySortField,
    inventorySortDirection, setInventorySortDirection,
    supplySearchTerm, setSupplySearchTerm,
    supplyCategoryFilter, setSupplyCategoryFilter,
    supplyStatusFilter, setSupplyStatusFilter,
    importDraft, setImportDraft,
    isApplyingImport, setIsApplyingImport,
    assetRiskSummary, setAssetRiskSummary,
  };
}
