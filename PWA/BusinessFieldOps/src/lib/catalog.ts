import {db, useLiveQuery, type ReferenceRow} from '@/lib/offline';

export type CatalogProduct = ReferenceRow<'products'>;

/** A client that can be chosen for a report. */
export interface ClientOption {
  id: string;
  name: string;
}

/** Active clients that operate in the given state, by name. */
export async function getClientOptions(
  stateId: number | null,
): Promise<ClientOption[]> {
  if (stateId === null) {
    return [];
  }

  const links = await db
    .reference('client_states')
    .where('state_id')
    .equals(stateId)
    .toArray();
  const clients = await db
    .reference('clients')
    .bulkGet(links.map(link => link.client_id));
  const active = clients.filter(
    (client): client is ReferenceRow<'clients'> => client?.is_active === true,
  );
  const identities = await db
    .reference('legal_identity')
    .bulkGet(active.map(client => client.legal_identity_id));
  const names = new Map<string, string>();

  for (const identity of identities) {
    if (identity) {
      names.set(identity.id, identity.name);
    }
  }

  return active
    .map(client => ({
      id: client.id,
      name: names.get(client.legal_identity_id) ?? '',
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

/**
 * Active products of one client that the establishment carries, by name.
 * (A product always belongs to a client, so the report's client narrows it.)
 */
export async function getCatalog(
  establishmentId: string,
  clientId: string,
): Promise<CatalogProduct[]> {
  const links = await db
    .reference('product_establishment')
    .where('establishment_id')
    .equals(establishmentId)
    .toArray();
  const products = await db
    .reference('products')
    .bulkGet(links.map(link => link.product_id));

  return products
    .filter(
      (product): product is CatalogProduct =>
        product !== undefined &&
        product.is_active &&
        product.client_id === clientId,
    )
    .sort((first, second) => first.name.localeCompare(second.name));
}

/** `undefined` until the first read ends; follows the local data. */
export function useClientOptions(
  stateId: number | null,
): ClientOption[] | undefined {
  return useLiveQuery(() => getClientOptions(stateId), [stateId]);
}

/** Products a report of this client can include. */
export function useCatalog(
  establishmentId: string | undefined,
  clientId: string | null,
): CatalogProduct[] | undefined {
  return useLiveQuery(
    async () =>
      establishmentId && clientId ? getCatalog(establishmentId, clientId) : [],
    [establishmentId, clientId],
  );
}

/** The client picked by the user, or the only one there is. */
export function resolveClientId(
  chosen: string | null,
  options: readonly ClientOption[] | undefined,
): string | null {
  return chosen ?? (options?.length === 1 ? options[0].id : null);
}
