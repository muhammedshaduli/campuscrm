const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middlewares/error');
const routes = require('./routes/index');
const { ApiError } = require('./utils/response');

const app = express();
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// 1. GLOBAL MIDDLEWARES
app.use(helmet()); // Security headers
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === 'null' || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new ApiError(403, `CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Logging
}

// 2. ROUTES
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Calviz CampusCRM API is healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', routes);

// Base route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Calviz CampusCRM API is online',
  });
});

// 3. ERROR HANDLING
app.use((req, res, next) => {
  next(new ApiError(404, `Can't find ${req.originalUrl} on this server!`));
});

app.use(errorHandler);

module.exports = app;
