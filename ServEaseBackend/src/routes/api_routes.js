const router = require('express').Router();
const supabase = require('../config/supabase');

// Quick check that the server AND the Supabase connection/keys work.
router.get('/health', async (req, res) => {
  const { error } = await supabase.from('users').select('user_id', { count: 'exact', head: true });
  if (error) console.error('[health] Supabase error:', error.message);
  res.status(error ? 503 : 200).json({
    status: error ? 'degraded' : 'ok',
    database: error ? 'unreachable' : 'connected',
  });
});

router.use('/auth', require('./auth.routes'));

// Add each module here as you build it:
// router.use('/providers', require('./provider.routes'));
// router.use('/requests', require('./request.routes'));
// router.use('/quotations', require('./quotation.routes'));

module.exports = router;