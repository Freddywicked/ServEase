const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');

// The users table's primary key is `id`. Rows are also given a `user_id` copy
// (see withUserId) so any other code that reads user.user_id keeps working.
// Only select `password_hash` when you must check it (login). Never send it to the client.
const PUBLIC_FIELDS = 'id, name, username, email, phone_number, role, address, birthdate, gender, active_mode';

const withUserId = (row) => (row ? { ...row, user_id: row.id } : row);

const findByEmail = async (email, columns = '*') =>
  withUserId(unwrap(await supabase.from('users').select(columns).eq('email', email).maybeSingle()));

const findByUsername = async (username, columns = '*') =>
  withUserId(unwrap(await supabase.from('users').select(columns).eq('username', username).maybeSingle()));

const findById = async (id) =>
  withUserId(unwrap(await supabase.from('users').select(PUBLIC_FIELDS).eq('id', id).maybeSingle()));

const findProvider = async (userId) =>
  unwrap(
    await supabase
      .from('service_providers')
      .select('user_id, verification_status')
      .eq('user_id', userId)
      .maybeSingle()
  );

// BR-02: every new account starts as a customer (users row + customers row).
const createCustomer = async (fields) => {
  const user = withUserId(
    unwrap(
      await supabase.from('users').insert({ ...fields, role: 'customer' }).select(PUBLIC_FIELDS).single()
    )
  );

  const { error } = await supabase.from('customers').insert({ user_id: user.id });
  if (error) {
    // supabase-js can't run a multi-table transaction, so undo the first insert by hand.
    await supabase.from('users').delete().eq('id', user.id);
    unwrap({ error });
  }
  return user;
};

// Which side of the app the account is using: 'customer' | 'service_provider'.
const setActiveMode = async (id, mode) =>
  withUserId(
    unwrap(
      await supabase.from('users').update({ active_mode: mode }).eq('id', id).select(PUBLIC_FIELDS).single()
    )
  );

const toPublic = ({ password, password_hash, ...rest }) => rest;

module.exports = { findByEmail, findByUsername, findById, findProvider, createCustomer, setActiveMode, toPublic };