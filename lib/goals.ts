import { ageOn } from './dates';
import type { User } from './types';

export interface GoalSuggestion {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const ACTIVITY_FACTORS = { Sedentary: 1.2, Light: 1.375, Moderate: 1.55, Active: 1.725, VeryActive: 1.9 } as const;

/** Suggests daily targets using the Mifflin-St Jeor equation. */
export function suggestGoals(user: User, today: string): GoalSuggestion | null {
  if (!user.sex || !user.heightCm || !user.weightKg || !user.birthDate) return null;
  const age = ageOn(user.birthDate, today);
  const w = user.weightKg;
  const bmr = 10 * w + 6.25 * user.heightCm - 5 * age + (user.sex === 'Male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTORS[user.activityLevel];
  let calories = user.weightGoal === 'Lose' ? tdee - 500 : user.weightGoal === 'Gain' ? tdee + 300 : tdee;
  calories = Math.max(calories, user.sex === 'Male' ? 1500 : 1200);

  // Protein ~1.8 g/kg, fat 27.5% of energy, remainder carbs.
  const protein = 1.8 * w;
  const fat = (calories * 0.275) / 9;
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: Math.round(calories / 10) * 10,
    proteinG: Math.round(protein),
    carbsG: Math.round(carbs),
    fatG: Math.round(fat),
  };
}
