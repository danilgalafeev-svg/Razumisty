export type UserPublic = {
  id: string;
  nickname: string;
  avatar_emoji: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  user_id: string;
  text: string;
  reply_to: string | null;
  created_at: string;
  kind: "text" | "circle";
  media_url: string | null;
  media_duration: number | null;
};

export type Session = {
  token: string;
  user: Pick<UserPublic, "id" | "nickname" | "avatar_emoji"> & { is_moderator: boolean };
};
