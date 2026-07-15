export type Round = {
  id: string;
  dmName: string;
  title: string;
  vibe: string;
  capacity: number;
  createdAt: number;
};

export type PlayerEntry = {
  id: string;
  playerName: string;
  /** Ordered most-preferred first. */
  rankedRoundIds: string[];
  createdAt: number;
};

export type Assignment = {
  playerId: string;
  /** null means every choice on their list was full. */
  roundId: string | null;
};
