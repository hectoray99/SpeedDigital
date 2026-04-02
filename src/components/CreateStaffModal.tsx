import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface CreateStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modalTitle?: string;
}

export default function CreateStaffModal({ isOpen, onClose, onSuccess, modalTitle = 'Nuevo Personal' }: CreateStaffModalProps) {
    const { orgData } = useAuthStore(); // Traemos el tenant desde la memoria
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        identifier: '',
        phone: '',
        email: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgData?.id) return;
        setLoading(true);

        try {
            // Insertamos con type 'staff' usando el orgData.id
            const { error } = await supabase.from('crm_people').insert([{
                organization_id: orgData.id,
                full_name: formData.full_name,
                identifier: formData.identifier,
                phone: formData.phone,
                email: formData.email,
                type: 'staff',
                is_active: true
            }]);

            if (error) throw error;

            toast.success('Miembro del equipo registrado con éxito');
            setFormData({ full_name: '', identifier: '', phone: '', email: '' });
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
                                    <Dialog.Title as="h3" className="text-lg font-bold text-slate-900">
                                        {modalTitle}
                                    </Dialog.Title>
                                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                                        <input required type="text" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">DNI / Identificador</label>
                                        <input type="text" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.identifier} onChange={e => setFormData({ ...formData, identifier: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                                            <input type="tel" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                            <input type="email" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-3 mt-4 bg-slate-900 hover:bg-black transition-colors text-white rounded-xl font-bold flex justify-center items-center gap-2">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Registrar
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