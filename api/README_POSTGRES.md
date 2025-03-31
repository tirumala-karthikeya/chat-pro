# PostgreSQL Migration Overview

This document summarizes the changes made to migrate the chat application from MongoDB to PostgreSQL for improved performance.

## Changes Made

1. **Database Implementation**:
   - Added `database_pg.py` with a complete PostgreSQL implementation of all database functions
   - Uses structured columns for improved query performance
   - Maintains compatibility with the existing API
   - Includes fallback to local storage when the database is unavailable

2. **Migration Script**:
   - Added `migrate_to_postgres.py` to transfer data from MongoDB to PostgreSQL
   - Creates a backup of MongoDB data before migration
   - Validates and transforms data as needed

3. **Helper Script**:
   - Added `migrate_and_setup_postgres.sh` to automate the migration process
   - Checks for PostgreSQL installation and running status
   - Sets up the required environment variables
   - Creates the database if needed
   - Runs the migration script
   - Updates the application to use PostgreSQL

4. **Application Updates**:
   - Updated `main.py` to import from `database_pg` instead of `database`
   - Simplified the health check endpoint to use PostgreSQL's built-in health info
   - Ensured all database operations use the PostgreSQL implementation

5. **Docker Configuration**:
   - Updated `docker-compose.yml` to replace MongoDB with PostgreSQL
   - Added proper volume configuration for persistent data
   - Updated environment variables for PostgreSQL connection

6. **Dependencies**:
   - Replaced `pymongo` with `psycopg2-binary` in `requirements.txt`

## Why PostgreSQL?

PostgreSQL offers several advantages over MongoDB for this application:

1. **Better Performance**: PostgreSQL's optimized query planner provides faster performance for structured data operations
2. **Local Storage**: PostgreSQL can be run locally alongside the application, eliminating external data source issues
3. **ACID Compliance**: Full transaction support ensures data integrity during updates
4. **Advanced Features**: Support for more complex queries, JSON data types, and better indexing

## How to Verify the Migration

1. Run the health check endpoint to verify PostgreSQL connection:
   ```
   curl http://localhost:8001/health
   ```

2. Test CRUD operations on chatbots:
   - Creating a new chatbot
   - Retrieving chatbots
   - Updating a chatbot
   - Deleting a chatbot

3. Check database size and performance:
   ```sql
   SELECT pg_size_pretty(pg_database_size('chatbot_db')) as db_size;
   ```

## Rollback Plan

If you need to revert to MongoDB:

1. Restore the original `main.py`:
   ```
   cp main.py.mongodb.bak main.py
   ```

2. Update `requirements.txt` to include `pymongo` again:
   ```
   pip install pymongo
   ```

## Where Data is Stored

When using PostgreSQL:

1. **Database**: Data is stored in the `chatbot_db` database
2. **Table**: All chatbots are stored in the `chatbots` table
3. **Persistent Storage**: With Docker, data is stored in the `postgres_data` volume

When running in fallback mode:

1. **File**: Data is stored in `api/local_storage/chatbots.json`
2. **Format**: Simple JSON format containing an array of chatbot objects 