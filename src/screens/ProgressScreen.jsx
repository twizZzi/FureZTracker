import { useMemo } from "react";
import Icon from "../components/Icon";
import { BarChart, LineChart } from "../components/Charts";
import { Empty } from "../components/ui";
import { useStore, useUi } from "../useStore";
import { addDays, formatDayShort, fromKey, startOfWeek, todayKey } from "../lib/dates";
import { computeTargets, sumMacros } from "../lib/nutrition";
import {
  bestOf,
  completedWorkouts,
  exerciseHistory,
  formatWeight,
  scheduledDaysCount,
  weekStreak,
  workoutVolume,
} from "../lib/workouts";

export default function ProgressScreen() {
  const { data } = useStore();
  const { openSheet } = useUi();
  const today = todayKey();

  const weightPoints = useMemo(
    () =>
      Object.entries(data.bodyWeight)
        .filter(([key]) => key >= addDays(today, -120))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({ label: key, value })),
    [data.bodyWeight, today]
  );
  const weightChange =
    weightPoints.length > 1
      ? Math.round((weightPoints[weightPoints.length - 1].value - weightPoints[0].value) * 10) / 10
      : null;

  const done = useMemo(() => completedWorkouts(data.workouts), [data.workouts]);
  const thisMonday = startOfWeek(today);
  const thisWeekCount = done.filter((workout) => workout.date >= thisMonday).length;
  const planned = scheduledDaysCount(data.schedule);
  const streak = weekStreak(data.workouts, data.schedule, data.scheduleSince);

  const volumeBars = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => {
        const monday = addDays(thisMonday, (index - 7) * 7);
        const sunday = addDays(monday, 6);
        const value = done
          .filter((workout) => workout.date >= monday && workout.date <= sunday)
          .reduce((sum, workout) => sum + workoutVolume(workout), 0);
        const date = fromKey(monday);
        return { label: `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, "0")}`, value };
      }),
    [done, thisMonday]
  );

  const targets = computeTargets(data.profile);
  const calorieBars = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const key = addDays(today, index - 13);
        const value = sumMacros(data.food.filter((item) => item.date === key)).kcal;
        return { label: String(fromKey(key).getDate()), value, muted: value === 0 };
      }),
    [data.food, today]
  );
  const loggedWeek = calorieBars.slice(-7).filter((bar) => bar.value > 0);
  const avgKcal = loggedWeek.length ? Math.round(loggedWeek.reduce((sum, bar) => sum + bar.value, 0) / loggedWeek.length) : null;

  const topExercises = useMemo(() => {
    const counts = {};
    done.forEach((workout) =>
      workout.exercises.forEach((exercise) => {
        if (exercise.sets.some((set) => set.done)) counts[exercise.exerciseId] = (counts[exercise.exerciseId] || 0) + 1;
      })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([exerciseId, sessions]) => {
        const history = exerciseHistory(data.workouts, exerciseId);
        const best = bestOf(history.flatMap((entry) => entry.sets));
        const name = data.exercises.find((exercise) => exercise.id === exerciseId)?.name || history[0]?.workoutTitle;
        return { exerciseId, sessions, name, best };
      });
  }, [done, data.workouts, data.exercises]);

  return (
    <>
      <header className="screen-header">
        <h1>Прогресс</h1>
      </header>

      <section className="stat-grid three">
        <div>
          <strong>
            {thisWeekCount}
            {planned ? <small>/{planned}</small> : null}
          </strong>
          <span>на этой неделе</span>
        </div>
        <div>
          <strong>{streak}</strong>
          <span>недель подряд</span>
        </div>
        <div>
          <strong>{done.length}</strong>
          <span>всего тренировок</span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Вес тела</p>
            {weightChange !== null && (
              <p className="muted">
                {weightChange > 0 ? "+" : ""}
                {formatWeight(weightChange)} кг с {formatDayShort(weightPoints[0].label)}
              </p>
            )}
          </div>
          <button type="button" className="round-button small" onClick={() => openSheet("weight")} aria-label="Записать вес">
            <Icon name="plus" size={18} />
          </button>
        </div>
        {weightPoints.length > 1 ? (
          <LineChart points={weightPoints} unit=" кг" formatLabel={formatDayShort} />
        ) : (
          <Empty
            text={
              weightPoints.length === 1
                ? `Записано ${formatWeight(weightPoints[0].value)} кг. Ещё одно взвешивание — и появится график.`
                : "Записывай вес пару раз в неделю — здесь появится график."
            }
          />
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Объём за неделю, кг</p>
        {done.length > 0 ? <BarChart bars={volumeBars} /> : <Empty text="Заверши первую тренировку, чтобы увидеть объём." />}
      </section>

      <section className="card">
        <div className="card-head">
          <p className="eyebrow">Калории, 14 дней</p>
          {avgKcal && <span className="muted">в среднем {avgKcal} ккал</span>}
        </div>
        {calorieBars.some((bar) => bar.value > 0) ? (
          <BarChart bars={calorieBars} target={targets.kcal} />
        ) : (
          <Empty text="Записывай питание — здесь появится динамика." />
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Рекорды</p>
        {topExercises.length > 0 ? (
          <div className="list flat">
            {topExercises.map((item) => (
              <button type="button" key={item.exerciseId} className="list-item" onClick={() => openSheet("exercise", { exerciseId: item.exerciseId })}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.sessions} трен. · макс {formatWeight(item.best.weight)} кг
                  </span>
                </div>
                <em className="pr-value">{item.best.oneRm ? `≈${formatWeight(item.best.oneRm)}` : "—"}</em>
              </button>
            ))}
          </div>
        ) : (
          <Empty text="Тут будут твои лучшие веса и расчётный 1ПМ по упражнениям." />
        )}
      </section>
    </>
  );
}
