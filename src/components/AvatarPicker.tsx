import { AVATARS } from "../lib/avatars";

export default function AvatarPicker(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="avatarGrid">
      {AVATARS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={`emojiBtn ${props.value === emoji ? "emojiBtnActive" : ""}`}
          onClick={() => props.onChange(emoji)}
          aria-label={`Выбрать аватар ${emoji}`}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

