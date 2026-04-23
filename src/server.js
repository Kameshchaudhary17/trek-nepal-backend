import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

import { seedTreks } from './controllers/treks.controller.js';
import { seedPricing } from './controllers/pricing.controller.js';

connectDB()
  .then(async () => {
    await seedTreks();
    await seedPricing();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err);
    process.exit(1);
  });
