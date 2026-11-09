import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminPage } from '../AdminApp';
import {
  LayoutDashboard, Image, BarChart3, Package, Grid3X3, Type, Phone, ListOrdered, Folder,
  ChevronDown, ExternalLink, LogOut, ChevronRight, ShoppingBag,
} from 'lucide-react';

const TEXT_SECTIONS = ['hero', 'stats', 'brands', 'categories', 'privateLabel', 'business', 'about', 'contact', 'footer', 'nav'];

interface Props {
  page: AdminPage;
  navigate: (p: AdminPage, sub?: string) => void;
  textSection: string;
  children: React.ReactNode;
}

const navItems = [
  { id: 'dashboard'  as AdminPage, label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'hero'       as AdminPage, label: 'Hero Banners', icon: Image },
  { id: 'stats'      as AdminPage, label: 'Statistics',   icon: BarChart3 },
  { id: 'brands'     as AdminPage, label: 'Brands',       icon: Package },
  { id: 'categories' as AdminPage, label: 'Categories',   icon: Grid3X3 },
  { id: 'products'   as AdminPage, label: 'Products',     icon: ShoppingBag },
  { id: 'contact'    as AdminPage, label: 'Contact Info', icon: Phone },
  { id: 'sections'   as AdminPage, label: 'Section Order',icon: ListOrdered },
  { id: 'media'      as AdminPage, label: 'Media Library',icon: Folder },
];

export default function AdminLayout({ page, navigate, textSection, children }: Props) {
  const [textOpen, setTextOpen] = useState(page === 'text');

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-slate-950 border-e border-slate-800 flex flex-col fixed inset-y-0 start-0 z-10">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-xs">UP</span>
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-none">UltraPet</div>
              <div className="text-slate-500 text-xs mt-0.5">CMS Admin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors text-start ${page === id && page !== 'text' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </button>
          ))}

          {/* Text content accordion */}
          <div>
            <button onClick={() => setTextOpen((v) => !v)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors text-start ${page === 'text' ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Type size={15} className="flex-shrink-0" />
              <span className="flex-1">Text Content</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${textOpen ? 'rotate-180' : ''}`} />
            </button>
            {textOpen && (
              <div className="ms-6 mt-0.5 space-y-0.5 border-s border-slate-800 ps-3">
                {TEXT_SECTIONS.map((sec) => (
                  <button key={sec} onClick={() => navigate('text', sec)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors text-start ${page === 'text' && textSection === sec ? 'text-red-400 bg-red-950/30' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                    <ChevronRight size={10} className="flex-shrink-0" />
                    {sec.charAt(0).toUpperCase() + sec.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="p-2 border-t border-slate-800 space-y-0.5">
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors text-start text-slate-400 hover:text-white hover:bg-slate-800">
            <ExternalLink size={15} className="flex-shrink-0" />
            View Website
          </a>
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors text-start text-slate-400 hover:text-red-400 hover:bg-slate-800">
            <LogOut size={15} className="flex-shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ms-60 flex-1 min-h-screen">
        {children}
      </div>
    </div>
  );
}
