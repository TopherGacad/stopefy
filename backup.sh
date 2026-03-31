#!/bin/bash
# Stopefy backup script
# Creates a timestamped backup of database, uploads, and migrations

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/stopefy_backup_${TIMESTAMP}"

echo "Creating backup in ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"

# 1. SQLite database
cp backend/stopefy.db "${BACKUP_DIR}/stopefy.db"
echo "  [OK] Database"

# 2. SQL dump (portable, works with any DB on the server)
cd backend
python -c "
import sqlite3, sys
conn = sqlite3.connect('stopefy.db')
with open('../${BACKUP_DIR}/stopefy_dump.sql', 'w') as f:
    for line in conn.iterdump():
        f.write(line + '\n')
conn.close()
print('  [OK] SQL dump')
"
cd ..

# 3. Uploaded files (audio + covers)
if [ -d "backend/uploads" ]; then
    cp -r backend/uploads "${BACKUP_DIR}/uploads"
    echo "  [OK] Uploads ($(du -sh backend/uploads | cut -f1))"
else
    echo "  [SKIP] No uploads directory"
fi

# 4. Alembic migrations
cp -r backend/alembic "${BACKUP_DIR}/alembic"
cp backend/alembic.ini "${BACKUP_DIR}/alembic.ini"
echo "  [OK] Migrations"

# 5. Environment config (without secrets)
if [ -f "backend/.env" ]; then
    cp backend/.env "${BACKUP_DIR}/.env"
    echo "  [OK] .env"
fi

echo ""
echo "Backup complete: ${BACKUP_DIR}"
echo ""
echo "=== To deploy to your server ==="
echo "1. Copy the backup folder to your server"
echo "2. Place stopefy.db in the backend/ directory"
echo "3. Place uploads/ in the backend/ directory"
echo "4. Place alembic/ and alembic.ini in backend/"
echo "5. Update backend/.env with production values:"
echo "   - SECRET_KEY (generate a new one)"
echo "   - SMTP_USER / SMTP_APP_PASSWORD"
echo "   - DATABASE_URL (if using PostgreSQL instead of SQLite)"
echo "6. Run: cd backend && alembic upgrade head"
echo "7. Start: uvicorn main:app --host 0.0.0.0 --port 8000"
