/**
 * Service provider application routes.
 * @format
 */

import { Router } from 'express';
import upload from '../middleware/upload.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getMyApplication,
  listApplications,
  reviewApplication,
  submitApplication,
} from '../controllers/providerController.js';

const router = Router();

const applicationUploads = upload.fields([
  { name: 'validId', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'supportingDocs', maxCount: 1 },
]);

router.post('/applications', authenticate, applicationUploads, submitApplication);
router.get('/applications/me', authenticate, getMyApplication);
router.get('/applications', authenticate, authorize('admin'), listApplications);
router.patch(
  '/applications/:id/review',
  authenticate,
  authorize('admin'),
  reviewApplication,
);

export default router;
