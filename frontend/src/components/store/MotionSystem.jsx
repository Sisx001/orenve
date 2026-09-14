import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useMotionValue, useSpring } from 'framer-motion';
import Lenis from 'lenis';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { BrandIntro } from './BrandIntro';

export const MotionSystem = () => {
  const {store,cartOpen,searchOpen,quickView}=useStore();const reduced=useReducedMotion();const location=useLocation();
  const x=useMotionValue(-100),y=useMotionValue(-100),sx=useSpring(x,{stiffness:160,damping:25}),sy=useSpring(y,{stiffness:160,damping:25});
  const [label,setLabel]=useState(''),[visible,setVisible]=useState(false);const lenis=useRef();
  useEffect(()=>{
    if(reduced||!store.features.animations)return;
    const instance=new Lenis({duration:1.15,smoothWheel:true,autoRaf:true,anchors:true,prevent:node=>node.closest('[data-lenis-prevent]')});lenis.current=instance;
    return()=>{instance.destroy();lenis.current=null;};
  },[reduced,store.features.animations]);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});lenis.current?.scrollTo(0,{immediate:true});},[location.pathname]);
  useEffect(()=>{if(cartOpen||searchOpen||quickView)lenis.current?.stop();else lenis.current?.start();},[cartOpen,searchOpen,quickView]);
  useEffect(()=>{
    if(reduced||!store.features.cursor||!store.features.animations||!window.matchMedia('(pointer:fine)').matches)return;
    const move=e=>{x.set(e.clientX);y.set(e.clientY);setVisible(true);setLabel(e.target.closest('[data-cursor]')?.dataset.cursor||'');};
    const hide=()=>setVisible(false);window.addEventListener('mousemove',move);document.addEventListener('mouseleave',hide);
    return()=>{window.removeEventListener('mousemove',move);document.removeEventListener('mouseleave',hide);};
  },[reduced,store.features.cursor,store.features.animations,x,y]);
  return <><BrandIntro/>{store.features.cursor&&store.features.animations&&!reduced&&<motion.div aria-hidden="true" className={`custom-cursor ${label?'cursor-label':''}`} style={{left:sx,top:sy,opacity:visible?1:0}}>{label}</motion.div>}</>;
};