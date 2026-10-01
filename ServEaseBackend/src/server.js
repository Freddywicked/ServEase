const os = require('os');
const config = require('./config'); // loads .env and checks required values

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes/api_routes');
const ApiError = require('./utils/api_error');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = config.clientOrigin.split(',').map((o) => o.trim());

// Log every request the moment it arrives (before anything can fail).
// If this line never appears, the request is not reaching the server at all.
if (config.nodeEnv !== 'production') {
  app.use((req, res, next) => {
    console.log(`[in] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
  });
}

app.use(helmet());
app.use(cors({ origin: allowedOrigins })); // browsers only; the mobile app sends no Origin
app.use(express.json({ limit: '1mb' }));
if (config.nodeEnv !== 'production') app.use(morgan('dev'));

app.use('/api', apiRoutes);
app.use('/api/providers', require('./routes/provider_routes'));

app.use((req, res, next) => {
  next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

// Your computer's Wi-Fi/LAN addresses, for testing on a physical phone.
const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);

if (require.main === module) {
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`ServEase API running at http://localhost:${config.port}/api`);
    console.log(`  Android emulator : http://10.0.2.2:${config.port}/api`);
    lanAddresses().forEach((ip) => console.log(`  Phone on Wi-Fi   : http://${ip}:${config.port}/api`));
    console.log(`  Health check     : add /health to any of the above`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${config.port} is already in use. Stop the other process, or set PORT in .env ` +
          '(and update BASE_URL in the app). On macOS, port 5000 is used by AirPlay Receiver.'
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

module.exports = app;