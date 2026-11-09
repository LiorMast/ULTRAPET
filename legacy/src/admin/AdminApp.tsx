import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminLayout from './components/AdminLayout';
import AdminLogin from './components/AdminLogin';
import Dashboard from './pages/Dashboard';
import HeroEditor from './pages/HeroEditor';
import StatsEditor from './pages/StatsEditor';
import BrandsManager from './pages/BrandsManager';
import CategoriesManager from './pages/CategoriesManager';
import ProductsManager from './pages/ProductsManager';
import TextEditor from './pages/TextEditor';
import ContactEditor from './pages/ContactEditor';
import SectionsEditor from './pages/SectionsEditor';
import MediaLibrary from './pages/MediaLibrary';

export type AdminPage =
  | 'dashboard'
  | 'hero'
  | 'stats'
  | 'brands'
  | 'categories'
  | 'products'
  | 'text'
  | 'contact'
  | 'sections'
  | 'media';

export default function AdminApp() {
  const [session, setSession] = useState<boolean | null>(null);
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [textSection, setTextSection] = useState('hero');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(!!s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const navigate = (p: AdminPage, sub?: string) => {
    setPage(p);
    if (sub) setTextSection(sub);
    window.location.hash = sub ? `${p}/${sub}` : p;
  };

  if (session === null) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  if (!session) {
    return <AdminLogin />;
  }

  const renderPage = () => {
    switch (page) {
      case 'hero': return <HeroEditor />;
      case 'stats': return <StatsEditor />;
      case 'brands': return <BrandsManager />;
      case 'categories': return <CategoriesManager />;
      case 'products': return <ProductsManager />;
      case 'text': return <TextEditor section={textSection} onSectionChange={setTextSection} />;
      case 'contact': return <ContactEditor />;
      case 'sections': return <SectionsEditor />;
      case 'media': return <MediaLibrary />;
      default: return <Dashboard navigate={navigate} />;
    }
  };

  return (
    <AdminLayout page={page} navigate={navigate} textSection={textSection}>
      {renderPage()}
    </AdminLayout>
  );
}
