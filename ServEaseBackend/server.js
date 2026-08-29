/**
 * ServEase backend entry point.
 * @format
 */

import app from './src/app.js';
import config from './src/config/index.js';

app.listen(config.port, () => {
  console.log(
    `ServEase API listening on http://localhost:${config.port} (${config.env})`,
  );
});
