CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('b2b', 'b2c')),
  source TEXT NOT NULL CHECK (source IN ('merchant_portal', 'customer_portal', 'platform_console', 'system')),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'waiting_customer', 'waiting_agent', 'resolved', 'closed')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  requester_type TEXT NOT NULL CHECK (requester_type IN ('customer', 'store_user', 'platform')),
  requester_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  requester_store_user_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
  requester_label TEXT,
  assigned_to_type TEXT CHECK (assigned_to_type IN ('store_user', 'platform_agent')),
  assigned_to_store_user_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
  assigned_to_label TEXT,
  sla_first_response_due_at TIMESTAMPTZ,
  sla_resolve_due_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_store_status_priority_created
  ON support_tickets (store_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_store_scope_updated
  ON support_tickets (store_id, scope, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'store_user', 'platform_agent', 'system')),
  author_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  author_store_user_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
  author_label TEXT,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
  ON support_messages (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS support_sla_policies (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('b2b', 'b2c')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  first_response_minutes INTEGER NOT NULL CHECK (first_response_minutes > 0),
  resolution_minutes INTEGER NOT NULL CHECK (resolution_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_sla_policies_store_scope_priority
  ON support_sla_policies (store_id, scope, priority, is_active);

CREATE TABLE IF NOT EXISTS support_macros (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_store_user_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_macros_store_active
  ON support_macros (store_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_events (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'store_user', 'platform_agent', 'system')),
  actor_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  actor_store_user_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
  actor_label TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket_created
  ON support_ticket_events (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('store', 'store_user', 'customer', 'platform')),
  recipient_store_user_id UUID REFERENCES store_users(id) ON DELETE CASCADE,
  recipient_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  recipient_label TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_store_recipient_created
  ON notifications (store_id, recipient_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_store_unread
  ON notifications (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_customer_unread
  ON notifications (recipient_customer_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('store', 'store_user', 'customer')),
  recipient_store_user_id UUID REFERENCES store_users(id) ON DELETE CASCADE,
  recipient_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('inbox', 'email')),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  frequency TEXT NOT NULL DEFAULT 'instant' CHECK (frequency IN ('instant', 'daily_digest', 'mute')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_unique
  ON notification_preferences (
    COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    recipient_type,
    COALESCE(recipient_store_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(recipient_customer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    event_type,
    channel
  );

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('inbox', 'email')),
  locale TEXT NOT NULL DEFAULT 'en',
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_event_channel_locale
  ON notification_templates (event_type, channel, locale, is_active);
