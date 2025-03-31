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
import database_pg as database  # Import the PostgreSQL database module instead of MongoDB
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

# Data models for chat API
class FileUpload(BaseModel):
    type: str
    transfer_method: str
    url: Optional[str] = None
    data: Optional[str] = None

class ChatRequest(BaseModel):
    query: str
    inputs: Dict[str, Any] = {}
    response_mode: str = "streaming"
    conversation_id: Optional[str] = None
    user: Optional[str] = "user123"
    files: Optional[List[FileUpload]] = None
    model: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    conversation_id: str

# Chatbot schema for API operations
class ChatbotModel(BaseModel):
    name: str
    chatLogoColor: str
    chatLogoImage: Optional[str] = None
    iconAvatarImage: Optional[str] = None
    staticImage: Optional[str] = None
    chatHeaderColor: str
    chatBgGradientStart: str
    chatBgGradientEnd: str
    bodyBackgroundImage: Optional[str] = None
    welcomeText: str
    apiKey: str
    analyticsUrl: Optional[str] = None
    uniqueId: Optional[str] = None
    id: Optional[str] = None

# Function to retrieve the API key
def get_api_key():
    api_key = os.getenv("NEXT_AGI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API key not configured")
    return api_key

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

# API Routes
@app.get("/")
async def root():
    return {"message": "Welcome to the Chatbot API"}

# Chatbot management endpoints
@app.get("/chatbots")
async def get_chatbots():
    """Get all chatbots from the database"""
    chatbots = database.get_all_chatbots()
    return chatbots

@app.get("/chatbots/{unique_id}")
async def get_chatbot(unique_id: str):
    """Get a specific chatbot by unique ID"""
    chatbot = database.get_chatbot_by_unique_id(unique_id)
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    return chatbot

@app.post("/chatbots")
async def create_chatbot(chatbot: ChatbotModel):
    """Create a new chatbot in the database"""
    try:
        # Generate uniqueId if not provided
        if not chatbot.uniqueId:
            chatbot.uniqueId = str(uuid.uuid4())[:12]
        
        # Generate ID if not provided
        if not chatbot.id:
            chatbot.id = str(int(uuid.uuid4().int % 1000000000))
        
        # Convert to dict and then to json and back to ensure everything is serializable
        chatbot_data = json.loads(json.dumps(chatbot.dict()))
        
        logger.debug(f"Chatbot data to save: {chatbot_data}")
        
        success = database.create_chatbot(chatbot_data)
        
        if not success:
            logger.error("Failed to create chatbot in database")
            raise HTTPException(status_code=500, detail="Failed to create chatbot")
        
        # Return the exact same format the frontend expects
        return {"status": "success", "chatbot": chatbot_data}
    except Exception as e:
        logger.exception(f"Exception in create_chatbot: {str(e)}")
        # Use a more generic response format for errors
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to create chatbot: {str(e)}"}
        )

@app.put("/chatbots/{unique_id}")
async def update_chatbot(unique_id: str, chatbot: ChatbotModel):
    """Update an existing chatbot"""
    try:
        # Check if chatbot exists
        existing_chatbot = database.get_chatbot_by_unique_id(unique_id)
        if not existing_chatbot:
            return JSONResponse(
                status_code=404, 
                content={"status": "error", "message": "Chatbot not found"}
            )
        
        # Update chatbot data - ensure it's fully serializable
        chatbot_data = json.loads(json.dumps(chatbot.dict(exclude_unset=True)))
        logger.debug(f"Updating chatbot data: {chatbot_data}")
        
        success = database.update_chatbot(unique_id, chatbot_data)
        
        if not success:
            logger.error(f"Failed to update chatbot with ID {unique_id}")
            return JSONResponse(
                status_code=500, 
                content={"status": "error", "message": "Failed to update chatbot"}
            )
        
        # Get the updated chatbot data
        updated_chatbot = database.get_chatbot_by_unique_id(unique_id)
        
        return {"status": "success", "chatbot": updated_chatbot}
    except Exception as e:
        logger.exception(f"Exception in update_chatbot: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to update chatbot: {str(e)}"}
        )

@app.delete("/chatbots/{unique_id}")
async def delete_chatbot(unique_id: str):
    """Delete a chatbot by unique ID"""
    try:
        # Check if chatbot exists
        existing_chatbot = database.get_chatbot_by_unique_id(unique_id)
        if not existing_chatbot:
            return JSONResponse(
                status_code=404, 
                content={"status": "error", "message": "Chatbot not found"}
            )
        
        # Delete chatbot
        success = database.delete_chatbot(unique_id)
        
        if not success:
            logger.error(f"Failed to delete chatbot with ID {unique_id}")
            return JSONResponse(
                status_code=500, 
                content={"status": "error", "message": "Failed to delete chatbot"}
            )
        
        return {"status": "success", "message": f"Chatbot with ID {unique_id} deleted"}
    except Exception as e:
        logger.exception(f"Exception in delete_chatbot: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to delete chatbot: {str(e)}"}
        )

@app.post("/chat")
async def chat(request: ChatRequest, nextagi_api_key: str = Depends(get_api_key)):
    """
    Chat endpoint that forwards the request to the NextAGI API
    """
    logger.debug(f"Chat request: {request}")

    # API settings for streaming
    url = NEXT_AGI_BASE_URL + "/chat-messages"
    
    # Prepare the body
    body = {
        "model": request.model or "claude-3-opus-20240229",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful AI assistant that provides concise and helpful responses. Your responses should be well-structured, clear, and formatted in Markdown to enhance readability. Use headers, lists, bold/italic text, and code blocks when appropriate."
            },
            {
                "role": "user",
                "content": request.query
            }
        ],
        "stream": True
    }
    
    # Add conversation ID if provided
    if request.conversation_id:
        body["conversation_id"] = request.conversation_id
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {nextagi_api_key}"
    }
    
    # Set up streaming response
    async def process_stream():
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream("POST", url, json=body, headers=headers, timeout=60.0) as response:
                    response.raise_for_status()
                    
                    # Variables to track the response data
                    full_answer = ""
                    conversation_id = request.conversation_id or str(uuid.uuid4())
                    
                    # Stream the response as Server-Sent Events (SSE)
                    yield f"data: {json.dumps({'type': 'start'})}\n\n"
                    
                    async for chunk in response.aiter_text():
                        if chunk.strip():
                            for line in chunk.strip().split("\n"):
                                if line.startswith("data: "):
                                    data = line[6:]  # Remove "data: " prefix
                                    try:
                                        data_json = json.loads(data)
                                        if "message" in data_json:
                                            message = data_json["message"]
                                            if "content" in message:
                                                content = message["content"]
                                                full_answer += content
                                                # Forward the text fragment as SSE with proper JSON formatting
                                                fragment_data = {
                                                    "type": "fragment",
                                                    "content": content,
                                                    "conversation_id": conversation_id
                                                }
                                                yield f"data: {json.dumps(fragment_data)}\n\n"
                                            if "conversation_id" in data_json:
                                                conversation_id = data_json["conversation_id"]
                                    except json.JSONDecodeError:
                                        logger.error(f"Failed to decode JSON: {data}")
                    
                    # Send the complete answer at the end
                    complete_data = {
                        "type": "complete",
                        "answer": full_answer,
                        "conversation_id": conversation_id
                    }
                    yield f"data: {json.dumps(complete_data)}\n\n"
                    
        except Exception as e:
            logger.error(f"Error in streaming response: {str(e)}")
            error_data = {
                "type": "error",
                "error": str(e)
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(process_stream(), media_type="text/event-stream")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user: str = Form(...)):
    """
    Upload a file to be used in chat
    """
    try:
        # Create user directory if it doesn't exist
        user_dir = UPLOAD_DIR / user
        user_dir.mkdir(exist_ok=True)
        
        file_path = user_dir / file.filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Forward to Next-AGI
        files = {
            'file': (file.filename, open(file_path, 'rb'), file.content_type)
        }
        
        data = {
            'user': user
        }
        
        headers = {
            "Authorization": f"Bearer {NEXT_AGI_API_KEY}"
        }
        
        response = requests.post(
            f"{NEXT_AGI_BASE_URL}/files/upload",
            headers=headers,
            files=files,
            data=data
        )
        
        response.raise_for_status()
        return response.json()
    
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    conversation_id = ""
    """
    WebSocket endpoint for real-time chat
    """
    await manager.connect(websocket, client_id)
    api_key = None  # Initialize API key variable
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # Parse the received data
            try:
                message_data = json.loads(data)
                logging.info(f"Message data: {message_data}")
                
                # Get API key from the message data
                if "api_key" in message_data:
                    api_key = message_data["api_key"]
                    logging.info(f"Using API key from message: {api_key[:5]}...{api_key[-4:] if len(api_key) > 10 else ''}")
                
                # Use default API key if none provided
                if not api_key:
                    api_key = NEXT_AGI_API_KEY
                    logging.info(f"Using default API key: {api_key[:5]}...{api_key[-4:] if len(api_key) > 10 else ''}")
                
                # Process chat message
                if "query" in message_data:
                    logging.info(f"Query: {message_data['query']}")
                    conversation_id = str(message_data.get("conversation_id"))
                    # Prepare payload for Next-AGI API
                    payload = {
                        "inputs": message_data.get("inputs", {}),
                        "query": message_data["query"],
                        "response_mode": "streaming",
                        "conversation_id": conversation_id,
                        "user": client_id,
                        "files": message_data.get("files", [])
                    }
                    
                    # Use the API key from the message
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    
                    # Generate a new conversation ID if not provided
                    logging.info(f"payload: {payload}")
                    logger.debug(f"Conversation ID0: {conversation_id}")
                    
                    try:
                        # Make request with streaming enabled
                        api_url = f"{NEXT_AGI_BASE_URL}/chat-messages"
                        logging.info(f"API URL: {api_url}")
                        logging.info(f"Headers: {headers}")
                        logging.info(f"Payload: {payload}")
                        response = requests.post(
                            api_url,
                            headers=headers,
                            json=payload,
                            stream=True
                        )
                        logging.info(f"Response: {response}")
                        # Check for HTTP error
                        if not response.ok:
                            logger.error(f"API Error in WebSocket: Status code {response.status_code}")
                            await manager.send_message(json.dumps({
                                "type": "error",
                                "content": f"API error: Status code {response.status_code}"
                            }), client_id)
                            continue
                            
                        # Handle SSE (Server-Sent Events) streaming response
                        if 'text/event-stream' in response.headers.get('content-type', ''):
                            for line in response.iter_lines():
                                if line:
                                    line = line.decode('utf-8')
                                    #logger.debug(f"Received WebSocket line: {line}")
                                    
                                    # SSE format starts with "data: "
                                    if line.startswith("data: "):
                                        try:
                                            # Parse the JSON data after "data: "
                                            event_data = json.loads(line[6:])
                                            #logger.debug(f"Event data: {event_data}")
                                            # Extract and send answer fragments
                                            if "answer" in event_data:
                                                answer_fragment = event_data["answer"]
                                                await manager.send_message(json.dumps({
                                                    "type": "chunk",
                                                    "content": answer_fragment,
                                                    "conversation_id": event_data['conversation_id']
                                                }), client_id)
                                                await asyncio.sleep(0.05)  # Small delay for smooth streaming
                                        except json.JSONDecodeError as e:
                                            logger.error(f"Error parsing SSE event in WebSocket: {e}")
                            logger.debug(f"Received WebSocket line: {line}")
                            logger.debug(f"Conversation ID: {conversation_id}")
                            conversation_id = line["conversation_id"]
                            # Send end event
                            #await manager.send_message(json.dumps({
                            #    "type": "end",
                            #    "conversation_id": conversation_id
                            #}), client_id)
                        else:
                            # Fallback for non-streaming responses
                            try:
                                response_data = response.json()
                                answer = response_data.get("answer", "No response from API")
                                
                                # Simulate streaming with the complete answer
                                words = answer.split()
                                chunk_size = 2  # Send 2 words at a time
                                
                                for i in range(0, len(words), chunk_size):
                                    chunk = " ".join(words[i:i+chunk_size])
                                    await manager.send_message(json.dumps({
                                        "type": "chunk",
                                        "content": chunk,
                                        "conversation_id": conversation_id
                                    }), client_id)
                                    await asyncio.sleep(0.1)  # Simulate streaming delay
                                
                                await manager.send_message(json.dumps({
                                    "type": "end",
                                    "conversation_id": conversation_id
                                }), client_id)
                            except Exception as e:
                                logger.error(f"Error parsing non-streaming response: {e}")
                                await manager.send_message(json.dumps({
                                    "type": "error",
                                    "content": "Error processing response"
                                }), client_id)
                    except Exception as e:
                        logger.error(f"Error in websocket chat: {e}")
                        await manager.send_message(json.dumps({
                            "type": "chunk",
                            "content": "",
                            "conversation_id": conversation_id
                        }), client_id)
            
            except json.JSONDecodeError:
                await manager.send_message(json.dumps({
                    "type": "error",
                    "content": "Invalid JSON format"
                }), client_id)
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)

@app.get("/health", status_code=200)
async def health_check():
    """Health check endpoint for API status monitoring"""
    try:
        # Get database connection info using the PostgreSQL implementation
        health_info = database.get_health_info()
        
        # Add API version info
        response = {
            "status": "healthy",
            "timestamp": datetime.datetime.now().isoformat(),
            "api_version": "1.0.0",
            "storage": health_info
        }
        
        return response
    except Exception as e:
        logger.exception(f"Health check error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "unhealthy",
                "timestamp": datetime.datetime.now().isoformat(),
                "error": str(e)
            }
        )



