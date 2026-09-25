// Minimal IndexedDB helper for caching and drafts
const DB_NAME = 'bfo-offline';
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('caches')) {
        db.createObjectStore('caches', {keyPath: 'key'});
      }
      if (!db.objectStoreNames.contains('drafts')) {
        const s = db.createObjectStore('drafts', {keyPath: 'id', autoIncrement: true});
        s.createIndex('by-type', 'type');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore(storeName: string, mode: IDBTransactionMode, cb: (store: IDBObjectStore) => any | Promise<any>) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    Promise.resolve(cb(store)).then(() => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }, reject);
  });
}

export async function saveCache(key: string, data: any) {
  await withStore('caches', 'readwrite', store => store.put({key, data, updated_at: Date.now()}));
}

export async function getCache(key: string) {
  const db = await openDB();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction('caches', 'readonly');
    const store = tx.objectStore('caches');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.data : null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(type: string, payload: any, meta: any = {}) {
  const item = {type, payload, meta, created_at: new Date().toISOString()};
  // simple dedupe: avoid identical payload for same type
  const existing = await getDrafts(type);
  const payloadJson = JSON.stringify(payload);
  for (const d of existing) {
    try {
      if (JSON.stringify(d.payload) === payloadJson) {
        return; // already saved
      }
    } catch (_) {
      // ignore
    }
  }
  await withStore('drafts', 'readwrite', store => store.add(item));
}

export async function getDrafts(type?: string) {
  const db = await openDB();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readonly');
    const store = tx.objectStore('drafts');
    const req = type ? store.index('by-type').getAll(type) : store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraft(id: number) {
  await withStore('drafts', 'readwrite', store => store.delete(id));
}

// Attempt simple sync of drafts for known types. Returns array of results.
export async function syncDrafts(supabase: any) {
  const drafts = await getDrafts();
  const results: Array<{id: number; ok: boolean; error?: any}> = [];
  for (const d of drafts) {
    try {
      if (d.type === 'contacts' || d.type === 'contacts_create') {
        // ensure we have an authenticated user to set owner_id
        const {data: authData} = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        const toInsert = {...d.payload};
        if (!toInsert.owner_id && userId) toInsert.owner_id = userId;
        if (!toInsert.owner_id) {
          // cannot insert without owner_id, skip for now
          results.push({id: d.id as number, ok: false, error: 'no-auth'});
          continue;
        }
        const {error} = await supabase.from('contacts').insert([toInsert]);
        if (error) throw error;
      } else if (d.type === 'contacts_update') {
        // update existing contact
        const payload = d.payload || {};
        const id = payload.id;
        if (!id) {
          results.push({id: d.id as number, ok: false, error: 'missing-id'});
          continue;
        }
        const {error} = await supabase.from('contacts').update(payload).eq('id', id);
        if (error) throw error;
      } else if (d.type === 'promoter_reports') {
        // Assume payload has report and details arrays
        const {report, details} = d.payload;
        const {data: inserted, error} = await supabase.from('promoter_reports').insert([report]);
        if (error) throw error;
        const reportId = inserted?.[0]?.id;
        if (reportId && Array.isArray(details) && details.length) {
          const prepared = details.map((det: any) => ({...det, report_id: reportId}));
          const {error: detErr} = await supabase.from('promoter_report_details').insert(prepared);
          if (detErr) throw detErr;
        }
      } else if (d.type === 'merchant_reports') {
        const {report, salesfloors, inventory} = d.payload;
        const {data: inserted, error} = await supabase.from('merchant_reports').insert([report]);
        if (error) throw error;
        const reportId = inserted?.[0]?.id;
        if (reportId) {
          if (Array.isArray(salesfloors) && salesfloors.length) {
            const sfPrepared = salesfloors.map((s: any) => ({...s, report_id: reportId}));
            const {error: sfErr} = await supabase.from('merchant_report_salesfloors').insert(sfPrepared);
            if (sfErr) throw sfErr;
            // fetch inserted salesfloors to map generated ids by name
            const {data: sfData} = await supabase.from('merchant_report_salesfloors').select('*').eq('report_id', reportId);
            const nameToId = new Map((sfData || []).map((s: any) => [s.name, s.id]));
            // insert inventory
                    const invRows: any[] = [];
                    for (const [productId, val] of Object.entries(inventory || {}) as [string, any][]) {
                      // stockroom
                      const stock = (val && val.stockroom) || {};
                      invRows.push({report_id: reportId, product_id: productId, salesfloor_id: null, good_units: stock.good || 0, damaged_units: stock.damaged || 0, expired_units: stock.expired || 0});
                      for (const [sfKey, counts] of Object.entries((val && val.salesfloors) || {}) as [string, any][]) {
                        const sfId = nameToId.get(sfKey) ?? null;
                        const c = counts || {};
                        invRows.push({report_id: reportId, product_id: productId, salesfloor_id: sfId, good_units: c.good || 0, damaged_units: c.damaged || 0, expired_units: c.expired || 0});
                      }
                    }
            if (invRows.length) {
              const {error: invErr} = await supabase.from('merchant_report_inventory').insert(invRows);
              if (invErr) throw invErr;
            }
          }
        }
      } else {
        // unknown type: try to insert into table with same name as type
        const {error} = await supabase.from(d.type).insert([d.payload]);
        if (error) throw error;
      }

      // success
      await deleteDraft(d.id as number);
      results.push({id: d.id as number, ok: true});
    } catch (err) {
      results.push({id: d.id as number, ok: false, error: err});
    }
  }
  return results;
}

export async function clearCaches() {
  await withStore('caches', 'readwrite', store => {
    store.clear();
  });
}

export default {openDB, saveCache, getCache, saveDraft, getDrafts, deleteDraft, syncDrafts, clearCaches};
