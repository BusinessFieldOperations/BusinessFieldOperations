import {db} from '@/lib/offline/db';

/** Client id -> display name (legal identity name), from the local copy. */
export async function getClientNames(): Promise<Map<string, string>> {
  const [clients, identities] = await Promise.all([
    db.reference('clients').toArray(),
    db.reference('legal_identity').toArray(),
  ]);
  const identityNames = new Map(
    identities.map(identity => [identity.id, identity.name]),
  );

  return new Map(
    clients.map(client => [
      client.id,
      identityNames.get(client.legal_identity_id) ?? '',
    ]),
  );
}
