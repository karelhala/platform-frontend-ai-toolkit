---
description: Creates SQL query for post-upgrade VACUUM and REINDEX operations
capabilities:
  - Creates app-interface SQL query YAML file for database maintenance
  - Generates VACUUM and REINDEX SQL queries
  - Creates pull request for post-maintenance operations
---

# HCC Frontend DB Upgrade Post Maintenance Agent

This agent creates an SQL query file for database maintenance operations (VACUUM and REINDEX) that should run after the database upgrade completes.

## When to Use This Agent

Use this agent when:
- This is **step 2 for stage** or **step 3 for production**
- After verifying replication slots are clear
- Before performing the switchover

## Prerequisites

Get from the user:
- Service name (e.g., "chrome-service")
- Environment (stage or production)
- Product name (default: "insights")
- Database name (default: service short name, e.g., "chrome")
- Date (default: today)

## Implementation Steps

### 1. Gather Information

Ask the user for:
- Service name
- Environment (stage or production)
- Target PostgreSQL version
- Product (defaults to "insights")
- Database name (defaults to service short name)
- Date (defaults to today)

### 2. Call the db-upgrader Skill

Call the `db-upgrader` skill with the post-maintenance action:

```javascript
Skill("db-upgrader", args: "{service} {environment} {version} {product} post-maintenance")
```

**Example:**
```javascript
Skill("db-upgrader", args: "chrome-service stage 16.9 insights post-maintenance")
```

The skill will receive:
- `$ARGUMENTS.service` - Service name (e.g., "chrome-service")
- `$ARGUMENTS.environment` - Environment (e.g., "stage")
- `$ARGUMENTS.version` - Target PostgreSQL version (e.g., "16.9")
- `$ARGUMENTS.product` - Product/bundle (e.g., "insights")
- `$ARGUMENTS.action` - "post-maintenance"

The skill will generate the SQL query YAML file at:
`data/app-interface/sql-queries/{product}/{service-short}/{env}/{date}-{env}-post-maintenance.yaml`

### 3. Create Pull Request

After the skill completes the YAML operations:

- **Branch**: `{service}-{env}-post-maintenance-{date}`
- **Commit**: `Post maintenance script for {service} {environment}`
- **PR Title**: `Post maintenance script for {service} {environment}`

## What The SQL Queries Do

The generated file includes two queries:

1. `VACUUM (VERBOSE, ANALYZE);`
   - Reclaims storage occupied by dead tuples
   - Updates statistics for the query planner
   - Verbose mode provides detailed output

2. `REINDEX (VERBOSE) DATABASE {database-name};`
   - Rebuilds all indexes in the database
   - Improves query performance after major version upgrade
   - Verbose mode provides detailed output

## File Structure

The skill generates this structure:
```yaml
---
$schema: /app-interface/app-interface-sql-query-1.yml
labels: {}
name: {date}-{env}-post-maintenance
namespace:
  $ref: /services/{product}/{service}/namespaces/{service}-{env}.yml
identifier: {service}-{env}
output: stdout
queries:
  - VACUUM (VERBOSE, ANALYZE);
  - REINDEX (VERBOSE) DATABASE {database-name};
```

## Notes

- These queries run AFTER the switchover completes
- VACUUM reclaims space and updates statistics
- REINDEX rebuilds indexes for optimal performance
- Both are important for database health after upgrade

## Next Steps

After this PR is merged:
- Proceed to step 4 - Switchover (the critical step)
