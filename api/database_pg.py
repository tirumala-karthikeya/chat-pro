import os
import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from contextlib import contextmanager

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# PostgreSQL connection parameters from environment variables
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "chatbot_db")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")

# Local storage path as fallback
LOCAL_STORAGE_DIR = Path("local_storage")
LOCAL_STORAGE_DIR.mkdir(exist_ok=True)
LOCAL_STORAGE_FILE = LOCAL_STORAGE_DIR / "chatbots.json"

# Flag to indicate if we're using PostgreSQL or local storage
using_postgres = False

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        yield conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise
    finally:
        if conn is not None:
            conn.close()

def init_db():
    """Initialize the PostgreSQL database or fallback to local storage"""
    global using_postgres
    try:
        # Try to connect to PostgreSQL
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Create chatbots table if it doesn't exist
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS chatbots (
                        id VARCHAR(255),
                        unique_id VARCHAR(255) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        chat_logo_color VARCHAR(50) NOT NULL,
                        chat_logo_image TEXT,
                        icon_avatar_image TEXT,
                        static_image TEXT,
                        chat_header_color VARCHAR(50) NOT NULL,
                        chat_bg_gradient_start VARCHAR(50) NOT NULL,
                        chat_bg_gradient_end VARCHAR(50) NOT NULL,
                        body_background_image TEXT,
                        welcome_text TEXT NOT NULL,
                        api_key VARCHAR(255) NOT NULL,
                        analytics_url TEXT,
                        data JSONB
                    )
                """)
                # Create index for faster queries
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chatbots_id ON chatbots (id)")
                conn.commit()
        
        logger.info(f"Connected to PostgreSQL database: {DB_NAME} on {DB_HOST}")
        using_postgres = True
        return True
    except Exception as e:
        logger.error(f"Error initializing PostgreSQL database: {e}")
        logger.warning("Falling back to local storage for development")
        using_postgres = False
        # Initialize local storage file if it doesn't exist
        if not LOCAL_STORAGE_FILE.exists():
            with open(LOCAL_STORAGE_FILE, 'w') as f:
                json.dump({"chatbots": []}, f)
        return False

def convert_to_pg_format(chatbot_data):
    """Convert chatbot data to PostgreSQL format"""
    # Extract specific fields for the structured columns
    structured_fields = {
        "id": chatbot_data.get("id", ""),
        "unique_id": chatbot_data.get("uniqueId", ""),
        "name": chatbot_data.get("name", ""),
        "chat_logo_color": chatbot_data.get("chatLogoColor", "#000000"),
        "chat_logo_image": chatbot_data.get("chatLogoImage", None),
        "icon_avatar_image": chatbot_data.get("iconAvatarImage", None),
        "static_image": chatbot_data.get("staticImage", None),
        "chat_header_color": chatbot_data.get("chatHeaderColor", "#000000"),
        "chat_bg_gradient_start": chatbot_data.get("chatBgGradientStart", "#ffffff"),
        "chat_bg_gradient_end": chatbot_data.get("chatBgGradientEnd", "#ffffff"),
        "body_background_image": chatbot_data.get("bodyBackgroundImage", None),
        "welcome_text": chatbot_data.get("welcomeText", "Welcome!"),
        "api_key": chatbot_data.get("apiKey", ""),
        "analytics_url": chatbot_data.get("analyticsUrl", None),
        # Store the full data object as JSONB for future extensibility
        "data": Json(chatbot_data)
    }
    return structured_fields

def convert_from_pg_format(db_record):
    """Convert PostgreSQL record to the format expected by the API"""
    # If we have a full JSON data field, use it as the base
    if db_record.get("data"):
        chatbot = db_record["data"]
    else:
        # Otherwise build the object from the structured fields
        chatbot = {
            "id": db_record.get("id", ""),
            "uniqueId": db_record.get("unique_id", ""),
            "name": db_record.get("name", ""),
            "chatLogoColor": db_record.get("chat_logo_color", "#000000"),
            "chatHeaderColor": db_record.get("chat_header_color", "#000000"),
            "chatBgGradientStart": db_record.get("chat_bg_gradient_start", "#ffffff"),
            "chatBgGradientEnd": db_record.get("chat_bg_gradient_end", "#ffffff"),
            "welcomeText": db_record.get("welcome_text", "Welcome!"),
            "apiKey": db_record.get("api_key", "")
        }
        
        # Add optional fields if they exist
        if db_record.get("chat_logo_image"):
            chatbot["chatLogoImage"] = db_record["chat_logo_image"]
        if db_record.get("icon_avatar_image"):
            chatbot["iconAvatarImage"] = db_record["icon_avatar_image"]
        if db_record.get("static_image"):
            chatbot["staticImage"] = db_record["static_image"]
        if db_record.get("body_background_image"):
            chatbot["bodyBackgroundImage"] = db_record["body_background_image"]
        if db_record.get("analytics_url"):
            chatbot["analyticsUrl"] = db_record["analytics_url"]
    
    return chatbot

def get_all_chatbots() -> List[Dict[str, Any]]:
    """Get all chatbots from the database or local storage"""
    try:
        # Always try to connect to PostgreSQL first, even if we previously used local storage
        if not using_postgres:
            init_db()  # Try to initialize PostgreSQL connection again
        
        if using_postgres:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT * FROM chatbots")
                    db_chatbots = cur.fetchall()
                    
                    # Convert database records to API format
                    chatbots = [convert_from_pg_format(record) for record in db_chatbots]
                    logger.info(f"Retrieved {len(chatbots)} chatbots from PostgreSQL")
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
        logger.error(f"Storage type: {'PostgreSQL' if using_postgres else 'Local Storage'}")
        
        # If PostgreSQL fails, try local storage as a last resort
        if using_postgres:
            logger.info("PostgreSQL failed, trying local storage as fallback for retrieving chatbots...")
            try:
                # Load from local storage
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        chatbots = data.get("chatbots", [])
                        logger.info(f"Retrieved {len(chatbots)} chatbots from local storage (after PostgreSQL failure)")
                        return chatbots
                logger.warning("Local storage file doesn't exist during fallback, returning empty list")
            except Exception as local_error:
                logger.error(f"Error getting chatbots from local storage: {local_error}")
        return []

def get_chatbot_by_unique_id(unique_id: str) -> Optional[Dict[str, Any]]:
    """Get a chatbot by its unique ID from the database or local storage"""
    try:
        # Always try to connect to PostgreSQL first, even if we previously used local storage
        if not using_postgres:
            init_db()  # Try to initialize PostgreSQL connection again
        
        if using_postgres:
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT * FROM chatbots WHERE unique_id = %s", (unique_id,))
                    record = cur.fetchone()
                    
                    if record:
                        chatbot = convert_from_pg_format(record)
                        logger.info(f"Retrieved chatbot from PostgreSQL with ID: {unique_id}")
                        return chatbot
                    else:
                        logger.warning(f"Chatbot with ID {unique_id} not found in PostgreSQL")
                        return None
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
        logger.error(f"Storage type: {'PostgreSQL' if using_postgres else 'Local Storage'}")
        
        # If PostgreSQL fails, try local storage as a last resort
        if using_postgres:
            logger.info("PostgreSQL failed, trying local storage as fallback for retrieving chatbot...")
            try:
                # Load from local storage
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        for chatbot in data.get("chatbots", []):
                            if chatbot.get("uniqueId") == unique_id:
                                logger.info(f"Retrieved chatbot from local storage (after PostgreSQL failure) with ID: {unique_id}")
                                return chatbot
                logger.warning(f"Chatbot with ID {unique_id} not found in local storage during fallback")
            except Exception as local_error:
                logger.error(f"Error getting chatbot from local storage: {local_error}")
        return None

def create_chatbot(chatbot_data: Dict[str, Any]) -> bool:
    """Create a new chatbot in the database or local storage"""
    try:
        # Always try to connect to PostgreSQL first, even if we previously used local storage
        if not using_postgres:
            init_db()  # Try to initialize PostgreSQL connection again
        
        if using_postgres:
            # Convert chatbot data to PostgreSQL format
            pg_data = convert_to_pg_format(chatbot_data)
            
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    # Insert into PostgreSQL using named parameters
                    cur.execute("""
                        INSERT INTO chatbots (
                            id, unique_id, name, chat_logo_color, chat_logo_image, 
                            icon_avatar_image, static_image, chat_header_color,
                            chat_bg_gradient_start, chat_bg_gradient_end, 
                            body_background_image, welcome_text, api_key, 
                            analytics_url, data
                        ) VALUES (
                            %(id)s, %(unique_id)s, %(name)s, %(chat_logo_color)s, %(chat_logo_image)s,
                            %(icon_avatar_image)s, %(static_image)s, %(chat_header_color)s,
                            %(chat_bg_gradient_start)s, %(chat_bg_gradient_end)s,
                            %(body_background_image)s, %(welcome_text)s, %(api_key)s,
                            %(analytics_url)s, %(data)s
                        )
                    """, pg_data)
                    conn.commit()
                    
                    logger.info(f"Created chatbot in PostgreSQL: {chatbot_data.get('name')} with ID: {chatbot_data.get('uniqueId')}")
                    return True
        else:
            # PostgreSQL unavailable, fall back to local storage
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
        logger.error(f"Storage type: {'PostgreSQL' if using_postgres else 'Local Storage'}")
        # If PostgreSQL fails, try local storage as a last resort
        if using_postgres:
            logger.info("PostgreSQL failed, trying local storage as fallback...")
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
                
                logger.info(f"Created chatbot in local storage (after PostgreSQL failure): {chatbot_data.get('name')}")
                return True
            except Exception as local_error:
                logger.error(f"Error creating chatbot in local storage: {local_error}")
        return False

def update_chatbot(unique_id: str, chatbot_data: Dict[str, Any]) -> bool:
    """Update an existing chatbot in the database or local storage"""
    try:
        # Always try to connect to PostgreSQL first, even if we previously used local storage
        if not using_postgres:
            init_db()  # Try to initialize PostgreSQL connection again
        
        if using_postgres:
            # Get existing chatbot to update with new data
            with get_db_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT * FROM chatbots WHERE unique_id = %s", (unique_id,))
                    existing = cur.fetchone()
                    
                    if not existing:
                        logger.error(f"Chatbot with ID {unique_id} not found in PostgreSQL")
                        return False
                    
                    # Get the existing data and update it with new values
                    existing_data = existing.get("data", {})
                    if existing_data:
                        # Update the JSON with new values
                        for key, value in chatbot_data.items():
                            existing_data[key] = value
                    else:
                        # Use the new data directly
                        existing_data = chatbot_data
                    
                    # Prepare the updated PostgreSQL data
                    pg_data = convert_to_pg_format(existing_data)
                    pg_data["original_unique_id"] = unique_id  # For the WHERE clause
                    
                    # Update the record
                    cur.execute("""
                        UPDATE chatbots SET
                            id = %(id)s,
                            unique_id = %(unique_id)s,
                            name = %(name)s,
                            chat_logo_color = %(chat_logo_color)s,
                            chat_logo_image = %(chat_logo_image)s,
                            icon_avatar_image = %(icon_avatar_image)s,
                            static_image = %(static_image)s,
                            chat_header_color = %(chat_header_color)s,
                            chat_bg_gradient_start = %(chat_bg_gradient_start)s,
                            chat_bg_gradient_end = %(chat_bg_gradient_end)s,
                            body_background_image = %(body_background_image)s,
                            welcome_text = %(welcome_text)s,
                            api_key = %(api_key)s,
                            analytics_url = %(analytics_url)s,
                            data = %(data)s
                        WHERE unique_id = %(original_unique_id)s
                    """, pg_data)
                    conn.commit()
                    
                    logger.info(f"Updated chatbot in PostgreSQL with ID: {unique_id}")
                    return True
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
        logger.error(f"Storage type: {'PostgreSQL' if using_postgres else 'Local Storage'}")
        
        # If PostgreSQL fails, try local storage as a last resort
        if using_postgres:
            logger.info("PostgreSQL failed, trying local storage as fallback...")
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
                            
                            logger.info(f"Updated chatbot in local storage (after PostgreSQL failure) with ID: {unique_id}")
                            return True
                            
                logger.error(f"Chatbot with ID {unique_id} not found in local storage during fallback")
            except Exception as local_error:
                logger.error(f"Error updating chatbot in local storage: {local_error}")
        return False

def delete_chatbot(unique_id: str) -> bool:
    """Delete a chatbot from the database or local storage"""
    try:
        # Always try to connect to PostgreSQL first, even if we previously used local storage
        if not using_postgres:
            init_db()  # Try to initialize PostgreSQL connection again
        
        if using_postgres:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM chatbots WHERE unique_id = %s", (unique_id,))
                    deleted = cur.rowcount > 0
                    conn.commit()
                    
                    if deleted:
                        logger.info(f"Deleted chatbot from PostgreSQL with ID: {unique_id}")
                    else:
                        logger.warning(f"Chatbot with ID {unique_id} not found in PostgreSQL for deletion")
                    
                    return deleted
        else:
            # PostgreSQL unavailable, fall back to local storage
            # Load existing chatbots
            if LOCAL_STORAGE_FILE.exists():
                with open(LOCAL_STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    chatbots = data.get("chatbots", [])
                
                # Find and remove the chatbot
                initial_count = len(chatbots)
                chatbots = [bot for bot in chatbots if bot.get("uniqueId") != unique_id]
                
                if len(chatbots) < initial_count:
                    # Save back to file
                    with open(LOCAL_STORAGE_FILE, 'w') as f:
                        json.dump({"chatbots": chatbots}, f, indent=2)
                    
                    logger.info(f"Deleted chatbot from local storage with ID: {unique_id}")
                    return True
                else:
                    logger.warning(f"Chatbot with ID {unique_id} not found in local storage for deletion")
                    return False
    except Exception as e:
        logger.error(f"Error deleting chatbot: {e}")
        logger.error(f"Storage type: {'PostgreSQL' if using_postgres else 'Local Storage'}")
        
        # If PostgreSQL fails, try local storage as a last resort
        if using_postgres:
            logger.info("PostgreSQL failed, trying local storage as fallback for deletion...")
            try:
                # Load existing chatbots
                if LOCAL_STORAGE_FILE.exists():
                    with open(LOCAL_STORAGE_FILE, 'r') as f:
                        data = json.load(f)
                        chatbots = data.get("chatbots", [])
                    
                    # Find and remove the chatbot
                    initial_count = len(chatbots)
                    chatbots = [bot for bot in chatbots if bot.get("uniqueId") != unique_id]
                    
                    if len(chatbots) < initial_count:
                        # Save back to file
                        with open(LOCAL_STORAGE_FILE, 'w') as f:
                            json.dump({"chatbots": chatbots}, f, indent=2)
                        
                        logger.info(f"Deleted chatbot from local storage (after PostgreSQL failure) with ID: {unique_id}")
                        return True
                    else:
                        logger.warning(f"Chatbot with ID {unique_id} not found in local storage during fallback for deletion")
                        return False
            except Exception as local_error:
                logger.error(f"Error deleting chatbot from local storage: {local_error}")
        return False

def get_health_info():
    """Get health information about the database connection"""
    try:
        if not using_postgres:
            init_db()  # Try to initialize PostgreSQL connection again
        
        if using_postgres:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    # Get PostgreSQL version
                    cur.execute("SELECT version()")
                    version = cur.fetchone()[0]
                    
                    # Get chatbot count
                    cur.execute("SELECT COUNT(*) FROM chatbots")
                    count = cur.fetchone()[0]
                    
                    return {
                        "database": "PostgreSQL",
                        "version": version,
                        "connected": True,
                        "chatbot_count": count,
                        "connection_string": f"postgresql://{DB_USER}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}"
                    }
        else:
            # Using local storage
            chatbot_count = 0
            if LOCAL_STORAGE_FILE.exists():
                with open(LOCAL_STORAGE_FILE, 'r') as f:
                    data = json.load(f)
                    chatbot_count = len(data.get("chatbots", []))
            
            return {
                "database": "localStorage",
                "version": "N/A",
                "connected": True,
                "chatbot_count": chatbot_count,
                "connection_string": str(LOCAL_STORAGE_FILE)
            }
    except Exception as e:
        logger.error(f"Error getting health info: {e}")
        return {
            "database": "PostgreSQL" if using_postgres else "localStorage",
            "connected": False,
            "error": str(e)
        }

# Initialize the database when this module is imported
init_db() 