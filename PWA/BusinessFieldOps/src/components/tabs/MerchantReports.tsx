import { useEffect, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import 'mdui/components/avatar.js';
import 'mdui/components/badge.js';
import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/divider.js';

import MerchantReportCreation from './MerchantReportCreation.tsx';
import MerchantReportView from './MerchantReportView.tsx';
import { supabase } from '../../lib/supabase';

interface ReportItem {
  id: number;
  submitted_at: string;
  salesman_name: string;
  zone: string;
  stablishment: string;
  clients: { name: string } | null;
  states: { name: string } | null;
}

export default function MerchantReports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createFeedbackMsg, setCreateFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const reloadReports = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('merchant_reports')
      .select(`
        id,
        submitted_at,
        salesman_name,
        zone,
        stablishment,
        clients ( name ),
        states ( name )
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Failed to load merchant reports', error.message);
      setReports([]);
    } else if (data) {
      setReports(data as any as ReportItem[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await reloadReports();
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Fragment>
      <div class="list-header">
        <h3>Merchant Reports</h3>
        {!showCreate && (
          <mdui-button variant="filled" icon="add" onClick={() => setShowCreate(true)}>Create Report</mdui-button>
        )}
      </div>

      {showCreate ? (
        <div class="dialog-panel">
          <mdui-button variant="outlined" icon="arrow_back" onClick={() => setShowCreate(false)}>
            Back to list
          </mdui-button>
          <MerchantReportCreation onCreated={(msg) => {
            setCreateFeedbackMsg(msg);
            setShowCreate(false);
            reloadReports();
          }} />
        </div>
      ) : null}

      {!showCreate && createFeedbackMsg && (
        <div class={`feedback-message ${createFeedbackMsg.type === 'error' ? 'error' : 'success'}`}>
          {createFeedbackMsg.text}
        </div>
      )}

      {!showCreate && loading && <p>Loading reports...</p>}

      {!showCreate && (
        <div class="user-list">
          {reports.map((report) => (
            <div class="user-box">
              <mdui-avatar icon="receipt_long"></mdui-avatar>

              <div>
                <div>{report.stablishment}</div>
                <div>
                  {new Date(report.submitted_at).toLocaleDateString()} • {new Date(report.submitted_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })} • {report.zone} • {report.salesman_name}
                </div>
                <mdui-badge>{report.clients?.name || 'Unknown Client'}</mdui-badge>
              </div>

              <div>
                <mdui-button-icon icon="visibility" variant="filled" onClick={() => setSelectedReportId(report.id)}></mdui-button-icon>
              </div>
            </div>
          ))}

          {!loading && reports.length === 0 && (
            <div class="info-message">
              No reports found. You haven't submitted any merchant reports yet.
            </div>
          )}
        </div>
      )}
      {selectedReportId && (
        <div class="dialog-panel">
          <MerchantReportView reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
        </div>
      )}
    </Fragment>
  );
}