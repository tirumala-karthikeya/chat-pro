# Migrating from MongoDB to PostgreSQL

This guide outlines the process of migrating the chat application database from MongoDB to PostgreSQL for improved performance with chatbot operations (update, addition, deletion).

## Why PostgreSQL?

PostgreSQL offers several advantages over MongoDB for our use case:

- **Better CRUD Performance**: For structured data like chatbots, PostgreSQL's optimized query planner and indexing can provide faster operations.
- **ACID Compliance**: PostgreSQL ensures data integrity with full ACID compliance.
- **Complex Queries**: PostgreSQL's powerful SQL capabilities allow for more complex queries and reporting.
- **Transaction Support**: Essential for maintaining data consistency during updates.

## Prerequisites

1. Install PostgreSQL:
   - **Ubuntu/Debian**: `sudo apt install postgresql postgresql-contrib`
   - **macOS**: `brew install postgresql` (using Homebrew)
   - **Windows**: Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

2. Install Python dependencies:
   ```bash
   pip install psycopg2-binary
   ```

## Configuration

1. Set up environment variables by adding the following to your `.env` file:

   ```
   # PostgreSQL Configuration
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=chatbot_db
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   ```

2. Create the PostgreSQL database:

   ```bash
   sudo -u postgres psql
   ```

   Then in the PostgreSQL shell:

   ```sql
   CREATE DATABASE chatbot_db;
   ```

   If you want to use a different user, create one and grant permissions:

   ```sql
   CREATE USER chatbot_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE chatbot_db TO chatbot_user;
   ```

## Migration Process

The migration is a 3-step process:

### 1. Test PostgreSQL Implementation

The `database_pg.py` file provides a PostgreSQL implementation of the database functions. Before migrating, you can test it alongside the existing MongoDB implementation:

```bash
# Start your application using the MongoDB implementation
python main.py

# In a separate terminal, verify that PostgreSQL connection works
python -c "import database_pg; print(database_pg.get_health_info())"
```

### 2. Migrate Data

We've provided a migration script that transfers all chatbots from MongoDB to PostgreSQL:

```bash
python migrate_to_postgres.py
```

This script will:
- Connect to both MongoDB and PostgreSQL
- Read all chatbots from MongoDB
- Save a backup of your MongoDB data to `mongodb_backup.json`
- Insert each chatbot into PostgreSQL
- Verify the migration

### 3. Switch to PostgreSQL

After successful migration, you can use the updated main application file:

1. Use the temporary approach for testing:
   ```bash
   python main_pg.py
   ```

2. Or permanently switch to PostgreSQL:
   ```bash
   # Backup the original file
   cp main.py main.py.mongodb.bak
   
   # Replace with PostgreSQL version
   cp main_pg.py main.py
   ```

## Verification

To verify the migration:

1. Check the health endpoint:
   ```
   curl http://localhost:8001/health
   ```

   You should see PostgreSQL listed as the database source.

2. Check your chatbots through the API:
   ```
   curl http://localhost:8001/chatbots
   ```

   Verify that all your chatbots are listed.

3. Test CRUD operations:
   - Create a new chatbot
   - Update an existing chatbot
   - Delete a chatbot
   - Verify all operations are working correctly

## Troubleshooting

1. **Connection Issues**:
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check credentials in `.env` file
   - Ensure database exists: `sudo -u postgres psql -c '\l'`
   - Check logs: `tail -f /var/log/postgresql/postgresql-*.log`

2. **Migration Errors**:
   - Review `mongodb_backup.json` to see what data might be causing issues
   - Check for uniqueId conflicts or missing fields

3. **Performance Issues**:
   - Ensure proper indexes are created (the default setup adds indexes on `id` and `unique_id`)
   - Consider adjusting PostgreSQL configuration for better performance

## Rollback Plan

If you need to revert to MongoDB:

1. Stop the application
2. Restore the original main.py:
   ```bash
   cp main.py.mongodb.bak main.py
   ```
3. Restart the application

The MongoDB data should still be intact since the migration process doesn't modify it.

## Additional Optimizations

Consider these additional optimizations for PostgreSQL:

1. **Connection Pooling**:
   ```python
   from psycopg2.pool import SimpleConnectionPool
   
   # Create a connection pool
   pool = SimpleConnectionPool(1, 10, 
       host=DB_HOST, port=DB_PORT, dbname=DB_NAME, 
       user=DB_USER, password=DB_PASS)
   ```

2. **Prepared Statements** for frequently executed queries
3. **Indexing** additional columns that are frequently searched
4. **Vacuum and Analyze** regularly to optimize performance

## Notes

The PostgreSQL implementation maintains the same API as the MongoDB version, so it should be a drop-in replacement. If you encounter any issues, the system will fall back to using local storage as a last resort, similar to the MongoDB implementation. 