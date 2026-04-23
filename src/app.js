import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import guideRoutes from './routes/guides.routes.js';
import userRoutes from './routes/users.routes.js';
import conditionsRoutes from './routes/conditions.routes.js';
import treksRoutes from './routes/treks.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { ApiError } from './utils/apiError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files (profile photos, trek photos)
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conditions', conditionsRoutes);
app.use('/api/treks', treksRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/upload', uploadRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ message });
});

export default app;
