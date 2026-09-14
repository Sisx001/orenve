import { useState } from 'react';
import { ArrowUpRight, ArrowUp, MessageCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../context/StoreContext';
import { OLink } from './Common';
import { BrandWordmark } from './BrandWordmark';
import { api, errorText } from '../../lib/api';
import { toast } from 'sonner';
export { Header, CurrencySelect } from './Header';

export const Newsletter = ({compact=false}) => {
  const {store}=useStore();const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);try{await api.post('/newsletter',{email});setSuccess(true);toast.success('You’re on the list. Welcome to ORYNVE.');}catch(err){toast.error(errorText(err));}finally{setBusy(false);}};
  return <div className={`newsletter ${compact?'newsletter-compact':''}`} data-testid="newsletter-section"><span className="eyebrow">THE INNER CIRCLE</span><h2 className="section-heading">{store.newsletter.title}</h2><p>{store.newsletter.text}</p>{success?<div className="newsletter-success" data-testid="newsletter-success"><Check size={18}/> YOU’RE ON THE LIST.</div>:<form onSubmit={submit}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input type="email" id="newsletter-email" data-testid="newsletter-email" required placeholder="Your email address" value={email} onChange={e=>setEmail(e.target.value)}/><button type="submit" aria-label="Subscribe to newsletter" disabled={busy} data-testid="newsletter-submit">{busy?'…':<ArrowUpRight size={24}/>}</button></form>}<small>{store.newsletter.consent} <OLink to="/privacy" data-testid="newsletter-privacy">Read more.</OLink></small></div>;
};

export const Footer = () => {
  const {store}=useStore();
  return <footer className="site-footer" data-testid="site-footer">
    <div className="footer-top"><div className="footer-intro"><span className="footer-emblem">O/</span><p>{store.footer.statement}</p><span className="eyebrow">{store.contact.address}</span></div>{store.footer.groups.map((g,i)=><div className="footer-group" key={g.id}><h2>{g.title}</h2>{g.links.map((l,j)=><OLink key={j} to={l.href} data-testid={`footer-link-${i}-${j}`}>{l.label}</OLink>)}</div>)}{store.features.newsletter&&<Newsletter compact/>}</div>
    <div className="footer-wordmark"><BrandWordmark name={store.brand.name} testId="footer-wordmark"/></div>
    <div className="footer-bottom"><span data-testid="copyright">{store.footer.copyright}</span><div>{store.contact.socials.map((s,i)=><a href={s.href} key={i} target="_blank" rel="noreferrer" data-testid={`social-${i}`}>{s.label}<ArrowUpRight size={12}/></a>)}</div><button data-testid="back-to-top" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>BACK TO TOP<ArrowUp size={13}/></button></div>
  </footer>;
};

export const ContactFloat = () => {
  const {store}=useStore();const [open,setOpen]=useState(false);const c=store.contact;
  if(!c.whatsapp_enabled&&!c.email_enabled&&!c.chat_enabled&&!c.form_enabled)return null;
  return <div className={`contact-float contact-${c.floating_position}`}><AnimatePresence>{open&&<motion.div className="contact-popover" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}} data-testid="contact-popover"><span className="eyebrow">A PERSONAL CONNECTION</span><p>{c.text}</p>{c.whatsapp_enabled&&c.whatsapp&&<a href={`https://wa.me/${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" data-testid="contact-whatsapp">WhatsApp<ArrowUpRight size={16}/></a>}{c.email_enabled&&c.email&&<a href={`mailto:${c.email}`} data-testid="contact-email-link">Email us<ArrowUpRight size={16}/></a>}{c.chat_enabled&&c.chat_url&&<a href={c.chat_url} target="_blank" rel="noreferrer" data-testid="live-chat-link">Live chat<ArrowUpRight size={16}/></a>}{c.form_enabled&&<OLink to="/contact" onClick={()=>setOpen(false)} data-testid="contact-form-link">Leave a message<ArrowUpRight size={16}/></OLink>}<small>{c.hours}</small></motion.div>}</AnimatePresence><button className="contact-trigger" data-testid="contact-toggle" aria-label="Contact ORYNVE" aria-expanded={open} onClick={()=>setOpen(!open)}><MessageCircle size={17}/><span>{c.floating_text}</span><span className="contact-status"/></button></div>;
};