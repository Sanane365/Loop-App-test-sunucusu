import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

try {
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'post'`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS poll_options jsonb`;
  await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_id integer`;
  await sql`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id serial PRIMARY KEY,
      comment_id integer NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE(comment_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id serial PRIMARY KEY,
      post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option_index integer NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE(post_id, user_id)
    )
  `;
  await sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_url text`;
  await sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_duration integer`;
  await sql`
    CREATE TABLE IF NOT EXISTS dm_groups (
      id serial PRIMARY KEY,
      name text NOT NULL,
      avatar_url text,
      created_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS dm_group_members (
      id serial PRIMARY KEY,
      group_id integer NOT NULL REFERENCES dm_groups(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS dm_group_messages (
      id serial PRIMARY KEY,
      group_id integer NOT NULL REFERENCES dm_groups(id) ON DELETE CASCADE,
      sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content text,
      media_url text,
      media_type text,
      voice_url text,
      voice_duration integer,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ All migrations applied successfully");
} catch(e) {
  console.error("Migration error:", e.message);
} finally {
  await sql.end();
}
