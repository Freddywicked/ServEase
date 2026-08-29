/**
 * Service catalog controller: exposes the categories and services
 * shown in the service provider application and customer booking flows.
 * @format
 */

import { getSupabase } from '../config/supabase.js';

/** GET /api/services/categories */
export const getCategories = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('service_categories')
      .select('id, name, services(id, name)')
      .order('sort_order', { ascending: true });
    if (error) {
      return res
        .status(500)
        .json({ message: 'Failed to load service categories.' });
    }
    return res.json({ categories: data });
  } catch (error) {
    return next(error);
  }
};
