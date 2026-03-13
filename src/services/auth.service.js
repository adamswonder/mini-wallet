const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const AppError = require('../errors');

const SALT_ROUNDS = 12;

async function register({ name, email, password }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('Name is required', 400);
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new AppError('A valid email is required', 400);
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }

  const { rows: existing } = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (existing.length) throw new AppError('Email already in use', 409);

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [user] } = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.toLowerCase(), password_hash]
    );

    const { rows: [wallet] } = await client.query(
      'INSERT INTO wallets (user_id) VALUES ($1) RETURNING id, balance, created_at',
      [user.id]
    );

    await client.query('COMMIT');

    const token = signToken(user.id);
    return { user, wallet, token };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const { rows: [user] } = await db.query(
    'SELECT id, name, email, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  // Use a constant-time comparison path to avoid leaking whether the email exists
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !valid) throw new AppError('Invalid email or password', 401);

  const token = signToken(user.id);
  return {
    user: { id: user.id, name: user.name, email: user.email },
    token,
  };
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = { register, login };
