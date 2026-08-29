/**
 * API route registry.
 * @format
 */

import { Router } from 'express';
import authRoutes from './authRoutes.js';
import providerRoutes from './providerRoutes.js';
import servicesRoutes from './servicesRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'servease-api',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/providers', providerRoutes);
router.use('/services', servicesRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);

export default router;
