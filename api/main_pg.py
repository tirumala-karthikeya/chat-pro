from fastapi import FastAPI, HTTPException, File,UploadFile, Query, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel
import requests
import shutil
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
import os
from fastapi.middleware.cors import CORSMiddleware
import json
import re
import uuid
from dotenv import load_dotenv
import asyncio
import httpx
from fastapi import Depends
import database_pg as database  # Import the PostgreSQL database module
import datetime

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Update CORS settings to allow requests from any origin
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# API key for Next-AGI (should be moved to environment variables)
NEXT_AGI_API_KEY = os.getenv("NEXT_AGI_API_KEY", "your_api_key")
logger.info(f"Using API key: {NEXT_AGI_API_KEY[:5]}...{NEXT_AGI_API_KEY[-4:] if len(NEXT_AGI_API_KEY) > 10 else ''}")
NEXT_AGI_BASE_URL = "http://api.next-agi.com/v1"

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# The rest of the file remains the same as the original main.py 