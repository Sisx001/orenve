import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Bespoke geometric letterforms: open spacing, a cut R leg, and a low V vertex.
const letters = [
  'M29 5C14 5 7 14 7 32S14 59 29 59S51 50 51 32S44 5 29 5Z',
  'M8 59V5H28C42 5 49 11 49 21S42 37 28 37H8M28 37L51 59',
  'M4 5L27 33L50 5M27 33V59',
  'M8 59V5L49 59V5',
  'M4 5L27 59L50 5',
  'M49 5H8V59H49M8 32H42',
];

export const BrandWordmark = ({name='ORYNVE',animated=false,className='',testId='orynve-wordmark'}) => {
  const reduced=useReducedMotion();
  const id=useId().replace(/:/g,'');
  const animate=animated&&!reduced;
  if(name.toUpperCase()!=='ORYNVE')return <span className={`custom-wordmark wordmark-text ${className}`} data-testid={testId}>{name}</span>;
  return <span className={`custom-wordmark ${animate?'wordmark-animated':''} ${className}`} data-testid={testId}>
    <svg viewBox="0 0 397 68" role="img" aria-label="ORYNVE" className="wordmark-svg">
      <defs>
        <linearGradient id={`glint-${id}`} x1="-100%" y1="0" x2="0%" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0"/>
          <stop offset=".48" stopColor="currentColor" stopOpacity="0"/>
          <stop offset=".56" stopColor="#fff" stopOpacity=".85"/>
          <stop offset=".66" stopColor="currentColor" stopOpacity="0"/>
          {animate&&<><animate attributeName="x1" from="-100%" to="150%" dur="1.25s" begin=".65s" fill="freeze"/><animate attributeName="x2" from="0%" to="250%" dur="1.25s" begin=".65s" fill="freeze"/></>}
        </linearGradient>
        <clipPath id={`wordmark-clip-${id}`}><rect width="397" height="68"/></clipPath>
      </defs>
      <g clipPath={`url(#wordmark-clip-${id})`} fill="none" stroke="currentColor" strokeWidth="7.2" strokeLinejoin="miter">
        {letters.map((d,i)=><g key={i} transform={`translate(${i*66},2)`}><motion.path d={d} initial={animate?{opacity:0,y:70}:false} animate={{opacity:1,y:0}} transition={{delay:i*.075,duration:.8,ease:[.16,1,.3,1]}}/><path d={d} stroke={`url(#glint-${id})`} className="wordmark-glint"/></g>)}
      </g>
    </svg>
    <span className="wordmark-trademark" aria-hidden="true">™</span>
  </span>;
};

export const BrandLoading = ({studio=false}) => <div className="store-loading brand-loading-state" data-testid="store-loading" role="status" aria-label={studio?'Loading owner studio':'Loading ORYNVE'}><span className="brand-loading-coordinate" aria-hidden="true">O / 01</span><BrandWordmark animated testId="loading-wordmark"/><span className="loading-rule"/><p data-testid="loading-label">{studio?'OPENING THE STUDIO':'SETTING THE SCENE'}</p><span className="brand-loading-caption">INDEPENDENT BY DESIGN.</span></div>;