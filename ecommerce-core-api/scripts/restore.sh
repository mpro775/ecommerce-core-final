#!/bin/bash
set -euo pipefail

RESTORE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$RESTORE_SCRIPT_DIR/../.." && pwd)"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

confirm_restore() {
    local component="$1"
    echo ""
    echo "=========================================="
    echo "WARNING: This will RESTORE $component from backup"
    echo "This will OVERWRITE existing data!"
    echo "=========================================="
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

restore_database() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    confirm_restore "DATABASE"
    
    local db_container="${DB_CONTAINER:-ecommerce_core-postgres}"
    local db_user="${POSTGRES_USER:-ecommerce_core}"
    local db_name="${POSTGRES_DB:-ecommerce_core_store}"
    
    log "Starting database restore from: $backup_file"
    
    if [[ "$backup_file" == *.gz ]]; then
        if docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
            log "Using Docker container: $db_container"
            zcat "$backup_file" | docker exec -i "$db_container" psql -U "$db_user" -d "$db_name"
        elif command -v psql &> /dev/null; then
            log "Using local psql"
            zcat "$backup_file" | PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$db_user" -d "$db_name"
        else
            error "Neither Docker container nor psql found"
            return 1
        fi
    else
        if docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
            log "Using Docker container: $db_container"
            docker exec -i "$db_container" psql -U "$db_user" -d "$db_name" < "$backup_file"
        elif command -v psql &> /dev/null; then
            log "Using local psql"
            PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$db_user" -d "$db_name" < "$backup_file"
        else
            error "Neither Docker container nor psql found"
            return 1
        fi
    fi
    
    log "Database restore completed successfully"
    return 0
}

restore_redis() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    confirm_restore "REDIS"
    
    local redis_container="${REDIS_CONTAINER:-ecommerce_core-redis}"
    
    log "Starting Redis restore from: $backup_file"
    
    if docker ps --format '{{.Names}}' | grep -q "^${redis_container}$"; then
        log "Using Docker container: $redis_container"
        docker cp "$backup_file" "$redis_container:/data/dump.rdb"
        docker restart "$redis_container"
        sleep 3
        log "Redis restore completed. Container restarted."
    else
        error "Redis container not found: $redis_container"
        return 1
    fi
    
    return 0
}

restore_storage() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    confirm_restore "STORAGE"
    
    local minio_container="${MINIO_CONTAINER:-ecommerce_core-minio}"
    
    log "Starting storage restore from: $backup_file"
    
    if docker ps --format '{{.Names}}' | grep -q "^${minio_container}$"; then
        log "Using Docker container: $minio_container"
        docker cp "$backup_file" "$minio_container:/tmp/storage_backup.tar.gz"
        docker exec "$minio_container" tar xzf /tmp/storage_backup.tar.gz -C /
        docker exec "$minio_container" rm -f /tmp/storage_backup.tar.gz
        log "Storage restore completed"
    else
        error "MinIO container not found: $minio_container"
        return 1
    fi
    
    return 0
}

validate_restore() {
    local component="$1"
    
    log "Validating $component restore..."
    
    case "$component" in
        database)
            local db_container="${DB_CONTAINER:-ecommerce_core-postgres}"
            local db_user="${POSTGRES_USER:-ecommerce_core}"
            local db_name="${POSTGRES_DB:-ecommerce_core_store}"
            
            if docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
                local table_count=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
                log "Database validation: $table_count tables found"
                
                local outbox_count=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM outbox_events;" | tr -d ' ')
                log "Outbox events: $outbox_count"
            fi
            ;;
        redis)
            local redis_container="${REDIS_CONTAINER:-ecommerce_core-redis}"
            if docker ps --format '{{.Names}}' | grep -q "^${redis_container}$"; then
                docker exec "$redis_container" redis-cli ping
            fi
            ;;
        storage)
            log "Storage validation: Manual verification recommended"
            ;;
    esac
    
    log "Validation completed for $component"
}

list_backups() {
    local backup_dir="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
    
    if [[ ! -d "$backup_dir" ]]; then
        log "No backups directory found"
        return
    fi
    
    log "Available backups in $backup_dir:"
    echo ""
    printf "%-40s %-15s %-15s\n" "FILE" "SIZE" "DATE"
    echo "------------------------------------------------------------------------"
    
    for file in "$backup_dir"/ecommerce_core_store_*; do
        if [[ -f "$file" ]]; then
            local size=$(du -h "$file" | cut -f1)
            local date=$(stat -c %y "$file" 2>/dev/null | cut -d' ' -f1 || stat -f "%Sm" "$file" 2>/dev/null)
            local name=$(basename "$file")
            printf "%-40s %-15s %-15s\n" "$name" "$size" "$date"
        fi
    done
}

usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                        List available backups"
    echo "  database <backup_file>      Restore database from backup"
    echo "  redis <backup_file>         Restore Redis from backup"
    echo "  storage <backup_file>       Restore storage from backup"
    echo "  validate <component>        Validate restore (database|redis|storage)"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 database ./backups/ecommerce_core_store_20240115_120000_database.sql.gz"
    echo "  $0 validate database"
}

if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

case "$1" in
    list)
        list_backups
        ;;
    database)
        if [[ $# -lt 2 ]]; then
            error "Missing backup file argument"
            usage
            exit 1
        fi
        restore_database "$2"
        ;;
    redis)
        if [[ $# -lt 2 ]]; then
            error "Missing backup file argument"
            usage
            exit 1
        fi
        restore_redis "$2"
        ;;
    storage)
        if [[ $# -lt 2 ]]; then
            error "Missing backup file argument"
            usage
            exit 1
        fi
        restore_storage "$2"
        ;;
    validate)
        if [[ $# -lt 2 ]]; then
            error "Missing component argument"
            usage
            exit 1
        fi
        validate_restore "$2"
        ;;
    *)
        error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
