const { supabase } = require('../config/supabase');
const { BUCKET } = require('../utils/storage');

const fail = (message) => {
  const error = new Error(message);
  error.status = 500;
  return error;
};

// Counts rows in a table. `applyFilter` is optional, e.g. (q) => q.eq('col', 'value').
const count = async (table, applyFilter) => {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (applyFilter) query = applyFilter(query);
  const { count: total, error } = await query;
  if (error) throw fail(`Could not count ${table}: ${error.message}`);
  return total ?? 0;
};

// GET /api/admin/stats
// Numbers for the five stat cards, plus the sign-up timestamps of the last 7 days
// for the "User Registration Trend" chart.
const getStats = async (req, res, next) => {
  try {
    const [totalUsers, customers, serviceProviders, pendingAccounts, verifiedProviders] =
      await Promise.all([
        count('users'),
        count('customers'),
        count('service_providers'),
        count('service_providers', (q) => q.eq('verification_status', 'pending')),
        count('service_providers', (q) => q.eq('verification_status', 'verified')),
      ]);

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data: rows, error } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', since.toISOString());

    // The chart is optional: if this fails, still return the stat cards.
    if (error) console.error('[admin] registration trend query failed:', error.message);
    const registration_dates = error ? [] : rows.map((row) => row.created_at);

    res.json({
      stats: {
        totalUsers,
        // Active = customers plus verified providers (accounts in good standing).
        activeUsers: customers + verifiedProviders,
        customers,
        serviceProviders,
        pendingAccounts,
      },
      registration_dates,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

// Storage bucket that holds the provider application files. Imported from
// utils/storage.js so uploads and admin viewing always use the same bucket.
const PROVIDER_BUCKET = BUCKET;

const TABS = ['all', 'customers', 'providers', 'pending'];

const CATEGORY_LABELS = {
  'it-related': 'IT-Related device repair',
  'phone-repair': 'Phone repair',
  automotive: 'Automotive services',
  'home-repair': 'Home repair services',
};

const DOC_COLUMNS = {
  validId: 'government_id',
  selfie: 'profile_photo',
  supportingDocument: 'certification',
};

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// What the admin screen shows in the Status column.
const statusOf = (user, provider) => {
  if (user.is_disabled) return 'Disabled';
  if (!provider) return 'Active';
  if (provider.verification_status === 'pending') return 'Pending';
  if (provider.verification_status === 'rejected') return 'Rejected';
  return 'Active';
};

// GET /api/admin/users?tab=all|customers|providers|pending&page=1&pageSize=5
const getUsers = async (req, res, next) => {
  try {
    const tab = TABS.includes(req.query.tab) ? req.query.tab : 'all';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 5));

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role, phone_number, address, birthdate, created_at, is_disabled')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });
    if (usersError) throw fail(`Could not load users: ${usersError.message}`);

    const { data: providers, error: providersError } = await supabase
      .from('service_providers')
      .select('*');
    if (providersError) throw fail(`Could not load providers: ${providersError.message}`);

    const providerByUser = new Map(providers.map((p) => [p.user_id, p]));

    // Specializations live in their own table: one row per category/service.
    const { data: specRows, error: specError } = await supabase
      .from('service_provider_specialization')
      .select('provider_id, specialization_name');
    if (specError) throw fail(`Could not load specializations: ${specError.message}`);

    const specsByProvider = new Map();
    for (const { provider_id, specialization_name } of specRows) {
      if (!specsByProvider.has(provider_id)) specsByProvider.set(provider_id, []);
      specsByProvider.get(provider_id).push(specialization_name);
    }

    // The apps may send category keys ('phone-repair') or labels ('Phone Repair').
    // Anything that matches a known category is a category; the rest is a custom service.
    const knownLabels = Object.values(CATEGORY_LABELS).map((l) => l.toLowerCase());
    const isCategory = (name) => name in CATEGORY_LABELS || knownLabels.includes(String(name).toLowerCase());

    const rows = users.map((user) => {
      const provider = providerByUser.get(user.id);
      const row = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: provider ? 'Service Provider' : 'Customer',
        status: statusOf(user, provider),
        dateRegistered: user.created_at,
        phone: user.phone_number,
        address: user.address,
        birthdate: user.birthdate,
      };
      if (provider) {
        const specs = specsByProvider.get(user.id) || [];
        row.serviceCategory = specs
          .filter(isCategory)
          .map((name) => CATEGORY_LABELS[name] || name)
          .join(', ');
        row.yearsExperience = provider.experience ?? '';
        row.servicesOffered = specs.filter((name) => !isCategory(name));
        row.rejectionReason = provider.rejection_reason || null;
      }
      return row;
    });

    const filtered = rows.filter((row) => {
      if (tab === 'customers') return row.role === 'Customer';
      if (tab === 'providers') return row.role === 'Service Provider';
      if (tab === 'pending') return row.status === 'Pending';
      return true;
    });

    const start = (page - 1) * pageSize;
    res.json({ users: filtered.slice(start, start + pageSize), total: filtered.length });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/approve   and   /reject  (body: { reason })
const reviewApplication = (status) => async (req, res, next) => {
  try {
    const update = { verification_status: status };
    if (status === 'rejected') {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) throw httpError(400, 'A reason for rejection is required.');
      update.rejection_reason = reason;
    } else {
      update.rejection_reason = null;
    }

    const { data, error } = await supabase
      .from('service_providers')
      .update(update)
      .eq('user_id', req.params.id)
      .select('user_id, verification_status');
    if (error) throw fail(error.message);
    if (!data || data.length === 0) throw httpError(404, 'No provider application found for this user.');

    res.json({ provider: data[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/disable
const disableUser = async (req, res, next) => {
  try {
    const { data: target, error: findError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', req.params.id)
      .maybeSingle();
    if (findError) throw fail(findError.message);
    if (!target) throw httpError(404, 'User not found.');
    if (target.role === 'admin') throw httpError(400, 'Admin accounts cannot be disabled.');

    const { error } = await supabase.from('users').update({ is_disabled: true }).eq('id', req.params.id);
    if (error) throw fail(error.message);

    res.json({ message: 'Account disabled' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/enable
// Reverses disableUser. Only the is_disabled flag changes, so a provider's
// verification_status (pending / verified / rejected) is kept as it was.
const enableUser = async (req, res, next) => {
  try {
    const { data: target, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (findError) throw fail(findError.message);
    if (!target) throw httpError(404, 'User not found.');

    const { error } = await supabase.from('users').update({ is_disabled: false }).eq('id', req.params.id);
    if (error) throw fail(error.message);

    res.json({ message: 'Account enabled' });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users/:id/documents/:kind   kind = validId | selfie | supportingDocument
// Returns short-lived links (10 minutes) so the images are never public.
const getDocuments = async (req, res, next) => {
  try {
    const column = DOC_COLUMNS[req.params.kind];
    if (!column) throw httpError(400, 'Unknown document type.');

    const { data: provider, error } = await supabase
      .from('service_providers')
      .select('*')
      .eq('user_id', req.params.id)
      .maybeSingle();
    if (error) throw fail(error.message);
    if (!provider) throw httpError(404, 'No provider application found for this user.');

    const raw = provider[column];
    const paths = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);

    const urls = [];
    for (const path of paths) {
      const { data, error: signError } = await supabase.storage
        .from(PROVIDER_BUCKET)
        .createSignedUrl(path, 600);
      if (signError) throw fail(`Could not open the file: ${signError.message}`);
      urls.push(data.signedUrl);
    }

    res.json({ urls });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getUsers,
  approveApplication: reviewApplication('verified'),
  rejectApplication: reviewApplication('rejected'),
  disableUser,
  enableUser,
  getDocuments,
};