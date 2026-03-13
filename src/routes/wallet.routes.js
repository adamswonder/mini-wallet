const { Router } = require('express');
const authenticate = require('../middleware/auth.middleware');
const { getWallet, deposit, transfer, getTransactions } = require('../controllers/wallet.controller');

const router = Router();

router.use(authenticate);

router.get('/',              getWallet);
router.post('/deposit',      deposit);
router.post('/transfer',     transfer);
router.get('/transactions',  getTransactions);

module.exports = router;
