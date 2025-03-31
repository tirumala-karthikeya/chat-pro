#!/usr/bin/env python3
"""
MongoDB Local Setup Script for Development

This script helps initialize a local MongoDB database for development.
It creates the necessary database, collections, and indices.
"""

import os
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def setup_local_mongodb():
    """Set up the local MongoDB database"""
    # Use localhost MongoDB URI by default
    mongo_uri = "mongodb://localhost:27017/chatbots"
    db_name = "chatbots"
    
    try:
        # Connect to MongoDB
        logger.info(f"Connecting to MongoDB at {mongo_uri}")
        client = MongoClient(mongo_uri)
        
        # Test connection
        client.server_info()
        logger.info("Successfully connected to MongoDB")
        
        # Create/access database
        db = client[db_name]
        logger.info(f"Using database: {db_name}")
        
        # Create indices for chatbots collection
        db.chatbots.create_index("uniqueId", unique=True)
        logger.info("Created uniqueId index for chatbots collection")
        
        # Check if we can insert and query data
        test_data = {"test": "data", "uniqueId": "test123"}
        db.chatbots.insert_one(test_data)
        result = db.chatbots.find_one({"uniqueId": "test123"})
        
        if result:
            logger.info("Successfully inserted and retrieved test data")
            # Clean up test data
            db.chatbots.delete_one({"uniqueId": "test123"})
            logger.info("Local MongoDB setup complete!")
        else:
            logger.error("Failed to retrieve test data")
            
    except Exception as e:
        logger.error(f"Error setting up MongoDB: {e}")
        logger.error("""
        Make sure MongoDB is installed and running:
        
        macOS: brew services start mongodb-community
        Windows: Check MongoDB service is running
        Linux: sudo systemctl start mongod
        """)
        return False
    
    return True

if __name__ == "__main__":
    if setup_local_mongodb():
        print("\n✅ MongoDB setup successful! Your local development environment is ready.")
        print("\nTo start the API with MongoDB support:")
        print("  cd api && python run.py")
    else:
        print("\n❌ MongoDB setup failed. Please check the logs above for details.") 