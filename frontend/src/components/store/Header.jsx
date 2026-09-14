import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ShoppingBag, Menu, ArrowUpRight, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../context/StoreContext';
import { OLink, Modal, Image } from './Common';
import { BrandWordmark } from './BrandWordmark';
import { ThemeToggle } from './ThemeToggle';
import { imgUrl } from '../../lib/api';

export const CurrencySelect = ({id='currency-select'}) => {
  const {store,currency,setCurrency}=useStore();
  return <label className="currency-select" aria-label="Display currency"><select data-testid={id} value={currency} onChange={e=>setCurrency(e.target.value)}>{store.currencies.filter(c=>c.enabled).map(c=><option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}</select><ChevronDown size={12}/></label>;
};

export const Header = () => {
  const {store,cart,setCartOpen,setSearchOpen,preview}=useStore();
  const [menu,setMenu]=useState(false),[mega,setMega]=useState(false);
  const location=useLocation();const count=cart.reduce((a,i)=>a+i.quantity,0);
  return <>
    {preview&&<div className="preview-banner" data-testid="preview-banner">DRAFT PREVIEW — Not visible to customers <OLink to="/admin" data-testid="preview-return">RETURN TO STUDIO ↗</OLink></div>}
    <header className="site-header" data-testid="site-header" onMouseLeave={()=>setMega(false)}>
      {store.features.announcement&&<div className="announcement" data-testid="announcement"><span>INDEPENDENT IN SPIRIT. CONSIDERED BY DESIGN.</span><OLink to={store.announcement.link} data-testid="announcement-link">{store.announcement.text}<ArrowUpRight size={12}/></OLink><span>EST. MMXXVI</span></div>}
      <div className="nav-main">
        <button className="icon-button mobile-menu-button" onClick={()=>setMenu(true)} aria-label="Open menu" data-testid="mobile-menu-open"><Menu size={22}/></button>
        <OLink to="/" className="wordmark brand-home-link" data-testid="brand-home" aria-label={`${store.brand.name} home`}><BrandWordmark name={store.brand.name} animated={store.features.animations} testId="header-wordmark"/></OLink>
        <nav className="desktop-nav" aria-label="Main navigation">{store.navigation.map((n,i)=><OLink key={n.id} to={n.href} className={location.pathname===n.href?'nav-active':''} data-testid={`nav-${n.id}`} onMouseEnter={()=>setMega(i===0)} onClick={()=>setMega(false)}>{n.label}{i===0&&<ChevronDown size={11}/>}</OLink>)}</nav>
        <div className="nav-actions">
          <div className="desktop-currency"><CurrencySelect/></div><ThemeToggle/>
          {store.features.search&&<button className="icon-button" aria-label="Search" data-testid="search-open" onClick={()=>{setSearchOpen(true);setMega(false);}}><Search size={20}/></button>}
          {store.features.cart&&<button className="bag-button" aria-label={`Shopping bag, ${count} items`} data-testid="cart-open" onClick={()=>{setCartOpen(true);setMega(false);}}><span className="bag-label">BAG</span><ShoppingBag size={18}/><span className="cart-count" data-testid="cart-count">{String(count).padStart(2,'0')}</span></button>}
        </div>
      </div>
      <AnimatePresence>{mega&&<motion.div className="mega-menu" initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} data-testid="shop-mega-menu"><div><span className="eyebrow">THE WARDROBE</span>{['All pieces',...new Set(store.products.map(p=>p.category))].map((c,i)=><OLink key={c} data-testid={`mega-category-${i}`} to={i===0?'/shop':`/shop?category=${encodeURIComponent(c)}`} onClick={()=>setMega(false)}>{c}<ArrowUpRight size={17}/></OLink>)}</div>{store.collections.slice(0,2).map(c=><OLink key={c.id} to={`/collections/${c.slug}`} onClick={()=>setMega(false)} data-testid={`mega-${c.id}`}><Image src={imgUrl(c.image,600)} alt={c.name}/><span>{c.name}<ArrowUpRight size={16}/></span></OLink>)}</motion.div>}</AnimatePresence>
    </header>
    <Modal open={menu} onOpenChange={setMenu} title={<BrandWordmark name={store.brand.name} testId="mobile-menu-wordmark"/>} className="mobile-navigation" testId="mobile-navigation">
      <div className="mobile-nav-links">{store.navigation.map((n,i)=><OLink to={n.href} key={n.id} onClick={()=>setMenu(false)} data-testid={`mobile-${n.id}`}><small>0{i+1}</small>{n.label}<ArrowUpRight/></OLink>)}</div>
      <ThemeToggle id="mobile-theme-toggle" expanded/><CurrencySelect id="mobile-currency"/><p className="eyebrow">{store.brand.tagline}</p>
    </Modal>
  </>;
};