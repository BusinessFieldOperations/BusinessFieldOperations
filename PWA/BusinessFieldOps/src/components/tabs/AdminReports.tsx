import {useEffect, useState} from 'preact/hooks';
import {Fragment} from 'preact';
import 'mdui/components/avatar.js';
import 'mdui/components/badge.js';
import 'mdui/components/button-icon.js';

import MerchantReportView from './MerchantReportView';
import PromoterReportView from './PromoterReportView';
import {supabase} from '../../lib/supabase';

type ReportRole = 'merchant' | 'promoter';

interface ReportItem {
  id: number;
  submitted_at: string;
  salesman_name: string;
  role: ReportRole;
  zone: string;
  stablishment: string;
  clients: {name: string} | null;
  states: {name: string} | null;
  profiles?: {
    first_name: string;
    last_name: string;
    is_active?: boolean | null;
  } | null;
}

const PAGE_SIZE = 10;

export default function AdminReports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<{
    id: number;
    role: ReportRole;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const reloadReports = async (
    targetPage = page,
    targetSearch = searchTerm,
  ) => {
    setLoading(true);

    try {
      const trimmed = targetSearch.trim();
      const offset = (targetPage - 1) * PAGE_SIZE;
      const merchantSelect = `
        id,
        submitted_at,
        salesman_name,
        zone,
        stablishment,
        merchant_id,
        clients ( name ),
        states ( name ),
        profiles:profiles!merchant_reports_merchant_id_fkey ( first_name, last_name, is_active )
      `;
      const promoterSelect = `
        id,
        submitted_at,
        salesman_name,
        zone,
        stablishment,
        promoter_id,
        clients ( name ),
        states ( name ),
        profiles:profiles!promoter_reports_promoter_id_fkey ( first_name, last_name, is_active )
      `;

      let merchantQuery = supabase
        .from('merchant_reports')
        .select(merchantSelect, {count: 'exact'});
      let promoterQuery = supabase
        .from('promoter_reports')
        .select(promoterSelect, {count: 'exact'});

      if (trimmed) {
        const filter = `stablishment.ilike.%${trimmed}%,salesman_name.ilike.%${trimmed}%,zone.ilike.%${trimmed}%,submitted_at::text.ilike.%${trimmed}%,clients.name.ilike.%${trimmed}%,profiles.first_name.ilike.%${trimmed}%,profiles.last_name.ilike.%${trimmed}%`;
        merchantQuery = merchantQuery.or(filter);
        promoterQuery = promoterQuery.or(filter);
      }

      const [merchantResult, promoterResult] = await Promise.all([
        merchantQuery.order('submitted_at', {ascending: false}).range(offset, offset + PAGE_SIZE - 1),
        promoterQuery.order('submitted_at', {ascending: false}).range(offset, offset + PAGE_SIZE - 1),
      ]);

      if (merchantResult.error) throw merchantResult.error;
      if (promoterResult.error) throw promoterResult.error;

      const mergedReports: ReportItem[] = [
        ...(merchantResult.data ?? []).map((report: any) => ({
          ...report,
          role: 'merchant' as const,
          clients: report.clients ?? null,
          states: report.states ?? null,
          profiles: report.profiles ?? null,
        })),
        ...(promoterResult.data ?? []).map((report: any) => ({
          ...report,
          role: 'promoter' as const,
          clients: report.clients ?? null,
          states: report.states ?? null,
          profiles: report.profiles ?? null,
        })),
      ].sort(
        (left, right) =>
          new Date(right.submitted_at).getTime() -
          new Date(left.submitted_at).getTime(),
      );

      const totalCount =
        (merchantResult.count ?? 0) + (promoterResult.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

      setReports(mergedReports.slice(0, PAGE_SIZE));
      setPageCount(totalPages);
      if (targetPage > totalPages) {
        setPage(totalPages);
      }
    } catch (error: any) {
      console.error('Failed to load admin reports', error.message || error);
      setReports([]);
      setPageCount(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    void reloadReports(page, searchTerm);
  }, [page, searchTerm]);

  return (
    <Fragment>
      <div class="list-header">
        <h3>All Reports</h3>

        <div class="list-header-actions">
          {showSearch && (
            <input
              class="list-search-input"
              type="text"
              value={searchTerm}
              placeholder="Search reports"
              onInput={event => {
                setSearchTerm((event.target as HTMLInputElement).value);
              }}
            />
          )}

          <mdui-button-icon
            icon="search"
            variant="filled"
            onClick={() => setShowSearch(value => !value)}
          ></mdui-button-icon>
        </div>
      </div>

      {loading && <p>Loading reports...</p>}

      <div class="user-list">
        {reports.map(report => {
          const employeeName = report.profiles
            ? `${report.profiles.first_name} ${report.profiles.last_name}`.trim()
            : report.salesman_name;
          const isEmployeeActive = report.profiles
            ? Boolean(report.profiles.is_active)
            : true;

          return (
            <div class="user-box" key={`${report.role}-${report.id}`}>
              <mdui-avatar icon="receipt_long"></mdui-avatar>

              <div>
                <div class="report-employee-row">
                  <span>{employeeName}</span>
                  {!isEmployeeActive && (
                    <span class="status-highlight">No Active</span>
                  )}
                </div>
                <div>
                  {new Date(report.submitted_at).toLocaleDateString()} •{' '}
                  {new Date(report.submitted_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}{' '}
                  • {report.role.charAt(0).toUpperCase() + report.role.slice(1)}
                </div>
                <mdui-badge>
                  {report.clients?.name || 'Unknown Client'}
                </mdui-badge>
              </div>

              <div>
                <mdui-button-icon
                  icon="visibility"
                  variant="filled"
                  onClick={() =>
                    setSelectedReport({id: report.id, role: report.role})
                  }
                ></mdui-button-icon>
              </div>
            </div>
          );
        })}

        {!loading && reports.length === 0 && (
          <div class="info-message">No reports found for this account.</div>
        )}
      </div>

      {!loading && reports.length > 0 && (
        <div class="pagination-row">
          <mdui-button-icon
            icon="chevron_left"
            variant="outlined"
            disabled={page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}
          ></mdui-button-icon>
          <mdui-button-icon
            icon="chevron_right"
            variant="outlined"
            disabled={page >= pageCount}
            onClick={() => setPage(value => Math.min(pageCount, value + 1))}
          ></mdui-button-icon>
        </div>
      )}

      {selectedReport && (
        <div class="dialog-panel">
          {selectedReport.role === 'merchant' ? (
            <MerchantReportView
              reportId={selectedReport.id}
              isAdmin={true}
              onClose={() => setSelectedReport(null)}
            />
          ) : (
            <PromoterReportView
              reportId={selectedReport.id}
              isAdmin={true}
              onClose={() => setSelectedReport(null)}
            />
          )}
        </div>
      )}
    </Fragment>
  );
}
