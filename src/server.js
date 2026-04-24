import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './config/socket.js';

const PORT = process.env.PORT || 5000;

import { seedTreks } from './controllers/treks.controller.js';
import { seedPricing } from './controllers/pricing.controller.js';

connectDB()
  .then(async () => {
    await seedTreks();
    await seedPricing();

    // Wrap the Express app in an HTTP server so Socket.io can share the port.
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err);
    process.exit(1);
  });
