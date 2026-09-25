import {useState, useEffect} from 'preact/hooks';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';
import 'mdui/components/select.js';
import 'mdui/components/menu-item.js';
import 'mdui/components/divider.js';
import {supabase} from '../../lib/supabase';

type Feedback = {type: 'success' | 'error'; text: string};

type InventorySection = {
  units: number;
  packages: number;
};

type InventoryValues = Record<
  number,
  {
    initial: InventorySection;
    final: InventorySection;
    restocked: number;
  }
>;

const emptyCounts = (initial: InventorySection = {units: 0, packages: 0}) => ({
  initial: {...initial},
  final: {...initial},
  restocked: 0,
});

export default function PromoterReportCreation({
  onCreated,
}: {
  onCreated?: (msg: Feedback) => void;
}) {
  const [statesList, setStatesList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  const [stateId, setStateId] = useState('');
  const [clientId, setClientId] = useState('');
  const [salesmanName, setSalesmanName] = useState('');
  const [zone, setZone] = useState('');
  const [stablishment, setStablishment] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState('');
  const [arrivalPhotoPath, setArrivalPhotoPath] = useState('');
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
      setInventory(
        Object.fromEntries(
          data.map(product => [product.id, emptyCounts()]),
        ),
      );
    }
  };

  const handleInventoryChange = (
    productId: number,
    section: 'initial' | 'final',
    field: keyof InventorySection,
    value: string,
  ) => {
    const numericValue = Math.max(0, Number(value) || 0);
    setInventory(current => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? emptyCounts()),
        [section]: {
          ...((current[productId]?.[section] ?? {units: 0, packages: 0})),
          [field]: numericValue,
        },
      },
    }));
  };

  const handleRestockedChange = (productId: number, value: string) => {
    const numericValue = Math.max(0, Number(value) || 0);
    setInventory(current => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? emptyCounts()),
        restocked: numericValue,
      },
    }));
  };

  const handleCreateReport = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);

    try {
      const location = await getCurrentLocation();
      setLatitude(String(location.latitude));
      setLongitude(String(location.longitude));
      setLocationAccuracy(String(location.accuracy ?? ''));

      const {
        data: {user},
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Could not authenticate user');

      const {data: report, error: reportError} = await supabase
        .from('promoter_reports')
        .insert({
          state_id: Number(stateId),
          salesman_name: salesmanName,
          promoter_id: user.id,
          zone,
          stablishment,
          client_id: clientId,
          latitude: location.latitude,
          longitude: location.longitude,
          location_accuracy_m: location.accuracy,
          arrival_photo_path: arrivalPhotoPath.trim() || null,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      const detailsToInsert = productsList.map(p => {
        const unitsPerPackage = p.units_per_package || 1;

        const initialInv =
          (inventory[p.id]?.initial.packages ?? 0) * unitsPerPackage +
          (inventory[p.id]?.initial.units ?? 0);
        const finalInv =
          (inventory[p.id]?.final.packages ?? 0) * unitsPerPackage +
          (inventory[p.id]?.final.units ?? 0);
        const restockedUnits = inventory[p.id]?.restocked ?? 0;

        return {
          report_id: report.id,
          product_id: p.id,
          initial_inventory: initialInv,
          final_inventory: finalInv,
          restocked_units: restockedUnits,
        };
      });

      if (detailsToInsert.length > 0) {
        const {error: detailsError} = await supabase
          .from('promoter_report_details')
          .insert(detailsToInsert);

        if (detailsError) throw detailsError;
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

  const renderInventoryGrid = (section: 'initial' | 'final', title: string) => (
    <div class="inventory-section">
      <h4>{title}</h4>
      <div class="inventory-grid">
        {productsList.map(product => (
          <div class="inventory-product" key={`${section}-${product.id}`}>
            <span>{product.name}</span>
            <div class="inventory-inputs">
              <mdui-text-field
                type="number"
                min="0"
                label="Units"
                variant="outlined"
                value={String(inventory[product.id]?.[section].units ?? 0)}
                onInput={(e: any) =>
                  handleInventoryChange(
                    product.id,
                    section,
                    'units',
                    e.target.value,
                  )
                }
              ></mdui-text-field>
              <mdui-text-field
                type="number"
                min="0"
                label="Packages"
                variant="outlined"
                value={String(inventory[product.id]?.[section].packages ?? 0)}
                onInput={(e: any) =>
                  handleInventoryChange(
                    product.id,
                    section,
                    'packages',
                    e.target.value,
                  )
                }
              ></mdui-text-field>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div class="creation-root">
      <h3>Add Sales Report</h3>

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

        <mdui-text-field
          label="Arrival photo path"
          variant="outlined"
          value={arrivalPhotoPath}
          onInput={(e: any) => setArrivalPhotoPath(e.target.value)}
          required
        ></mdui-text-field>

        <mdui-divider></mdui-divider>

        {productsList.length > 0 ? (
          <div class="inventory-section">
            <div class="info-message">
              <strong>Tip:</strong> Enter the starting stock, closing stock, and
              units restocked during the shift.
            </div>

            {renderInventoryGrid('initial', 'Initial Inventory')}
            {renderInventoryGrid('final', 'Final Inventory')}

            <div class="inventory-section">
              <h4>Restocked Units</h4>
              <div class="inventory-grid">
                {productsList.map(product => (
                  <div class="inventory-product" key={`restocked-${product.id}`}>
                    <span>{product.name}</span>
                    <div class="inventory-inputs">
                      <mdui-text-field
                        type="number"
                        min="0"
                        label="Restocked"
                        variant="outlined"
                        value={String(inventory[product.id]?.restocked ?? 0)}
                        onInput={(e: any) =>
                          handleRestockedChange(product.id, e.target.value)
                        }
                      ></mdui-text-field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p class="info-message">
            Select a state and a client to load products for inventory tracking.
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
