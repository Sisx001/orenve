import os
import json
import re
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Literal
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, ConfigDict, model_validator
from core import db, now, uid, Document, Result
from auth import admin

router = APIRouter(prefix='/api')
class Product(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
    price: float = Field(ge=0, le=10000000)
    sale_price: float | None = Field(default=None, ge=0)
    status: Literal['draft','published','archived'] = 'draft'
    sizes: list[dict] = []
    images: list[str] = []
    @model_validator(mode='after')
    def check_values(self):
        if self.sale_price is not None and self.sale_price > self.price:
            raise ValueError('Sale price cannot exceed regular price.')
        for size in self.sizes:
            if not size.get('name') or not isinstance(size.get('stock'),int) or size['stock'] < 0:
                raise ValueError('Every size needs a name and non-negative whole-number stock.')
        if len({size['name'] for size in self.sizes}) != len(self.sizes):
            raise ValueError('Size names must be unique within a product.')
        colors=self.model_dump().get('colors',[])
        if not isinstance(colors,list) or any(not isinstance(c,dict) or not c.get('name') for c in colors):
            raise ValueError('Every color needs a name.')
        if len({c['name'] for c in colors})!=len(colors):
            raise ValueError('Color names must be unique within a product.')
        if self.status=='published' and (not self.images or not self.sizes or not colors):
            raise ValueError('Published products need at least one image, a color, and size information.')
        return self

class Store(BaseModel):
    model_config = ConfigDict(extra='allow')
    products: list[Product] = Field(max_length=1000)
    collections: list[dict] = []
    pages: list[dict] = []
    currencies: list[dict]
    site_mode: Literal['live','maintenance','coming_soon']
    @model_validator(mode='after')
    def validate_content(self):
        for items in (self.products,self.collections,self.pages):
            slugs = [p.slug if isinstance(p,Product) else p.get('slug') for p in items]
            if len(slugs) != len(set(slugs)):
                raise ValueError('Slugs must be unique within products, collections, and pages.')
            ids = [p.id if isinstance(p,Product) else p.get('id') for p in items]
            if len(ids) != len(set(ids)) or any(not id for id in ids):
                raise ValueError('Each product, collection, and page needs a unique ID.')
            if any(not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', str(slug or '')) for slug in slugs):
                raise ValueError('Page and collection slugs must use lowercase words separated by hyphens.')
        base = [c for c in self.currencies if c.get('code')=='BDT' and c.get('enabled') and c.get('rate')==1]
        if not base:
            raise ValueError('BDT must remain enabled at a conversion rate of 1.')
        if len({c.get('code') for c in self.currencies}) != len(self.currencies):
            raise ValueError('Currency codes must be unique.')
        for c in self.currencies:
            if not re.fullmatch(r'[A-Z]{3}',c.get('code','')) or not isinstance(c.get('rate'),(int,float)) or c['rate'] <= 0:
                raise ValueError('Currencies need a three-letter code and positive conversion rate.')
        validate_urls(self.model_dump())
        contact = self.model_dump().get('contact',{})
        if contact.get('whatsapp') and not re.fullmatch(r'\+?[1-9]\d{6,14}',contact['whatsapp'].replace(' ','')):
            raise ValueError('WhatsApp number must include country code and 7–15 digits.')
        return self

def validate_urls(value, key=''):
    if isinstance(value,dict):
        for k,v in value.items():
            if k.startswith('$') or '.' in k:
                raise ValueError('Invalid field name.')
            validate_urls(v,k)
    elif isinstance(value,list):
        for v in value:
            validate_urls(v,key)
    elif isinstance(value,str) and value and (key in ('href','link','cta_link','secondary_link','url','chat_url','image','image2','images','video','logo') or key.endswith('_url')):
        if not (value.startswith('https://') or (value.startswith('/') and not value.startswith('//')) or value.startswith('mailto:') or value.startswith('tel:') or value.startswith('#')):
            raise ValueError(f'{key} must be a secure URL or an internal path.')

class WorkspaceSave(BaseModel):
    store: Store
    version: int
class StoreResponse(BaseModel):
    store: dict[str,Any]
    preview: bool = False
    published_at: str | None = None
class WorkspaceResponse(StoreResponse):
    version: int
    updated_at: str
    has_changes: bool
class PreviewResult(BaseModel):
    token: str
    expires_at: str
class Revert(BaseModel):
    revision_id: str

async def get_store(preview=None):
    if preview:
        record = await db.previews.find_one({'token_hash':hashlib.sha256(preview.encode()).hexdigest()}, {'_id':0})
        if not record or record['expires_at'].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(403,'This preview link has expired. Create a new preview in the owner studio.')
        return record['store']
    site = await db.sites.find_one({'id':'main'}, {'_id':0,'published':1})
    return site['published']

@router.get('/store', response_model=StoreResponse)
async def storefront(preview: str | None = None):
    store = await get_store(preview)
    if not preview:
        store['products'] = [p for p in store['products'] if p['status']=='published']
        store['collections'] = [c for c in store['collections'] if c.get('published')]
        store['pages'] = [p for p in store['pages'] if p.get('published')]
    return {'store':store,'preview':bool(preview)}

@router.get('/admin/workspace', response_model=WorkspaceResponse)
async def workspace(user=Depends(admin)):
    site = await db.sites.find_one({'id':'main'}, {'_id':0})
    return {'store':site['draft'],'version':site['version'],'updated_at':site['updated_at'],'published_at':site['published_at'],'has_changes':site['draft']!=site['published']}

@router.put('/admin/workspace', response_model=Result)
async def save_workspace(data: WorkspaceSave,user=Depends(admin)):
    content = data.store.model_dump()
    if len(json.dumps(content)) > 8000000:
        raise HTTPException(413,'Store content is too large.')
    result = await db.sites.update_one({'id':'main','version':data.version},{'$set':{'draft':content,'updated_at':now()},'$inc':{'version':1}})
    if not result.matched_count:
        raise HTTPException(409,'Someone changed this draft. Reload the studio before saving.')
    return {'success':True,'version':data.version+1}

@router.post('/admin/publish', response_model=Result)
async def publish(user=Depends(admin)):
    site = await db.sites.find_one({'id':'main'},{'_id':0})
    Store(**site['draft'])
    stamp = now()
    await db.revisions.insert_one({'id':uid(),'created_at':stamp,'author':user['email'],'store':site['published'],'label':f"Before publish — {stamp[:16].replace('T',' ')}"})
    result=await db.sites.update_one({'id':'main','version':site['version']},{'$set':{'published':site['draft'],'published_at':stamp},'$inc':{'version':1}})
    if not result.matched_count:
        raise HTTPException(409,'The draft changed during publishing. Please try again.')
    return {'success':True,'published_at':stamp,'version':site['version']+1}

@router.post('/admin/preview',response_model=PreviewResult)
async def preview(user=Depends(admin)):
    site=await db.sites.find_one({'id':'main'},{'_id':0,'draft':1})
    token=secrets.token_urlsafe(32)
    expires=datetime.now(timezone.utc)+timedelta(hours=2)
    await db.previews.insert_one({'id':uid(),'token_hash':hashlib.sha256(token.encode()).hexdigest(),'store':site['draft'],'expires_at':expires})
    return {'token':token,'expires_at':expires.isoformat()}

@router.get('/admin/revisions',response_model=list[Document])
async def revisions(user=Depends(admin)):
    return await db.revisions.find({}, {'_id':0,'store':0}).sort('created_at',-1).limit(30).to_list(30)

@router.post('/admin/revert',response_model=Result)
async def revert(data:Revert,user=Depends(admin)):
    record=await db.revisions.find_one({'id':data.revision_id},{'_id':0})
    if not record:
        raise HTTPException(404,'Revision not found.')
    await db.sites.update_one({'id':'main'},{'$set':{'draft':record['store'],'updated_at':now()},'$inc':{'version':1}})
    return {'success':True}

@router.post('/admin/discard',response_model=Result)
async def discard(user=Depends(admin)):
    site=await db.sites.find_one({'id':'main'},{'_id':0,'published':1})
    await db.sites.update_one({'id':'main'},{'$set':{'draft':site['published'],'updated_at':now()},'$inc':{'version':1}})
    return {'success':True}

@router.get('/admin/activity',response_model=Result)
async def activity(user=Depends(admin)):
    inquiries=await db.inquiries.find({}, {'_id':0}).sort('created_at',-1).limit(100).to_list(100)
    contacts=await db.contacts.find({}, {'_id':0}).sort('created_at',-1).limit(100).to_list(100)
    subscribers=await db.subscribers.find({}, {'_id':0}).sort('created_at',-1).limit(100).to_list(100)
    return {'success':True,'inquiries':inquiries,'contacts':contacts,'subscribers':subscribers}

@router.patch('/admin/inquiries/{id}',response_model=Result)
async def update_inquiry(id:str,status:Literal['prepared','contacted','confirmed','closed'],user=Depends(admin)):
    result=await db.inquiries.update_one({'id':id},{'$set':{'status':status}})
    if not result.matched_count:
        raise HTTPException(404,'Inquiry not found.')
    return {'success':True}

@router.get('/sitemap.xml')
async def sitemap():
    store=await get_store()
    paths=['/','/shop','/collections','/lookbook','/contact']
    paths += ['/product/'+p['slug'] for p in store['products'] if p['status']=='published']
    paths += ['/collections/'+c['slug'] for c in store['collections'] if c.get('published')]
    paths += ['/'+p['slug'] for p in store['pages'] if p.get('published')]
    urls=''.join('<url><loc>'+escape(os.environ['FRONTEND_URL']+p)+'</loc></url>' for p in paths)
    return Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>',media_type='application/xml')

@router.get('/robots.txt')
async def robots():
    return Response('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nDisallow: /*?preview=\nSitemap: '+os.environ['FRONTEND_URL']+'/api/sitemap.xml',media_type='text/plain')