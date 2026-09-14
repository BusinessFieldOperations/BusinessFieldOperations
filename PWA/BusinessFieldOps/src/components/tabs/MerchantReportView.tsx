import { useEffect, useRef, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import 'mdui/components/button.js';
import 'mdui/components/divider.js';

import { supabase } from '../../lib/supabase';

type DetailItem = {
  product_id: number;
  salesfloor_inventory: number;
  stockroom_inventory: number;
  total_units: number;
  products?: { id: number; name: string; units_per_package?: number } | null;
};

export default function MerchantReportView({ reportId, onClose, isAdmin = false }: { reportId: number | null; onClose?: () => void; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [details, setDetails] = useState<DetailItem[]>([]);
  const [showScrollCta, setShowScrollCta] = useState(false);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!reportId) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('merchant_reports')
          .select(`
            id,
            submitted_at,
            salesman_name,
            zone,
            stablishment,
            client_id,
            merchant_id,
            clients ( id, name ),
            states ( id, name ),
            profiles:profiles!merchant_reports_merchant_id_fkey ( id, first_name, last_name, is_active ),
            merchant_report_details (
              product_id,
              salesfloor_inventory,
              stockroom_inventory,
              total_units,
              products ( id, name, units_per_package )
            )
          `)
          .eq('id', reportId)
          .single();

        if (error) throw error;
        if (!mounted) return;

        if (data) {
          setReport(data);
          const rawDetails = (data.merchant_report_details || []) as any[];
          setDetails(rawDetails.map((d) => ({
            product_id: d.product_id,
            salesfloor_inventory: d.salesfloor_inventory,
            stockroom_inventory: d.stockroom_inventory,
            total_units: d.total_units,
            products: d.products ?? null,
          })));
        }
      } catch (err: any) {
        console.error('Failed to load merchant report', err.message || err);
        setError(err.message || 'Failed to load merchant report');
      } finally {
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [reportId]);

  useEffect(() => {
    const updateOverflowState = () => {
      const wrapper = tableWrapperRef.current;
      if (!wrapper) {
        setShowScrollCta(false);
        return;
      }

      const hasOverflow = wrapper.scrollWidth > wrapper.clientWidth + 1;
      const isNearEnd = wrapper.scrollLeft + wrapper.clientWidth >= wrapper.scrollWidth - 2;
      setShowScrollCta(hasOverflow && !isNearEnd);
    };

    const wrapper = tableWrapperRef.current;
    updateOverflowState();
    window.addEventListener('resize', updateOverflowState);

    if (wrapper) {
      wrapper.addEventListener('scroll', updateOverflowState, { passive: true });
    }

    return () => {
      window.removeEventListener('resize', updateOverflowState);
      if (wrapper) {
        wrapper.removeEventListener('scroll', updateOverflowState);
      }
    };
  }, [details]);

  const handleScrollCta = () => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    const nextLeft = Math.min(wrapper.scrollLeft + wrapper.clientWidth * 0.75, wrapper.scrollWidth - wrapper.clientWidth);
    wrapper.scrollTo({ left: nextLeft, behavior: 'auto' });
  };

  if (!reportId) return null;

  return (
    <Fragment>
      <div class="dialog-panel">
        <div class="list-header">
          <h3>Merchant Report Details</h3>
          <mdui-button variant="outlined" icon="arrow_back" onClick={() => onClose ? onClose() : null}>Back</mdui-button>
        </div>

        {loading && <p>Loading merchant report details...</p>}
        {error && <div class="feedback-message error">{error}</div>}

        {report && (
          <div class="report-details">
            <div class="report-meta-grid">
                {isAdmin && (
                <div class="meta-row highlight-text">
                  <span class="meta-label">Employee</span>
                  <span class="meta-value employee-name-with-status">
                    <span>{report.profiles ? `${report.profiles.first_name} ${report.profiles.last_name}`.trim() : report.salesman_name}</span>
                    {report.profiles && report.profiles.is_active === false && <span class="status-highlight">No Active</span>}
                  </span>
                </div>
              )}
              <div class="meta-row">
                <span class="meta-label">Establishment</span>
                <span class="meta-value">{report.stablishment}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Date</span>
                <span class="meta-value">{new Date(report.submitted_at).toLocaleString()}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Salesman</span>
                <span class="meta-value">{report.salesman_name}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Client</span>
                <span class="meta-value">{report.clients?.name || report.client_id || 'Unknown'}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">State</span>
                <span class="meta-value">{report.states?.name || ''}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Zone</span>
                <span class="meta-value">{report.zone}</span>
              </div>
            </div>

            <mdui-divider></mdui-divider>

            <div class="report-section">
              <h4>Inventory Overview</h4>

              {details.length === 0 ? (
                <p class="info-message">No product details recorded for this merchant report.</p>
              ) : (
                <div class="report-table-shell">
                  <div class="report-table-wrapper" ref={tableWrapperRef}>
                    <div class="inventory-table" role="table" aria-label="Merchant inventory table">
                      <div class="inventory-row inventory-head" role="row">
                        <div role="columnheader">Product</div>
                        <div role="columnheader">Units/Package</div>
                        <div role="columnheader">Salesfloor</div>
                        <div role="columnheader">Stockroom</div>
                        <div role="columnheader">Total</div>
                      </div>
                      {details.map((d) => (
                        <div class="inventory-row" role="row" key={d.product_id}>
                          <div role="cell">{d.products?.name || `#${d.product_id}`}</div>
                          <div role="cell">{d.products?.units_per_package ?? '-'}</div>
                          <div role="cell">{d.salesfloor_inventory}</div>
                          <div role="cell">{d.stockroom_inventory}</div>
                          <div role="cell">{d.total_units}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {showScrollCta && (
                    <mdui-button-icon
                      class="report-scroll-cta"
                      variant="filled"
                      icon="chevron_right"
                      onClick={handleScrollCta}
                      aria-label="Scroll merchant report table"
                    >
                    </mdui-button-icon>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
}
