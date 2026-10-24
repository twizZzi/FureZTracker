import { useMemo, useState } from "react";
import Sheet from "../components/Sheet";
import Icon from "../components/Icon";
import { LineChart } from "../components/Charts";
import { Chips, Empty } from "../components/ui";
import { useStore, useUi } from "../useStore";
import { useExerciseFilter, useMainButton } from "../hooks";
import { confirmAction, haptic } from "../telegram";
import { DEFAULT_MUSCLE_GROUP, MUSCLE_GROUPS } from "../data/exercises";
import { createExercise, createId, deleteExercise, updateExercise } from "../data/actions";
import { bestOf, estimateOneRepMax, exerciseHistory, formatWeight } from "../lib/workouts";
import { formatDayShort } from "../lib/dates";

const GROUP_FILTERS = [{ id: "all", title: "Все" }, ...MUSCLE_GROUPS.map((group) => ({ id: group, title: group }))];

export function SearchField({ value, onChange, placeholder, autoFocus = false }) {
  return (
    <label className="search-field">
      <Icon name="search" size={18} />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Очистить">
          <Icon name="close" size={16} />
        </button>
      )}
    </label>
  );
}

export function ExercisePickerSheet({ sheetKey, title = "Упражнения", onSelect }) {
  const { data } = useStore();
  const { closeSheet, openSheet } = useUi();
  const { query, setQuery, group, setGroup, filtered } = useExerciseFilter(data.exercises);
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    haptic.select();
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const submit = () => {
    if (selected.length === 0) return;
    closeSheet(sheetKey);
    onSelect(selected);
  };

  useMainButton({
    text: selected.length ? `Добавить (${selected.length})` : "Выбери упражнения",
    onClick: submit,
    enabled: selected.length > 0,
  });

  const createFromSearch = () =>
    openSheet("exerciseEdit", {
      initialName: query.trim(),
      initialGroup: group === "all" ? "" : group,
      onSaved: (id) => setSelected((prev) => [...prev, id]),
    });

  return (
    <Sheet title={title} onClose={() => closeSheet(sheetKey)}>
      <div className="sticky-tools">
        <SearchField value={query} onChange={setQuery} placeholder="Поиск упражнения" />
        <Chips options={GROUP_FILTERS} value={group} onChange={setGroup} />
      </div>

      <div className="list">
        {filtered.map((exercise) => {
          const isSelected = selected.includes(exercise.id);
          return (
            <button
              type="button"
              key={exercise.id}
              className={`list-item selectable ${isSelected ? "selected" : ""}`}
              onClick={() => toggle(exercise.id)}
            >
              <div>
                <strong>{exercise.name}</strong>
                <span>{exercise.muscleGroup}</span>
              </div>
              <span className="check-circle">{isSelected && <Icon name="check" size={14} strokeWidth={3} />}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && <Empty title="Ничего не нашлось" text="Создай своё упражнение — оно сохранится в библиотеке." />}

      <button type="button" className="add-button" onClick={createFromSearch}>
        <Icon name="plus" /> {query.trim() ? `Создать «${query.trim()}»` : "Своё упражнение"}
      </button>
    </Sheet>
  );
}

export function ExerciseEditSheet({ sheetKey, exerciseId, initialName = "", initialGroup = "", onSaved }) {
  const { data, update } = useStore();
  const { closeSheet } = useUi();
  const existing = data.exercises.find((exercise) => exercise.id === exerciseId);
  const [name, setName] = useState(existing?.name || initialName);
  const [group, setGroup] = useState(existing?.muscleGroup || initialGroup || DEFAULT_MUSCLE_GROUP);
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    if (existing) {
      update(updateExercise, existing.id, { name: name.trim(), muscleGroup: group });
      closeSheet(sheetKey);
      onSaved?.(existing.id);
      return;
    }
    const exercise = { id: createId("exercise"), name: name.trim(), muscleGroup: group, custom: true };
    update(createExercise, exercise);
    haptic.success();
    closeSheet(sheetKey);
    onSaved?.(exercise.id);
  };

  useMainButton({ text: existing ? "Сохранить" : "Создать упражнение", onClick: save, enabled: valid });

  return (
    <Sheet variant="bottom" title={existing ? "Упражнение" : "Новое упражнение"} onClose={() => closeSheet(sheetKey)}>
      <label className="field-label">
        <span>Название</span>
        <input
          className="field"
          autoFocus={!existing}
          value={name}
          placeholder="Например, жим Смита"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <p className="field-caption">Группа мышц</p>
      <Chips options={MUSCLE_GROUPS.map((item) => ({ id: item, title: item }))} value={group} onChange={setGroup} />
    </Sheet>
  );
}

export function ExerciseSheet({ sheetKey, exerciseId }) {
  const { data, update } = useStore();
  const { closeSheet, openSheet } = useUi();
  const exercise = data.exercises.find((item) => item.id === exerciseId);
  const history = useMemo(() => exerciseHistory(data.workouts, exerciseId), [data.workouts, exerciseId]);
  const best = useMemo(() => bestOf(history.flatMap((entry) => entry.sets)), [history]);

  const chartPoints = useMemo(
    () =>
      [...history]
        .reverse()
        .map((entry) => ({ label: entry.date, value: bestOf(entry.sets).oneRm }))
        .filter((point) => point.value > 0)
        .slice(-20),
    [history]
  );

  const name = exercise?.name || history[0]?.workoutTitle || "Упражнение";

  const openMenu = () =>
    openSheet("actions", {
      title: name,
      actions: [
        exercise && { label: "Редактировать", onClick: () => openSheet("exerciseEdit", { exerciseId }) },
        exercise && {
          label: "Удалить из библиотеки",
          destructive: true,
          onClick: async () => {
            const ok = await confirmAction(
              `Удалить «${exercise.name}» из библиотеки и программ? Прошлые тренировки останутся.`
            );
            if (!ok) return;
            closeSheet(sheetKey);
            update(deleteExercise, exerciseId);
          },
        },
      ].filter(Boolean),
    });

  return (
    <Sheet
      title={name}
      subtitle={exercise?.muscleGroup}
      onClose={() => closeSheet(sheetKey)}
      headerRight={
        exercise && (
          <button type="button" className="icon-button" onClick={openMenu} aria-label="Меню упражнения">
            <Icon name="more" />
          </button>
        )
      }
    >
      <div className="stat-grid">
        <div>
          <strong>{best.weight ? formatWeight(best.weight) : "—"}</strong>
          <span>макс. вес, кг</span>
        </div>
        <div>
          <strong>{best.oneRm ? formatWeight(best.oneRm) : "—"}</strong>
          <span>≈ 1ПМ, кг</span>
        </div>
        <div>
          <strong>{history.length}</strong>
          <span>тренировок</span>
        </div>
      </div>

      {chartPoints.length > 1 && (
        <section className="card">
          <p className="eyebrow">Расчётный 1ПМ</p>
          <LineChart points={chartPoints} unit=" кг" formatLabel={formatDayShort} />
        </section>
      )}

      <section className="card">
        <p className="eyebrow">История</p>
        {history.length === 0 ? (
          <Empty text="Здесь появятся подходы, когда ты выполнишь это упражнение." />
        ) : (
          <div className="history-list">
            {history.slice(0, 30).map((entry) => (
              <div className="history-row" key={entry.date}>
                <div>
                  <strong>{formatDayShort(entry.date)}</strong>
                  <span>{entry.workoutTitle}</span>
                </div>
                <p>
                  {entry.sets.map((set, index) => (
                    <span key={index} className={estimateOneRepMax(set.weight, set.reps) === best.oneRm ? "pr" : ""}>
                      {formatWeight(set.weight)}×{set.reps ?? "—"}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </Sheet>
  );
}
