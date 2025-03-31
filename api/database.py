from pymongo import MongoClient
import os
import json
from dotenv import load_dotenv
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection string from environment variable
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/chatbots")
MONGODB_DB = os.getenv("MONGODB_DB", "chatbots")

# If URI doesn't have a database, extract from MONGODB_DB
if '/' not in MONGODB_URI.split('://')[-1]:
    MONGODB_URI = f"{MONGODB_URI}/{MONGODB_DB}"
elif MONGODB_URI.endswith('/'):
    MONGODB_URI = f"{MONGODB_URI}{MONGODB_DB}"

# Validate the MongoDB URI format
if not MONGODB_URI.startswith("mongodb://") and not MONGODB_URI.startswith("mongodb+srv://"):
    logger.warning(f"Invalid MongoDB URI format: {MONGODB_URI}")
    # Try to fix it by prepending mongodb://
    if not MONGODB_URI.startswith('mongodb'):
        MONGODB_URI = f"mongodb://{MONGODB_URI}"
        logger.info(f"Modified MongoDB URI to: {MONGODB_URI}")

# Initialize MongoDB client
client = None
db = None
# Flag to indicate if we're using MongoDB or local storage
using_mongodb = False

# Local storage path
LOCAL_STORAGE_DIR = Path("local_storage")
LOCAL_STORAGE_DIR.mkdir(exist_ok=True)
LOCAL_STORAGE_FILE = LOCAL_STORAGE_DIR / "chatbots.json"

def init_db():
    """Initialize the MongoDB connection or fallback to local storage"""
    global client, db, using_mongodb
    try:
        # Increased timeout for better reliability
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
        # Test connection by getting server info
        client.server_info()
        db = client[MONGODB_DB]
        # Create indices for faster queries
        db.chatbots.create_index("uniqueId", unique=True)
        logger.info(f"Connected to MongoDB: {MONGODB_URI}")
        using_mongodb = True
        return True
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")
        logger.warning(f"MONGODB_URI configured as: {MONGODB_URI}")
        logger.warning("Falling back to local storage for development")
        using_mongodb = False
        # Initialize local storage file if it doesn't exist
        if not LOCAL_STORAGE_FILE.exists():
            with open(LOCAL_STORAGE_FILE, 'w') as f:
                json.dump({"chatbots": []}, f)
        return False

def get_all_chatbots() -> List[Dict[str, Any]]:
    """Get all chatbots from the database or local storage"""
    try:
        # Always try to connect to MongoDB first, even if we previously used local storage
        if not using_mongodb:
            init_db()  # Try to initialize MongoDB connection again
        
        if using_mongodb:
            # Convert MongoDB _id to string for JSON serialization
            chatbots = list(db.chatbots.find({}, {'_id': 0}))
            logger.info(f"Retrieved {len(chatbots)} chatbots from MongoDB")
            return chatbots
        else:
            # Load from local storage
            if LOCAL_STORAGE_FILE.exists():
                with open(LOCAL_STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    chatbots = data.get("chatbots", [])
                    logger.info(f"Retrieved {len(chatbots)} chatbots from local storage")
                    return chatbots
            logger.warning("Local storage file doesn't exist, returning empty list")
            return []
    except Exception as e:
        logger.error(f"Error getting chatbots: {e}")
        logger.error(f"Storage type: {'MongoDB' if using_mongodb else 'Local Storage'}")
        
        # If MongoDB fails, try local storage as a last resort
        if using_mongodb:
            logger.info("MongoDB failed, trying local storage as fallback for retrieving chatbots...")
            try:
                # Load from local storage
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        chatbots = data.get("chatbots", [])
                        logger.info(f"Retrieved {len(chatbots)} chatbots from local storage (after MongoDB failure)")
                        return chatbots
                logger.warning("Local storage file doesn't exist during fallback, returning empty list")
            except Exception as local_error:
                logger.error(f"Error getting chatbots from local storage: {local_error}")
        return []

def get_chatbot_by_unique_id(unique_id: str) -> Optional[Dict[str, Any]]:
    """Get a chatbot by its unique ID from the database or local storage"""
    try:
        # Always try to connect to MongoDB first, even if we previously used local storage
        if not using_mongodb:
            init_db()  # Try to initialize MongoDB connection again
        
        if using_mongodb:
            chatbot = db.chatbots.find_one({"uniqueId": unique_id}, {'_id': 0})
            if chatbot:
                logger.info(f"Retrieved chatbot from MongoDB with ID: {unique_id}")
            else:
                logger.warning(f"Chatbot with ID {unique_id} not found in MongoDB")
            return chatbot
        else:
            # Load from local storage
            if LOCAL_STORAGE_FILE.exists():
                with open(LOCAL_STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    for chatbot in data.get("chatbots", []):
                        if chatbot.get("uniqueId") == unique_id:
                            logger.info(f"Retrieved chatbot from local storage with ID: {unique_id}")
                            return chatbot
            logger.warning(f"Chatbot with ID {unique_id} not found in local storage")
            return None
    except Exception as e:
        logger.error(f"Error getting chatbot by unique ID: {e}")
        logger.error(f"Storage type: {'MongoDB' if using_mongodb else 'Local Storage'}")
        
        # If MongoDB fails, try local storage as a last resort
        if using_mongodb:
            logger.info("MongoDB failed, trying local storage as fallback for retrieving chatbot...")
            try:
                # Load from local storage
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        for chatbot in data.get("chatbots", []):
                            if chatbot.get("uniqueId") == unique_id:
                                logger.info(f"Retrieved chatbot from local storage (after MongoDB failure) with ID: {unique_id}")
                                return chatbot
                logger.warning(f"Chatbot with ID {unique_id} not found in local storage during fallback")
            except Exception as local_error:
                logger.error(f"Error getting chatbot from local storage: {local_error}")
        return None

def create_chatbot(chatbot_data: Dict[str, Any]) -> bool:
    """Create a new chatbot in the database or local storage"""
    try:
        # Always try to connect to MongoDB first, even if we previously used local storage
        if not using_mongodb:
            init_db()  # Try to initialize MongoDB connection again
        
        if using_mongodb:
            # MongoDB is available, use it
            db.chatbots.insert_one(chatbot_data)
            logger.info(f"Created chatbot in MongoDB: {chatbot_data.get('name')} with ID: {chatbot_data.get('uniqueId')}")
            return True
        else:
            # MongoDB unavailable, fall back to local storage
            # Load existing chatbots
            chatbots = []
            if LOCAL_STORAGE_FILE.exists():
                with open(LOCAL_STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    chatbots = data.get("chatbots", [])
            
            # Add new chatbot
            chatbots.append(chatbot_data)
            
            # Save back to file
            with open(LOCAL_STORAGE_FILE, 'w') as f:
                json.dump({"chatbots": chatbots}, f, indent=2)
            
            logger.info(f"Created chatbot in local storage: {chatbot_data.get('name')} with ID: {chatbot_data.get('uniqueId')}")
            return True
    except Exception as e:
        logger.error(f"Error creating chatbot: {e}")
        logger.error(f"Storage type: {'MongoDB' if using_mongodb else 'Local Storage'}")
        # If MongoDB fails, try local storage as a last resort
        if using_mongodb:
            logger.info("MongoDB failed, trying local storage as fallback...")
            try:
                # Load existing chatbots
                chatbots = []
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        chatbots = data.get("chatbots", [])
                
                # Add new chatbot
                chatbots.append(chatbot_data)
                
                # Save back to file
                with open(LOCAL_STORAGE_FILE, 'w') as f:
                    json.dump({"chatbots": chatbots}, f, indent=2)
                
                logger.info(f"Created chatbot in local storage (after MongoDB failure): {chatbot_data.get('name')}")
                return True
            except Exception as local_error:
                logger.error(f"Error creating chatbot in local storage: {local_error}")
        return False

def update_chatbot(unique_id: str, chatbot_data: Dict[str, Any]) -> bool:
    """Update an existing chatbot in the database or local storage"""
    try:
        # Always try to connect to MongoDB first, even if we previously used local storage
        if not using_mongodb:
            init_db()  # Try to initialize MongoDB connection again
            
        if using_mongodb:
            result = db.chatbots.update_one(
                {"uniqueId": unique_id},
                {"$set": chatbot_data}
            )
            logger.info(f"Updated chatbot in MongoDB with ID: {unique_id}, matched: {result.matched_count}")
            return result.matched_count > 0
        else:
            # MongoDB unavailable, fall back to local storage
            # Load existing chatbots
            if LOCAL_STORAGE_FILE.exists():
                with open(LOCAL_STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    chatbots = data.get("chatbots", [])
                
                # Find and update the chatbot
                for i, chatbot in enumerate(chatbots):
                    if chatbot.get("uniqueId") == unique_id:
                        # Update the chatbot with new data
                        chatbots[i].update(chatbot_data)
                        
                        # Save back to file
                        with open(LOCAL_STORAGE_FILE, 'w') as f:
                            json.dump({"chatbots": chatbots}, f, indent=2)
                        
                        logger.info(f"Updated chatbot in local storage with ID: {unique_id}")
                        return True
            
            logger.error(f"Chatbot with ID {unique_id} not found in local storage")
            return False
    except Exception as e:
        logger.error(f"Error updating chatbot: {e}")
        logger.error(f"Storage type: {'MongoDB' if using_mongodb else 'Local Storage'}")
        
        # If MongoDB fails, try local storage as a last resort
        if using_mongodb:
            logger.info("MongoDB failed, trying local storage as fallback for update...")
            try:
                # Load existing chatbots
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        chatbots = data.get("chatbots", [])
                    
                    # Find and update the chatbot
                    for i, chatbot in enumerate(chatbots):
                        if chatbot.get("uniqueId") == unique_id:
                            # Update the chatbot with new data
                            chatbots[i].update(chatbot_data)
                            
                            # Save back to file
                            with open(LOCAL_STORAGE_FILE, 'w') as f:
                                json.dump({"chatbots": chatbots}, f, indent=2)
                            
                            logger.info(f"Updated chatbot in local storage (after MongoDB failure) with ID: {unique_id}")
                            return True
                
                logger.error(f"Chatbot with ID {unique_id} not found in local storage during fallback")
            except Exception as local_error:
                logger.error(f"Error updating chatbot in local storage: {local_error}")
        return False

def delete_chatbot(unique_id: str) -> bool:
    """Delete a chatbot by its unique ID from the database or local storage"""
    try:
        # Always try to connect to MongoDB first, even if we previously used local storage
        if not using_mongodb:
            init_db()  # Try to initialize MongoDB connection again
            
        if using_mongodb:
            result = db.chatbots.delete_one({"uniqueId": unique_id})
            logger.info(f"Deleted chatbot from MongoDB with ID: {unique_id}, deleted: {result.deleted_count}")
            return result.deleted_count > 0
        else:
            # MongoDB unavailable, fall back to local storage
            # Load existing chatbots
            if LOCAL_STORAGE_FILE.exists():
                with open(LOCAL_STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    chatbots = data.get("chatbots", [])
                
                # Filter out the chatbot to be deleted
                initial_count = len(chatbots)
                chatbots = [chatbot for chatbot in chatbots if chatbot.get("uniqueId") != unique_id]
                
                if len(chatbots) < initial_count:
                    # Save back to file
                    with open(LOCAL_STORAGE_FILE, 'w') as f:
                        json.dump({"chatbots": chatbots}, f, indent=2)
                    
                    logger.info(f"Deleted chatbot from local storage with ID: {unique_id}")
                    return True
                else:
                    logger.error(f"Chatbot with ID {unique_id} not found in local storage")
                    return False
            
            return False
    except Exception as e:
        logger.error(f"Error deleting chatbot: {e}")
        logger.error(f"Storage type: {'MongoDB' if using_mongodb else 'Local Storage'}")
        
        # If MongoDB fails, try local storage as a last resort
        if using_mongodb:
            logger.info("MongoDB failed, trying local storage as fallback for delete...")
            try:
                # Load existing chatbots
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        chatbots = data.get("chatbots", [])
                    
                    # Filter out the chatbot to be deleted
                    initial_count = len(chatbots)
                    chatbots = [chatbot for chatbot in chatbots if chatbot.get("uniqueId") != unique_id]
                    
                    if len(chatbots) < initial_count:
                        # Save back to file
                        with open(LOCAL_STORAGE_FILE, 'w') as f:
                            json.dump({"chatbots": chatbots}, f, indent=2)
                        
                        logger.info(f"Deleted chatbot from local storage (after MongoDB failure) with ID: {unique_id}")
                        return True
                    else:
                        logger.error(f"Chatbot with ID {unique_id} not found in local storage during fallback")
                        return False
            except Exception as local_error:
                logger.error(f"Error deleting chatbot in local storage: {local_error}")
        return False

# Initialize database connection when module is imported
init_db() 