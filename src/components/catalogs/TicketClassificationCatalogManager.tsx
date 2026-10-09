import { useEffect, useId, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import type { TicketAreaCatalogItem, TicketCategoryCatalogItem } from '../../types/app';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface TicketClassificationCatalogManagerProps {
  areas: TicketAreaCatalogItem[];
  categorias: TicketCategoryCatalogItem[];
  onSave: (areas: TicketAreaCatalogItem[], categorias: TicketCategoryCatalogItem[]) => Promise<boolean>;
}

function catalogId(prefix: 'AREA' | 'CAT', name: string, usedIds: Set<string>): string {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'NUEVO';
  let candidate = `${prefix}_${base}`;
  let suffix = 2;
  while (usedIds.has(candidate)) candidate = `${prefix}_${base}_${suffix++}`;
  return candidate;
}

export function TicketClassificationCatalogManager({
  areas,
  categorias,
  onSave,
}: TicketClassificationCatalogManagerProps) {
  const [areaDrafts, setAreaDrafts] = useState(areas);
  const [categoryDrafts, setCategoryDrafts] = useState(categorias);
  const [newAreaName, setNewAreaName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryAreaId, setNewCategoryAreaId] = useState(areas[0]?.id || '');
  const [isSaving, setIsSaving] = useState(false);
  const newAreaId = useId();
  const newCategoryId = useId();
  const newCategoryAreaSelectId = useId();

  useEffect(() => {
    setAreaDrafts(areas);
    setCategoryDrafts(categorias);
  }, [areas, categorias]);

  useEffect(() => {
    if (areaDrafts.some((area) => area.id === newCategoryAreaId)) return;
    setNewCategoryAreaId(areaDrafts[0]?.id || '');
  }, [areaDrafts, newCategoryAreaId]);

  const categoriesByArea = useMemo(() => {
    const groups = new Map<string, TicketCategoryCatalogItem[]>();
    for (const category of categoryDrafts) {
      groups.set(category.areaId, [...(groups.get(category.areaId) || []), category]);
    }
    return groups;
  }, [categoryDrafts]);

  const addArea = () => {
    const nombre = newAreaName.trim();
    if (!nombre) return;
    const id = catalogId('AREA', nombre, new Set(areaDrafts.map((item) => item.id)));
    setAreaDrafts((current) => [...current, { id, nombre, activo: true }]);
    setNewAreaName('');
  };

  const addCategory = () => {
    const nombre = newCategoryName.trim();
    if (!nombre || !newCategoryAreaId) return;
    const id = catalogId('CAT', nombre, new Set(categoryDrafts.map((item) => item.id)));
    setCategoryDrafts((current) => [...current, { id, areaId: newCategoryAreaId, nombre, activo: true }]);
    setNewCategoryName('');
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(areaDrafts, categoryDrafts);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-xl md:p-8">
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Configuración de tickets</p>
        <h4 className="font-['Outfit'] text-xl font-black uppercase tracking-tight text-slate-800">Áreas y categorías</h4>
        <p className="mt-1 text-xs text-slate-500">Desactiva valores históricos; elimínalos solo cuando ningún ticket los use.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <Field htmlFor={newAreaId} label="Nueva área">
            <div className="flex gap-2">
              <Input id={newAreaId} value={newAreaName} onChange={(event) => setNewAreaName(event.target.value)} className="min-w-0 flex-1" />
              <Button variant="secondary" size="icon" aria-label="Agregar área" onClick={addArea} disabled={!newAreaName.trim()}><Plus size={16} /></Button>
            </div>
          </Field>
          {areaDrafts.map((area) => {
            const hasCategories = (categoriesByArea.get(area.id)?.length || 0) > 0;
            return (
              <div key={area.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-slate-100 p-3 sm:flex">
                <Input
                  aria-label={`Nombre del área ${area.nombre}`}
                  value={area.nombre}
                  onChange={(event) => setAreaDrafts((current) => current.map((item) => item.id === area.id ? { ...item, nombre: event.target.value } : item))}
                  className="col-span-2 min-w-0 flex-1 sm:col-span-1"
                />
                <label htmlFor={`catalog-area-active-${area.id}`} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                  <Input
                    id={`catalog-area-active-${area.id}`}
                    type="checkbox"
                    checked={area.activo !== false}
                    onChange={(event) => setAreaDrafts((current) => current.map((item) => item.id === area.id ? { ...item, activo: event.target.checked } : item))}
                    className="h-4 w-4"
                  />
                  Activa
                </label>
                <Button
                  variant="danger"
                  size="icon"
                  aria-label={`Eliminar área ${area.nombre}`}
                  title={hasCategories ? 'Elimina primero sus categorías' : 'Eliminar área'}
                  disabled={hasCategories || areaDrafts.length <= 1}
                  onClick={() => setAreaDrafts((current) => current.filter((item) => item.id !== area.id))}
                ><Trash2 size={15} /></Button>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Field htmlFor={newCategoryId} label="Nueva categoría">
              <Input id={newCategoryId} value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
            </Field>
            <Field htmlFor={newCategoryAreaSelectId} label="Área">
              <Select id={newCategoryAreaSelectId} value={newCategoryAreaId} onChange={(event) => setNewCategoryAreaId(event.target.value)}>
                {areaDrafts.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
              </Select>
            </Field>
            <Button variant="secondary" size="icon" className="self-end" aria-label="Agregar categoría" onClick={addCategory} disabled={!newCategoryName.trim() || !newCategoryAreaId}><Plus size={16} /></Button>
          </div>
          {categoryDrafts.map((category) => (
            <div key={category.id} className="grid items-center gap-2 rounded-2xl border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto_auto]">
              <Input
                aria-label={`Nombre de la categoría ${category.nombre}`}
                value={category.nombre}
                onChange={(event) => setCategoryDrafts((current) => current.map((item) => item.id === category.id ? { ...item, nombre: event.target.value } : item))}
              />
              <Select
                aria-label={`Área de la categoría ${category.nombre}`}
                value={category.areaId}
                onChange={(event) => setCategoryDrafts((current) => current.map((item) => item.id === category.id ? { ...item, areaId: event.target.value } : item))}
              >
                {areaDrafts.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
              </Select>
              <label htmlFor={`catalog-category-active-${category.id}`} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                <Input
                  id={`catalog-category-active-${category.id}`}
                  type="checkbox"
                  checked={category.activo !== false}
                  onChange={(event) => setCategoryDrafts((current) => current.map((item) => item.id === category.id ? { ...item, activo: event.target.checked } : item))}
                  className="h-4 w-4"
                />
                Activa
              </label>
              <Button
                variant="danger"
                size="icon"
                aria-label={`Eliminar categoría ${category.nombre}`}
                disabled={categoryDrafts.length <= 1}
                onClick={() => setCategoryDrafts((current) => current.filter((item) => item.id !== category.id))}
              ><Trash2 size={15} /></Button>
            </div>
          ))}
        </div>
      </div>

      <Button variant="primary" size="md" className="mt-6" disabled={isSaving} onClick={() => void save()}>
        <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar catálogos'}
      </Button>
    </section>
  );
}
