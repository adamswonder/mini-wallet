const express = require('express');
const morgan  = require('morgan');
const authRoutes   = require('./routes/auth.routes');
const walletRoutes = require('./routes/wallet.routes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth',   authRoutes);
app.use('/wallet', walletRoutes);

app.use((_req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

app.use(errorMiddleware);

module.exports = app;
