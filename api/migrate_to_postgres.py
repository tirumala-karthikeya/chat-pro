#!/usr/bin/env python3
"""
Migration script to transfer chatbot data from MongoDB to PostgreSQL.
This script will:
1. Connect to the MongoDB database
2. Read all existing chatbots
3. Connect to the PostgreSQL database
4. Insert all chatbots into PostgreSQL
5. Verify the migration was successful
"""

import os
import logging
import json
from typing import List, Dict, Any
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def migrate_data():
    """Main migration function"""
    logger.info("Starting migration from MongoDB to PostgreSQL")
    
    # Import both database modules
    try:
        import database as mongo_db
        import database_pg as pg_db
        
        # Initialize both databases
        logger.info("Initializing MongoDB connection")
        mongo_connected = mongo_db.init_db()
        
        if not mongo_connected or not mongo_db.using_mongodb:
            logger.error("Failed to connect to MongoDB. Make sure MongoDB is running and properly configured.")
            return False
        
        logger.info("Initializing PostgreSQL connection")
        pg_connected = pg_db.init_db()
        
        if not pg_connected or not pg_db.using_postgres:
            logger.error("Failed to connect to PostgreSQL. Make sure PostgreSQL is running and properly configured.")
            return False
        
        # Get all chatbots from MongoDB
        logger.info("Fetching chatbots from MongoDB")
        mongo_chatbots = mongo_db.get_all_chatbots()
        
        if not mongo_chatbots:
            logger.warning("No chatbots found in MongoDB. Nothing to migrate.")
            return True
        
        logger.info(f"Found {len(mongo_chatbots)} chatbots in MongoDB")
        
        # Save a backup of the MongoDB data
        backup_file = "mongodb_backup.json"
        logger.info(f"Creating backup of MongoDB data to {backup_file}")
        with open(backup_file, 'w') as f:
            json.dump(mongo_chatbots, f, indent=2)
        
        # Migrate each chatbot to PostgreSQL
        success_count = 0
        error_count = 0
        
        for chatbot in mongo_chatbots:
            try:
                # Convert MongoDB's _id to a string if present (should have been removed already)
                if '_id' in chatbot:
                    # Convert ObjectId to string if needed
                    if not isinstance(chatbot['_id'], str):
                        chatbot['_id'] = str(chatbot['_id'])
                
                # Ensure uniqueId is set
                if not chatbot.get('uniqueId'):
                    logger.warning(f"Chatbot {chatbot.get('name', 'unknown')} has no uniqueId. Skipping.")
                    error_count += 1
                    continue
                
                # Insert the chatbot into PostgreSQL
                logger.info(f"Migrating chatbot: {chatbot.get('name')} (ID: {chatbot.get('uniqueId')})")
                success = pg_db.create_chatbot(chatbot)
                
                if success:
                    success_count += 1
                else:
                    error_count += 1
                    logger.error(f"Failed to migrate chatbot: {chatbot.get('name')}")
            except Exception as e:
                error_count += 1
                logger.exception(f"Error migrating chatbot {chatbot.get('name', 'unknown')}: {e}")
        
        # Verify the migration
        logger.info("Verifying migration")
        pg_chatbots = pg_db.get_all_chatbots()
        
        logger.info(f"Migration completed:")
        logger.info(f"  - Total chatbots in MongoDB: {len(mongo_chatbots)}")
        logger.info(f"  - Successfully migrated: {success_count}")
        logger.info(f"  - Errors: {error_count}")
        logger.info(f"  - Total chatbots in PostgreSQL: {len(pg_chatbots)}")
        
        # Return success status
        return success_count == len(mongo_chatbots)
        
    except ImportError as e:
        logger.error(f"Failed to import database modules: {e}")
        logger.error("Make sure both database.py and database_pg.py exist in the current directory.")
        return False
    except Exception as e:
        logger.exception(f"Unexpected error during migration: {e}")
        return False

def main():
    """Entry point for the script"""
    print("=" * 80)
    print(" MongoDB to PostgreSQL Migration Tool ")
    print("=" * 80)
    print("\nThis script will migrate your chatbot data from MongoDB to PostgreSQL.")
    print("Make sure both databases are running and properly configured.")
    print("A backup of your MongoDB data will be created before migration.")
    
    try:
        # Confirm with the user
        choice = input("\nDo you want to proceed? (yes/no): ").strip().lower()
        
        if choice not in ('yes', 'y'):
            print("Migration cancelled.")
            return
        
        # Run the migration
        success = migrate_data()
        
        if success:
            print("\n✅ Migration completed successfully!")
            print("\nNext steps:")
            print("1. Update your main.py to import database_pg instead of database")
            print("2. Test your application with the new PostgreSQL backend")
            print("3. If everything works, you can rename database_pg.py to database.py")
        else:
            print("\n❌ Migration failed. Please check the logs for details.")
            
    except KeyboardInterrupt:
        print("\nMigration cancelled by user.")
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")

if __name__ == "__main__":
    main() 