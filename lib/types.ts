export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type Meal = (typeof MEALS)[number];

export const SEXES = ['Female', 'Male'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['Sedentary', 'Light', 'Moderate', 'Active', 'VeryActive'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const WEIGHT_GOALS = ['Lose', 'Maintain', 'Gain'] as const;
export type WeightGoal = (typeof WEIGHT_GOALS)[number];

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  Sedentary: 'Sedentary (little or no exercise)',
  Light: 'Light (exercise 1-3 days/week)',
  Moderate: 'Moderate (exercise 3-5 days/week)',
  Active: 'Active (exercise 6-7 days/week)',
  VeryActive: 'Very active (physical job or 2x/day)',
};

export const GOAL_LABELS: Record<WeightGoal, string> = {
  Lose: 'Lose weight (about 0.5 kg / 1 lb per week)',
  Maintain: 'Maintain weight',
  Gain: 'Gain weight (lean bulk)',
};

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  sex: Sex | null;
  birthDate: string | null; // yyyy-MM-dd
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
  dailyCalorieGoal: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
  timeZone: string;
  useMetric: boolean;
  createdAt: string;
}

/** Nutrition values are per single serving. */
export interface FoodEntry {
  id: number;
  entryDate: string;
  meal: Meal;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingDescription: string | null;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Product {
  barcode: string;
  ownerId: string;
  name: string;
  brand: string | null;
  servingDescription: string | null;
  servingGrams: number | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  caloriesPerServing: number | null;
  proteinPerServing: number | null;
  carbsPerServing: number | null;
  fatPerServing: number | null;
  imageUrl: string | null;
  source: string;
  updatedAt: string;
}

/** Shape returned to the scanner by /api/products/[barcode]. */
export type ProductDto = Omit<Product, 'ownerId' | 'updatedAt'> & { isCustom: boolean };

export interface DailyTotals {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryCount: number;
}

export interface RecentFood {
  name: string;
  brand: string | null;
  servingDescription: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface TopFood {
  name: string;
  brand: string | null;
  timesLogged: number;
  totalCalories: number;
}

export interface WeightLog {
  date: string;
  weightKg: number;
}

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;
