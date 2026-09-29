require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes/api.routes');
const ApiError = require('./utils/ApiError');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors()); // tighten to your web app's origin before deploying
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/api', apiRoutes);

// Anything that didn't match a route ends up here.
app.use((req, res, next) => {
  next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`));
});

// Must stay the LAST middleware.
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Only listen when run directly (so tests can import `app` without opening a port).
if (require.main === module) {
  app.listen(PORT, () => console.log(`ServEase API running at http://localhost:${PORT}/api`));
}

module.exports = app;