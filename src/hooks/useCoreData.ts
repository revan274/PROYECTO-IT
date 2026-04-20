import { useAppStore } from '../store/useAppStore';

export function useCoreData() {
  const activos = useAppStore((state) => state.activos);
  const setActivos = useAppStore((state) => state.setActivos);
  const insumos = useAppStore((state) => state.insumos);
  const setInsumos = useAppStore((state) => state.setInsumos);
  const tickets = useAppStore((state) => state.tickets);
  const setTickets = useAppStore((state) => state.setTickets);
  const users = useAppStore((state) => state.users);
  const setUsers = useAppStore((state) => state.setUsers);
  const catalogos = useAppStore((state) => state.catalogos);
  const setCatalogos = useAppStore((state) => state.setCatalogos);
  const auditoria = useAppStore((state) => state.auditoria);
  const setAuditoria = useAppStore((state) => state.setAuditoria);

  return {
    activos,
    setActivos,
    insumos,
    setInsumos,
    tickets,
    setTickets,
    users,
    setUsers,
    catalogos,
    setCatalogos,
    auditoria,
    setAuditoria,
  };
}
