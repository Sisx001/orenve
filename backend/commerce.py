import os
import re
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr
from core import db, uid, now, Result
from cms import get_store

router=APIRouter(prefix='/api')
class Item(BaseModel):
    product_id:str
    size:str
    color:str
    quantity:int=Field(ge=1,le=20)
class Order(BaseModel):
    items:list[Item]=Field(min_length=1,max_length=30)
    currency:str='BDT'
    notes:str=Field(default='',max_length=1500)
    name:str=Field(default='',max_length=120)
    phone:str=Field(default='',max_length=30)
    address:str=Field(default='',max_length=500)
class OrderResponse(BaseModel):
    id:str
    summary:str
    total:float
    currency:str
    whatsapp_url:str|None
    email:str
    status:str
class Subscription(BaseModel):
    email:EmailStr
class Contact(BaseModel):
    name:str=Field(min_length=1,max_length=120)
    email:EmailStr
    message:str=Field(min_length=10,max_length=4000)
    website:str=''

async def rate_limit(request,kind,limit=20):
    ip=request.headers.get('x-forwarded-for',request.client.host).split(',')[0]
    cutoff=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()
    if await db.rate_events.count_documents({'ip':ip,'kind':kind,'created_at':{'$gte':cutoff}})>=limit:
        raise HTTPException(429,'Please wait a little before trying again.')
    await db.rate_events.insert_one({'ip':ip,'kind':kind,'created_at':now()})

@router.post('/orders/prepare',response_model=OrderResponse)
async def prepare(data:Order,request:Request):
    await rate_limit(request,'orders',60)
    store=await get_store()
    if store['site_mode']!='live':
        raise HTTPException(409,'Ordering is temporarily paused.')
    if not store['features'].get('whatsapp') or not store['checkout'].get('whatsapp_enabled'):
        raise HTTPException(409,'WhatsApp ordering is currently unavailable. Please contact us.')
    currencies={c['code']:c for c in store['currencies'] if c.get('enabled')}
    if data.currency not in currencies:
        raise HTTPException(400,'This currency is not available.')
    rate=currencies[data.currency]['rate']
    products={p['id']:p for p in store['products'] if p['status']=='published'}
    order_id='ORY-'+uid().split('-')[0].upper()
    lines=['Hello ORYNVE, I’d like to order the following pieces:','']
    total=0
    normalized=[]
    combined={}
    reserved_by_size={}
    for item in data.items:
        key=(item.product_id,item.size,item.color)
        combined[key]=combined.get(key,0)+item.quantity
        stock_key=(item.product_id,item.size)
        reserved_by_size[stock_key]=reserved_by_size.get(stock_key,0)+item.quantity
    for (product_id,size,color),quantity in combined.items():
        p=products.get(product_id)
        if not p:
            raise HTTPException(409,'A piece in your bag is no longer available.')
        stock=next((s['stock'] for s in p.get('sizes',[]) if s['name']==size),0)
        if reserved_by_size[(product_id,size)]>stock or quantity>20:
            raise HTTPException(409,f"{p['name']} in {size}: only {stock} available.")
        if color not in [c['name'] for c in p.get('colors',[])]:
            raise HTTPException(400,'Please choose an available color.')
        amount=p.get('sale_price') if p.get('sale_price') is not None else p['price']
        total+=amount*quantity
        lines += [p['name'],f'Size: {size} | Color: {color} | Quantity: {quantity}',f"Unit price: {data.currency} {amount*rate:,.2f}"]
        if store['checkout'].get('product_link'):
            lines.append(os.environ['FRONTEND_URL']+'/product/'+p['slug'])
        lines.append('')
        normalized.append({'product_id':product_id,'name':p['name'],'size':size,'color':color,'quantity':quantity,'unit_price_bdt':amount})
    lines.append(f'Estimated subtotal: {data.currency} {total*rate:,.2f}')
    if data.currency!='BDT':
        lines.append(f'Base subtotal: BDT {total:,.2f} (converted price is indicative)')
    if store['checkout'].get('order_identifier'):
        lines.append(f'Reference: {order_id}')
    if data.notes and store['checkout'].get('notes_enabled'):
        lines += ['', 'Notes: '+data.notes]
    if store['checkout'].get('shipping_fields'):
        for label,val in [('Name',data.name),('Phone',data.phone),('Address',data.address)]:
            if val:
                lines.append(f'{label}: {val}')
    lines += ['',store['checkout'].get('instructions',''), 'Please confirm availability, shipping, and payment details.']
    summary='\n'.join(lines)
    number=re.sub(r'\D','',store['contact'].get('whatsapp',''))
    whatsapp_url=f'https://wa.me/{number}?text={quote(summary)}' if number else None
    record={'id':order_id,'items':normalized,'total_bdt':total,'currency':data.currency,'summary':summary,'notes':data.notes,'name':data.name,'phone':data.phone,'address':data.address,'status':'prepared','created_at':now()}
    await db.inquiries.insert_one(record.copy())
    return {'id':order_id,'summary':summary,'total':round(total*rate,2),'currency':data.currency,'whatsapp_url':whatsapp_url,'email':store['contact'].get('email',''),'status':'prepared'}

@router.post('/newsletter',response_model=Result)
async def subscribe(data:Subscription,request:Request):
    await rate_limit(request,'newsletter',15)
    store=await get_store()
    if not store['features'].get('newsletter'):
        raise HTTPException(409,'Newsletter subscriptions are paused.')
    await db.subscribers.update_one({'email':data.email.lower()},{'$setOnInsert':{'id':uid(),'created_at':now()}},upsert=True)
    return {'success':True,'message':'You’re on the list. Welcome to ORYNVE.'}

@router.post('/contact',response_model=Result)
async def contact(data:Contact,request:Request):
    await rate_limit(request,'contact',15)
    store=await get_store()
    if not store['contact'].get('form_enabled'):
        raise HTTPException(409,'The contact form is currently closed.')
    if data.website:
        return {'success':True}
    await db.contacts.insert_one({'id':uid(),**data.model_dump(exclude={'website'}),'created_at':now(),'status':'new'})
    return {'success':True,'message':'Your message is with the ORYNVE team. We’ll reply to your email.'}