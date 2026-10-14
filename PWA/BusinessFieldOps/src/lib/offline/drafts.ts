import {db} from './db';
import type {Draft, OfflineKind} from './types';

/** Input of {@link saveDraft}. */
export interface SaveDraftInput<T> {
  /** Omit to create a new draft with a fresh id. */
  id?: string;
  kind: OfflineKind;
  ownerId: string;
  /** What the draft is about (e.g. a task id). Defaults to ''. */
  refId?: string;
  data: T;
}

/** Creates the draft, or updates it (keeping `createdAt`) if `id` exists. */
export async function saveDraft<T>({
  id = crypto.randomUUID(),
  kind,
  ownerId,
  refId = '',
  data,
}: SaveDraftInput<T>): Promise<Draft<T>> {
  return db.transaction('rw', db.drafts, async () => {
    const now = Date.now();
    const existing = await db.drafts.get(id);
    const draft: Draft<T> = {
      id,
      kind,
      ownerId,
      refId,
      data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await db.drafts.put(draft);

    return draft;
  });
}

export async function getDraft<T = unknown>(
  id: string,
): Promise<Draft<T> | undefined> {
  return (await db.drafts.get(id)) as Draft<T> | undefined;
}

/** The most recently edited draft of this user for that kind and refId. */
export async function findDraft<T = unknown>(
  ownerId: string,
  kind: OfflineKind,
  refId = '',
): Promise<Draft<T> | undefined> {
  const matches = await db.drafts
    .where('[ownerId+kind+refId]')
    .equals([ownerId, kind, refId])
    .sortBy('updatedAt');

  return matches[matches.length - 1] as Draft<T> | undefined;
}

/** Drafts of a user, newest first; optionally only one kind. */
export async function listDrafts(
  ownerId: string,
  kind?: OfflineKind,
): Promise<Draft[]> {
  const drafts = kind
    ? await db.drafts.where('[ownerId+kind]').equals([ownerId, kind]).toArray()
    : await db.drafts.where('ownerId').equals(ownerId).toArray();

  return drafts.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function deleteDraft(id: string): Promise<void> {
  await db.drafts.delete(id);
}
