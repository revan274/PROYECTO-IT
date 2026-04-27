import { useState } from 'react';
import type {
  ReportAttentionFilter,
  ReportFilterPreset,
  ReportPriorityFilter,
  ReportStateFilter,
} from '../types/app';
import {
  buildCurrentMonthInputValue,
  buildDefaultReportFilterSnapshot,
} from '../utils/app';
import { 
  TRAVEL_DEFAULT_AUTHORIZER, 
  TRAVEL_DEFAULT_DEPARTMENT, 
  TRAVEL_DEFAULT_FINANCE, 
  TRAVEL_DEFAULT_FUEL_EFFICIENCY 
} from '../constants/app';

export function useReportState() {
  const [reportDateFrom, setReportDateFrom] = useState(() => buildDefaultReportFilterSnapshot().dateFrom);
  const [reportDateTo, setReportDateTo] = useState(() => buildDefaultReportFilterSnapshot().dateTo);
  const [reportBranchFilter, setReportBranchFilter] = useState(() => buildDefaultReportFilterSnapshot().branch);
  const [reportAreaFilter, setReportAreaFilter] = useState(() => buildDefaultReportFilterSnapshot().area);
  const [reportStateFilter, setReportStateFilter] = useState<ReportStateFilter>(() => buildDefaultReportFilterSnapshot().state);
  const [reportPriorityFilter, setReportPriorityFilter] = useState<ReportPriorityFilter>(() => buildDefaultReportFilterSnapshot().priority);
  const [reportAttentionFilter, setReportAttentionFilter] = useState<ReportAttentionFilter>(() => buildDefaultReportFilterSnapshot().attention);
  const [reportTechnicianFilter, setReportTechnicianFilter] = useState(() => buildDefaultReportFilterSnapshot().technician);
  const [reportPresetName, setReportPresetName] = useState('');
  const [reportFilterPresets, setReportFilterPresets] = useState<ReportFilterPreset[]>([]);
  
  const [travelReportMonth, setTravelReportMonth] = useState(() => buildCurrentMonthInputValue());
  const [travelReportTechnician, setTravelReportTechnician] = useState('TODOS');
  const [travelReportName, setTravelReportName] = useState('');
  const [travelReportDepartment, setTravelReportDepartment] = useState(TRAVEL_DEFAULT_DEPARTMENT);
  const [travelReportFuelEfficiency, setTravelReportFuelEfficiency] = useState(String(TRAVEL_DEFAULT_FUEL_EFFICIENCY));
  const [travelReportAuthorizer, setTravelReportAuthorizer] = useState(TRAVEL_DEFAULT_AUTHORIZER);
  const [travelReportFinance, setTravelReportFinance] = useState(TRAVEL_DEFAULT_FINANCE);
  return {
    reportDateFrom, setReportDateFrom,
    reportDateTo, setReportDateTo,
    reportBranchFilter, setReportBranchFilter,
    reportAreaFilter, setReportAreaFilter,
    reportStateFilter, setReportStateFilter,
    reportPriorityFilter, setReportPriorityFilter,
    reportAttentionFilter, setReportAttentionFilter,
    reportTechnicianFilter, setReportTechnicianFilter,
    reportPresetName, setReportPresetName,
    reportFilterPresets, setReportFilterPresets,
    travelReportMonth, setTravelReportMonth,
    travelReportTechnician, setTravelReportTechnician,
    travelReportName, setTravelReportName,
    travelReportDepartment, setTravelReportDepartment,
    travelReportFuelEfficiency, setTravelReportFuelEfficiency,
    travelReportAuthorizer, setTravelReportAuthorizer,
    travelReportFinance, setTravelReportFinance,
  };
}
