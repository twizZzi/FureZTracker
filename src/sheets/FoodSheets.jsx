import { useEffect, useMemo, useState } from "react";
import Sheet from "../components/Sheet";
import Icon from "../components/Icon";
import { Chips, Empty } from "../components/ui";
import { SearchField } from "./ExerciseSheets";
import { useStore, useUi } from "../useStore";
import { useDebounced, useMainButton } from "../hooks";
import { confirmAction, haptic } from "../telegram";
import { BUILTIN_FOODS } from "../data/foods";
import { MEALS, macrosForGrams, mealTitle, normalizeSearch, sumMacros } from "../lib/nutrition";
import { searchOpenFoodFacts } from "../lib/openFoodFacts";
import { relativeDayLabel } from "../lib/dates";
import { addFood, createId, deleteFood, saveCustomFood, toggleFavoriteFood, updateFood } from "../data/actions";

const MEAL_OPTIONS = MEALS.map((meal) => ({ id: meal.id, title: meal.title }));

function per100Line(product) {
  return `${product.kcal} ккал · Б ${product.p} · Ж ${product.f} · У ${product.c} на 100 г`;
}

function ProductRow({ product, onClick, right }) {
  return (
    <button type="button" className="list-item" onClick={onClick}>
      <div>
        <strong>{product.name}</strong>
        <span>{product.brand ? `${product.brand} · ` : ""}{per100Line(product)}</span>
      </div>
      {right ?? <Icon name="plus" size={18} />}
    </button>
  );
}

function useAllProducts() {
  const { data } = useStore();
  return useMemo(() => {
    const custom = data.customFoods || [];
    const customIds = new Set(custom.map((item) => item.id));
    return [...custom, ...BUILTIN_FOODS.filter((item) => !customIds.has(item.id))];
  }, [data.customFoods]);
}

export function FoodSearchSheet({ sheetKey, dateKey, meal: initialMeal }) {
  const { data, update } = useStore();
  const { closeSheet, openSheet } = useUi();
  const products = useAllProducts();
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState(initialMeal);
  const [added, setAdded] = useState([]);
  const debounced = useDebounced(normalizeSearch(query), 450);
  const [remote, setRemote] = useState({ query: "", items: [], error: false });
  const [attempt, setAttempt] = useState(0);

  const search = normalizeSearch(query);

  const localResults = useMemo(() => {
    if (!search) return [];
    const words = search.split(/\s+/);
    return products
      .map((product) => {
        const name = normalizeSearch(product.name);
        if (!words.every((word) => name.includes(word))) return null;
        return { product, rank: name.startsWith(search) ? 0 : name.includes(` ${words[0]}`) ? 1 : 2 };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.product.name.length - b.product.name.length)
      .slice(0, 30)
      .map((item) => item.product);
  }, [products, search]);

  useEffect(() => {
    if (debounced.length < 3) return undefined;
    const controller = new AbortController();
    searchOpenFoodFacts(debounced, controller.signal)
      .then((items) => setRemote({ query: debounced, items, error: false, retrying: false }))
      .catch((error) => {
        if (error.name !== "AbortError") setRemote({ query: debounced, items: [], error: true, retrying: false });
      });
    return () => controller.abort();
  }, [debounced, attempt]);

  const remoteLoading = search.length >= 3 && (remote.query !== search || remote.retrying);
  const remoteItems = remote.query === search ? remote.items : [];

  const favorites = useMemo(
    () => data.favoriteFoods.map((id) => products.find((product) => product.id === id)).filter(Boolean),
    [data.favoriteFoods, products]
  );

  const recent = useMemo(() => {
    const seen = new Set();
    return [...data.food]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((entry) => {
        const key = entry.productId || `name:${entry.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [data.food]);

  const onAdded = (entry) => {
    setAdded((prev) => [...prev, entry]);
  };

  const openProduct = (product, grams) =>
    openSheet("portion", { product, dateKey, meal, grams, onAdded });

  const reAddRecent = (entry) => {
    if (entry.per100) {
      openProduct(
        { id: entry.productId || createId("custom"), name: entry.name, ...entry.per100 },
        entry.grams
      );
      return;
    }
    const copy = { date: dateKey, meal, name: entry.name, grams: null, productId: null, kcal: entry.kcal, p: entry.p, f: entry.f, c: entry.c };
    update(addFood, copy);
    haptic.success();
    onAdded(copy);
  };

  const addedTotals = sumMacros(added);
  useMainButton({
    text: `Готово · +${addedTotals.kcal} ккал`,
    onClick: () => closeSheet(sheetKey),
    visible: added.length > 0,
  });

  return (
    <Sheet title="Добавить еду" subtitle={relativeDayLabel(dateKey)} onClose={() => closeSheet(sheetKey)}>
      <div className="sticky-tools">
        <SearchField value={query} onChange={setQuery} placeholder="Продукт или блюдо" autoFocus />
        <Chips options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
      </div>

      {!search && (
        <>
          <div className="quick-actions">
            <button type="button" onClick={() => openSheet("manualFood", { mode: "product", dateKey, meal, onAdded })}>
              <Icon name="plus" size={18} />
              <span>Свой продукт</span>
            </button>
            <button type="button" onClick={() => openSheet("manualFood", { mode: "quick", dateKey, meal, onAdded })}>
              <Icon name="flame" size={18} />
              <span>Только калории</span>
            </button>
          </div>

          {favorites.length > 0 && (
            <section>
              <p className="section-title">Избранное</p>
              <div className="list">
                {favorites.map((product) => (
                  <ProductRow key={product.id} product={product} onClick={() => openProduct(product)} />
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="section-title">Недавнее</p>
            {recent.length > 0 ? (
              <div className="list">
                {recent.map((entry) => (
                  <button type="button" key={entry.id} className="list-item" onClick={() => reAddRecent(entry)}>
                    <div>
                      <strong>{entry.name}</strong>
                      <span>
                        {entry.grams ? `${entry.grams} г · ` : ""}
                        {entry.kcal} ккал
                      </span>
                    </div>
                    <Icon name="plus" size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty text="Начни вводить название: «гречка», «банан», «творог 5»…" />
            )}
          </section>
        </>
      )}

      {search && (
        <>
          {localResults.length > 0 && (
            <section>
              <p className="section-title">Продукты</p>
              <div className="list">
                {localResults.map((product) => (
                  <ProductRow key={product.id} product={product} onClick={() => openProduct(product)} />
                ))}
              </div>
            </section>
          )}

          {search.length >= 3 && (
            <section>
              <p className="section-title">Open Food Facts</p>
              {remoteLoading && <p className="muted small-pad">Ищу в базе…</p>}
              {!remoteLoading && remote.error && (
                <div className="remote-error">
                  <p className="muted">Open Food Facts не ответила — у них бывают перегрузки.</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setRemote((prev) => ({ ...prev, retrying: true }));
                      setAttempt((prev) => prev + 1);
                    }}
                  >
                    Повторить
                  </button>
                </div>
              )}
              {!remoteLoading && !remote.error && remoteItems.length === 0 && (
                <p className="muted small-pad">Ничего не нашлось.</p>
              )}
              {remoteItems.length > 0 && (
                <div className="list">
                  {remoteItems.map((product) => (
                    <ProductRow key={product.id} product={product} onClick={() => openProduct(product)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {search.length < 3 && localResults.length === 0 && <Empty text="Введи хотя бы 3 буквы для поиска в базе." />}

          <button
            type="button"
            className="add-button"
            onClick={() => openSheet("manualFood", { mode: "product", dateKey, meal, initialName: query.trim(), onAdded })}
          >
            <Icon name="plus" /> Создать «{query.trim()}»
          </button>
        </>
      )}
    </Sheet>
  );
}

export function PortionSheet({ sheetKey, product, dateKey, meal: initialMeal, grams: initialGrams, entryId, onAdded }) {
  const { data, update } = useStore();
  const { closeSheet } = useUi();
  const [grams, setGrams] = useState(String(initialGrams || product.pieceGrams || 100));
  const [meal, setMeal] = useState(initialMeal);
  const gramsNumber = Number(String(grams).replace(",", "."));
  const valid = gramsNumber > 0 && gramsNumber < 5000;
  const macros = macrosForGrams(product, valid ? gramsNumber : 0);
  const isFavorite = data.favoriteFoods.includes(product.id);

  const portionChips = [
    ...(product.pieceGrams
      ? [1, 2, 3].map((count) => ({
          id: String(product.pieceGrams * count),
          title: `${count} ${product.pieceLabel}`,
        }))
      : []),
    ...[50, 100, 150, 200, 300].map((value) => ({ id: String(value), title: `${value} г` })),
  ];

  const save = () => {
    if (!valid) return;
    const per100 = { kcal: product.kcal, p: product.p, f: product.f, c: product.c };
    const entry = {
      date: dateKey,
      meal,
      name: product.name,
      grams: Math.round(gramsNumber),
      productId: product.id,
      per100,
      ...macros,
    };
    if (product.source === "off" || product.source === "custom") update(saveCustomFood, product);
    if (entryId) update(updateFood, entryId, entry);
    else update(addFood, entry);
    haptic.success();
    closeSheet(sheetKey);
    onAdded?.(entry);
  };

  useMainButton({
    text: valid ? `${entryId ? "Сохранить" : "Добавить"} · ${macros.kcal} ккал` : "Укажи вес порции",
    onClick: save,
    enabled: valid,
  });

  const remove = async () => {
    const ok = await confirmAction(`Удалить «${product.name}»?`);
    if (!ok) return;
    update(deleteFood, entryId);
    closeSheet(sheetKey);
  };

  return (
    <Sheet
      variant="bottom"
      title={product.name}
      subtitle={product.brand || mealTitle(meal)}
      onClose={() => closeSheet(sheetKey)}
      headerRight={
        <button
          type="button"
          className={`icon-button ${isFavorite ? "favorite" : ""}`}
          onClick={() => {
            if (product.source === "off" || product.source === "custom") update(saveCustomFood, product);
            update(toggleFavoriteFood, product.id);
            haptic.select();
          }}
          aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={isFavorite}
        >
          <Icon name="star" filled={isFavorite} />
        </button>
      }
    >
      <div className="big-input">
        <input
          inputMode="decimal"
          value={grams}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setGrams(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && save()}
          aria-label="Вес порции в граммах"
        />
        <span>г</span>
      </div>
      <Chips options={portionChips} value={String(Math.round(gramsNumber))} onChange={setGrams} />

      <div className="macro-line">
        <div>
          <strong>{macros.kcal}</strong>
          <span>ккал</span>
        </div>
        <div>
          <strong>{macros.p}</strong>
          <span>белки</span>
        </div>
        <div>
          <strong>{macros.f}</strong>
          <span>жиры</span>
        </div>
        <div>
          <strong>{macros.c}</strong>
          <span>углеводы</span>
        </div>
      </div>
      <p className="hint">{per100Line(product)}</p>

      <p className="field-caption">Приём пищи</p>
      <Chips options={MEAL_OPTIONS} value={meal} onChange={setMeal} />

      {entryId && (
        <button type="button" className="danger-link" onClick={remove}>
          Удалить запись
        </button>
      )}
    </Sheet>
  );
}

const numberOrZero = (value) => Math.max(0, Number(String(value).replace(",", ".")) || 0);

// mode "product": define a product per 100 g, then pick a portion.
// mode "quick": log calories/macros directly (also used to edit such entries).
export function ManualFoodSheet({ sheetKey, mode, dateKey, meal: initialMeal, entryId, initialName = "", onAdded }) {
  const { data, update } = useStore();
  const { closeSheet, openSheet } = useUi();
  const entry = entryId ? data.food.find((item) => item.id === entryId) : null;
  const [meal, setMeal] = useState(entry?.meal || initialMeal);
  const [form, setForm] = useState({
    name: entry?.name || initialName,
    kcal: entry ? String(entry.kcal) : "",
    p: entry ? String(entry.p) : "",
    f: entry ? String(entry.f) : "",
    c: entry ? String(entry.c) : "",
  });
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const isProduct = mode === "product";
  const valid = numberOrZero(form.kcal) > 0 && (!isProduct || form.name.trim());

  const save = () => {
    if (!valid) return;
    const values = { kcal: Math.round(numberOrZero(form.kcal)), p: numberOrZero(form.p), f: numberOrZero(form.f), c: numberOrZero(form.c) };

    if (isProduct) {
      const product = { id: createId("custom"), name: form.name.trim(), source: "custom", ...values };
      update(saveCustomFood, product);
      closeSheet(sheetKey);
      openSheet("portion", { product, dateKey, meal, onAdded });
      return;
    }

    const next = { date: entry?.date || dateKey, meal, name: form.name.trim() || "Быстрая запись", grams: null, productId: null, ...values };
    if (entry) update(updateFood, entry.id, next);
    else update(addFood, next);
    haptic.success();
    closeSheet(sheetKey);
    onAdded?.(next);
  };

  useMainButton({
    text: isProduct ? "Дальше: вес порции" : entry ? "Сохранить" : "Добавить",
    onClick: save,
    enabled: Boolean(valid),
  });

  const remove = async () => {
    const ok = await confirmAction(`Удалить «${entry.name}»?`);
    if (!ok) return;
    update(deleteFood, entry.id);
    closeSheet(sheetKey);
  };

  return (
    <Sheet
      variant="bottom"
      title={isProduct ? "Свой продукт" : entry ? "Запись" : "Быстрая запись"}
      subtitle={isProduct ? "Значения на 100 г" : "Значения на всю порцию"}
      onClose={() => closeSheet(sheetKey)}
    >
      <label className="field-label">
        <span>Название{isProduct ? "" : " (необязательно)"}</span>
        <input className="field" autoFocus={isProduct && !initialName} value={form.name} onChange={set("name")} placeholder={isProduct ? "Например, сырники мамы" : "Перекус"} />
      </label>
      <div className="form-grid four">
        {[
          ["kcal", "Ккал"],
          ["p", "Белки"],
          ["f", "Жиры"],
          ["c", "Углев."],
        ].map(([field, label]) => (
          <label className="field-label" key={field}>
            <span>{label}</span>
            <input className="field" inputMode="decimal" value={form[field]} onChange={set(field)} placeholder="0" autoFocus={field === "kcal" && (!isProduct || Boolean(initialName))} />
          </label>
        ))}
      </div>
      {!isProduct && (
        <>
          <p className="field-caption">Приём пищи</p>
          <Chips options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
        </>
      )}
      {entry && (
        <button type="button" className="danger-link" onClick={remove}>
          Удалить запись
        </button>
      )}
    </Sheet>
  );
}
