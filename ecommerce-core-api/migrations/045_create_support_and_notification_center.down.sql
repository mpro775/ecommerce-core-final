DROP INDEX IF EXISTS idx_notification_templates_event_channel_locale;
DROP TABLE IF EXISTS notification_templates;

DROP INDEX IF EXISTS idx_notification_preferences_unique;
DROP TABLE IF EXISTS notification_preferences;

DROP INDEX IF EXISTS idx_notifications_customer_unread;
DROP INDEX IF EXISTS idx_notifications_store_unread;
DROP INDEX IF EXISTS idx_notifications_store_recipient_created;
DROP TABLE IF EXISTS notifications;

DROP INDEX IF EXISTS idx_support_ticket_events_ticket_created;
DROP TABLE IF EXISTS support_ticket_events;

DROP INDEX IF EXISTS idx_support_macros_store_active;
DROP TABLE IF EXISTS support_macros;

DROP INDEX IF EXISTS idx_support_sla_policies_store_scope_priority;
DROP TABLE IF EXISTS support_sla_policies;

DROP INDEX IF EXISTS idx_support_messages_ticket_created;
DROP TABLE IF EXISTS support_messages;

DROP INDEX IF EXISTS idx_support_tickets_store_scope_updated;
DROP INDEX IF EXISTS idx_support_tickets_store_status_priority_created;
DROP TABLE IF EXISTS support_tickets;
