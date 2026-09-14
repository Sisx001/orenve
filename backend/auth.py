import os
import bcrypt
import jwt
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from core import db, uid, now

router = APIRouter(prefix='/api/auth')
class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
class Owner(BaseModel):
    id: str
    email: str
    role: str

async def seed_admin():
    await db.users.create_index('email', unique=True)
    await db.sessions.create_index('expires_at', expireAfterSeconds=0)
    await db.login_attempts.create_index('identifier', unique=True)
    await db.login_attempts.create_index('expires_at', expireAfterSeconds=0)
    email, password = os.environ['ADMIN_EMAIL'].lower(), os.environ['ADMIN_PASSWORD']
    existing = await db.users.find_one({'email': email}, {'_id': 0})
    if not existing:
        await db.users.insert_one({'id': uid(), 'email': email, 'role': 'admin', 'password_hash': bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(), 'created_at': now()})
    elif not bcrypt.checkpw(password.encode(), existing['password_hash'].encode()):
        await db.users.update_one({'id': existing['id']}, {'$set': {'password_hash': bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()}})
        await db.sessions.delete_many({'user_id': existing['id']})

def decode(token, kind):
    try:
        payload = jwt.decode(token, os.environ['JWT_SECRET'], algorithms=['HS256'])
        if payload.get('type') != kind:
            raise ValueError()
        return payload
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, 'Your session has expired. Please sign in again.')

async def admin(request: Request):
    token = request.cookies.get('access_token')
    if not token:
        raise HTTPException(401, 'Please sign in to the owner studio.')
    payload = decode(token, 'access')
    session = await db.sessions.find_one({'id': payload['sid'], 'user_id': payload['sub']}, {'_id': 0})
    if not session or session['expires_at'].replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(401, 'Session is no longer active.')
    user = await db.users.find_one({'id': payload['sub'], 'role': 'admin'}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(401, 'Owner not found.')
    return user

async def issue(response, user, old_sid=None):
    if old_sid:
        await db.sessions.delete_one({'id': old_sid})
    sid = uid()
    current = datetime.now(timezone.utc)
    await db.sessions.insert_one({'id': sid, 'user_id': user['id'], 'expires_at': current + timedelta(days=7)})
    for kind, age in [('access',900), ('refresh',604800)]:
        token = jwt.encode({'sub':user['id'], 'sid':sid, 'type':kind, 'exp':current+timedelta(seconds=age)}, os.environ['JWT_SECRET'], algorithm='HS256')
        response.set_cookie(f'{kind}_token', token, max_age=age, httponly=True, secure=True, samesite='none', path='/')

@router.post('/login', response_model=Owner)
async def login(data: Login, request: Request, response: Response):
    email = data.email.lower().strip()
    ip = request.headers.get('x-forwarded-for', request.client.host).split(',')[0].strip()
    identifier = hashlib.sha256(f'{ip}:{email}'.encode()).hexdigest()
    attempts = await db.login_attempts.find_one({'identifier': identifier}, {'_id': 0})
    current = datetime.now(timezone.utc)
    if attempts and attempts.get('count',0) >= 5 and attempts['expires_at'].replace(tzinfo=timezone.utc) > current:
        raise HTTPException(429, 'Too many attempts. Please try again in 15 minutes.')
    if attempts and attempts['expires_at'].replace(tzinfo=timezone.utc) <= current:
        await db.login_attempts.delete_one({'identifier': identifier})
    user = await db.users.find_one({'email': email}, {'_id': 0})
    if not user or not bcrypt.checkpw(data.password.encode(), user['password_hash'].encode()):
        await db.login_attempts.update_one({'identifier': identifier}, {'$inc': {'count':1}, '$set': {'expires_at': current+timedelta(minutes=15)}}, upsert=True)
        raise HTTPException(401, 'Email or password is incorrect.')
    await db.login_attempts.delete_one({'identifier': identifier})
    await issue(response, user)
    return Owner(**user)

@router.get('/me', response_model=Owner)
async def me(user=Depends(admin)):
    return user

@router.post('/refresh', response_model=Owner)
async def refresh(request: Request, response: Response):
    payload = decode(request.cookies.get('refresh_token',''), 'refresh')
    session = await db.sessions.find_one({'id': payload['sid'], 'user_id': payload['sub']}, {'_id':0})
    if not session:
        raise HTTPException(401, 'Session expired.')
    user = await db.users.find_one({'id':payload['sub'], 'role':'admin'}, {'_id':0, 'password_hash':0})
    if not user:
        raise HTTPException(401, 'Owner not found.')
    await issue(response, user, payload['sid'])
    return user

@router.post('/logout')
async def logout(request: Request, response: Response):
    try:
        payload = decode(request.cookies.get('refresh_token',''), 'refresh')
        await db.sessions.delete_one({'id': payload['sid']})
    except HTTPException:
        pass
    for kind in ('access','refresh'):
        response.delete_cookie(f'{kind}_token', path='/', secure=True, httponly=True, samesite='none')
    return {'success':True}