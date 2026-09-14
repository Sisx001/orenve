import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { SEO, OLink, EmptyState, Modal, Image, TextLink } from '../components/store/Common';
import { ProductDetails } from '../components/store/ProductDetails';
import { Gallery } from '../components/store/Gallery';
import { ProductCard } from '../components/store/ProductCard';
import { imgUrl } from '../lib/api';

export const QuickView = () => {
  const {quickView,setQuickView}=useStore();const location=useLocation();
  useEffect(()=>{setQuickView(null);},[location.pathname,setQuickView]);
  return <Modal open={!!quickView} onOpenChange={o=>{if(!o)setQuickView(null);}} title="A closer look." testId="quick-view-modal" className="quick-view-modal">{quickView&&<div className="quick-view-grid"><Image src={imgUrl(quickView.images[0],1000)} alt={quickView.name} style={{objectPosition:quickView.focal_point}}/><div className="quick-view-scroll" data-lenis-prevent><ProductDetails key={quickView.id} product={quickView} quick/></div></div>}</Modal>;
};

export default function Product(){const {slug}=useParams(),{store}=useStore();const p=store.products.find(p=>p.slug===slug);if(!p)return <EmptyState title="This piece has moved on." text="It may be archived or currently unavailable. Discover something else to make your own."/>;const related=store.products.filter(x=>x.id!==p.id).slice(0,4);return <><SEO title={p.seo_title||`${p.name} | ORYNVE`} description={p.seo_description||p.description} image={p.images[0]} product={p}/><div className="product-breadcrumb"><OLink to="/shop" data-testid="product-back-shop">THE WARDROBE</OLink><span>/</span><span data-testid="product-breadcrumb-name">{p.name.toUpperCase()}</span></div><div className="product-page"><Gallery key={p.id} product={p}/><ProductDetails key={p.id} product={p}/></div><section className="product-section section-pad"><div className="section-header"><div><span className="eyebrow">IN GOOD COMPANY</span><h2 className="section-heading">Complete your perspective.</h2></div><TextLink to="/shop" testId="related-view-all">ALL PIECES</TextLink></div><div className="product-grid">{related.map((p,i)=><ProductCard product={p} index={i} prefix="related" key={p.id}/>)}</div></section></>;}