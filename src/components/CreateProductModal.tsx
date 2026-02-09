import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CreateProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateProductModal({ isOpen, onClose, onSuccess }: CreateProductModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        type: 'product', // product, service, subscription
        sku: ''
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: '', price: '', type: 'product', sku: '' });
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No auth');

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
            if (!profile) throw new Error('No org');

            const { error } = await supabase.from('catalog_items').insert([{
                organization_id: profile.organization_id,
                name: formData.name,
                price: Number(formData.price),
                type: formData.type,
                sku: formData.sku || null,
                is_active: true
            }]);

            if (error) throw error;

            toast.success('Ítem creado correctamente');
            onSuccess();
            onClose();

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                <div className="flex justify-between items-center mb-6">
                                    <Dialog.Title as="h3" className="text-lg font-bold text-slate-900">Nuevo Ítem</Dialog.Title>
                                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                        <input required type="text" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Precio</label>
                                            <input required type="number" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                            <select className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                                <option value="product">Producto</option>
                                                <option value="service">Servicio</option>
                                                <option value="subscription">Suscripción</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium flex justify-center items-center gap-2">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                                    </button>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}