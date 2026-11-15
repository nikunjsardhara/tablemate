-- Tablemate demo seed. Resets and repopulates demo data.
-- Usage: psql "$DATABASE_URL" -f seed.sql

TRUNCATE invitations, answers, responses, questions, listings, profiles CASCADE;

INSERT INTO profiles (id, nickname, bio, interests, contact) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Maya', 'Building in food-tech, ex-marketplace ops', ARRAY['startups','food','design'], 'maya@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'Arjun', 'Shipped two mobile apps, obsessing over supply chains', ARRAY['engineering','logistics','cooking'], 'arjun@hey.com'),
  ('33333333-3333-3333-3333-333333333333', 'Priya', 'Product manager day, potter by night', ARRAY['product','ceramics','music'], NULL);

INSERT INTO listings (asker_id, title, expires_at)
VALUES ('11111111-1111-1111-1111-111111111111',
        'Looking for a co-founder for a food-tech idea',
        now() + interval '23 hours');

INSERT INTO questions (listing_id, position, body, expectation, weight)
SELECT l.id, v.position, v.body, v.expectation, v.weight
FROM listings l, (VALUES
  (1, 'Why does food-tech need another startup right now?',
      'Has actually built something and can name a specific gap in the market, not a generic trend statement', 3),
  (2, 'What do you bring to a co-founder relationship?',
      'Names a concrete skill with evidence — shipped product, closed deals, ran ops — rather than adjectives', 2),
  (3, 'What would your first 90 days look like?',
      'Realistic sequencing: validate with real customers before building, knows distribution is the hard part', 1)
) AS v(position, body, expectation, weight)
WHERE l.title = 'Looking for a co-founder for a food-tech idea';

-- Two responses with pre-baked scores so the results page has content.
INSERT INTO responses (listing_id, answerer_id, match_score)
SELECT l.id, v.answerer_id::uuid, v.match_score
FROM listings l, (VALUES
  ('22222222-2222-2222-2222-222222222222', 84),
  ('33333333-3333-3333-3333-333333333333', 55)
) AS v(answerer_id, match_score)
WHERE l.title = 'Looking for a co-founder for a food-tech idea';

INSERT INTO answers (response_id, question_id, body, score, rationale)
SELECT
  r.id,
  q.id,
  v.body,
  v.score,
  v.rationale
FROM responses r
JOIN (VALUES
  ('22222222-2222-2222-2222-222222222222', 1,
   'Kitchens lose 18% of revenue to last-mile coordination — I ran dispatch ops at a delivery startup and saw the gap first-hand. Standalone apps exist but none own the operations layer.', 88,
   'Names a specific, quantified gap from direct experience — meets the expectation.'),
  ('22222222-2222-2222-2222-222222222222', 2,
   'I build and ship the product myself; my last two apps went from zero to 40k users with no agency help.', 90,
   'Concrete evidence of shipping at scale, exactly the substance the expectation asks for.'),
  ('22222222-2222-2222-2222-222222222222', 3,
   'Spend 90 days embedded in five kitchens doing dispatch manually, then automate only the step that hurts most.', 74,
   'Validates with real operations before building — closely matches the sequencing the asker wants.'),
  ('33333333-3333-3333-3333-333333333333', 1,
   'Food-tech is booming and everyone loves convenience food these days, so the market is huge right now.', 30,
   'Generic trend statement with no specific gap — misses most of the expectation.'),
  ('33333333-3333-3333-3333-333333333333', 2,
   'I am a great team player, hard working and very passionate about food.', 25,
   'Adjectives without evidence; contradicts the expectation of concrete, demonstrated skills.'),
  ('33333333-3333-3333-3333-333333333333', 3,
   'Build the app first, then figure out marketing once it looks good.', 65,
   'Builds before validating, but shows some awareness of needing to sell eventually.')
) AS v(answerer_id, position, body, score, rationale)
  ON r.answerer_id = v.answerer_id::uuid
JOIN questions q
  ON q.listing_id = r.listing_id AND q.position = v.position;
