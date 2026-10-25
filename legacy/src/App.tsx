import { lazy, Suspense } from 'react';
import { CmsProvider } from './contexts/CmsContext';
import Header from './components/Header';
import Hero from './components/Hero';
import Stats from './components/Stats';
import Brands from './components/Brands';
import Categories from './components/Categories';
import PrivateLabel from './components/PrivateLabel';
import BusinessCustomers from './components/BusinessCustomers';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import BrandPage from './components/BrandPage';
import ProductPage from './components/ProductPage';
import CategoryPage from './components/CategoryPage';

const AdminApp = lazy(() => import('./admin/AdminApp'));

const Spinner = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-neutral-200 border-t-brand-red rounded-full animate-spin" />
  </div>
);

function MainSite() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Stats />
        <Brands />
        <Categories />
        <PrivateLabel />
        <BusinessCustomers />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;

  if (path.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>}>
        <AdminApp />
      </Suspense>
    );
  }

  // /brands/:brand/:category/:product
  const productMatch = path.match(/^\/brands\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (productMatch) {
    return (
      <CmsProvider>
        <Suspense fallback={<Spinner />}>
          <ProductPage brandSlug={productMatch[1]} categorySlug={productMatch[2]} productSlug={productMatch[3]} />
        </Suspense>
      </CmsProvider>
    );
  }

  // /brands/:brand
  const brandMatch = path.match(/^\/brands\/([^/]+)$/);
  if (brandMatch) {
    return (
      <CmsProvider>
        <Suspense fallback={<Spinner />}>
          <BrandPage slug={brandMatch[1]} />
        </Suspense>
      </CmsProvider>
    );
  }

  // /categories/:slug
  const categoryMatch = path.match(/^\/categories\/([^/]+)$/);
  if (categoryMatch) {
    return (
      <CmsProvider>
        <Suspense fallback={<Spinner />}>
          <CategoryPage slug={categoryMatch[1]} />
        </Suspense>
      </CmsProvider>
    );
  }

  return (
    <CmsProvider>
      <MainSite />
    </CmsProvider>
  );
}
