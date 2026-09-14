import os
import io
import asyncio
import requests
from PIL import Image, UnidentifiedImageError
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from core import db, uid, now, Document, Result
from auth import admin

router=APIRouter(prefix='/api')
STORAGE_BASE=(os.environ.get('INTEGRATION_PROXY_URL') or '').strip() or 'https://integrations.emergentagent.com'
STORAGE_URL=STORAGE_BASE.rstrip('/')+'/objstore/api/v1/storage'
storage_key=None

def init_storage(force=False):
    global storage_key
    if storage_key and not force:
        return storage_key
    r=requests.post(STORAGE_URL+'/init',json={'emergent_key':os.environ['EMERGENT_LLM_KEY']},timeout=30)
    r.raise_for_status()
    storage_key=r.json()['storage_key']
    return storage_key

def storage_request(method,path,**kwargs):
    key=init_storage()
    headers=kwargs.pop('headers',{})
    r=requests.request(method,STORAGE_URL+'/objects/'+path,headers={'X-Storage-Key':key,**headers},timeout=90,**kwargs)
    if r.status_code==404:
        key=init_storage(True)
        r=requests.request(method,STORAGE_URL+'/objects/'+path,headers={'X-Storage-Key':key,**headers},timeout=90,**kwargs)
    r.raise_for_status()
    return r

class MediaEdit(BaseModel):
    alt:str=Field(default='',max_length=500)
    name:str=Field(min_length=1,max_length=200)
    focal_point:str=Field(default='50% 50%',pattern=r'^\d{1,3}% \d{1,3}%$')
    folder:str=Field(default='Library',max_length=100)

@router.get('/admin/media',response_model=list[Document])
async def list_media(user=Depends(admin)):
    return await db.media.find({'is_deleted':False},{'_id':0,'storage_path':0}).sort('created_at',-1).to_list(1000)

@router.post('/admin/media',response_model=Document)
async def upload(file:UploadFile=File(...),user=Depends(admin)):
    allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}
    mime=file.content_type
    if mime not in allowed:
        raise HTTPException(415,'Upload JPEG, PNG, WebP, MP4, or WebM files.')
    data=await file.read(30*1024*1024+1)
    if not data or len(data)>30*1024*1024:
        raise HTTPException(413,'Files must be between 1 byte and 30 MB.')
    if mime.startswith('image/'):
        try:
            picture=Image.open(io.BytesIO(data))
            picture.verify()
            if picture.format not in ('JPEG','PNG','WEBP') or picture.width*picture.height>60000000:
                raise ValueError()
        except (UnidentifiedImageError,ValueError,OSError,Image.DecompressionBombError):
            raise HTTPException(415,'This file is not a valid supported image.')
    elif mime=='video/mp4' and data[4:8]!=b'ftyp':
        raise HTTPException(415,'Invalid MP4 file.')
    elif mime=='video/webm' and data[:4]!=b'\x1aE\xdf\xa3':
        raise HTTPException(415,'Invalid WebM file.')
    id=uid()
    path=f"{os.environ['STORAGE_APP_NAME']}/uploads/{user['id']}/{id}.{allowed[mime]}"
    try:
        response=await asyncio.to_thread(storage_request,'PUT',path,data=data,headers={'Content-Type':mime})
        result=response.json()
    except requests.RequestException:
        raise HTTPException(503,'Media storage is temporarily unavailable. Your file has not been saved; please retry.')
    record={'id':id,'storage_path':result['path'],'name':file.filename[:200],'content_type':mime,'size':len(data),'alt':'','focal_point':'50% 50%','folder':'Library','url':os.environ['FRONTEND_URL']+'/api/media/'+id,'is_deleted':False,'created_at':now()}
    await db.media.insert_one(record.copy())
    return {k:v for k,v in record.items() if k!='storage_path'}

@router.get('/media/{id}')
async def get_media(id:str):
    record=await db.media.find_one({'id':id,'is_deleted':False},{'_id':0})
    if not record:
        raise HTTPException(404,'Media not found.')
    try:
        response=await asyncio.to_thread(storage_request,'GET',record['storage_path'])
    except requests.RequestException:
        raise HTTPException(503,'Unable to load this media right now.')
    return Response(response.content,media_type=record['content_type'],headers={'Cache-Control':'public, max-age=86400'})

@router.put('/admin/media/{id}',response_model=Result)
async def edit_media(id:str,data:MediaEdit,user=Depends(admin)):
    result=await db.media.update_one({'id':id,'is_deleted':False},{'$set':data.model_dump()})
    if not result.matched_count:
        raise HTTPException(404,'Media not found.')
    return {'success':True}

@router.delete('/admin/media/{id}',response_model=Result)
async def delete_media(id:str,user=Depends(admin)):
    site=await db.sites.find_one({'id':'main'},{'_id':0})
    import json
    if '/api/media/'+id in json.dumps(site):
        raise HTTPException(409,'This media is used in your storefront. Replace it and publish the change before deleting.')
    result=await db.media.update_one({'id':id},{'$set':{'is_deleted':True}})
    if not result.matched_count:
        raise HTTPException(404,'Media not found.')
    return {'success':True}