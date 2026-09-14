from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from core import db, client, now
from auth import router as auth_router, seed_admin
from cms import router as cms_router
from commerce import router as commerce_router
from media import router as media_router
from seed import initial_store

@asynccontextmanager
async def lifespan(app):
    await seed_admin()
    await db.sites.create_index('id', unique=True)
    await db.previews.create_index('expires_at', expireAfterSeconds=0)
    await db.inquiries.create_index('id', unique=True)
    await db.subscribers.create_index('email', unique=True)
    if not await db.sites.find_one({'id': 'main'}):
        store = initial_store()
        await db.sites.insert_one({'id': 'main', 'draft': store, 'published': store, 'updated_at': now(), 'published_at': now(), 'version': 1})
    yield
    client.close()

app = FastAPI(title='ORYNVE Fashion House', lifespan=lifespan, docs_url=None, redoc_url=None)
origin = os.environ['FRONTEND_URL'].rstrip('/')
trusted_origins = {origin, os.environ['TRUSTED_PROXY_ORIGIN'].rstrip('/')}
app.add_middleware(CORSMiddleware, allow_origins=list(trusted_origins), allow_credentials=True, allow_methods=['GET','POST','PUT','PATCH','DELETE'], allow_headers=['Content-Type','Authorization'])

@app.middleware('http')
async def security_headers(request: Request, call_next):
    if request.method in ('POST','PUT','PATCH','DELETE') and request.url.path.startswith(('/api/admin', '/api/auth')):
        if request.headers.get('origin', '').rstrip('/') not in trusted_origins:
            logging.warning('Rejected CMS origin received=%r expected=%r host=%r forwarded_host=%r forwarded_proto=%r', request.headers.get('origin'), origin, request.headers.get('host'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))
            return JSONResponse({'detail': 'Request origin is not permitted.'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    if request.url.path.startswith(('/api/admin','/api/auth')) or request.query_params.get('preview'):
        response.headers['Cache-Control'] = 'no-store'
    return response

@app.get('/api/health')
async def health():
    await db.command('ping')
    return {'status': 'ok', 'brand': 'ORYNVE'}

app.include_router(auth_router)
app.include_router(cms_router)
app.include_router(commerce_router)
app.include_router(media_router)