-- ==============================================================================
-- Migration: Add Profile Nutrition Parameters & Custom Rep Ranges
-- Safely alters public.profiles using IF NOT EXISTS without dropping or altering existing data.
-- Preserves all RLS policies and trigger definitions.
-- ==============================================================================

alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female')),
  add column if not exists birth_date text,
  add column if not exists age integer check (age is null or age > 0),
  add column if not exists weight numeric check (weight is null or weight > 0),
  add column if not exists height numeric check (height is null or height > 0),
  add column if not exists activity_level numeric default 1.2 check (activity_level is null or activity_level >= 1.0),
  add column if not exists goal text default 'maintenance' check (goal is null or goal in ('weight_loss', 'maintenance', 'weight_gain')),
  add column if not exists calorie_adjustment_percent numeric default 0 check (calorie_adjustment_percent is null or calorie_adjustment_percent >= 0),
  add column if not exists protein_per_kg numeric default 2.0 check (protein_per_kg is null or protein_per_kg >= 0),
  add column if not exists fat_per_kg numeric default 1.0 check (fat_per_kg is null or fat_per_kg >= 0),
  add column if not exists carbs_per_kg numeric check (carbs_per_kg is null or carbs_per_kg >= 0),
  add column if not exists custom_rep_ranges jsonb default '["4-6","6-8","8-10","8-12","10-12","12-15","15-20","20+"]'::jsonb;

-- Comment on columns for clear documentation
comment on column public.profiles.gender is 'User biological sex (male or female) for Mifflin-St Jeor calculation';
comment on column public.profiles.birth_date is 'User birth date string in YYYY-MM-DD format';
comment on column public.profiles.age is 'User age in years (derived or manual)';
comment on column public.profiles.weight is 'User body weight in kg (also used for 0kg bodyweight sets volume calculation)';
comment on column public.profiles.height is 'User height in cm';
comment on column public.profiles.activity_level is 'Physical activity level multiplier (1.2, 1.375, 1.55, 1.725, 1.9)';
comment on column public.profiles.goal is 'Nutrition goal: weight_loss, maintenance, or weight_gain';
comment on column public.profiles.calorie_adjustment_percent is 'Deficit or surplus percentage (e.g. 10, 15, 20)';
comment on column public.profiles.protein_per_kg is 'Target protein intake in grams per kg of bodyweight';
comment on column public.profiles.fat_per_kg is 'Target fat intake in grams per kg of bodyweight';
comment on column public.profiles.carbs_per_kg is 'Target carbs intake in grams per kg of bodyweight (auto-calculated)';
comment on column public.profiles.custom_rep_ranges is 'Custom list of repetition ranges configured by user';
