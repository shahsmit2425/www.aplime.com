ALTER TABLE profiles ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
CREATE TABLE professional_subscriptions (
 user_id text PRIMARY KEY REFERENCES users(id), customer_id text UNIQUE,
 subscription_id text UNIQUE, status text NOT NULL DEFAULT 'none', checkout_id text,
 cancel_at_period_end boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
