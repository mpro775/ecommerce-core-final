#!/bin/bash
set -euo pipefail

BACKUP_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$BACKUP_SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="ecommerce_core_store_$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

backup_database() {
    log "Starting database backup..."
    
    local db_container="${DB_CONTAINER:-ecommerce_core-postgres}"
    local db_user="${POSTGRES_USER:-ecommerce_core}"
    local db_name="${POSTGRES_DB:-ecommerce_core_store}"
    local db_password="${POSTGRES_PASSWORD:-}"
    
    local backup_file="$BACKUP_DIR/${BACKUP_NAME}_database.sql"
    local backup_file_gz="$backup_file.gz"
    
    if docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
        log "Using Docker container: $db_container"
        docker exec -i "$db_container" pg_dump -U "$db_user" -d "$db_name" --clean --if-exists > "$backup_file"
    elif command -v pg_dump &> /dev/null; then
        log "Using local pg_dump"
        PGPASSWORD="$db_password" pg_dump -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$db_user" -d "$db_name" --clean --if-exists > "$backup_file"
    else
        error "Neither Docker container nor pg_dump found"
        return 1
    fi
    
    gzip -f "$backup_file"
    log "Database backup created: $backup_file_gz"
    echo "$backup_file_gz"
}

backup_redis() {
    log "Starting Redis backup..."
    
    local redis_container="${REDIS_CONTAINER:-ecommerce_core-redis}"
    local backup_file="$BACKUP_DIR/${BACKUP_NAME}_redis.rdb"
    
    if docker ps --format '{{.Names}}' | grep -q "^${redis_container}$"; then
        log "Using Docker container: $redis_container"
        docker exec "$redis_container" redis-cli BGSAVE
        sleep 2
        docker cp "$redis_container:/data/dump.rdb" "$backup_file"
    else
        log "Skipping Redis backup (container not found)"
        return 0
    fi
    
    log "Redis backup created: $backup_file"
    echo "$backup_file"
}

backup_storage() {
    log "Starting storage backup..."
    
    local minio_container="${MINIO_CONTAINER:-ecommerce_core-minio}"
    local backup_file="$BACKUP_DIR/${BACKUP_NAME}_storage.tar.gz"
    
    if docker ps --format '{{.Names}}' | grep -q "^${minio_container}$"; then
        log "Using Docker container: $minio_container"
        docker exec "$minio_container" tar czf /tmp/storage_backup.tar.gz /data 2>/dev/null || true
        docker cp "$minio_container:/tmp/storage_backup.tar.gz" "$backup_file" 2>/dev/null || true
        docker exec "$minio_container" rm -f /tmp/storage_backup.tar.gz 2>/dev/null || true
    else
        log "Skipping storage backup (container not found)"
        return 0
    fi
    
    log "Storage backup created: $backup_file"
    echo "$backup_file"
}

apply_retention() {
    log "Applying retention policy ($RETENTION_DAYS days)..."
    
    find "$BACKUP_DIR" -name "ecommerce_core_store_*" -type f -mtime +$RETENTION_DAYS -delete
    
    local file_count=$(find "$BACKUP_DIR" -name "ecommerce_core_store_*" -type f | wc -l)
    log "Retention applied. $file_count backup files remaining."
}

verify_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    if [[ "$backup_file" == *.sql.gz ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            log "Backup integrity verified: $backup_file"
            return 0
        else
            error "Backup integrity check failed: $backup_file"
            return 1
        fi
    elif [[ "$backup_file" == *.tar.gz ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            log "Backup integrity verified: $backup_file"
            return 0
        else
            error "Backup integrity check failed: $backup_file"
            return 1
        fi
    fi
    
    log "Backup file exists: $backup_file"
    return 0
}

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[Backup] $status: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    log "Notification: [$status] $message"
}

main() {
    local exit_code=0
    local backup_files=()
    
    log "=========================================="
    log "Ecommerce Core Store Backup Started"
    log "Timestamp: $TIMESTAMP"
    log "=========================================="
    
    if backup_database; then
        backup_files+=("$BACKUP_DIR/${BACKUP_NAME}_database.sql.gz")
    else
        exit_code=1
    fi
    
    if backup_redis; then
        backup_files+=("$BACKUP_DIR/${BACKUP_NAME}_redis.rdb")
    fi
    
    if backup_storage; then
        backup_files+=("$BACKUP_DIR/${BACKUP_NAME}_storage.tar.gz")
    fi
    
    apply_retention
    
    log "=========================================="
    log "Verifying backups..."
    for file in "${backup_files[@]}"; do
        verify_backup "$file" || exit_code=1
    done
    
    if [[ $exit_code -eq 0 ]]; then
        send_notification "SUCCESS" "Backup completed successfully. Files: ${backup_files[*]}"
    else
        send_notification "FAILED" "Backup completed with errors"
    fi
    
    log "=========================================="
    log "Ecommerce Core Store Backup Completed (exit: $exit_code)"
    log "=========================================="
    
    exit $exit_code
}

if [[ "${1:-}" == "--database-only" ]]; then
    backup_database
elif [[ "${1:-}" == "--verify" ]]; then
    verify_backup "${2:-}"
else
    main
fi
