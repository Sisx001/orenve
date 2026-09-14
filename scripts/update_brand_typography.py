"""Apply the owner's requested typeface without publishing unrelated drafts."""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('/app/backend/.env'))
sys.path.insert(0, '/app/backend')
from core import db, client, now

async def update():
    site = await db.sites.find_one({'id': 'main'}, {'_id': 0})
    changes = {}
    for state in ('draft', 'published'):
        if site[state]['brand'].get('font') in ('Manrope', 'DM Sans'):
            changes[f'{state}.brand.font'] = 'Outfit'
    if changes:
        changes['updated_at'] = now()
        await db.sites.update_one({'id': 'main', 'version': site['version']}, {'$set': changes, '$inc': {'version': 1}})
    print('Requested Outfit typography applied. Other draft and published content preserved.')
    client.close()

if __name__ == '__main__':
    asyncio.run(update())