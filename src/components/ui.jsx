import { useSyncExternalStore } from "react";
import { getButtonsSnapshot, haptic, isTelegram, subscribeButtons, triggerMainButton } from "../telegram";
import Icon from "./Icon";

export function Ring({ value, max, size = 132, stroke = 12, children }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className={`ring-value ${over ? "over" : ""}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// Half-gauge from v2, kept for macro targets.
export function MacroStat({ label, current, target, unit = "г" }) {
  const safeCurrent = Math.round(Number(current) || 0);
  const safeTarget = Math.round(Number(target) || 0);
  const percent = safeTarget > 0 ? Math.min((safeCurrent / safeTarget) * 100, 100) : 0;

  return (
    <div className="macro-stat">
      <svg viewBox="0 0 100 58" className="macro-stat-svg" aria-hidden="true">
        <path d="M 10 50 A 40 40 0 0 1 90 50" className="macro-stat-track" pathLength="100" />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          className={`macro-stat-progress ${safeTarget && safeCurrent > safeTarget * 1.05 ? "over" : ""}`}
          pathLength="100"
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <strong>
        {safeCurrent}
        {safeTarget ? <span>/{safeTarget}</span> : null} {unit}
      </strong>
      <small>{label}</small>
    </div>
  );
}

export function MacroBar({ label, current, target, unit = "г" }) {
  const safeCurrent = Math.round(Number(current) || 0);
  const safeTarget = Math.round(Number(target) || 0);
  const percent = safeTarget > 0 ? Math.min((safeCurrent / safeTarget) * 100, 100) : 0;

  return (
    <div className="macro-bar">
      <div>
        <span>{label}</span>
        <strong>
          {safeCurrent}
          {safeTarget ? <em> / {safeTarget}</em> : null} {unit}
        </strong>
      </div>
      <i>
        <b style={{ width: `${percent}%` }} className={safeTarget && safeCurrent > safeTarget * 1.05 ? "over" : ""} />
      </i>
    </div>
  );
}

export function Segmented({ options, value, onChange, className = "" }) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={value === option.id ? "active" : ""}
          onClick={() => {
            haptic.select();
            onChange(option.id);
          }}
        >
          {option.title}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange, multiple = false }) {
  const isActive = (id) => (multiple ? value.includes(id) : value === id);
  return (
    <div className="chips">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`chip ${isActive(option.id) ? "active" : ""}`}
          onClick={() => {
            haptic.select();
            onChange(option.id);
          }}
        >
          {option.title}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 20 }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Меньше">
        <Icon name="minus" size={16} />
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Больше">
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export function Empty({ title, text, children }) {
  return (
    <div className="empty">
      {title && <strong>{title}</strong>}
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

// Outside Telegram the MainButton is rendered as a sticky in-page button.
export function BrowserMainButton() {
  const { mainButton } = useSyncExternalStore(subscribeButtons, getButtonsSnapshot);
  if (isTelegram || !mainButton) return null;

  return (
    <div className="browser-main-button">
      <button type="button" disabled={mainButton.enabled === false} onClick={triggerMainButton}>
        {mainButton.text}
      </button>
    </div>
  );
}
