import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict
from typing import Any

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
def now():
    return datetime.now(timezone.utc).isoformat()
def uid():
    return str(uuid.uuid4())
class Document(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
class Result(BaseModel):
    model_config = ConfigDict(extra='allow')
    success: bool = True