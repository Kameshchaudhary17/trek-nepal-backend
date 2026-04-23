import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import guideRoutes from './routes/guides.routes.js';
import userRoutes from './routes/users.routes.js';
import conditionsRoutes from './routes/conditions.routes.js';
import treksRoutes from './routes/treks.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import { ApiError } from './utils/apiError.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conditions', conditionsRoutes);
app.use('/api/treks', treksRoutes);
app.use('/api/pricing', pricingRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ message });
});

export default app;
