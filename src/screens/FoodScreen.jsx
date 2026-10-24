import Icon from "../components/Icon";
import { MacroStat, Ring } from "../components/ui";
import { useStore, useUi } from "../useStore";
import { addDays, relativeDayLabel, todayKey } from "../lib/dates";
import { MEALS, computeTargets, sumMacros } from "../lib/nutrition";
import { copyMeal } from "../data/actions";
import { haptic } from "../telegram";

export default function FoodScreen() {
  const { data, update } = useStore();
  const { foodDate, setFoodDate, openSheet } = useUi();
  const today = todayKey();
  const targets = computeTargets(data.profile);
  const dayEntries = data.food.filter((item) => item.date === foodDate);
  const totals = sumMacros(dayEntries);
  const yesterday = addDays(foodDate, -1);
  const remaining = targets.kcal ? targets.kcal - totals.kcal : null;

  const openEntry = (entry) => {
    if (entry.per100) {
      openSheet("portion", {
        product: { id: entry.productId, name: entry.name, ...entry.per100 },
        dateKey: entry.date,
        meal: entry.meal,
        grams: entry.grams,
        entryId: entry.id,
      });
      return;
    }
    openSheet("manualFood", { mode: "quick", dateKey: entry.date, meal: entry.meal, entryId: entry.id });
  };

  return (
    <>
      <header className="screen-header">
        <h1>Питание</h1>
      </header>

      <div className="date-switcher">
        <button type="button" className="icon-button" onClick={() => setFoodDate(addDays(foodDate, -1))} aria-label="Предыдущий день">
          <Icon name="chevronLeft" />
        </button>
        <button type="button" className="date-switcher-label" onClick={() => setFoodDate(today)}>
          {relativeDayLabel(foodDate)}
        </button>
        <button type="button" className="icon-button" onClick={() => setFoodDate(addDays(foodDate, 1))} aria-label="Следующий день">
          <Icon name="chevronRight" />
        </button>
      </div>

      <section className="card food-summary">
        <Ring value={totals.kcal} max={targets.kcal || 0} size={140} stroke={12}>
          <strong>{totals.kcal}</strong>
          <span>{targets.kcal ? `из ${targets.kcal} ккал` : "ккал"}</span>
        </Ring>
        <p className={`remaining ${remaining !== null && remaining < 0 ? "over" : ""}`}>
          {remaining === null
            ? "Заполни профиль, чтобы увидеть норму"
            : remaining >= 0
              ? `Осталось ${remaining} ккал`
              : `Перебор ${-remaining} ккал`}
        </p>
        <div className="macro-row">
          <MacroStat label="Белки" current={totals.p} target={targets.p} />
          <MacroStat label="Жиры" current={totals.f} target={targets.f} />
          <MacroStat label="Углеводы" current={totals.c} target={targets.c} />
        </div>
      </section>

      <div className="stack">
        {MEALS.map((meal) => {
          const items = dayEntries.filter((item) => (item.meal || "snack") === meal.id);
          const mealTotals = sumMacros(items);
          const canCopy = items.length === 0 && data.food.some((item) => item.date === yesterday && item.meal === meal.id);
          return (
            <section className="card meal-card" key={meal.id}>
              <div className="meal-head">
                <div>
                  <h3>{meal.title}</h3>
                  <span>{mealTotals.kcal ? `${mealTotals.kcal} ккал · Б ${mealTotals.p} · Ж ${mealTotals.f} · У ${mealTotals.c}` : "пусто"}</span>
                </div>
                <button
                  type="button"
                  className="round-button small"
                  onClick={() => openSheet("foodSearch", { dateKey: foodDate, meal: meal.id })}
                  aria-label={`Добавить в ${meal.title.toLowerCase()}`}
                >
                  <Icon name="plus" size={18} />
                </button>
              </div>

              {items.length > 0 && (
                <div className="meal-items">
                  {items.map((item) => (
                    <button type="button" key={item.id} className="meal-item" onClick={() => openEntry(item)}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.grams ? `${item.grams} г` : "порция"}</span>
                      </div>
                      <em>{item.kcal}</em>
                    </button>
                  ))}
                </div>
              )}

              {canCopy && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    update(copyMeal, yesterday, foodDate, meal.id);
                    haptic.success();
                  }}
                >
                  <Icon name="copy" size={14} /> Как вчера
                </button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
