import { useState } from "react";
import Sheet from "../components/Sheet";
import Icon from "../components/Icon";
import { useStore, useUi } from "../useStore";
import { useMainButton } from "../hooks";
import { haptic, showAlert } from "../telegram";
import { formatDayLong, formatMinutes, relativeDayLabel, todayKey } from "../lib/dates";
import { formatWeight, workoutProgress, workoutVolume } from "../lib/workouts";
import { logBodyWeight, startWorkout } from "../data/actions";

export function ActionsSheet({ sheetKey, title, actions }) {
  const { closeSheet } = useUi();
  return (
    <Sheet variant="bottom" title={title} onClose={() => closeSheet(sheetKey)}>
      <div className="action-list">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.destructive ? "destructive" : ""}
            onClick={() => {
              closeSheet(sheetKey);
              action.onClick();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function PromptSheet({ sheetKey, title, value = "", placeholder, onSubmit }) {
  const { closeSheet } = useUi();
  const [text, setText] = useState(value);
  const submit = () => {
    closeSheet(sheetKey);
    onSubmit(text.trim());
  };
  useMainButton({ text: "Сохранить", onClick: submit });

  return (
    <Sheet variant="bottom" title={title} onClose={() => closeSheet(sheetKey)}>
      <input
        className="field"
        autoFocus
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
      />
    </Sheet>
  );
}

export function StartWorkoutSheet({ sheetKey, dateKey }) {
  const { data, update } = useStore();
  const { closeSheet, openSheet } = useUi();

  const start = (programId) => {
    update(startWorkout, dateKey, programId);
    haptic.impact();
    closeSheet(sheetKey);
    openSheet("workout", { dateKey });
  };

  return (
    <Sheet variant="bottom" title="Начать тренировку" subtitle={relativeDayLabel(dateKey)} onClose={() => closeSheet(sheetKey)}>
      <div className="option-list">
        {data.programs.map((program) => (
          <button type="button" key={program.id} onClick={() => start(program.id)}>
            <strong>{program.title}</strong>
            <span>{program.exercises.length} упр.</span>
          </button>
        ))}
        <button type="button" className="option-empty" onClick={() => start(null)}>
          <strong>Пустая тренировка</strong>
          <span>добавлю упражнения сам</span>
        </button>
      </div>
    </Sheet>
  );
}

export function SummarySheet({ sheetKey, dateKey, records = [] }) {
  const { data } = useStore();
  const { closeSheet } = useUi();
  const workout = data.workouts[dateKey];
  useMainButton({ text: "Готово", onClick: () => closeSheet(sheetKey) });
  if (!workout) return null;

  const progress = workoutProgress(workout);
  const volume = workoutVolume(workout);
  const duration = workout.startedAt && workout.finishedAt ? workout.finishedAt - workout.startedAt : null;

  const shareText = [
    `💪 ${workout.title} — ${formatDayLong(dateKey)}`,
    duration ? `⏱ ${formatMinutes(duration)}` : null,
    `Подходов: ${progress.done} · Объём: ${volume.toLocaleString("ru-RU")} кг`,
    ...workout.exercises.map(
      (exercise) =>
        `• ${exercise.name}: ${exercise.sets.map((set) => `${formatWeight(set.weight)}×${set.reps ?? "—"}`).join(", ")}`
    ),
    ...records.map((record) => `🏆 ${record.name}: ${record.kinds.join(", ")}`),
    "",
    "FureZ Tracker",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      haptic.success();
      showAlert("Итог скопирован — вставь в любой чат.");
    } catch {
      showAlert("Не получилось скопировать.");
    }
  };

  return (
    <Sheet variant="bottom" onClose={() => closeSheet(sheetKey)} className="summary-sheet">
      <div className="summary-hero">
        <div className="summary-badge">
          <Icon name="check" size={28} strokeWidth={2.6} />
        </div>
        <h2>Тренировка завершена</h2>
        <p className="muted">{workout.title}</p>
      </div>

      <div className="stat-grid">
        <div>
          <strong>{duration ? formatMinutes(duration) : "—"}</strong>
          <span>время</span>
        </div>
        <div>
          <strong>{progress.done}</strong>
          <span>подходов</span>
        </div>
        <div>
          <strong>{volume.toLocaleString("ru-RU")}</strong>
          <span>кг объём</span>
        </div>
      </div>

      {records.length > 0 && (
        <div className="records">
          <p className="eyebrow">Новые рекорды</p>
          {records.map((record) => (
            <div className="record-row" key={record.name}>
              <Icon name="trophy" size={18} />
              <div>
                <strong>{record.name}</strong>
                <span>{record.kinds.join(" · ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="secondary-button" onClick={copy}>
        <Icon name="copy" size={16} /> Скопировать итог
      </button>
    </Sheet>
  );
}

export function WeightSheet({ sheetKey }) {
  const { data, update } = useStore();
  const { closeSheet } = useUi();
  const key = todayKey();
  const lastKey = Object.keys(data.bodyWeight).sort().pop();
  const [value, setValue] = useState(String(data.bodyWeight[key] ?? (lastKey ? data.bodyWeight[lastKey] : "")));
  const kg = Number(String(value).replace(",", "."));
  const valid = kg > 20 && kg < 400;

  const save = () => {
    if (!valid) return;
    update(logBodyWeight, key, Math.round(kg * 10) / 10);
    haptic.success();
    closeSheet(sheetKey);
  };
  useMainButton({ text: "Сохранить вес", onClick: save, enabled: valid });

  return (
    <Sheet variant="bottom" title="Вес сегодня" onClose={() => closeSheet(sheetKey)}>
      <div className="big-input">
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          placeholder="75.0"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && save()}
        />
        <span>кг</span>
      </div>
      <p className="hint">Лучше взвешиваться утром натощак. Вес из профиля обновится автоматически.</p>
    </Sheet>
  );
}
