import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring } from 'framer-motion';
import Lenis from 'lenis';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';

export const MotionSystem = () => {
  const {store,cartOpen,searchOpen,quickView}=useStore(); const reduced=useReducedMotion(); const location=useLocation();
  const x=useMotionValue(-100),y=useMotionValue(-100),sx=useSpring(x,{stiffness:160,damping:25}),sy=useSpring(y,{stiffness:160,damping:25});
  const [label,setLabel]=useState(''), [visible,setVisible]=useState(false);
  const [intro,setIntro]=useState(()=>!sessionStorage.getItem('orynve-introduced'));
  const lenis=useRef();
  const done=()=>{sessionStorage.setItem('orynve-introduced','1');setIntro(false);};
  useEffect(()=>{const t=setTimeout(done,1750);return()=>clearTimeout(t);},[]);
  useEffect(()=>{
    if(reduced||!store.features.animations)return;
    const instance=new Lenis({duration:1.15,smoothWheel:true,autoRaf:true,anchors:true,prevent:node=>node.closest('[data-lenis-prevent]')});lenis.current=instance;
    return()=>{instance.destroy();lenis.current=null;};
  },[reduced,store.features.animations]);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});lenis.current?.scrollTo(0,{immediate:true});},[location.pathname]);
  useEffect(()=>{if(cartOpen||searchOpen||quickView)lenis.current?.stop();else lenis.current?.start();},[cartOpen,searchOpen,quickView]);
  useEffect(()=>{
    if(reduced||!store.features.cursor||!window.matchMedia('(pointer:fine)').matches)return;
    const move=e=>{x.set(e.clientX);y.set(e.clientY);setVisible(true);setLabel(e.target.closest('[data-cursor]')?.dataset.cursor||'');};
    const hide=()=>setVisible(false);window.addEventListener('mousemove',move);document.addEventListener('mouseleave',hide);
    return()=>{window.removeEventListener('mousemove',move);document.removeEventListener('mouseleave',hide);};
  },[reduced,store.features.cursor,x,y]);
  return <><AnimatePresence>{intro&&!reduced&&store.features.preloader&&<motion.div className="brand-intro" data-testid="brand-intro" exit={{opacity:0,transition:{duration:.45}}}><div className="intro-wordmark">{store.brand.name.split('').map((l,i)=><motion.span key={i} initial={{opacity:0,filter:'blur(8px)',x:12}} animate={{opacity:1,filter:'blur(0px)',x:0}} transition={{delay:i*.085,duration:.65}}>{l}</motion.span>)}</div><motion.span className="intro-line" initial={{scaleX:0}} animate={{scaleX:1}} transition={{duration:1.3}}/><span className="intro-caption">AN INDEPENDENT EXPRESSION</span><button className="intro-skip" onClick={done} data-testid="skip-intro">ENTER ↗</button></motion.div>}</AnimatePresence>{store.features.cursor&&!reduced&&<motion.div aria-hidden="true" className={`custom-cursor ${label?'cursor-label':''}`} style={{left:sx,top:sy,opacity:visible?1:0}}>{label}</motion.div>}</>;
};