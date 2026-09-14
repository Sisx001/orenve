import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { api, errorText, BASE } from '../lib/api';
import { toast } from 'sonner';

const StoreContext = createContext(null);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
export const StoreProvider = ({ children }) => {
  const [store, setStore] = useState(null), [error, setError] = useState('');
  const [preview] = useState(new URLSearchParams(window.location.search).get('preview'));
  const [themePreference,setThemePreference]=useState(()=>{const saved=preview?null:read('orynve-theme',null);return saved==='dark'||saved==='light'?saved:null;});
  const theme=themePreference||(store?.brand.theme==='dark'?'dark':'light');
  const setTheme=useCallback(next=>{if(!['light','dark'].includes(next))return;setThemePreference(next);if(!preview){try{localStorage.setItem('orynve-theme',JSON.stringify(next));}catch{/* Keep the choice for this visit when storage is restricted. */}}},[preview]);
  useLayoutEffect(()=>{const root=document.documentElement;root.dataset.brandTheme=theme;root.classList.toggle('dark',theme==='dark');root.style.colorScheme=theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#131710':'#faf9f6';},[theme]);
  useEffect(()=>{if(preview)return;const sync=e=>{if(e.key==='orynve-theme'){try{const next=JSON.parse(e.newValue);setThemePreference(next==='dark'||next==='light'?next:null);}catch{setThemePreference(null);}}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[preview]);
  useEffect(()=>()=>{const root=document.documentElement;delete root.dataset.brandTheme;delete root.dataset.spacing;root.classList.remove('dark');root.style.removeProperty('color-scheme');root.style.removeProperty('--font-body');root.style.removeProperty('--accent-brand');},[]);
  const [cart, setCart] = useState(() => read('orynve-bag', []));
  const [wishlist, setWishlist] = useState(() => read('orynve-wishlist', []));
  const [currency, setCurrency] = useState(() => read('orynve-currency', 'BDT'));
  const [cartOpen, setCartOpen] = useState(false), [searchOpen, setSearchOpen] = useState(false), [quickView, setQuickView] = useState(null);
  const load = useCallback(async () => {
    setError('');
    try { const {data} = await api.get('/store', {params: preview ? {preview} : {}}); setStore(data.store); }
    catch (e) { setError(errorText(e)); }
  }, [preview]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!store || window.parent === window) return;
    const timer = setTimeout(() => window.parent.postMessage({type:'ORYNVE_STOREFRONT_READY'},new URL(BASE).origin),150);
    return () => clearTimeout(timer);
  }, [store]);
  useEffect(() => { localStorage.setItem('orynve-bag', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('orynve-wishlist', JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem('orynve-currency', JSON.stringify(currency)); }, [currency]);
  useEffect(() => {
    if (store && !store.currencies.some(c => c.code === currency && c.enabled)) setCurrency('BDT');
    if (store) {
      document.documentElement.style.setProperty('--accent-brand', store.brand.accent);
      document.documentElement.dataset.spacing = store.brand.spacing;
      document.documentElement.style.setProperty('--font-body', `${store.brand.font || 'Outfit'}, sans-serif`);
    }
  }, [store,currency]);
  const money = (value, code=currency) => {
    const c = store?.currencies.find(c => c.code === code) || {symbol:'৳',rate:1,code:'BDT'};
    return `${c.symbol}${Number(value*c.rate).toLocaleString('en-US',{minimumFractionDigits:c.code==='BDT'?0:2,maximumFractionDigits:c.code==='BDT'?0:2})}`;
  };
  const addToCart = (product, size, color, quantity=1) => {
    if (!size) { toast.error('Choose your size first.'); return false; }
    const key = `${product.id}-${size}-${color}`;
    const existing = cart.find(i=>i.key===key);
    const stock = product.sizes.find(s=>s.name===size)?.stock || 0;
    const reserved=cart.filter(i=>i.product_id===product.id&&i.size===size).reduce((sum,i)=>sum+i.quantity,0);
    if (reserved+quantity>stock) { toast.error(`Only ${stock} available in this size.`); return false; }
    setCart(prev => existing ? prev.map(i=>i.key===key?{...i,quantity:i.quantity+quantity}:i) : [...prev,{key,product_id:product.id,size,color,quantity}]);
    setQuickView(null); setCartOpen(true); toast.success('A considered choice. Added to your bag.'); return true;
  };
  const toggleWish = (id) => setWishlist(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const value = {store,error,load,preview,theme,setTheme,cart,setCart,wishlist,toggleWish,currency,setCurrency,money,cartOpen,setCartOpen,searchOpen,setSearchOpen,quickView,setQuickView,addToCart};
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};
export const useStore = () => useContext(StoreContext);