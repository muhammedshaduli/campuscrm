const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middlewares/error');
const routes = require('./routes/index');
const { ApiError } = require('./utils/response');

const app = express();

// 1. GLOBAL MIDDLEWARES
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Logging
}

// 2. ROUTES
app.use('/api', routes);

// Base route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CampusBridge CRM API v1.0 connected',
  });
});

// 3. ERROR HANDLING
app.all('*', (req, res, next) => {
  next(new ApiError(404, `Can't find ${req.originalUrl} on this server!`));
});

app.use(errorHandler);

module.exports = app;
