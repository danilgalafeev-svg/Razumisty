import type { MessageRow, UserPublic } from "../lib/types";

function formatTime(value: string) {
  const d = new Date(value);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function MessageItem(props: {
  message: MessageRow;
  mine: boolean;
  author: UserPublic | undefined;
  reply: { message: MessageRow; author?: UserPublic } | null;
  onReply: (messageId: string) => void;
  onJumpTo: (messageId: string) => void;
  canModerate?: boolean;
  onDelete?: (messageId: string) => void;
  onBlockUser?: (userId: string) => void;
}) {
  const authorLabel = props.author ? `${props.author.avatar_emoji} ${props.author.nickname}` : "…";
  const isCircle = props.message.kind === "circle";
  const replyText = props.reply
    ? props.reply.message.kind === "circle"
      ? "Видео-сообщение"
      : props.reply.message.text
    : "";

  return (
    <div
      data-mid={props.message.id}
      style={{
        display: "flex",
        justifyContent: props.mine ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      <div className={`bubble ${props.mine ? "bubbleMine" : ""}`}>
        <div className="msgTop">
          <div className="nick">{authorLabel}</div>
          <div className="time">{formatTime(props.message.created_at)}</div>
        </div>

        {props.reply ? (
          <div
            className="replyBox"
            role="button"
            tabIndex={0}
            onClick={() => props.onJumpTo(props.reply!.message.id)}
            onKeyDown={(e) => e.key === "Enter" && props.onJumpTo(props.reply!.message.id)}
            title="Перейти к исходному сообщению"
          >
            <div className="replyMeta">
              Ответ на{" "}
              {props.reply.author
                ? `${props.reply.author.avatar_emoji} ${props.reply.author.nickname}`
                : "сообщение"}
            </div>
            <div className="replyText">{replyText}</div>
          </div>
        ) : null}

        {isCircle ? (
          <div className="circleWrap">
            <video
              className="circleVideo"
              src={props.message.media_url ?? ""}
              controls
              playsInline
            />
            {props.message.media_duration ? (
              <div className="circleMeta">{props.message.media_duration}s</div>
            ) : null}
          </div>
        ) : (
          <div className="msgText">{props.message.text}</div>
        )}

        <div className="msgActions">
          <button className="linkBtn" type="button" onClick={() => props.onReply(props.message.id)}>
            Ответить
          </button>
          {props.canModerate && !props.mine ? (
            <>
              <button
                className="linkBtn"
                type="button"
                onClick={() => props.onDelete?.(props.message.id)}
              >
                Удалить
              </button>
              <button
                className="linkBtn"
                type="button"
                onClick={() => props.onBlockUser?.(props.message.user_id)}
              >
                Заблокировать
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
