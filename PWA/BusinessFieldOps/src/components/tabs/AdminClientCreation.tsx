import { useState, useEffect } from 'preact/hooks';
import { Fragment } from 'preact';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/divider.js';
import 'mdui/components/badge.js';
import 'mdui/components/select.js';
import 'mdui/components/menu-item.js';

import AdminProductCreation from './AdminProductCreation';
import { supabase } from '../../lib/supabase';

type Feedback = { type: 'success' | 'error'; text: string };

export default function AdminClientCreation({ onCreated, onClose }: { onCreated?: (msg: Feedback) => void; onClose?: () => void }) {
    const [name, setName] = useState('');
    const [rif, setRif] = useState('');
    const [products, setProducts] = useState<Array<{ name: string; units_per_package?: number }>>([]);
    const [showProductCreate, setShowProductCreate] = useState(false);
    const [loading, setLoading] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<Feedback | null>(null);
    const [statesList, setStatesList] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedStates, setSelectedStates] = useState<number[]>([]);

    const handleAddProduct = (p: { name: string; units_per_package?: number }) => {
        setProducts((cur) => [...cur, p]);
        setShowProductCreate(false);
    };

    const loadStates = async () => {
        const { data } = await supabase.from('states').select('id,name').order('name');
        if (data) setStatesList(data as any);
    };

    useEffect(() => {
        loadStates();
    }, []);

    const handleCreateClient = async (e: Event) => {
        e.preventDefault();
        setLoading(true);
        setFeedbackMsg(null);

        try {
            const { data: clientData, error: clientErr } = await supabase.from('clients').insert([{ name, rif }]).select().single();
            if (clientErr || !clientData) throw clientErr || new Error('Failed to create client');

            if (products.length > 0) {
                const toInsert = products.map((p) => ({ name: p.name, units_per_package: p.units_per_package || null, client_id: clientData.id }));
                const { error: prodErr } = await supabase.from('products').insert(toInsert);
                if (prodErr) throw prodErr;
            }

            if (selectedStates.length > 0) {
                const rels = selectedStates.map((sId) => ({ client_id: clientData.id, state_id: Number(sId) }));
                const { error: relErr } = await supabase.from('clients_states').insert(rels);
                if (relErr) throw relErr;
            }

            const msg = { type: 'success' as const, text: `Client ${name} created successfully.` };
            if (onCreated) onCreated(msg);
            setName('');
            setRif('');
            setProducts([]);
            setSelectedStates([]);
            if (onClose) onClose();
        } catch (error: any) {
            console.error('Failed to create client with products', error.message || error);
            setFeedbackMsg({ type: 'error', text: error.message || 'Failed to create client' });
        } finally {
            setLoading(false);
        }
    };

    const removeProduct = (idx: number) => setProducts((cur) => cur.filter((_, i) => i !== idx));


    return (
        <Fragment>
            <div class="creation-root">
                <h3>Add Client</h3>

                <form onSubmit={handleCreateClient}>
                    <mdui-text-field label="Client name" variant="outlined" value={name} onInput={(e: any) => setName(e.target.value)} required />
                    <mdui-text-field label="Client RIF" variant="outlined" value={rif} onInput={(e: any) => setRif(e.target.value)} required />

                    <div class="items-box">
                        <h4>States</h4>
                        <mdui-select multiple label="States" variant="outlined" onChange={(e: any) => {
                            const opts = Array.from(e.target.selectedOptions || []);
                            const vals = opts.map((o: any) => Number(o.value));
                            setSelectedStates(vals);
                        }}>
                            {statesList.map(s => <mdui-menu-item key={s.id} value={String(s.id)}>{s.name}</mdui-menu-item>)}
                        </mdui-select>
                    </div>

                    <div class="items-box">
                        <div className="list-header">
                            <h4>Products</h4>
                            <mdui-button variant="outlined" icon="add" onClick={() => setShowProductCreate(true)}>Add product</mdui-button>
                        </div>

                        <div class="user-list">
                            {products.length === 0 ? (
                                <div class="info-message">No products added yet.</div>
                            ) : (
                                products.map((p, idx) => (
                                    <div class="user-box" key={`${p.name}-${idx}`}>
                                        <mdui-avatar icon="inventory_2"></mdui-avatar>

                                        <div>
                                            <div>{p.name}</div>
                                            <mdui-badge>{p.units_per_package ?? '-'}</mdui-badge>
                                        </div>

                                        <div>
                                            <mdui-button-icon icon="delete" variant="outlined" onClick={() => removeProduct(idx)}></mdui-button-icon>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {feedbackMsg && <div class={`feedback-message ${feedbackMsg.type === 'error' ? 'error' : 'success'}`}>{feedbackMsg.text}</div>}

                    <div>
                        <mdui-button type="submit" variant="filled" loading={loading ? true : undefined}>Create Client</mdui-button>
                        <mdui-button variant="outlined" onClick={() => { if (onClose) onClose(); }}>Back to list</mdui-button>
                    </div>
                </form>

                {showProductCreate && (
                    <div class="dialog-panel">
                        <AdminProductCreation onAdd={handleAddProduct} onClose={() => setShowProductCreate(false)} />
                    </div>
                )}
            </div>
        </Fragment>
    );
}
