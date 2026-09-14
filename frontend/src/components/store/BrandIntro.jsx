import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { BrandWordmark } from './BrandWordmark';
import { useStore } from '../../context/StoreContext';

export const INTRO_KEY='orynve-introduced-v2';
const hasSeen=()=>{try{return sessionStorage.getItem(INTRO_KEY)==='1';}catch{return false;}};
export const useBrandEntrance = () => {
  const {store,preview}=useStore();const reduced=useReducedMotion();
  const skip=reduced||preview||!store.features.preloader||!store.features.animations;
  const [ready,setReady]=useState(()=>hasSeen()||skip);
  useEffect(()=>{const complete=()=>setReady(true);window.addEventListener('orynve:intro-complete',complete);if(skip||hasSeen())setReady(true);return()=>window.removeEventListener('orynve:intro-complete',complete);},[skip]);
  return ready;
};

export const BrandIntro = () => {
  const {store,preview}=useStore();const reduced=useReducedMotion();
  const [show,setShow]=useState(()=>!hasSeen());const skipRef=useRef(null);
  const enabled=show&&!reduced&&!preview&&store.features.preloader&&store.features.animations;
  const done=useCallback(()=>{
    try{sessionStorage.setItem(INTRO_KEY,'1');}catch{/* The intro still closes when storage is unavailable. */}
    setShow(false);window.dispatchEvent(new Event('orynve:intro-complete'));
  },[]);
  useEffect(()=>{
    if(!enabled)return;
    const previous=document.activeElement;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    skipRef.current?.focus({preventScroll:true});
    const timeout=setTimeout(done,2100);
    return()=>{clearTimeout(timeout);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[enabled,done]);
  return <AnimatePresence>{enabled&&<motion.div className="brand-intro brand-intro-v2" role="dialog" aria-modal="true" aria-label={`Introducing ${store.brand.name}`} data-testid="brand-intro" exit={{clipPath:'inset(0 0 100% 0)',transition:{duration:.45,ease:[.76,0,.24,1]}} onKeyDown={e=>{if(e.key==='Escape')done();if(e.key==='Tab'){e.preventDefault();skipRef.current?.focus();}}}>
    <div className="intro-ambient" aria-hidden="true"/>
    <div className="intro-top"><span>{store.brand.name} / AN INDEPENDENT EXPRESSION</span><span>EST. MMXXVI</span></div>
    <div className="intro-identity"><span className="intro-registration" aria-hidden="true">+</span><BrandWordmark name={store.brand.name} animated testId="intro-wordmark"/><span className="intro-registration" aria-hidden="true">+</span></div>
    <motion.div className="intro-signature" initial={{opacity:0,y:9}} animate={{opacity:1,y:0}} transition={{delay:.85,duration:.65}}><span>FORM.</span><span>FEELING.</span><span>IDENTITY.</span></motion.div>
    <div className="intro-bottom"><div className="intro-chapter"><span>01 / THE FIRST EXPRESSION</span><motion.i initial={{scaleX:0}} animate={{scaleX:1}} transition={{duration:1.85,ease:[.22,1,.36,1]}}/></div><button ref={skipRef} className="intro-enter" onClick={done} data-testid="skip-intro">ENTER ORYNVE<ArrowUpRight size={17}/></button></div>
  </motion.div>}</AnimatePresence>;
};