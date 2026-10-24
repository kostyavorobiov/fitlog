import { Gender, ActivityLevel, NutritionGoal, User } from '../types/workout';

export interface NutritionCalculationResult {
  isComplete: boolean;
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  proteinPerKg: number;
  fatGrams: number;
  fatPerKg: number;
  carbsGrams: number;
  carbsPerKg: number;
  validationError?: string;
}

/**
 * Calculate age from YYYY-MM-DD birth date string
 */
export function calculateAge(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? age : null;
}

/**
 * Calculate BMR, TDEE, Target Calories, and Macronutrients using Mifflin-St Jeor formula
 */
export function calculateNutrition(user?: Partial<User> | null): NutritionCalculationResult {
  const defaultResult: NutritionCalculationResult = {
    isComplete: false,
    bmr: 0,
    tdee: 0,
    targetCalories: 0,
    proteinGrams: 0,
    proteinPerKg: 0,
    fatGrams: 0,
    fatPerKg: 0,
    carbsGrams: 0,
    carbsPerKg: 0,
  };

  if (!user) return defaultResult;

  const weight = Number(user.weight) || 0;
  const height = Number(user.height) || 0;
  const gender = user.gender;
  const age = user.age || calculateAge(user.birthDate) || 0;
  const activityLevel = Number(user.activityLevel) || 1.2;
  const goal: NutritionGoal = user.goal || 'maintenance';
  const adjustmentPercent = Number(user.calorieAdjustmentPercent) || 0;
  const proteinPerKg = Number(user.proteinPerKg) || 1.8;
  const fatPerKg = Number(user.fatPerKg) || 1.0;

  // Validation: Check if basic required fields are filled
  if (weight <= 0 || height <= 0 || age <= 0 || !gender) {
    return {
      ...defaultResult,
      isComplete: false,
    };
  }

  // 1. Mifflin–St Jeor BMR:
  // Men: BMR = 10 × weight + 6.25 × height − 5 × age + 5
  // Women: BMR = 10 × weight + 6.25 × height − 5 × age − 161
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  bmr = Math.round(bmr);

  // 2. TDEE = BMR × activityLevel
  const tdee = Math.round(bmr * activityLevel);

  // 3. Target Calories = TDEE ± deficit/surplus
  let targetCalories = tdee;
  if (goal === 'weight_loss') {
    targetCalories = Math.round(tdee * (1 - Math.abs(adjustmentPercent) / 100));
  } else if (goal === 'weight_gain') {
    targetCalories = Math.round(tdee * (1 + Math.abs(adjustmentPercent) / 100));
  }

  // 4. Proteins (g) = weight × proteinPerKg
  const proteinGrams = Math.round(weight * proteinPerKg);

  // 5. Fats (g) = weight × fatPerKg
  const fatGrams = Math.round(weight * fatPerKg);

  // 6. Carbs (g) = (targetCalories - protein * 4 - fat * 9) / 4
  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatGrams * 9;
  const remainingCalories = targetCalories - proteinCalories - fatCalories;

  let validationError: string | undefined;
  if (remainingCalories < 0) {
    validationError = 'Задані білки та жири перевищують цільовий калорійний бюджет';
  }

  const carbsGrams = remainingCalories > 0 ? Math.round(remainingCalories / 4) : 0;
  const carbsPerKg = weight > 0 ? Math.round((carbsGrams / weight) * 10) / 10 : 0;

  return {
    isComplete: true,
    bmr,
    tdee,
    targetCalories,
    proteinGrams,
    proteinPerKg,
    fatGrams,
    fatPerKg,
    carbsGrams,
    carbsPerKg,
    validationError,
  };
}

/**
 * Parse a rep range string like "4-6", "8-12", "15+", "20"
 */
export function parseRepRange(rangeStr: string): { min: number; max: number } | null {
  if (!rangeStr) return null;
  const clean = rangeStr.trim().replace(/\s+/g, '');

  // "4-6", "4–6", "4—6"
  const rangeMatch = clean.match(/^(\d+)[-–—](\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    if (min <= 0 || max <= 0 || min > max) return null;
    return { min, max };
  }

  // "20+"
  const plusMatch = clean.match(/^(\d+)\+$/);
  if (plusMatch) {
    const min = parseInt(plusMatch[1], 10);
    if (min <= 0) return null;
    return { min, max: 999 };
  }

  // Single number "15"
  const singleMatch = clean.match(/^(\d+)$/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    if (val <= 0) return null;
    return { min: val, max: val };
  }

  return null;
}

/**
 * Sort rep ranges in ascending order of repetitions
 */
export function sortRepRanges(ranges: string[]): string[] {
  return [...ranges].sort((a, b) => {
    const pA = parseRepRange(a);
    const pB = parseRepRange(b);
    if (!pA && !pB) return a.localeCompare(b);
    if (!pA) return 1;
    if (!pB) return -1;
    if (pA.min !== pB.min) return pA.min - pB.min;
    return pA.max - pB.max;
  });
}

/**
 * Validate new rep range candidate against existing ranges
 */
export function validateNewRepRange(
  existingRanges: string[],
  candidate: string
): { isValid: boolean; error?: string; formatted?: string } {
  const clean = candidate.trim();
  if (!clean) {
    return { isValid: false, error: 'Введіть діапазон повторень' };
  }

  const parsed = parseRepRange(clean);
  if (!parsed) {
    return {
      isValid: false,
      error: 'Некоректний формат діапазону. Вкажіть, наприклад, 8-12, 10-15 або 20+',
    };
  }

  const formatted = parsed.max === 999
    ? `${parsed.min}+`
    : parsed.min === parsed.max
    ? `${parsed.min}`
    : `${parsed.min}-${parsed.max}`;

  // Check for duplicates
  const isDuplicate = existingRanges.some((r) => {
    const p = parseRepRange(r);
    if (!p) return r.trim().toLowerCase() === clean.toLowerCase();
    return p.min === parsed.min && p.max === parsed.max;
  });

  if (isDuplicate) {
    return { isValid: false, error: 'Такий діапазон повторень вже існує' };
  }

  return { isValid: true, formatted };
}
