import { useState, useEffect, createElement } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, Copy, ImageIcon, GripVertical } from 'lucide-react';
import { Modal, Action } from '../../components/store/Common';
import { api, errorText, newId } from '../../lib/api';
import { toast } from 'sonner';
import { Switch } from '../../components/ui/switch';

export const humanize = key => key.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
const areas=new Set(['body','description','subheadline','headline','subtitle','text','message','statement','material','fit','care','shipping','returns','notes','seo_description','instructions','consent','title']);
const choices={status:['draft','published','archived'],site_mode:['live','maintenance','coming_soon'],theme:['light','dark'],font:['Outfit','Manrope','DM Sans'],spacing:['generous','compact'],border_style:['sharp'],floating_position:['right','left'],type:['featured','arrivals','editorial','lookbook','manifesto'],unit:['cm','in']};
export const Field = ({label,value,onChange,type='text',options,testId,help,...props}) => <label className="admin-field"><span>{label}</span>{options?<select value={value??''} onChange={e=>onChange(e.target.value)} data-testid={testId} {...props}>{options.map(o=><option key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>{typeof o==='string'?humanize(o):o.label}</option>)}</select>:type==='textarea'?<textarea rows={3} value={value??''} onChange={e=>onChange(e.target.value)} data-testid={testId} {...props}/>:<input type={type} value={value??''} onChange={e=>onChange(type==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value)} data-testid={testId} {...props}/>} {help&&<small>{help}</small>}</label>;
export const Toggle = ({label,value,onChange,testId,help}) => <div className="admin-toggle"><div><label htmlFor={testId}>{label}</label>{help&&<small>{help}</small>}</div><Switch id={testId} checked={!!value} onCheckedChange={onChange} data-testid={testId}/></div>;

export const MediaPicker = ({open,onOpenChange,onSelect}) => {
  const [media,setMedia]=useState([]),[loading,setLoading]=useState(false);
  useEffect(()=>{if(open){setLoading(true);api.get('/admin/media').then(r=>setMedia(r.data)).catch(e=>toast.error(errorText(e))).finally(()=>setLoading(false));}},[open]);
  const load=async()=>{setLoading(true);try{const {data}=await api.get('/admin/media');setMedia(data);}catch(e){toast.error(errorText(e));}finally{setLoading(false);}};
  return <Modal open={open} onOpenChange={o=>{onOpenChange(o);if(o)load();}} title="Choose from your library" testId="media-picker" className="admin-media-picker"><Action className="action-outline" onClick={load} data-testid="media-picker-load">{loading?'LOADING…':'LOAD MEDIA LIBRARY'}</Action><div className="media-picker-grid">{media.map(m=><button key={m.id} onClick={()=>{onSelect(m.url);onOpenChange(false);}} data-testid={`pick-media-${m.id}`}>{m.content_type.startsWith('image/')?<img src={m.url} alt={m.alt||m.name}/>:<video src={m.url} muted preload="metadata"/>}<span>{m.name}</span></button>)}</div>{!media.length&&!loading&&<p className="admin-hint">Upload assets in Media Library, then load your library here. Or paste a secure image URL.</p>}</Modal>;
};

export const MediaField = ({label,value,onChange,testId}) => {
  const [picker,setPicker]=useState(false);
  return <div className="admin-media-field"><Field label={label} value={value} onChange={onChange} testId={testId} placeholder="https://…"/><div className="media-field-preview">{value&&!/\.(mp4|webm)(\?|$)/.test(value)&&<img src={value} alt={label} onError={e=>{e.currentTarget.style.display='none';}}/>}<button className="admin-small-button" type="button" onClick={()=>setPicker(true)} data-testid={`${testId}-library`}><ImageIcon size={14}/>CHOOSE FROM LIBRARY</button></div><MediaPicker open={picker} onOpenChange={setPicker} onSelect={onChange}/></div>;
};

const template = (key,items) => {
  const defaults={navigation:{id:newId(),label:'New link',href:'/shop'},links:{label:'New link',href:'/shop'},socials:{label:'Instagram',href:'https://instagram.com/'},groups:{id:newId(),title:'NEW GROUP',links:[]},sections:{id:newId(),type:'editorial',title:'New perspective.',subtitle:'Your story starts here.',image:'',link:'/about',button:'DISCOVER MORE',enabled:false},colors:{name:'New color',hex:'#333333'},sizes:{name:'Custom',stock:0},currencies:{code:'CAD',symbol:'CA$',rate:0.011,enabled:false},product_ids:'',images:'',tags:'new',rows:['S','100','70','45'],labels:'Measurement'};
  if(defaults[key])return structuredClone(defaults[key]);
  if(items.length){const item=structuredClone(items[0]);if(typeof item==='object'&&!Array.isArray(item)){if(item.id)item.id=newId();if(item.slug)item.slug+='-copy';if(item.name)item.name+=' copy';}return item;}
  return '';
};

export const ObjectEditor = ({value,onChange,path='settings',hide=[],products=[]}) => createElement('div',{className:'object-editor'},Object.entries(value||{}).filter(([k])=>k!=='id'&&!hide.includes(k)).map(([key,val])=>createElement(ValueEditor,{key,name:key,value:val,onChange:v=>onChange({...value,[key]:v}),path:`${path}-${key}`,products})));

export const ValueEditor = ({name,value,onChange,path,products=[]}) => {
  const label=humanize(name);
  if(typeof value==='boolean')return <Toggle label={label} value={value} onChange={onChange} testId={path}/>;
  if(Array.isArray(value))return <ArrayEditor name={name} value={value} onChange={onChange} path={path} products={products}/>;
  if(value&&typeof value==='object')return <section className="admin-fieldset"><h3>{label}</h3><ObjectEditor value={value} onChange={onChange} path={path} products={products}/></section>;
  if(['image','image2','video','logo'].includes(name))return <MediaField label={label} value={value} onChange={onChange} testId={path}/>;
  if(name==='product_id')return <Field label={label} value={value} onChange={onChange} options={[{value:'',label:'Choose a product'},...products.map(p=>({value:p.id,label:p.name}))]} testId={path}/>;
  return <Field label={label} value={value} onChange={onChange} testId={path} type={typeof value==='number'||['sale_price','price','rate','stock','overlay'].includes(name)?'number':areas.has(name)?'textarea':name==='hex'||name==='accent'?'color':name==='launch_date'?'datetime-local':'text'} options={choices[name]} step="any" help={name==='rate'?'Conversion from 1 BDT. Converted prices are indicative.':name==='position'||name==='focal_point'?'Horizontal and vertical focal point, e.g. 50% 35%.':name==='whatsapp'?'Include country code, e.g. +8801XXXXXXXXX. Leave empty until ready.':undefined}/>;
};

export const ArrayEditor = ({name,value,onChange,path,products=[]}) => {
  const [drag,setDrag]=useState(null);
  const move=(from,to)=>{if(to<0||to>=value.length)return;const next=[...value];const [item]=next.splice(from,1);next.splice(to,0,item);onChange(next);};
  const update=(i,v)=>onChange(value.map((x,j)=>i===j?v:x));
  const duplicate=i=>{let copy=structuredClone(value[i]);if(copy&&typeof copy==='object'&&!Array.isArray(copy)){if(copy.id)copy.id=newId();if(copy.slug)copy.slug+='-copy-'+Date.now().toString().slice(-4);}const next=[...value];next.splice(i+1,0,copy);onChange(next);};
  return <section className="admin-array"><div className="admin-array-header"><h3>{humanize(name)} <small>{value.length}</small></h3><button type="button" onClick={()=>onChange([...value,template(name,value)])} data-testid={`${path}-add`}><Plus size={14}/>ADD</button></div>{value.map((item,i)=><details className="admin-array-item" key={item?.id||i} open={typeof item!=='object'||name==='sizes'||name==='colors'} draggable onDragStart={e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'){e.preventDefault();return;}setDrag(i);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag!==null)move(drag,i);setDrag(null);}}><summary><span><GripVertical size={13}/>{String(i+1).padStart(2,'0')} / {typeof item==='object'?(item.name||item.title||item.label||item.type||humanize(name)):name==='images'?'Image':String(item).slice(0,55)||'New item'}</span><div><button type="button" aria-label="Move up" onClick={e=>{e.preventDefault();move(i,i-1);}} disabled={i===0} data-testid={`${path}-${i}-up`}><ChevronUp size={14}/></button><button type="button" aria-label="Move down" onClick={e=>{e.preventDefault();move(i,i+1);}} disabled={i===value.length-1} data-testid={`${path}-${i}-down`}><ChevronDown size={14}/></button><button type="button" aria-label="Duplicate" onClick={e=>{e.preventDefault();duplicate(i);}} data-testid={`${path}-${i}-duplicate`}><Copy size={13}/></button><button type="button" aria-label="Delete" onClick={e=>{e.preventDefault();if(window.confirm('Remove this item from the draft?'))onChange(value.filter((_,j)=>i!==j));}} data-testid={`${path}-${i}-delete`}><Trash2 size={13}/></button></div></summary><div className="admin-array-body">{Array.isArray(item)?<div className="array-row-inputs">{item.map((v,j)=><Field key={j} label={`Column ${j+1}`} value={v} onChange={val=>update(i,item.map((x,k)=>j===k?val:x))} testId={`${path}-${i}-${j}`}/>)}</div>:item&&typeof item==='object'?<ObjectEditor value={item} onChange={v=>update(i,v)} path={`${path}-${i}`} products={products}/>:name==='images'?<MediaField label={`Image ${i+1}`} value={item} onChange={v=>update(i,v)} testId={`${path}-${i}`}/>:name==='product_ids'?<Field label="Product" value={item} options={[{value:'',label:'Choose a product'},...products.map(p=>({value:p.id,label:p.name}))]} onChange={v=>update(i,v)} testId={`${path}-${i}`}/>:<Field label={humanize(name)} value={item} onChange={v=>update(i,v)} testId={`${path}-${i}`}/>}</div></details>)}{!value.length&&<p className="admin-empty-inline">No items yet. Add your first one above.</p>}</section>;
};