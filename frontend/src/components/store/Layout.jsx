import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ShoppingBag, Menu, ArrowUpRight, ArrowUp, ChevronDown, MessageCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../context/StoreContext';
import { OLink, Modal, TextLink, Image } from './Common';
import { api, errorText, imgUrl } from '../../lib/api';
import { toast } from 'sonner';

export const CurrencySelect = ({id='currency-select'}) => {
  const {store,currency,setCurrency}=useStore();
  return <label className="currency-select" aria-label="Display currency"><select data-testid={id} value={currency} onChange={e=>setCurrency(e.target.value)}>{store.currencies.filter(c=>c.enabled).map(c=><option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}</select><ChevronDown size={12}/></label>;
};
export const Header = () => {
  const {store,cart,setCartOpen,setSearchOpen,preview}=useStore(); const [menu,setMenu]=useState(false),[mega,setMega]=useState(false); const location=useLocation();
  const count=cart.reduce((a,i)=>a+i.quantity,0);
  return <>{preview&&<div className="preview-banner" data-testid="preview-banner">DRAFT PREVIEW — Not visible to customers <OLink to="/admin" data-testid="preview-return">RETURN TO STUDIO ↗</OLink></div>}
    <header className="site-header" data-testid="site-header" onMouseLeave={()=>setMega(false)}>
      {store.features.announcement&&<div className="announcement" data-testid="announcement"><span>INDEPENDENT IN SPIRIT. CONSIDERED BY DESIGN.</span><OLink to={store.announcement.link} data-testid="announcement-link">{store.announcement.text}<ArrowUpRight size={12}/></OLink><span>EST. MMXXVI</span></div>}
      <div className="nav-main"><button className="icon-button mobile-menu-button" onClick={()=>setMenu(true)} aria-label="Open menu" data-testid="mobile-menu-open"><Menu size={22}/></button><OLink to="/" className="wordmark" data-testid="brand-home">{store.brand.name}</OLink><nav className="desktop-nav" aria-label="Main navigation">{store.navigation.map((n,i)=><OLink key={n.id} to={n.href} className={location.pathname===n.href?'nav-active':''} data-testid={`nav-${n.id}`} onMouseEnter={()=>setMega(i===0)} onClick={()=>setMega(false)}>{n.label}{i===0&&<ChevronDown size={10}/>}</OLink>)}</nav><div className="nav-actions"><div className="desktop-currency"><CurrencySelect/></div>{store.features.search&&<button className="icon-button" aria-label="Search" data-testid="search-open" onClick={()=>{setSearchOpen(true);setMega(false);}}><Search size={19}/></button>}{store.features.cart&&<button className="bag-button" aria-label={`Shopping bag, ${count} items`} data-testid="cart-open" onClick={()=>{setCartOpen(true);setMega(false);}}><span className="bag-label">BAG</span><ShoppingBag size={18}/><span className="cart-count" data-testid="cart-count">{String(count).padStart(2,'0')}</span></button>}</div></div>
      <AnimatePresence>{mega&&<motion.div className="mega-menu" initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} data-testid="shop-mega-menu"><div><span className="eyebrow">THE WARDROBE</span>{['All pieces',...new Set(store.products.map(p=>p.category))].map((c,i)=><OLink key={c} data-testid={`mega-category-${i}`} to={i===0?'/shop':`/shop?category=${encodeURIComponent(c)}`} onClick={()=>setMega(false)}>{c}<ArrowUpRight size={17}/></OLink>)}</div>{store.collections.slice(0,2).map(c=><OLink key={c.id} to={`/collections/${c.slug}`} onClick={()=>setMega(false)} data-testid={`mega-${c.id}`}><Image src={imgUrl(c.image,600)} alt={c.name}/><span>{c.name}<ArrowUpRight size={16}/></span></OLink>)}</motion.div>}</AnimatePresence>
    </header>
    <Modal open={menu} onOpenChange={setMenu} title={store.brand.name} className="mobile-navigation" testId="mobile-navigation"><div className="mobile-nav-links">{store.navigation.map((n,i)=><OLink to={n.href} key={n.id} onClick={()=>setMenu(false)} data-testid={`mobile-${n.id}`}><small>0{i+1}</small>{n.label}<ArrowUpRight/></OLink>)}</div><CurrencySelect id="mobile-currency"/><p className="eyebrow">{store.brand.tagline}</p></Modal>
  </>;
};

export const Newsletter = ({compact=false}) => {
  const {store}=useStore();const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);try{await api.post('/newsletter',{email});setSuccess(true);toast.success('You’re on the list. Welcome to ORYNVE.');}catch(err){toast.error(errorText(err));}finally{setBusy(false);}};
  return <div className={`newsletter ${compact?'newsletter-compact':''}`} data-testid="newsletter-section"><span className="eyebrow">THE INNER CIRCLE</span><h2 className="section-heading">{store.newsletter.title}</h2><p>{store.newsletter.text}</p>{success?<div className="newsletter-success" data-testid="newsletter-success"><Check size={18}/> YOU’RE ON THE LIST.</div>:<form onSubmit={submit}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input type="email" id="newsletter-email" data-testid="newsletter-email" required placeholder="Your email address" value={email} onChange={e=>setEmail(e.target.value)}/><button type="submit" aria-label="Subscribe to newsletter" disabled={busy} data-testid="newsletter-submit">{busy?'…':<ArrowUpRight size={24}/>}</button></form>}<small>{store.newsletter.consent} <OLink to="/privacy" data-testid="newsletter-privacy">Read more.</OLink></small></div>;
};

export const Footer = () => {
  const {store}=useStore();
  return <footer className="site-footer" data-testid="site-footer"><div className="footer-top"><div className="footer-intro"><span className="footer-emblem">O/</span><p>{store.footer.statement}</p><span className="eyebrow">{store.contact.address}</span></div>{store.footer.groups.map((g,i)=><div className="footer-group" key={g.id}><h2>{g.title}</h2>{g.links.map((l,j)=><OLink key={j} to={l.href} data-testid={`footer-link-${i}-${j}`}>{l.label}</OLink>)}</div>)}{store.features.newsletter&&<Newsletter compact/>}</div><div className="footer-wordmark" aria-hidden="true">{store.brand.name}<span>®</span></div><div className="footer-bottom"><span data-testid="copyright">{store.footer.copyright}</span><div>{store.contact.socials.map((s,i)=><a href={s.href} key={i} target="_blank" rel="noreferrer" data-testid={`social-${i}`}>{s.label}<ArrowUpRight size={12}/></a>)}</div><button data-testid="back-to-top" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>BACK TO TOP<ArrowUp size={13}/></button></div></footer>;
};

export const ContactFloat = () => {
  const {store}=useStore();const [open,setOpen]=useState(false);const c=store.contact;
  if(!c.whatsapp_enabled&&!c.email_enabled&&!c.chat_enabled&&!c.form_enabled)return null;
  return <div className={`contact-float contact-${c.floating_position}`}><AnimatePresence>{open&&<motion.div className="contact-popover" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}} data-testid="contact-popover"><span className="eyebrow">A PERSONAL CONNECTION</span><p>{c.text}</p>{c.whatsapp_enabled&&c.whatsapp&&<a href={`https://wa.me/${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" data-testid="contact-whatsapp">WhatsApp<ArrowUpRight size={16}/></a>}{c.email_enabled&&c.email&&<a href={`mailto:${c.email}`} data-testid="contact-email-link">Email us<ArrowUpRight size={16}/></a>}{c.chat_enabled&&c.chat_url&&<a href={c.chat_url} target="_blank" rel="noreferrer" data-testid="live-chat-link">Live chat<ArrowUpRight size={16}/></a>}{c.form_enabled&&<OLink to="/contact" onClick={()=>setOpen(false)} data-testid="contact-form-link">Leave a message<ArrowUpRight size={16}/></OLink>}<small>{c.hours}</small></motion.div>}</AnimatePresence><button className="contact-trigger" data-testid="contact-toggle" aria-label="Contact ORYNVE" aria-expanded={open} onClick={()=>setOpen(!open)}><MessageCircle size={17}/><span>{c.floating_text}</span><span className="contact-status"/></button></div>;
};