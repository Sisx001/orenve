import { Sun, Moon } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ThemeToggle = ({id='header-theme-toggle',expanded=false}) => {
  const {theme,setTheme}=useStore();const dark=theme==='dark';
  return <div className={`theme-control ${expanded?'theme-control-expanded':''}`}>
    {expanded&&<div className="theme-control-label"><span>APPEARANCE</span><strong data-testid={`${id}-label`}>{dark?'After dark.':'In the light.'}</strong></div>}
    <button type="button" role="switch" aria-label="Dark mode" aria-checked={dark} title={`Switch to ${dark?'light':'dark'} mode`} onClick={()=>setTheme(dark?'light':'dark')} className={`theme-toggle ${dark?'is-dark':''}`} data-testid={id}>
      <span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-thumb"/><Sun size={15} strokeWidth={1.8}/><Moon size={15} strokeWidth={1.8}/></span>
    </button>
  </div>;
};