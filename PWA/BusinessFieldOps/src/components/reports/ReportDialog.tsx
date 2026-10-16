import type {JSX} from 'preact';

import {useAuth} from '@/lib/AuthContext';

import {MerchantReportDialog} from './MerchantReportDialog';
import {PromoterReportDialog} from './PromoterReportDialog';
import type {ReportDialogProps} from './ReportFrame';

/**
 * The report form of the signed-in user's role. Mounted only while
 * `?report=<draftId>` is in the URL: `key` gives every draft a fresh form.
 *
 * Needs `?task=<id>` too (it says what the report is about); without it the
 * form shows "task not available".
 */
export function ReportDialog({
  draftId,
  ...rest
}: Omit<ReportDialogProps, 'draftId'> & {
  draftId: string | null;
}): JSX.Element | null {
  const {profile} = useAuth();

  if (draftId === null || !profile) {
    return null;
  }

  if (profile.role === 'merchant') {
    return <MerchantReportDialog key={draftId} draftId={draftId} {...rest} />;
  }

  if (profile.role === 'promoter') {
    return <PromoterReportDialog key={draftId} draftId={draftId} {...rest} />;
  }

  return null;
}
