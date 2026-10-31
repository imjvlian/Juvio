import { useEffect, useRef } from "react";

const EMOJIS = [
  "📄",
  "📝",
  "📌",
  "📚",
  "🗂️",
  "📁",
  "💡",
  "🔥",
  "✨",
  "🌱",
  "🌊",
  "🌙",
  "☀️",
  "⭐",
  "🎯",
  "🚀",
  "🧭",
  "🗺️",
  "🧪",
  "🧩",
  "🛠️",
  "⚙️",
  "💻",
  "🎨",
  "🎧",
  "📷",
  "🍀",
  "🍊",
  "🍋",
  "🍩",
  "☕",
  "🧠",
  "👋",
  "✅",
  "❤️",
  "🦊",
  "🐙",
  "🐳",
  "🪐",
  "🏔️",
];

interface EmojiPickerProps {
  onPick: (emoji: string | null) => void;
  onClose: () => void;
}

export function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target?.closest("[data-emoji-anchor]")) return;
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref} role="dialog" aria-label="Choose an icon">
      <div className="emoji-grid">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-option"
            onClick={() => onPick(emoji)}
            aria-label={`Use ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button type="button" className="emoji-remove" onClick={() => onPick(null)}>
        Remove icon
      </button>
    </div>
  );
}
