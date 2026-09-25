import {useEffect, useState} from 'preact/hooks';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';
import 'mdui/components/select.js';
import 'mdui/components/menu-item.js';
import 'mdui/components/divider.js';
import {supabase} from '../../lib/supabase';

type Feedback = {type: 'success' | 'error'; text: string};

type InventoryCounts = {
  good: number;
  damaged: number;
  expired: number;
};

type SalesfloorEntry = {
  id: string;
  name: string;
};

type InventoryValues = Record<
  number,
  {
    stockroom: InventoryCounts;
    salesfloors: Record<string, InventoryCounts>;
  }
>;

const createEmptyCounts = (): InventoryCounts => ({
  good: 0,
  damaged: 0,
  expired: 0,
});

const createSalesfloorId = () =>
  `salesfloor-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function MerchantReportCreation({
  onCreated,
}: {
  onCreated?: (msg: Feedback) => void;
}) {
  const [statesList, setStatesList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [salesfloors, setSalesfloors] = useState<SalesfloorEntry[]>([
    {id: createSalesfloorId(), name: 'Salesfloor 1'},
  ]);

  const [stateId, setStateId] = useState('');
  const [clientId, setClientId] = useState('');
  const [salesmanName, setSalesmanName] = useState('');
  const [zone, setZone] = useState('');
  const [stablishment, setStablishment] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState('');
  const [arrivalPhotoPath, setArrivalPhotoPath] = useState('');
  const [departurePhotoPath, setDeparturePhotoPath] = useState('');
  const [observations, setObservations] = useState('');
  const [noInventory, setNoInventory] = useState(false);
  const [inventory, setInventory] = useState<InventoryValues>({});

  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<Feedback | null>(null);

  const getCurrentLocation = async () => {
    if (!('geolocation' in navigator)) {
      throw new Error('This device does not support GPS location.');
    }

    return await new Promise<{
      latitude: number;
      longitude: number;
      accuracy: number | null;
    }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        error => {
          reject(new Error(error.message || 'Unable to access the device GPS location.'));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });
  };

  useEffect(() => {
    const loadStates = async () => {
      const {data} = await supabase.from('states').select('*').order('name');
      if (data) setStatesList(data);
    };
    loadStates();
  }, []);

  const handleStateChange = async (e: any) => {
    const selectedStateId = e.target.value;
    setStateId(selectedStateId);
    setClientId('');
    setProductsList([]);
    setInventory({});
    setSalesfloors([{id: createSalesfloorId(), name: 'Salesfloor 1'}]);

    if (!selectedStateId) return;

    const {data} = await supabase
      .from('clients_states')
      .select('clients ( id, name, rif )')
      .eq('state_id', selectedStateId);

    if (data) {
      setClientsList(data.map((row: any) => row.clients));
    }
  };

  const handleClientChange = async (e: any) => {
    const selectedClientId = e.target.value;
    setClientId(selectedClientId);

    if (!selectedClientId) {
      setProductsList([]);
      setInventory({});
      return;
    }

    const {data} = await supabase
      .from('products')
      .select('*')
      .eq('client_id', selectedClientId);

    if (data) {
      setProductsList(data);
      // do not pre-init inventory for all products; user selects products via search
      setInventory({});
      setSelectedProducts([]);
      setProductSearch('');
    }
  };

  const filteredProducts = productsList.filter(p => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return false;
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.brand || '').toLowerCase().includes(q) ||
      String(p.category || '').toLowerCase().includes(q)
    );
  });

  const addProductToSelection = (product: any) => {
    if (selectedProducts.find(p => p.id === product.id)) return;
    setSelectedProducts(cur => [...cur, product]);
    setInventory(cur => ({...cur, [product.id]: {stockroom: createEmptyCounts(), salesfloors: Object.fromEntries(salesfloors.map(s => [s.id, createEmptyCounts()]))}}));
  };

  const removeSelectedProduct = (productId: number) => {
    setSelectedProducts(cur => cur.filter(p => p.id !== productId));
    setInventory(cur => {
      const next = {...cur};
      delete next[productId];
      return next;
    });
  };

  const updateSalesfloorList = (nextSalesfloors: SalesfloorEntry[]) => {
    setSalesfloors(nextSalesfloors);
    setInventory(current => {
      const merged: Record<number, {stockroom: InventoryCounts; salesfloors: Record<string, InventoryCounts>}> = {};

      Object.entries(current).forEach(([productId, value]) => {
        merged[Number(productId)] = {
          stockroom: value.stockroom ?? createEmptyCounts(),
          salesfloors: Object.fromEntries(
            nextSalesfloors.map(salesfloor => [
              salesfloor.id,
              value.salesfloors?.[salesfloor.id] ?? createEmptyCounts(),
            ]),
          ),
        };
      });

      return merged;
    });
  };

  const addSalesfloor = () => {
    const nextSalesfloor = {
      id: createSalesfloorId(),
      name: `Salesfloor ${salesfloors.length + 1}`,
    };
    updateSalesfloorList([...salesfloors, nextSalesfloor]);
  };

  const removeSalesfloor = (id: string) => {
    if (salesfloors.length === 1) return;

    const nextSalesfloors = salesfloors.filter(salesfloor => salesfloor.id !== id);
    updateSalesfloorList(nextSalesfloors);
  };

  const handleSalesfloorNameChange = (id: string, value: string) => {
    const nextSalesfloors = salesfloors.map(salesfloor =>
      salesfloor.id === id ? {...salesfloor, name: value} : salesfloor,
    );
    setSalesfloors(nextSalesfloors);
  };

  const handleInventoryChange = (
    productId: number,
    section: 'stockroom' | 'salesfloor',
    salesfloorId: string | null,
    field: keyof InventoryCounts,
    value: string,
  ) => {
    const numericValue = Math.max(0, Number(value) || 0);

    setInventory(current => {
      const currentEntry = current[productId] ?? {
        stockroom: createEmptyCounts(),
        salesfloors: {},
      };

      if (section === 'stockroom') {
        return {
          ...current,
          [productId]: {
            ...currentEntry,
            stockroom: {
              ...currentEntry.stockroom,
              [field]: numericValue,
            },
          },
        };
      }

      const currentSalesfloor = currentEntry.salesfloors[salesfloorId ?? ''] ?? createEmptyCounts();
      return {
        ...current,
        [productId]: {
          ...currentEntry,
          salesfloors: {
            ...currentEntry.salesfloors,
            [salesfloorId ?? '']: {
              ...currentSalesfloor,
              [field]: numericValue,
            },
          },
        },
      };
    });
  };

  const handleCreateReport = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);

    try {
      const errors: string[] = [];
      if (!salesmanName.trim()) errors.push('Salesman name is required.');
      if (!zone.trim()) errors.push('Zone is required.');
      if (!stablishment.trim()) errors.push('Establishment is required.');
      if (!clientId) errors.push('Client must be selected.');
      if (!noInventory && selectedProducts.length === 0) errors.push('At least one product must be selected for the report.');

      // Validate inventory numbers
      if (!noInventory) {
        for (const p of selectedProducts) {
          const state = inventory[p.id];
          if (!state) continue;
          const stock = state.stockroom ?? createEmptyCounts();
          if (stock.good < 0 || stock.damaged < 0 || stock.expired < 0) {
            errors.push(`Product ${p.name}: stockroom counts must be >= 0.`);
          }
          for (const sf of salesfloors) {
            const sfCounts = state.salesfloors?.[sf.id] ?? createEmptyCounts();
            if (sfCounts.good < 0 || sfCounts.damaged < 0 || sfCounts.expired < 0) {
              errors.push(`Product ${p.name} at ${sf.name}: counts must be >= 0.`);
            }
          }
        }
      }

      if (errors.length > 0) {
        setFeedbackMsg({type: 'error', text: errors.join(' ')});
        setLoading(false);
        return;
      }

      const location = await getCurrentLocation();
      setLatitude(String(location.latitude));
      setLongitude(String(location.longitude));
      setLocationAccuracy(String(location.accuracy ?? ''));

      const {
        data: {user},
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Could not authenticate user');

      const reportPayload = {
        state_id: Number(stateId),
        salesman_name: salesmanName,
        merchant_id: user.id,
        zone,
        stablishment,
        client_id: clientId,
        latitude: location.latitude,
        longitude: location.longitude,
        location_accuracy_m: location.accuracy,
        arrival_photo_path: arrivalPhotoPath.trim() || null,
        departure_photo_path: departurePhotoPath.trim() || null,
        observations: observations.trim() || null,
        no_inventory: noInventory,
      };

      const {data: report, error: reportError} = await supabase
        .from('merchant_reports')
        .insert(reportPayload)
        .select()
        .single();

      if (reportError) throw reportError;

      if (!noInventory) {
        const salesfloorRows = salesfloors.map(salesfloor => ({
          report_id: report.id,
          name: salesfloor.name.trim() || 'Salesfloor',
        }));

        const {data: insertedSalesfloors, error: salesfloorError} = await supabase
          .from('merchant_report_salesfloors')
          .insert(salesfloorRows)
          .select();

        if (salesfloorError) throw salesfloorError;

        const salesfloorMap = new Map(
          salesfloors.map((salesfloor, index) => [
            salesfloor.id,
            insertedSalesfloors?.[index]?.id ?? null,
          ]),
        );

        const inventoryRows = selectedProducts.flatMap(product => {
          const productState = inventory[product.id] ?? {
            stockroom: createEmptyCounts(),
            salesfloors: {},
          };
          const rows: any[] = [];

          const stockroomCounts = productState.stockroom ?? createEmptyCounts();
          if (
            stockroomCounts.good > 0 ||
            stockroomCounts.damaged > 0 ||
            stockroomCounts.expired > 0
          ) {
            rows.push({
              report_id: report.id,
              product_id: product.id,
              salesfloor_id: null,
              good_units: stockroomCounts.good,
              damaged_units: stockroomCounts.damaged,
              expired_units: stockroomCounts.expired,
            });
          }

          salesfloors.forEach(salesfloor => {
            const counts = productState.salesfloors?.[salesfloor.id] ?? createEmptyCounts();
            if (
              counts.good > 0 ||
              counts.damaged > 0 ||
              counts.expired > 0
            ) {
              rows.push({
                report_id: report.id,
                product_id: product.id,
                salesfloor_id: salesfloorMap.get(salesfloor.id),
                good_units: counts.good,
                damaged_units: counts.damaged,
                expired_units: counts.expired,
              });
            }
          });

          return rows;
        });

        if (inventoryRows.length > 0) {
          const {error: inventoryError} = await supabase
            .from('merchant_report_inventory')
            .insert(inventoryRows);

          if (inventoryError) throw inventoryError;
        }
      }

      if (onCreated) {
        onCreated({
          type: 'success',
          text: `Report for ${stablishment} created successfully.`,
        });
      }
    } catch (error: any) {
      setFeedbackMsg({
        type: 'error',
        text: error.message || 'Failed to submit report',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderInventoryInputs = (
    product: any,
    values: InventoryCounts,
    isStockroom = false,
    salesfloorId?: string,
  ) => (
    <div class="inventory-inputs">
      <mdui-text-field
        type="number"
        min="0"
        label="Good"
        variant="outlined"
        value={String(values.good ?? 0)}
        onInput={(e: any) =>
          handleInventoryChange(
            product.id,
            isStockroom ? 'stockroom' : 'salesfloor',
            isStockroom ? null : salesfloorId ?? null,
            'good',
            e.target.value,
          )
        }
      ></mdui-text-field>
      <mdui-text-field
        type="number"
        min="0"
        label="Damaged"
        variant="outlined"
        value={String(values.damaged ?? 0)}
        onInput={(e: any) =>
          handleInventoryChange(
            product.id,
            isStockroom ? 'stockroom' : 'salesfloor',
            isStockroom ? null : salesfloorId ?? null,
            'damaged',
            e.target.value,
          )
        }
      ></mdui-text-field>
      <mdui-text-field
        type="number"
        min="0"
        label="Expired"
        variant="outlined"
        value={String(values.expired ?? 0)}
        onInput={(e: any) =>
          handleInventoryChange(
            product.id,
            isStockroom ? 'stockroom' : 'salesfloor',
            isStockroom ? null : salesfloorId ?? null,
            'expired',
            e.target.value,
          )
        }
      ></mdui-text-field>
    </div>
  );

  return (
    <div class="creation-root">
      <h3>Add Merchant Report</h3>

      <form onSubmit={handleCreateReport}>
        <div class="field-grid">
          <mdui-select
            label="State"
            variant="outlined"
            value={stateId}
            onChange={handleStateChange}
            required
          >
            {statesList.map(s => (
              <mdui-menu-item key={s.id} value={String(s.id)}>
                {s.name}
              </mdui-menu-item>
            ))}
          </mdui-select>

          <mdui-select
            label="Client"
            variant="outlined"
            value={clientId}
            onChange={handleClientChange}
            required
            disabled={!stateId}
          >
            {clientsList.map(c => (
              <mdui-menu-item key={c.id} value={c.id}>
                {c.name}
              </mdui-menu-item>
            ))}
          </mdui-select>
        </div>

        <div class="field-grid">
          <mdui-text-field
            label="Search products"
            variant="outlined"
            value={productSearch}
            onInput={(e: any) => setProductSearch(e.target.value)}
            disabled={!clientId}
          />
        </div>

        {productSearch && filteredProducts.length > 0 && (
          <div class="user-list">
            {filteredProducts.map(p => (
              <div class="user-box" key={`search-${p.id}`}>
                <div>
                  <div>{p.sku ? `${p.sku}: ${p.brand ?? '-'} - ${p.name}` : p.name}</div>
                  <div>Units per package: {p.units_per_package ?? '-'}</div>
                </div>
                <div>
                  <mdui-button
                    variant="outlined"
                    onClick={() => addProductToSelection(p)}
                  >
                    Add
                  </mdui-button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedProducts.length > 0 && (
          <div class="items-box">
            <h4>Selected products</h4>
            <div class="user-list">
              {selectedProducts.map(p => (
                <div class="user-box" key={`sel-${p.id}`}>
                  <div>
                    <div>{p.sku ? `${p.sku}: ${p.brand ?? '-'} - ${p.name}` : p.name}</div>
                  </div>
                  <div>
                    <mdui-button-icon
                      icon="delete"
                      variant="outlined"
                      onClick={() => removeSelectedProduct(p.id)}
                    ></mdui-button-icon>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <mdui-text-field
          label="Salesman (Name and Surname)"
          variant="outlined"
          icon="person"
          value={salesmanName}
          onInput={(e: any) => setSalesmanName(e.target.value)}
          required
        />

        <div class="field-grid">
          <mdui-text-field
            label="Zone"
            variant="outlined"
            icon="location_on"
            value={zone}
            onInput={(e: any) => setZone(e.target.value)}
            required
          />

          <mdui-text-field
            label="Establishment"
            variant="outlined"
            icon="store"
            value={stablishment}
            onInput={(e: any) => setStablishment(e.target.value)}
            required
          />
        </div>


        <div class="field-grid">
          <mdui-text-field
            label="Arrival photo path"
            variant="outlined"
            value={arrivalPhotoPath}
            onInput={(e: any) => setArrivalPhotoPath(e.target.value)}
            required
          ></mdui-text-field>

          <mdui-text-field
            label="Departure photo path"
            variant="outlined"
            value={departurePhotoPath}
            onInput={(e: any) => setDeparturePhotoPath(e.target.value)}
            required
          ></mdui-text-field>
        </div>

        <mdui-text-field
          label="Observations"
          variant="outlined"
          value={observations}
          onInput={(e: any) => setObservations(e.target.value)}
        ></mdui-text-field>

        <label class="checkbox-row">
          <input
            type="checkbox"
            checked={noInventory}
            onChange={e => setNoInventory((e.target as HTMLInputElement).checked)}
          />
          <span>No inventory available for this visit</span>
        </label>

        <mdui-divider></mdui-divider>

        {productsList.length > 0 && !noInventory ? (
          <div class="inventory-section">
            <div class="salesfloor-editor">
              <h4>Salesfloor locations</h4>
              {salesfloors.map(salesfloor => (
                <div class="salesfloor-row" key={salesfloor.id}>
                  <mdui-text-field
                    label="Salesfloor name"
                    variant="outlined"
                    value={salesfloor.name}
                    onInput={(e: any) =>
                      handleSalesfloorNameChange(salesfloor.id, e.target.value)
                    }
                  ></mdui-text-field>
                  {salesfloors.length > 1 && (
                    <button
                      type="button"
                      class="secondary-button"
                      onClick={() => removeSalesfloor(salesfloor.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" class="secondary-button" onClick={addSalesfloor}>
                Add salesfloor
              </button>
            </div>

            <div class="info-message">
              Enter the inventory count by product, location, and condition.
            </div>

            {salesfloors.map(salesfloor => (
              <div class="inventory-section" key={`salesfloor-group-${salesfloor.id}`}>
                <h4>{salesfloor.name || 'Salesfloor'}</h4>
                    <div class="inventory-grid">
                      {selectedProducts.map(product => (
                        <div class="inventory-product" key={`${salesfloor.id}-${product.id}`}>
                          <span>{product.sku ? `${product.sku}: ${product.brand ?? '-'} - ${product.name}` : product.name}</span>
                          {renderInventoryInputs(
                            product,
                            inventory[product.id]?.salesfloors?.[salesfloor.id] ??
                              createEmptyCounts(),
                            false,
                            salesfloor.id,
                          )}
                        </div>
                      ))}
                </div>
              </div>
            ))}

            <div class="inventory-section">
              <h4>Stockroom</h4>
              <div class="inventory-grid">
                {selectedProducts.map(product => (
                  <div class="inventory-product" key={`stockroom-${product.id}`}>
                    <span>{product.sku ? `${product.sku}: ${product.brand ?? '-'} - ${product.name}` : product.name}</span>
                    {renderInventoryInputs(
                      product,
                      inventory[product.id]?.stockroom ?? createEmptyCounts(),
                      true,
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p class="info-message">
            {noInventory
              ? 'Inventory is intentionally omitted for this merchant report.'
              : 'Select a state and a client to load products for inventory tracking.'}
          </p>
        )}

        {feedbackMsg && (
          <div
            class={`feedback-message ${feedbackMsg.type === 'error' ? 'error' : 'success'}`}
          >
            {feedbackMsg.text}
          </div>
        )}

        <mdui-button
          type="submit"
          variant="filled"
          icon="check"
          loading={loading ? true : undefined}
          disabled={productsList.length === 0}
        >
          Submit Report
        </mdui-button>
      </form>
    </div>
  );
}
