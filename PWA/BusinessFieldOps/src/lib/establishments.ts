import {db, type ReferenceRow} from '@/lib/offline/db';
import {useLiveQuery} from '@/lib/offline/useLiveQuery';

/** An establishment ready to display, from the local copy of the data. */
export interface EstablishmentInfo {
  id: string;
  /** Legal name plus branch, e.g. "Acme - Downtown". */
  name: string;
  location: string;
  stateId: number;
  stateName: string;
}

/** Shown when the legal identity of an establishment is not synced yet. */
const UNKNOWN_NAME = '—';

async function describe(
  establishments: readonly ReferenceRow<'establishment'>[],
): Promise<EstablishmentInfo[]> {
  const [identities, states] = await Promise.all([
    db
      .reference('legal_identity')
      .bulkGet([
        ...new Set(establishments.map(item => item.legal_identity_id)),
      ]),
    db.reference('states').toArray(),
  ]);

  const identityNames = new Map<string, string>();

  for (const identity of identities) {
    if (identity) {
      identityNames.set(identity.id, identity.name);
    }
  }

  const stateNames = new Map(states.map(state => [state.id, state.name]));

  return establishments.map(item => ({
    id: item.id,
    name:
      [identityNames.get(item.legal_identity_id), item.branch_name]
        .filter(Boolean)
        .join(' - ') || UNKNOWN_NAME,
    location: item.location,
    stateId: item.state_id,
    stateName: stateNames.get(item.state_id) ?? '',
  }));
}

/** The given establishments by id. Ids that are not in the local data are skipped. */
export async function getEstablishmentInfos(
  ids: readonly string[],
): Promise<Map<string, EstablishmentInfo>> {
  const rows = await db.reference('establishment').bulkGet([...new Set(ids)]);
  const found = rows.filter(
    (row): row is ReferenceRow<'establishment'> => row !== undefined,
  );

  return new Map((await describe(found)).map(info => [info.id, info]));
}

/** Every establishment, by name (for pickers). */
export async function getEstablishments(): Promise<EstablishmentInfo[]> {
  const rows = await db.reference('establishment').toArray();

  return (await describe(rows)).sort(
    (first, second) =>
      first.name.localeCompare(second.name) ||
      first.location.localeCompare(second.location),
  );
}

/** `undefined` until the first read ends; follows the local data. */
export function useEstablishments(): EstablishmentInfo[] | undefined {
  return useLiveQuery(() => getEstablishments(), []);
}
