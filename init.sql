-- Tablemate Database Schema
-- Run this against your PostgreSQL database to initialize it

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE profiles (
  id          UUID PRIMARY KEY,
  nickname    TEXT NOT NULL,
  bio         VARCHAR(200),
  interests   TEXT[] DEFAULT '{}',
  contact     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE listings (
  id          SERIAL PRIMARY KEY,
  asker_id    UUID REFERENCES profiles(id),
  title       VARCHAR(120) NOT NULL,
  status      TEXT DEFAULT 'open',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE questions (
  id           SERIAL PRIMARY KEY,
  listing_id   INT REFERENCES listings(id) ON DELETE CASCADE,
  position     INT NOT NULL,
  body         VARCHAR(250) NOT NULL,
  expectation  VARCHAR(300) NOT NULL,
  weight       INT DEFAULT 1 CHECK (weight BETWEEN 1 AND 3)
);

CREATE TABLE responses (
  id             SERIAL PRIMARY KEY,
  listing_id     INT REFERENCES listings(id) ON DELETE CASCADE,
  answerer_id    UUID REFERENCES profiles(id),
  match_score    INT,
  status         TEXT DEFAULT 'scored',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (listing_id, answerer_id)
);

CREATE TABLE answers (
  id           SERIAL PRIMARY KEY,
  response_id  INT REFERENCES responses(id) ON DELETE CASCADE,
  question_id  INT REFERENCES questions(id),
  body         VARCHAR(500) NOT NULL,
  score        INT,
  rationale    TEXT
);

CREATE TABLE invitations (
  id              SERIAL PRIMARY KEY,
  response_id     INT REFERENCES responses(id),
  from_id         UUID REFERENCES profiles(id),
  to_id           UUID REFERENCES profiles(id),
  share_contact   BOOLEAN DEFAULT false,
  message         VARCHAR(200),
  meet_at         TIMESTAMPTZ,
  meet_spot       TEXT,
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_listings_asker ON listings(asker_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_responses_listing ON responses(listing_id);
CREATE INDEX idx_responses_answerer ON responses(answerer_id);
CREATE INDEX idx_answers_response ON answers(response_id);
CREATE INDEX idx_invitations_from ON invitations(from_id);
CREATE INDEX idx_invitations_to ON invitations(to_id);
