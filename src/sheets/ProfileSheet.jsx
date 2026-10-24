import { useRef, useState } from "react";
import Sheet from "../components/Sheet";
import { Chips, Segmented } from "../components/ui";
import { useStore, useUi } from "../useStore";
import { confirmAction, getTelegramUser, haptic, showAlert } from "../telegram";
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, bmiStatus, computeTargets } from "../lib/nutrition";
import { todayKey } from "../lib/dates";
import { parseBackup } from "../data/storage";
import { replaceAll, updateProfile } from "../data/actions";

const REST_OPTIONS = [60, 90, 120, 180].map((seconds) => ({
  id: seconds,
  title: seconds < 120 ? `${seconds} с` : `${seconds / 60} мин`,
}));

function NumberField({ label, unit, value, placeholder, onChange }) {
  return (
    <label className="unit-field">
      <span>{label}</span>
      <div>
        <input inputMode="decimal" value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
}

export default function ProfileSheet({ sheetKey }) {
  const { data, update } = useStore();
  const { closeSheet } = useUi();
  const profile = data.profile;
  const targets = computeTargets(profile);
  const user = getTelegramUser();
  const fileInput = useRef(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);

  const set = (field) => (value) => update(updateProfile, field, value);

  const backupJson = () => JSON.stringify(data, null, 2);

  const download = () => {
    const blob = new Blob([backupJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `furez-backup-${todayKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(backupJson());
      haptic.success();
      showAlert("Бэкап скопирован. Сохрани его, например, в «Избранное» Telegram.");
    } catch {
      showAlert("Не получилось скопировать.");
    }
  };

  const restore = async (text) => {
    try {
      const next = parseBackup(text);
      const ok = await confirmAction("Заменить все текущие данные данными из бэкапа?");
      if (!ok) return;
      update(replaceAll, next);
      haptic.success();
      setShowImport(false);
      setImportText("");
      showAlert("Данные восстановлены.");
    } catch (error) {
      showAlert(error.message || "Не удалось прочитать бэкап.");
    }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) restore(await file.text());
  };

  return (
    <Sheet title="Профиль" onClose={() => closeSheet(sheetKey)}>
      {user && (
        <div className="profile-head">
          {user.photo_url ? <img src={user.photo_url} alt="" /> : <span>{user.first_name?.[0]}</span>}
          <div>
            <strong>
              {user.first_name} {user.last_name || ""}
            </strong>
            {user.username && <p>@{user.username}</p>}
          </div>
        </div>
      )}

      <section className="card">
        <p className="eyebrow">Параметры</p>
        <div className="form-grid">
          <NumberField label="Вес" unit="кг" value={profile.weight} placeholder="75" onChange={set("weight")} />
          <NumberField label="Рост" unit="см" value={profile.height} placeholder="180" onChange={set("height")} />
          <NumberField label="Возраст" unit="лет" value={profile.age} placeholder="25" onChange={set("age")} />
          <div className="unit-field">
            <span>Пол</span>
            <Segmented
              options={[
                { id: "male", title: "Муж" },
                { id: "female", title: "Жен" },
              ]}
              value={profile.gender}
              onChange={set("gender")}
            />
          </div>
        </div>
        {targets.bmi && (
          <p className="hint">
            ИМТ {targets.bmi.toFixed(1)} — {bmiStatus(targets.bmi).toLowerCase()}
          </p>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Цель</p>
        <div className="option-cards">
          {GOAL_OPTIONS.map((goal) => (
            <button type="button" key={goal.id} className={profile.goal === goal.id ? "active" : ""} onClick={() => set("goal")(goal.id)}>
              <strong>{goal.title}</strong>
              <span>{goal.description}</span>
            </button>
          ))}
        </div>
        <p className="field-caption">Активность</p>
        <div className="option-list compact">
          {ACTIVITY_OPTIONS.map((activity) => (
            <button
              type="button"
              key={activity.id}
              className={profile.activity === activity.id ? "active" : ""}
              onClick={() => set("activity")(activity.id)}
            >
              <strong>{activity.title}</strong>
              <span>{activity.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Норма в день</p>
        <p className="hint">Рассчитано автоматически. Впиши своё значение, если работаешь с тренером или нутрициологом.</p>
        <div className="form-grid">
          <NumberField label="Калории" unit="ккал" value={profile.kcalOverride} placeholder={targets.autoKcal ?? "—"} onChange={set("kcalOverride")} />
          <NumberField label="Белки" unit="г" value={profile.proteinOverride} placeholder={targets.autoP ?? "—"} onChange={set("proteinOverride")} />
          <NumberField label="Жиры" unit="г" value={profile.fatOverride} placeholder={targets.autoF ?? "—"} onChange={set("fatOverride")} />
          <NumberField label="Углеводы" unit="г" value={profile.carbsOverride} placeholder={targets.autoC ?? "—"} onChange={set("carbsOverride")} />
        </div>
        {targets.tdee && (
          <p className="hint">
            Обмен веществ {targets.bmr} ккал, с активностью {targets.tdee} ккал.
          </p>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Тренировки</p>
        <p className="field-caption">Отдых по умолчанию</p>
        <Chips options={REST_OPTIONS} value={Number(profile.restSeconds) || 90} onChange={set("restSeconds")} />
      </section>

      <section className="card">
        <p className="eyebrow">Данные</p>
        <p className="hint">
          Все записи хранятся только на этом устройстве. Делай бэкап, чтобы не потерять их при переустановке Telegram.
        </p>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={copy}>
            Скопировать бэкап
          </button>
          <button type="button" className="secondary-button" onClick={download}>
            Скачать файл
          </button>
        </div>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}>
            Загрузить файл
          </button>
          <button type="button" className="secondary-button" onClick={() => setShowImport((prev) => !prev)}>
            Вставить текст
          </button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
        {showImport && (
          <>
            <textarea
              className="field note-field"
              rows={4}
              value={importText}
              placeholder="Вставь сюда скопированный бэкап"
              onChange={(event) => setImportText(event.target.value)}
            />
            <button type="button" className="primary-button" disabled={!importText.trim()} onClick={() => restore(importText)}>
              Восстановить
            </button>
          </>
        )}
      </section>

      <p className="footer-note">FureZ Tracker · v0.4.0</p>
    </Sheet>
  );
}
