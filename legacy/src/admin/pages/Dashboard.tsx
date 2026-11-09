import { AdminPage } from '../AdminApp';
import { Image, BarChart3, Package, Grid3X3, Phone, ListOrdered, Folder, Type, ArrowRight } from 'lucide-react';

interface Props {
  navigate: (p: AdminPage, sub?: string) => void;
}

const cards = [
  { id: 'hero' as AdminPage, label: 'Hero Banners', desc: 'Manage homepage slideshow images and text', icon: Image, color: 'bg-blue-600' },
  { id: 'stats' as AdminPage, label: 'Statistics', desc: 'Edit the company numbers and labels', icon: BarChart3, color: 'bg-green-600' },
  { id: 'brands' as AdminPage, label: 'Brands', desc: 'Add, edit or reorder brand profiles', icon: Package, color: 'bg-purple-600' },
  { id: 'categories' as AdminPage, label: 'Categories', desc: 'Manage product categories and images', icon: Grid3X3, color: 'bg-orange-600' },
  { id: 'contact' as AdminPage, label: 'Contact Info', desc: 'Update phone, email, WhatsApp, location', icon: Phone, color: 'bg-cyan-600' },
  { id: 'sections' as AdminPage, label: 'Section Order', desc: 'Show/hide and reorder homepage sections', icon: ListOrdered, color: 'bg-pink-600' },
  { id: 'media' as AdminPage, label: 'Media Library', desc: 'Browse and upload images', icon: Folder, color: 'bg-yellow-600' },
  { id: 'text' as AdminPage, label: 'Text Content', desc: 'Edit all website text in Hebrew & English', icon: Type, color: 'bg-red-600' },
];

export default function Dashboard({ navigate }: Props) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-white font-bold text-2xl mb-1">Dashboard</h1>
        <p className="text-slate-400 text-sm">Manage all content on the UltraPet website.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(({ id, label, desc, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => navigate(id, id === 'text' ? 'hero' : undefined)}
            className="bg-slate-900 border border-slate-800 hover:border-slate-600 p-5 text-start transition-all duration-200 group hover:bg-slate-800"
          >
            <div className={`w-10 h-10 ${color} flex items-center justify-center mb-4`}>
              <Icon size={18} className="text-white" />
            </div>
            <div className="text-white font-semibold text-sm mb-1">{label}</div>
            <div className="text-slate-500 text-xs leading-relaxed mb-3">{desc}</div>
            <div className="flex items-center gap-1 text-slate-500 group-hover:text-red-400 text-xs font-semibold transition-colors">
              Open <ArrowRight size={11} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
