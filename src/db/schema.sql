-- Leading with Heart AI Coaching App Database Schema
-- Migrated from Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (replaces auth.users from Supabase)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'trialing', 'active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT subscriptions_user_id_key UNIQUE (user_id)
);

-- Users limits table
CREATE TABLE IF NOT EXISTS users_limits (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_generations_today INTEGER DEFAULT 0,
  email_generations_last_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
  coaching_sessions_today INTEGER DEFAULT 0,
  coaching_sessions_last_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
  difficult_conversations_today INTEGER DEFAULT 0,
  difficult_conversations_last_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Coaching sessions table
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'general',
  challenge TEXT NOT NULL DEFAULT '',
  desired_outcome TEXT NOT NULL DEFAULT '',
  insights TEXT[] DEFAULT '{}',
  action_items TEXT[] DEFAULT '{}',
  feedback TEXT,
  session_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Coaching conversations table
CREATE TABLE IF NOT EXISTS coaching_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assistant_id TEXT,
  thread_id TEXT,
  conversation_state JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Follow up sessions table
CREATE TABLE IF NOT EXISTS follow_up_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_session_id UUID NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Difficult conversation history table
CREATE TABLE IF NOT EXISTS difficult_conversation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  conversation_topic TEXT NOT NULL,
  desired_outcome TEXT NOT NULL,
  communication_style TEXT NOT NULL,
  additional_context TEXT,
  feedback TEXT,
  detailed_feedback JSONB,
  performance_metrics JSONB,
  key_strengths TEXT[],
  improvement_areas TEXT[],
  actionable_next_steps JSONB,
  tenets_rating JSONB,
  -- Legacy fields (for backward compatibility)
  scenario TEXT,
  intensity_level TEXT,
  role TEXT,
  dialogue_history JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI assistants table
CREATE TABLE IF NOT EXISTS ai_assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assistant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  file_ids TEXT[] DEFAULT '{}',
  vector_store_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  file_id TEXT NOT NULL DEFAULT '',
  vector_store_id TEXT NOT NULL DEFAULT '',
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Resource documents table
CREATE TABLE IF NOT EXISTS resource_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  size BIGINT NOT NULL DEFAULT 0,
  file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Quick tips table
CREATE TABLE IF NOT EXISTS quick_tips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT 'Lightbulb',
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user_id ON coaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_difficult_conversation_history_user_id ON difficult_conversation_history(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at (drop first if they exist)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_limits_updated_at ON users_limits;
CREATE TRIGGER update_users_limits_updated_at BEFORE UPDATE ON users_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coaching_sessions_updated_at ON coaching_sessions;
CREATE TRIGGER update_coaching_sessions_updated_at BEFORE UPDATE ON coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coaching_conversations_updated_at ON coaching_conversations;
CREATE TRIGGER update_coaching_conversations_updated_at BEFORE UPDATE ON coaching_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follow_up_sessions_updated_at ON follow_up_sessions;
CREATE TRIGGER update_follow_up_sessions_updated_at BEFORE UPDATE ON follow_up_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_difficult_conversation_history_updated_at ON difficult_conversation_history;
CREATE TRIGGER update_difficult_conversation_history_updated_at BEFORE UPDATE ON difficult_conversation_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_assistants_updated_at ON ai_assistants;
CREATE TRIGGER update_ai_assistants_updated_at BEFORE UPDATE ON ai_assistants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_resource_documents_updated_at ON resource_documents;
CREATE TRIGGER update_resource_documents_updated_at BEFORE UPDATE ON resource_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quick_tips_updated_at ON quick_tips;
CREATE TRIGGER update_quick_tips_updated_at BEFORE UPDATE ON quick_tips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data
INSERT INTO ai_assistants (assistant_id, name, vector_store_id)
VALUES ('asst_placeholder', 'Leadership Coach Assistant', null)
ON CONFLICT DO NOTHING;

INSERT INTO quick_tips (title, description, icon, category, active)
VALUES 
  ('Active Listening', 'Focus on understanding rather than responding. Maintain eye contact and avoid interrupting.', 'Ear', 'Communication', true),
  ('Lead by Example', 'Model the behavior you want to see in your team. Your actions speak louder than words.', 'Users', 'Leadership', true),
  ('Regular Feedback', 'Provide constructive feedback regularly, not just during reviews. Celebrate wins and address issues promptly.', 'MessageSquare', 'Management', true),
  ('Emotional Intelligence', 'Recognize and manage your emotions and those of others. Empathy is a powerful leadership tool.', 'Heart', 'Leadership', true),
  ('Clear Communication', 'Be specific and concise in your messages. Ensure your team understands expectations and goals.', 'MessageCircle', 'Communication', true)
ON CONFLICT DO NOTHING;

