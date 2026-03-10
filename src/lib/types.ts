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
};

export type Session = {
  token: string;
  user: Pick<UserPublic, "id" | "nickname" | "avatar_emoji"> & { is_moderator: boolean };
};
