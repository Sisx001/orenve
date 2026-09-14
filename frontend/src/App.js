import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header, Footer, ContactFloat } from './components/store/Layout';
import { MotionSystem } from './components/store/MotionSystem';
import { Search } from './components/store/Search';
import { Cart } from './components/store/Cart';
import { QuickView } from './pages/Product';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import { Collections, Lookbook, ContentPage, Contact, Maintenance } from './pages/EditorialPages';
import './App.css';
import './refinements.css';
const Admin = lazy(()=>import('./pages/admin/Admin'));

function Storefront(){const {store,error,load,preview}=useStore();const location=useLocation();if(error)return <div className="store-load-error" data-testid="store-error"><span className="wordmark">ORYNVE</span><h1>A brief interruption.</h1><p>{error}</p><button className="action" onClick={load} data-testid="store-retry">TRY AGAIN</button></div>;if(!store)return <div className="store-loading" data-testid="store-loading"><span className="wordmark">ORYNVE</span><span className="loading-rule"/></div>;if(store.site_mode!=='live'&&!preview&&location.pathname!=='/contact')return <Maintenance/>;return <MotionConfig reducedMotion={store.features.animations?'user':'always'}><a className="skip-link" href="#main-content" data-testid="skip-to-content">Skip to content</a><MotionSystem/><Header/><main id="main-content" className={store.features.transitions?'page-enter':''} key={store.features.transitions?location.pathname:'static'}><Routes><Route path="/" element={<Home/>}/><Route path="/shop" element={<Shop/>}/><Route path="/product/:slug" element={<Product/>}/><Route path="/collections" element={<Collections/>}/><Route path="/collections/:slug" element={<Shop/>}/><Route path="/lookbook" element={<Lookbook/>}/><Route path="/contact" element={<Contact/>}/><Route path="*" element={<ContentPage/>}/></Routes></main><Footer/><ContactFloat/>{store.features.search&&<Search/>}{store.features.cart&&<Cart/>}<QuickView/></MotionConfig>;}
function App(){return <BrowserRouter><Toaster position="bottom-center" richColors toastOptions={{className:'ory-toast'}}/><Routes><Route path="/admin/*" element={<Suspense fallback={<div className="store-loading">ORYNVE STUDIO</div>}><Admin/></Suspense>}/><Route path="*" element={<StoreProvider><Storefront/></StoreProvider>}/></Routes></BrowserRouter>;}
export default App;