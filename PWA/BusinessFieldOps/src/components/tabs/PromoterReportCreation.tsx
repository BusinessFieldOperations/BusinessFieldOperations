import { useState, useEffect } from 'preact/hooks';
import "mdui/components/text-field.js";
import "mdui/components/button.js";
import "mdui/components/select.js";
import "mdui/components/menu-item.js";
import "mdui/components/divider.js";
import { supabase } from '../../lib/supabase';

type Feedback = { type: 'success' | 'error'; text: string };

type InventorySection = {
  units: number;
  packages: number;
};

type InventoryValues = Record<number, {
  initial: InventorySection;
  final: InventorySection;
}>;

export default function PromoterReportCreation({ onCreated }: { onCreated?: (msg: Feedback) => void }) {
  // Selection states
  const [statesList, setStatesList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Form values
  const [stateId, setStateId] = useState('');
  const [clientId, setClientId] = useState('');
  const [salesmanName, setSalesmanName] = useState('');
  const [zone, setZone] = useState('');
  const [stablishment, setStablishment] = useState('');
  const [inventory, setInventory] = useState<InventoryValues>({});

  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<Feedback | null>(null);

  // 1. Fetch States on Mount
  useEffect(() => {
    const loadStates = async () => {
      const { data } = await supabase.from('states').select('*').order('name');
      if (data) setStatesList(data);
    };
    loadStates();
  }, []);

  // 2. Fetch Clients when State changes
  const handleStateChange = async (e: any) => {
    const selectedStateId = e.target.value;
    setStateId(selectedStateId);
    setClientId('');
    setProductsList([]);
    setInventory({});

    if (!selectedStateId) return;

    const { data } = await supabase
      .from('clients_states')
      .select(`clients ( id, name, rif )`)
      .eq('state_id', selectedStateId);

    if (data) {
      setClientsList(data.map((row: any) => row.clients));
    }
  };

  // 3. Fetch Products when Client changes
  const handleClientChange = async (e: any) => {
    const selectedClientId = e.target.value;
    setClientId(selectedClientId);

    if (!selectedClientId) {
      setProductsList([]);
      setInventory({});
      return;
    }

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('client_id', selectedClientId);

    if (data) {
      setProductsList(data);
      // Initialize inventory fields correctly
      setInventory(
        Object.fromEntries(
          data.map((product) => [
            product.id,
            { initial: { units: 0, packages: 0 }, final: { units: 0, packages: 0 } },
          ])
        )
      );
    }
  };

  const handleInventoryChange = (
    productId: number,
    section: 'initial' | 'final',
    field: keyof InventorySection,
    value: string
  ) => {
    const numericValue = Math.max(0, Number(value) || 0);
    setInventory((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [section]: {
          ...current[productId]?.[section],
          [field]: numericValue,
        },
      },
    }));
  };

  const handleCreateReport = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);

    try {
      // 1. Get auth user mapping for promoter_id
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Could not authenticate user");

      // 2. Insert Base Report inside 'promoter_reports' table
      const { data: report, error: reportError } = await supabase
        .from('promoter_reports')
        .insert({
          state_id: Number(stateId),
          salesman_name: salesmanName,
          promoter_id: user.id,
          zone: zone,
          stablishment: stablishment,
          client_id: clientId,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // 3. Calculate details based on the schema constraints
      const detailsToInsert = productsList.map((p) => {
        const unitsPerPackage = p.units_per_package || 1;

        const initU = inventory[p.id]?.initial.units || 0;
        const initP = inventory[p.id]?.initial.packages || 0;
        const finU = inventory[p.id]?.final.units || 0;
        const finP = inventory[p.id]?.final.packages || 0;

        const initialInv = (initP * unitsPerPackage) + initU;
        const finalInv = (finP * unitsPerPackage) + finU;
        const totalSales = initialInv - finalInv; // Must map to DB constraint

        return {
          report_id: report.id,
          product_id: p.id,
          initial_inventory: initialInv,
          final_inventory: finalInv,
          total_sales: totalSales
        };
      });

      // 4. Insert Inventory Details
      if (detailsToInsert.length > 0) {
        const { error: detailsError } = await supabase
          .from('promoter_report_details')
          .insert(detailsToInsert);

        if (detailsError) throw detailsError;
      }

      if (onCreated) onCreated({ type: 'success', text: `Report for ${stablishment} created successfully.` });

    } catch (error: any) {
      setFeedbackMsg({ type: 'error', text: error.message || 'Failed to submit report' });
    } finally {
      setLoading(false);
    }
  };

  const renderInventoryGrid = (section: 'initial' | 'final', title: string) => (
    <div class="inventory-section">
      <h4>{title}</h4>
      <div class="inventory-grid">
        {productsList.map((product) => (
          <div class="inventory-product" key={`${section}-${product.id}`}>
            <span>{product.name}</span>
            <div class="inventory-inputs">
              <mdui-text-field
                type="number"
                min="0"
                label="Units"
                variant="outlined"
                value={String(inventory[product.id]?.[section].units ?? 0)}
                onInput={(e: any) => handleInventoryChange(product.id, section, 'units', e.target.value)}
              ></mdui-text-field>
              <mdui-text-field
                type="number"
                min="0"
                label="Packages"
                variant="outlined"
                value={String(inventory[product.id]?.[section].packages ?? 0)}
                onInput={(e: any) => handleInventoryChange(product.id, section, 'packages', e.target.value)}
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

        <div>
          <mdui-select
            label="State"
            variant="outlined"
            value={stateId}
            onChange={handleStateChange}
            required
          >
            {statesList.map(s => <mdui-menu-item key={s.id} value={String(s.id)}>{s.name}</mdui-menu-item>)}
          </mdui-select>

          <mdui-select
            label="Client"
            variant="outlined"
            value={clientId}
            onChange={handleClientChange}
            required
            disabled={!stateId}
          >
            {clientsList.map(c => <mdui-menu-item key={c.id} value={c.id}>{c.name}</mdui-menu-item>)}
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

        <div>
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

        <mdui-divider></mdui-divider>

        {productsList.length > 0 ? (
          <div class="inventory-section">
            <div class="info-message">
              <strong>Tip:</strong> System will automatically calculate total inventory and sales based on the units and packages (Bultos).
            </div>

            {renderInventoryGrid('initial', 'Initial Inventory')}
            {renderInventoryGrid('final', 'Final Inventory')}
          </div>
        ) : (
          <p class="info-message">Select a state and a client to load products for inventory tracking.</p>
        )}

        {feedbackMsg && (
          <div class={`feedback-message ${feedbackMsg.type === 'error' ? 'error' : 'success'}`}>
            {feedbackMsg.text}
          </div>
        )}

        <mdui-button type="submit" variant="filled" icon="check" loading={loading ? true : undefined} disabled={productsList.length === 0}>
          Submit Report
        </mdui-button>
      </form>
    </div>
  );
}