"""One-time refinement of the initial editorial content; preserves owner edits."""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('/app/backend/.env'))
sys.path.insert(0, '/app/backend')
from core import db, client

async def refine():
    site = await db.sites.find_one({'id': 'main'}, {'_id': 0})
    updates = {}
    for stage in ('draft', 'published'):
        if site[stage]['hero']['position'] == '50% 32%':
            updates[f'{stage}.hero.position'] = '50% 0%'
        for i, product in enumerate(site[stage]['products']):
            if product['id'] in ('p003', 'p006') and product['collection'] == 'the-first-expression':
                updates[f'{stage}.products.{i}.collection'] = 'everyday-elevated'
            if product['id'] in ('p004', 'p005') and product['collection'] == 'the-first-expression':
                updates[f'{stage}.products.{i}.collection'] = 'after-hours'
    if updates:
        await db.sites.update_one({'id': 'main'}, {'$set': updates})
    print('Campaign framing and collection assignments refined.')
    client.close()

if __name__ == '__main__':
    asyncio.run(refine())