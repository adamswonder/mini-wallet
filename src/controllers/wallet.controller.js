const walletService = require('../services/wallet.service');

async function getWallet(req, res, next) {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    res.json({ status: 'success', data: wallet });
  } catch (err) {
    next(err);
  }
}

async function deposit(req, res, next) {
  try {
    const result = await walletService.deposit(req.user.id, req.body.amount);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

async function transfer(req, res, next) {
  try {
    const result = await walletService.transfer(req.user.id, req.body);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

async function getTransactions(req, res, next) {
  try {
    const result = await walletService.getTransactions(req.user.id, req.query);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getWallet, deposit, transfer, getTransactions };
