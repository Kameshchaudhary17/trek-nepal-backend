import { Router } from 'express';
import {
  register, login, getMe, googleAuth, verifyOtp, resendOtp, logout,
  forgotPassword, resetPassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { loginLimiter, otpLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', otpLimiter, register);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleAuth);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password',  otpLimiter, resetPassword);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

export default router;
