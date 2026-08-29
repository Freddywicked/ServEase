/**
 * Service request (booking) routes.
 * @format
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getActiveBooking } from '../controllers/bookingController.js';

const router = Router();

router.get('/active', authenticate, getActiveBooking);

export default router;
