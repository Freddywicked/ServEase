/**
 * Service catalog routes.
 * @format
 */

import { Router } from 'express';
import { getCategories } from '../controllers/servicesController.js';

const router = Router();

router.get('/categories', getCategories);

export default router;
