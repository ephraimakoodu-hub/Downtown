# Existing database safety procedure

The supplied Downtown Supermarket database was created separately in phpMyAdmin.
Treat it as an existing database containing business data.

## Important

Do not run the original migrations against it until its schema has been compared
with `backend/migrations/001_init.sql`, `002_operations.sql`, and
`003_reviews_jobs_images.sql`.

The migration runner now fails closed when:
- `schema_migrations` does not exist; and
- the selected database already contains one or more tables.

In that case it lists the existing tables and exits without creating the
migration tracker or changing application tables. This avoids treating an
untracked existing database as an empty database.

## Collect a schema-only export

1. Open phpMyAdmin and select `downtown_supermarket`.
2. Choose **Export**.
3. Select **Custom**.
4. Select all 25 tables.
5. Under output, choose SQL.
6. In the data section, choose **Structure only** (do not export rows).
7. Export and upload the resulting `.sql` file here.

Do not include `.env`, database passwords, customer data, order data, or other
personal information.

Alternatively, run `DATABASE_DIAGNOSTIC_READ_ONLY.sql` in phpMyAdmin and
provide the result sets. It contains SELECT statements only.

## After the schema is reviewed

We will map each existing table and column to the application's expected
schema, identify which migration changes are already present, and prepare
only the missing changes. Any proposed ALTER statements will be reviewed
before execution, and a fresh backup must be taken first.

Never mark a migration as applied merely to bypass an error. A migration
should only be recorded after its effects have been verified.
