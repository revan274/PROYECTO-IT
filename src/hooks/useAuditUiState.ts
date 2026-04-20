import { useState } from 'react';
import type { 
  AuditAlertsState, 
  AuditFiltersState, 
  AuditIntegrityState, 
  AuditPaginationState, 
  AuditSummaryState, 
  RegistroAuditoria 
} from '../types/app';
import { 
  buildDefaultAuditFilters, 
  buildDefaultAuditPagination 
} from '../utils/app';

export function useAuditUiState() {
  const [auditRemoteRows, setAuditRemoteRows] = useState<RegistroAuditoria[] | null>(null);
  const [reportAuditRowsRemote, setReportAuditRowsRemote] = useState<RegistroAuditoria[] | null>(null);
  const [auditFilters, setAuditFilters] = useState<AuditFiltersState>(() => buildDefaultAuditFilters());
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditPagination, setAuditPagination] = useState<AuditPaginationState>(() => buildDefaultAuditPagination(25));
  const [auditSummary, setAuditSummary] = useState<AuditSummaryState | null>(null);
  const [auditIntegrity, setAuditIntegrity] = useState<AuditIntegrityState | null>(null);
  const [auditAlerts, setAuditAlerts] = useState<AuditAlertsState | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  return {
    auditRemoteRows, setAuditRemoteRows,
    reportAuditRowsRemote, setReportAuditRowsRemote,
    auditFilters, setAuditFilters,
    auditPage, setAuditPage,
    auditPageSize, setAuditPageSize,
    auditPagination, setAuditPagination,
    auditSummary, setAuditSummary,
    auditIntegrity, setAuditIntegrity,
    auditAlerts, setAuditAlerts,
    isAuditLoading, setIsAuditLoading,
  };
}
