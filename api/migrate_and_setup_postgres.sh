#!/bin/bash

# Migration and setup script for PostgreSQL

echo "======================================================="
echo "     MongoDB to PostgreSQL Migration Helper"
echo "======================================================="
echo

# Check if pip is installed
if ! command -v pip &> /dev/null; then
    echo "Error: pip is not installed. Please install pip first."
    exit 1
fi

# Install required dependencies
echo "Installing required dependencies..."
pip install psycopg2-binary python-dotenv

# Check if PostgreSQL is installed and running
if command -v pg_isready &> /dev/null; then
    pg_status=$(pg_isready)
    if [[ $pg_status == *"accepting connections"* ]]; then
        echo "PostgreSQL is running and accepting connections."
    else
        echo "PostgreSQL appears to be installed but not running."
        echo "Please start PostgreSQL before continuing."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "On macOS, you can start it with: brew services start postgresql"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "On Linux, you can start it with: sudo systemctl start postgresql"
        fi
        
        read -p "Continue after starting PostgreSQL? (y/n): " choice
        if [[ "$choice" != "y" && "$choice" != "Y" ]]; then
            exit 1
        fi
    fi
else
    echo "PostgreSQL command-line tools not found."
    echo "Please install PostgreSQL before continuing."
    exit 1
fi

# Create .env file with PostgreSQL settings if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating default .env file with PostgreSQL settings..."
    cat > .env << EOF
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=chatbot_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
EOF
    echo ".env file created with default PostgreSQL settings."
    echo "Please edit this file if you need to change the settings."
    read -p "Press Enter to continue or Ctrl+C to exit and edit the file..."
else
    echo "Existing .env file found. Adding PostgreSQL configuration if not present..."
    grep -q "POSTGRES_HOST" .env || echo "POSTGRES_HOST=localhost" >> .env
    grep -q "POSTGRES_PORT" .env || echo "POSTGRES_PORT=5432" >> .env
    grep -q "POSTGRES_DB" .env || echo "POSTGRES_DB=chatbot_db" >> .env
    grep -q "POSTGRES_USER" .env || echo "POSTGRES_USER=postgres" >> .env
    grep -q "POSTGRES_PASSWORD" .env || echo "POSTGRES_PASSWORD=postgres" >> .env
fi

# Check for existing database
echo "Checking for existing PostgreSQL database..."
if psql -lqt | cut -d \| -f 1 | grep -qw chatbot_db; then
    echo "Database 'chatbot_db' already exists."
else
    echo "Creating PostgreSQL database 'chatbot_db'..."
    createdb chatbot_db || { 
        echo "Failed to create database. Please create it manually with:"
        echo "createdb chatbot_db"
        echo "or via psql:"
        echo "psql -c 'CREATE DATABASE chatbot_db;'"
    }
fi

# Run the migration script
echo "Running the migration script..."
python migrate_to_postgres.py

# Backup the original main.py file if it hasn't been backed up yet
if [ ! -f main.py.mongodb.bak ]; then
    echo "Backing up the original main.py file to main.py.mongodb.bak..."
    cp main.py main.py.mongodb.bak
fi

# Update the main.py file to use PostgreSQL
echo "Updating main.py to use PostgreSQL..."
cp main_pg.py main.py || {
    echo "Error: Failed to replace main.py with main_pg.py"
    echo "Please manually copy main_pg.py to main.py"
}

echo
echo "Migration completed!"
echo
echo "You can now run your application with:"
echo "uvicorn main:app --reload"
echo
echo "If you need to roll back to MongoDB, run:"
echo "cp main.py.mongodb.bak main.py"
echo
echo "For more information, please refer to POSTGRES_MIGRATION.md"
echo 