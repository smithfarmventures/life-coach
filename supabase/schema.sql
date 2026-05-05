-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(15),
  telegram_chat_id BIGINT UNIQUE,
  name VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Food logs
CREATE TABLE food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  logged_at TIMESTAMP DEFAULT NOW(),
  meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description TEXT,
  calories INT,
  protein_g INT,
  carbs_g INT,
  fat_g INT,
  is_fish BOOLEAN DEFAULT FALSE,
  raw_input TEXT
);

-- Exercise logs
CREATE TABLE exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  logged_at TIMESTAMP DEFAULT NOW(),
  exercise_type VARCHAR(50) CHECK (exercise_type IN ('bodyweight', 'cardio', 'sport')),
  duration_minutes INT,
  description TEXT,
  raw_input TEXT
);

-- Daily checkboxes
CREATE TABLE daily_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  breakfast_protein BOOLEAN DEFAULT FALSE,
  workout_done BOOLEAN DEFAULT FALSE,
  eating_done_by_930 BOOLEAN DEFAULT FALSE,
  bed_by_1030 BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, date)
);

-- Weekly summaries (optional denormalized cache)
CREATE TABLE weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  fish_meals_count INT DEFAULT 0,
  workouts_count INT DEFAULT 0,
  days_on_track INT DEFAULT 0,
  UNIQUE(user_id, week_start)
);

-- Indexes for common queries
CREATE INDEX idx_food_logs_user_logged ON food_logs(user_id, logged_at);
CREATE INDEX idx_exercise_logs_user_logged ON exercise_logs(user_id, logged_at);
CREATE INDEX idx_daily_checks_user_date ON daily_checks(user_id, date);

-- Insert Andrew (update telegram_chat_id after you message the bot once)
-- To find your chat_id: message @userinfobot on Telegram
INSERT INTO users (telegram_chat_id, phone_number, name, timezone)
VALUES (YOUR_TELEGRAM_CHAT_ID, '+1XXXXXXXXXX', 'Andrew', 'America/New_York');
