const db = require('../db');
const AppError = require('../errors');

function validateAmount(amount) {
  if (amount === undefined || amount === null) {
    throw new AppError('Amount is required', 400);
  }
  if (!Number.isInteger(amount)) {
    throw new AppError('Amount must be a whole number (in kobo)', 400);
  }
  if (amount <= 0) {
    throw new AppError('Amount must be greater than zero', 400);
  }
}

async function getWalletByUserId(userId) {
  const { rows: [wallet] } = await db.query(
    'SELECT id, balance, created_at FROM wallets WHERE user_id = $1',
    [userId]
  );
  if (!wallet) throw new AppError('Wallet not found', 404);
  return wallet;
}

async function getWallet(userId) {
  const { rows: [row] } = await db.query(
    `SELECT w.id, w.balance, w.created_at, u.name, u.email
     FROM wallets w
     JOIN users u ON u.id = w.user_id
     WHERE w.user_id = $1`,
    [userId]
  );
  if (!row) throw new AppError('Wallet not found', 404);
  return row;
}

async function deposit(userId, amount) {
  validateAmount(amount);

  const wallet = await getWalletByUserId(userId);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
      [amount, wallet.id]
    );

    const { rows: [tx] } = await client.query(
      `INSERT INTO transactions (type, to_wallet_id, amount, status)
       VALUES ('deposit', $1, $2, 'success')
       RETURNING *`,
      [wallet.id, amount]
    );

    const { rows: [updated] } = await client.query(
      'SELECT balance FROM wallets WHERE id = $1',
      [wallet.id]
    );

    await client.query('COMMIT');

    return { transaction: tx, balance: updated.balance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function transfer(userId, { to_wallet_id, amount }) {
  validateAmount(amount);

  if (!to_wallet_id || typeof to_wallet_id !== 'string') {
    throw new AppError('to_wallet_id is required', 400);
  }

  // Resolve both wallets before opening a transaction
  const senderWallet = await getWalletByUserId(userId);

  const { rows: [recipientWallet] } = await db.query(
    'SELECT id FROM wallets WHERE id = $1',
    [to_wallet_id]
  );
  if (!recipientWallet) throw new AppError('Recipient wallet not found', 404);

  if (senderWallet.id === recipientWallet.id) {
    throw new AppError('Cannot transfer to your own wallet', 400);
  }

  const client = await db.connect();
  let clientReleased = false;

  const release = async (rollback = false) => {
    if (clientReleased) return;
    clientReleased = true;
    if (rollback) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    client.release();
  };

  try {
    await client.query('BEGIN');

    // Lock sender row to prevent concurrent overdrafts
    const { rows: [locked] } = await client.query(
      'SELECT balance FROM wallets WHERE id = $1 FOR UPDATE',
      [senderWallet.id]
    );

    if (locked.balance < amount) {
      // Rollback and release before recording the failed transaction on refresh
      await release(true);

      await db.query(
        `INSERT INTO transactions (type, from_wallet_id, to_wallet_id, amount, status)
         VALUES ('transfer', $1, $2, $3, 'failed')`,
        [senderWallet.id, to_wallet_id, amount]
      );

      throw new AppError('Insufficient balance', 422);
    }

    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE id = $2',
      [amount, senderWallet.id]
    );
    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
      [amount, recipientWallet.id]
    );

    const { rows: [tx] } = await client.query(
      `INSERT INTO transactions (type, from_wallet_id, to_wallet_id, amount, status)
       VALUES ('transfer', $1, $2, $3, 'success')
       RETURNING *`,
      [senderWallet.id, recipientWallet.id, amount]
    );

    const { rows: [updated] } = await client.query(
      'SELECT balance FROM wallets WHERE id = $1',
      [senderWallet.id]
    );

    await client.query('COMMIT');
    await release();

    return { transaction: tx, balance: updated.balance };
  } catch (err) {
    await release(true);
    throw err;
  }
}

async function getTransactions(userId, { page = 1, limit = 20 } = {}) {
  const parsedPage  = Math.max(1, parseInt(page)  || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  const wallet = await getWalletByUserId(userId);

  const { rows } = await db.query(
    `SELECT t.*
     FROM transactions t
     WHERE t.from_wallet_id = $1 OR t.to_wallet_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [wallet.id, parsedLimit, offset]
  );

  const { rows: [{ count }] } = await db.query(
    `SELECT COUNT(*) FROM transactions
     WHERE from_wallet_id = $1 OR to_wallet_id = $1`,
    [wallet.id]
  );

  return {
    wallet_id: wallet.id,
    transactions: rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: parseInt(count),
      pages: Math.ceil(parseInt(count) / parsedLimit),
    },
  };
}

module.exports = { getWallet, deposit, transfer, getTransactions };
