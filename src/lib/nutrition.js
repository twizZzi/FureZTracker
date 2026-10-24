export const GOAL_OPTIONS = [
  { id: "cut", title: "Сушка", description: "Дефицит −15%", calorieModifier: 0.85, proteinPerKg: 2.2, fatPerKg: 0.8 },
  { id: "maintain", title: "Поддержание", description: "Стабильный вес", calorieModifier: 1, proteinPerKg: 1.8, fatPerKg: 0.9 },
  { id: "bulk", title: "Набор", description: "Профицит +12%", calorieModifier: 1.12, proteinPerKg: 2, fatPerKg: 1 },
];

export const ACTIVITY_OPTIONS = [
  { id: "minimal", title: "Минимальная", description: "Мало движения", multiplier: 1.2 },
  { id: "light", title: "Лёгкая", description: "1–3 тренировки в неделю", multiplier: 1.375 },
  { id: "medium", title: "Средняя", description: "3–5 тренировок", multiplier: 1.55 },
  { id: "high", title: "Высокая", description: "5–6 тренировок", multiplier: 1.725 },
  { id: "very-high", title: "Очень высокая", description: "Тяжёлый режим", multiplier: 1.9 },
];

export const MEALS = [
  { id: "breakfast", title: "Завтрак" },
  { id: "lunch", title: "Обед" },
  { id: "dinner", title: "Ужин" },
  { id: "snack", title: "Перекус" },
];

export function mealTitle(mealId) {
  return MEALS.find((meal) => meal.id === mealId)?.title || "Перекус";
}

export function mealByTime(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function positive(value) {
  const number = Number(value);
  return number > 0 ? number : null;
}

// Mifflin–St Jeor + activity multiplier + goal modifier; manual overrides win.
export function computeTargets(profile = {}) {
  const weight = positive(profile.weight);
  const height = positive(profile.height);
  const age = positive(profile.age);
  const goal = GOAL_OPTIONS.find((item) => item.id === profile.goal) || GOAL_OPTIONS[1];
  const activity =
    ACTIVITY_OPTIONS.find((item) => item.id === profile.activity) || ACTIVITY_OPTIONS[1];

  const bmr =
    weight && height && age
      ? Math.round(10 * weight + 6.25 * height - 5 * age + (profile.gender === "female" ? -161 : 5))
      : null;
  const tdee = bmr ? Math.round(bmr * activity.multiplier) : null;

  const autoKcal = tdee ? Math.round(tdee * goal.calorieModifier) : null;
  const autoP = weight ? Math.round(weight * goal.proteinPerKg) : null;
  const autoF = weight ? Math.round(weight * goal.fatPerKg) : null;

  const kcal = positive(profile.kcalOverride) || autoKcal;
  const p = positive(profile.proteinOverride) || autoP;
  const f = positive(profile.fatOverride) || autoF;
  const autoC = kcal && p && f ? Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4)) : null;
  const c = positive(profile.carbsOverride) || autoC;

  const bmi = weight && height ? weight / (height / 100) ** 2 : null;

  return { bmr, tdee, kcal, p, f, c, autoKcal, autoP, autoF, autoC, bmi };
}

export function bmiStatus(bmi) {
  if (!bmi) return "";
  if (bmi < 18.5) return "Недобор";
  if (bmi < 25) return "Норма";
  if (bmi < 30) return "Выше нормы";
  return "Высокий";
}

const round1 = (value) => Math.round(value * 10) / 10;

export function macrosForGrams(product, grams) {
  const factor = (Number(grams) || 0) / 100;
  return {
    kcal: Math.round(product.kcal * factor),
    p: round1(product.p * factor),
    f: round1(product.f * factor),
    c: round1(product.c * factor),
  };
}

export function sumMacros(entries) {
  const totals = entries.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (Number(item.kcal) || 0),
      p: acc.p + (Number(item.p) || 0),
      f: acc.f + (Number(item.f) || 0),
      c: acc.c + (Number(item.c) || 0),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 }
  );
  return { kcal: Math.round(totals.kcal), p: round1(totals.p), f: round1(totals.f), c: round1(totals.c) };
}

export function normalizeSearch(text) {
  return text.toLowerCase().replace(/ё/g, "е").trim();
}
