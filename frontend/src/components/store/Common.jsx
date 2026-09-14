import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { useStore } from '../../context/StoreContext';
import { BASE } from '../../lib/api';

export const OLink = ({to,children,onClick,...props}) => {
  const ctx=useStore();
  const clicked=e=>{onClick?.(e);if(!e.defaultPrevented){ctx?.setCartOpen(false);ctx?.setSearchOpen(false);ctx?.setQuickView(null);}};
  const target=ctx?.preview && !to.startsWith('/admin') ? `${to}${to.includes('?')?'&':'?'}preview=${ctx.preview}` : to;
  if (/^(https:|mailto:|tel:)/.test(to)) return <a href={to} onClick={clicked} {...props}>{children}</a>;
  return <Link to={target} onClick={clicked} {...props}>{children}</Link>;
};
export const Reveal = ({children,className='',delay=0}) => {
  const reduced=useReducedMotion(), ctx=useStore();
  return <motion.div className={className} initial={reduced||!ctx?.store?.features.animations?false:{opacity:0,y:35}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.12}} transition={{duration:.85,delay,ease:[.22,1,.36,1]}}>{children}</motion.div>;
};
export const Action = ({children,className='',...props}) => <Button className={`action ${className}`} {...props}>{children}</Button>;
export const TextLink = ({to,children,testId,className=''}) => <OLink to={to} className={`text-link ${className}`} data-testid={testId}>{children}<ArrowUpRight size={16}/></OLink>;
export const Modal = ({open,onOpenChange,title,description,children,className='',testId}) => <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`ory-modal ${className}`} data-testid={testId} aria-describedby={description?`${testId}-description`:undefined}><DialogTitle className="modal-title" data-testid={`${testId}-title`}>{title}</DialogTitle>{description&&<DialogDescription id={`${testId}-description`} data-testid={`${testId}-description`}>{description}</DialogDescription>}{children}</DialogContent></Dialog>;
export const EmptyState = ({title,text,link='/shop',label='EXPLORE THE COLLECTION',testId='empty-state'}) => <div className="empty-state" data-testid={testId}><span className="empty-emblem">O/</span><h1>{title}</h1><p>{text}</p><TextLink to={link} testId={`${testId}-link`}>{label}</TextLink></div>;
export const Image = ({src,alt,className='',...props}) => <img src={src} alt={alt||'ORYNVE menswear'} className={className} {...props} onError={e=>{e.currentTarget.style.opacity='.25';e.currentTarget.alt='Image currently unavailable';}}/>;
export const SEO = ({title,description,image,product}) => {
  const ctx=useStore();
  useEffect(()=>{
    document.title=title||ctx?.store?.seo.title||'ORYNVE';
    const setMeta=(key,content,property=false)=>{let el=document.querySelector(`meta[${property?'property':'name'}="${key}"]`);if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',key);document.head.appendChild(el);}el.content=content||'';};
    const desc=description||ctx?.store?.seo.description;
    setMeta('description',desc);setMeta('og:title',document.title,true);setMeta('og:description',desc,true);setMeta('og:image',image||ctx?.store?.seo.image,true);setMeta('og:type',product?'product':'website',true);
    setMeta('robots',ctx?.preview?'noindex, nofollow':'index, follow');
    let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical);}canonical.href=BASE+window.location.pathname;
    const old=document.getElementById('product-schema');if(old)old.remove();
    if(product){const el=document.createElement('script');el.id='product-schema';el.type='application/ld+json';el.textContent=JSON.stringify({'@context':'https://schema.org','@type':'Product',name:product.name,image:product.images,description:product.description,sku:product.sku,brand:{'@type':'Brand',name:ctx.store.brand.name},offers:{'@type':'Offer',url:BASE+'/product/'+product.slug,priceCurrency:'BDT',price:product.sale_price??product.price,availability:product.sizes.some(s=>s.stock>0)?'https://schema.org/InStock':'https://schema.org/OutOfStock'}});document.head.appendChild(el);}
  },[title,description,image,product,ctx?.store,ctx?.preview]);
  return null;
};
export { ArrowUpRight, ArrowRight };