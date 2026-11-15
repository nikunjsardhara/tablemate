/** Shapes the API returns. Expectations and scores are never serialized to answerers. */

export interface Profile {
  id: string;
  nickname: string;
  bio: string | null;
  interests: string[];
  /** Only present on /api/profile GET/PUT — the owner's own view. */
  contact: string | null;
  created_at: string;
}

/** Profile without contact info — safe to render next to someone else's answers. */
export interface PublicProfile {
  id: string;
  nickname: string;
  bio: string | null;
  interests: string[];
}

export interface Listing {
  id: number;
  asker_id: string;
  asker_nickname: string;
  title: string;
  status: "open" | "closed";
  expires_at: string;
  created_at: string;
  response_count?: number;
  answered_by_me?: boolean;
  is_mine?: boolean;
  questions?: Question[];
}

export interface Question {
  id: number;
  listing_id: number;
  position: number;
  body: string;
  /** Askers only — stripped by every public query. */
  expectation?: string;
  weight: number;
}

export interface ListingDetail {
  id: number;
  title: string;
  status: "open" | "closed";
  expires_at: string;
  created_at: string;
  asker_nickname: string;
  is_mine: boolean;
  questions: Question[];
  /** Present only when is_mine. */
  responses?: RankedResponse[];
}

export interface RankedResponse {
  id: number;
  match_score: number | null;
  created_at: string;
  answerer: PublicProfile;
  answers: Answer[];
  /** Invitation the asker already sent for this response, if any. */
  invitation?: {
    id: number;
    status: "pending" | "accepted" | "declined" | "countered";
    meet_at: string | null;
    meet_spot: string | null;
  } | null;
}

export interface Answer {
  id: number;
  question_id: number;
  body: string;
  score: number | null;
  rationale: string | null;
}

export interface Invitation {
  id: number;
  response_id: number;
  listing_id: number;
  listing_title: string;
  direction: "received" | "sent";
  peer: PublicProfile & { contact?: string | null };
  share_contact: boolean;
  message: string | null;
  meet_at: string | null;
  meet_spot: string | null;
  status: "pending" | "accepted" | "declined" | "countered";
  created_at: string;
}
