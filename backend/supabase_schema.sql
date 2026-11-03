-- ========================================
-- 药记得 - Supabase 数据库表结构
-- ========================================

-- 1. 创建 profiles 表（用户资料）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  real_name TEXT,
  id_card TEXT,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  family_group_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建 family_groups 表（家庭组）
CREATE TABLE IF NOT EXISTS family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建 medications 表（用药记录）
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  usage TEXT,
  effect TEXT,
  frequency TEXT,
  time TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'missed')),
  taken_time TEXT,
  created_by UUID REFERENCES profiles(id),
  reminder_times TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建 messages 表（留言消息）
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 创建 reminder_logs 表（提醒日志）
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  actual_taken_time TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'taken', 'missed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 创建 medication_review_requests 表（药品复核请求）
CREATE TABLE IF NOT EXISTS medication_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elderly_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  medication JSONB NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 创建索引
-- ========================================

CREATE INDEX IF NOT EXISTS idx_profiles_family_group ON profiles(family_group_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_time ON medications(time);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_medication ON reminder_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_elderly ON medication_review_requests(elderly_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON medication_review_requests(status);

-- ========================================
-- 启用行级安全 (RLS)
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_review_requests ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS 策略
-- ========================================

-- Profiles: 用户只能查看和修改自己的资料
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Family Groups: 家庭组成员可以查看
CREATE POLICY "Family members can view group"
  ON family_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.family_group_id = family_groups.id
    )
  );

-- Medications: 可以查看自己或同家庭组长者的用药
CREATE POLICY "Users can view their own medications"
  ON medications FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'child'
      AND EXISTS (
        SELECT 1 FROM profiles p2
        WHERE p2.id = medications.user_id
        AND p2.family_group_id = profiles.family_group_id
      )
    )
  );

CREATE POLICY "Users can manage their own medications"
  ON medications FOR ALL
  USING (user_id = auth.uid() OR created_by = auth.uid());

-- Messages: 可以查看发送给自己或自己发送的消息
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can mark their messages as read"
  ON messages FOR UPDATE
  USING (to_user_id = auth.uid());

-- Reminder Logs: 可以查看相关提醒
CREATE POLICY "Users can view reminder logs"
  ON reminder_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM medications
      WHERE medications.id = reminder_logs.medication_id
      AND (
        medications.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'child'
          AND EXISTS (
            SELECT 1 FROM profiles p2
            WHERE p2.id = medications.user_id
            AND p2.family_group_id = profiles.family_group_id
          )
        )
      )
    )
  );

-- Review Requests: 可以查看同家庭组的复核请求
CREATE POLICY "Users can view review requests"
  ON medication_review_requests FOR SELECT
  USING (
    elderly_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'child'
      AND EXISTS (
        SELECT 1 FROM profiles p2
        WHERE p2.id = medication_review_requests.elderly_id
        AND p2.family_group_id = profiles.family_group_id
      )
    )
  );

CREATE POLICY "Elderly can create review requests"
  ON medication_review_requests FOR INSERT
  WITH CHECK (elderly_id = auth.uid());

CREATE POLICY "Children can review requests"
  ON medication_review_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'child'
      AND EXISTS (
        SELECT 1 FROM profiles p2
        WHERE p2.id = medication_review_requests.elderly_id
        AND p2.family_group_id = profiles.family_group_id
      )
    )
  );

-- ========================================
-- 创建视图（可选，用于简化查询）
-- ========================================

CREATE OR REPLACE VIEW family_members AS
SELECT 
  p.id,
  p.username,
  p.real_name,
  p.role,
  p.family_group_id,
  fg.group_code
FROM profiles p
LEFT JOIN family_groups fg ON p.family_group_id = fg.id;

-- ========================================
-- 创建触发器（自动更新 updated_at）
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_groups_updated_at BEFORE UPDATE ON family_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 完成！
-- ========================================
