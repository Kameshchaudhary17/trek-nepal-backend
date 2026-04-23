import { Router } from 'express';
import { getConditions, getRegions } from '../controllers/conditions.controller.js';

const router = Router();

router.get('/', getConditions);
router.get('/regions', getRegions);

export default router;
