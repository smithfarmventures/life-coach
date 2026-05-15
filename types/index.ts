export interface User {
  id: string
  phone_number: string | null
  telegram_chat_id: number | null
  name: string
  timezone: string
  created_at: string
  last_checkin_type: string | null
  last_checkin_at: string | null
}

export interface FoodLog {
  id: string
  user_id: string
  logged_at: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  is_fish: boolean
  raw_input: string
}

export interface ExerciseLog {
  id: string
  user_id: string
  logged_at: string
  exercise_type: 'bodyweight' | 'cardio' | 'sport'
  duration_minutes: number
  description: string
  raw_input: string
}

export interface OuraData {
  total_sleep_hours: number | null
  rem_hours: number | null
  deep_hours: number | null
  efficiency: number | null
  sleep_score: number | null
  readiness_score: number | null
  bedtime_start: string | null
  bedtime_end: string | null
}

export interface WhoopData {
  total_sleep_hours: number | null
  rem_hours: number | null
  deep_hours: number | null
  efficiency: number | null
  performance: number | null
  recovery: number | null
  hrv_ms: number | null
  resting_hr: number | null
}

export interface DailyCheck {
  id: string
  user_id: string
  date: string
  breakfast_protein: boolean
  workout_done: boolean
  eating_done_by_930: boolean
  bed_by_1030: boolean
  sleep_response: string | null
  sleep_hours: number | null
  sleep_quality: string | null
  wind_down_confirmed: boolean
  oura_data: OuraData | null
  whoop_data: WhoopData | null
}

export interface WeeklySummary {
  id: string
  user_id: string
  week_start: string
  fish_meals_count: number
  workouts_count: number
  days_on_track: number
}

export interface ParsedFood {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  is_fish: boolean
  ingredients: string[]
}

export interface ParsedExercise {
  exercise_type: 'bodyweight' | 'cardio' | 'sport'
  duration_minutes: number
  description: string
  exercises: string[]
}

export type CheckinType =
  | 'morning'
  | 'lunch'
  | 'dinner'
  | 'bedtime'
  | 'friday-menu'
  | 'sunday-workout'
  | 'monday-recap'

export interface FoodPreferences {
  user_id: string
  data: FoodPreferencesData
  updated_at: string
}

export interface FoodPreferencesData {
  diet_style: string                  // free text: e.g. "Mediterranean-leaning, fish-forward"
  goals: string[]                     // ["lower ApoB/LDL", "raise vit D", "build muscle"]
  weekday_pattern: string             // free text describing typical Mon–Thu cooking style
  protein_staples: string[]           // ["chicken", "ground turkey", "salmon", ...]
  veg_staples: string[]
  carb_staples: string[]
  cuisines: string[]                  // ["Italian", "Asian", "Mexican/Latin", "American comfort"]
  treats_allowed: string[]            // foods Andrew won't give up — keep visible to the model
  dislikes: string[]
  restrictions: string[]              // medical/dietary restrictions
  cooking_constraints: string         // e.g. "1 stove + 2 oven, set-it-and-forget-it"
  notes: string                       // any free-text extras
  household_health_notes?: string     // household-level health constraints (e.g. wife's iron deficiency)
}

export interface WeeklyMenu {
  id: string
  user_id: string
  week_start: string                  // YYYY-MM-DD (Monday)
  options: MenuOption[]
  chosen: number[] | null             // indices (0-based) of the 3 picked, or null until user replies
  generated_at: string
}

export interface MenuOption {
  name: string                        // "Teriyaki Salmon Bowl"
  ingredients: string[]               // main ingredients
  prep_notes: string                  // 1-line cooking guidance
  why: string                         // why this fits Andrew's profile (1 sentence)
}

export interface WeeklyWorkoutPlan {
  id: string
  user_id: string
  week_start: string                  // YYYY-MM-DD (Monday)
  plan: WorkoutDay[]                  // length 7
  generated_at: string
}

export interface WorkoutDay {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  type: 'strength' | 'cardio' | 'sport' | 'active-rest' | 'rest'
  description: string
  target_minutes: number
}
