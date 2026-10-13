CREATE TABLE IF NOT EXISTS command_permissions (
    id BIGSERIAL PRIMARY KEY,
    command_name TEXT NOT NULL,
    user_id VARCHAR(20),
    role_id VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT command_permissions_target_required
        CHECK (user_id IS NOT NULL OR role_id IS NOT NULL),
    CONSTRAINT command_permissions_unique
        UNIQUE NULLS NOT DISTINCT (command_name, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_command_permissions_name
    ON command_permissions (command_name);

CREATE TABLE IF NOT EXISTS custom_errors (
    error_key TEXT PRIMARY KEY,
    error_message TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS command_logs (
    id BIGSERIAL PRIMARY KEY,
    command_name TEXT NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    user_mention TEXT NOT NULL,
    guild_id VARCHAR(20),
    guild_name TEXT,
    channel_id VARCHAR(20),
    channel_name TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timezone_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started',
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_command_logs_executed_at
    ON command_logs (executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_command_logs_user_id
    ON command_logs (user_id);

INSERT INTO custom_errors (error_key, error_message)
VALUES
    ('permission_denied', 'You do not have permission to use this command.'),
    ('permission_unconfigured', 'This command has not been configured for use.'),
    ('invalid_arguments', 'Invalid command arguments. Please check the command syntax.'),
    ('invalid_json', 'The supplied JSON is invalid.'),
    ('command_failed', 'An unexpected error occurred while running this command.')
ON CONFLICT (error_key) DO NOTHING;