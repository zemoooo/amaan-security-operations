-- Supabase Schema for CCTV SaaS Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table
CREATE TABLE public.tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    plan_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    camera_limit INTEGER DEFAULT 0,
    device_limit INTEGER DEFAULT 0,
    employee_limit INTEGER DEFAULT 0,
    retention_days INTEGER DEFAULT 30,
    modules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Users Table
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    avatar TEXT,
    phone TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Cameras Table
CREATE TABLE public.cameras (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    stream_url TEXT,
    username_encrypted TEXT,
    password_encrypted TEXT,
    status TEXT DEFAULT 'OFFLINE',
    fps INTEGER DEFAULT 0,
    resolution TEXT,
    ai_enabled BOOLEAN DEFAULT false,
    recording_enabled BOOLEAN DEFAULT false,
    type TEXT,
    last_ping TEXT,
    detection_settings JSONB DEFAULT '{}'::jsonb,
    zones JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Customer WhatsApp connection/settings
CREATE TABLE IF NOT EXISTS public.customer_whatsapp_settings (
    tenant_id TEXT PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_email TEXT,
    phone_number TEXT,
    customer_name TEXT,
    instance_name TEXT,
    enabled BOOLEAN DEFAULT true,
    alert_mode TEXT DEFAULT 'MESSAGE_ONLY',
    min_severity TEXT DEFAULT 'MEDIUM',
    language TEXT DEFAULT 'ar',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Employees Table
CREATE TABLE public.employees (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_code TEXT,
    name TEXT NOT NULL,
    department TEXT,
    position TEXT,
    phone TEXT,
    email TEXT,
    photo_url TEXT,
    face_embedding_vector JSONB,
    is_active BOOLEAN DEFAULT true,
    allowed_zones JSONB DEFAULT '[]'::jsonb,
    schedule JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Attendance Records Table
CREATE TABLE public.attendance_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name TEXT,
    department TEXT,
    photo_url TEXT,
    date TEXT NOT NULL,
    first_entry_time TEXT,
    last_exit_time TEXT,
    total_working_minutes INTEGER DEFAULT 0,
    late_minutes INTEGER DEFAULT 0,
    early_leave_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    status TEXT,
    adjusted_by_supervisor BOOLEAN DEFAULT false,
    adjustment_reason TEXT,
    audit_log_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Behavior Events Table
CREATE TABLE public.behavior_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    camera_id TEXT REFERENCES public.cameras(id) ON DELETE CASCADE,
    camera_name TEXT,
    camera_location TEXT,
    timestamp TEXT NOT NULL,
    event_type TEXT,
    severity TEXT,
    confidence FLOAT,
    person_name TEXT,
    snapshot_url TEXT,
    video_clip_url TEXT,
    reason TEXT,
    review_status TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Security Incidents Table
CREATE TABLE public.security_incidents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    camera_id TEXT REFERENCES public.cameras(id) ON DELETE CASCADE,
    camera_name TEXT,
    timestamp TEXT NOT NULL,
    title TEXT NOT NULL,
    incident_type TEXT,
    severity TEXT,
    confidence FLOAT,
    reason TEXT,
    suspect_details JSONB DEFAULT '{}'::jsonb,
    involved_objects JSONB DEFAULT '[]'::jsonb,
    status TEXT,
    video_evidence JSONB DEFAULT '{}'::jsonb,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Inventory Products Table
CREATE TABLE public.inventory_products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    warehouse TEXT,
    zone TEXT,
    camera_name TEXT,
    unit TEXT,
    units_per_carton INTEGER,
    expected_quantity INTEGER DEFAULT 0,
    ai_detected_quantity INTEGER DEFAULT 0,
    confidence FLOAT,
    difference INTEGER DEFAULT 0,
    difference_reason TEXT,
    outgoing_count_today INTEGER DEFAULT 0,
    incoming_count_today INTEGER DEFAULT 0,
    last_count_timestamp TEXT,
    low_stock_threshold INTEGER,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Audit Logs Table
CREATE TABLE public.audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_name TEXT,
    user_role TEXT,
    action TEXT,
    entity TEXT,
    entity_id TEXT,
    timestamp TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) - Enabled but set to allow all for demo purposes
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write" ON public.tenants FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.cameras FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.employees FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.attendance_records FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.behavior_events FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.security_incidents FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.inventory_products FOR ALL USING (true);
CREATE POLICY "Allow public read/write" ON public.audit_logs FOR ALL USING (true);


-- ============================================================
-- Production additions: Evolution WhatsApp, Edge Agents, DVR/NVR
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recorder_devices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('NVR','DVR')),
    brand TEXT,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 8000,
    username_encrypted TEXT,
    password_encrypted TEXT,
    channels INTEGER DEFAULT 8,
    status TEXT DEFAULT 'OFFLINE',
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS recorder_id TEXT;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS channel INTEGER;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS agent_id TEXT;

CREATE TABLE IF NOT EXISTS public.edge_agents (
    id UUID PRIMARY KEY,
    tenant_id TEXT REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    version TEXT,
    os TEXT,
    is_active BOOLEAN DEFAULT true,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.whatsapp_events (
    id UUID PRIMARY KEY,
    tenant_id TEXT,
    event_type TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.recorder_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write" ON public.recorder_devices;
DROP POLICY IF EXISTS "Allow public read/write" ON public.edge_agents;
DROP POLICY IF EXISTS "Allow public read/write" ON public.whatsapp_events;
CREATE POLICY "Service role manages recorder devices" ON public.recorder_devices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages edge agents" ON public.edge_agents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages whatsapp events" ON public.whatsapp_events FOR ALL USING (auth.role() = 'service_role');


-- Employee photo storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public employee photos" ON storage.objects;
CREATE POLICY "Public employee photos" ON storage.objects FOR SELECT USING (bucket_id = 'employee-photos');
CREATE POLICY "Service role employee photos" ON storage.objects FOR ALL USING (bucket_id = 'employee-photos' AND auth.role() = 'service_role') WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'service_role');

-- Evidence storage for AI security snapshots.
INSERT INTO storage.buckets (id, name, public)
VALUES ('security-evidence', 'security-evidence', true)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cameras_agent_id ON public.cameras(agent_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_tenant_camera_time ON public.behavior_events(tenant_id, camera_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_agents_tenant_active ON public.edge_agents(tenant_id, is_active);
