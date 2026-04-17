import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { ApiError } from './utils/apiError.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ message });
});

export default app;
