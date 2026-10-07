const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');

// The users table's primary key is user_id (see migrations/001_align_schema_with_erd.sql).
// Only select `password_hash` when you must check it (login). Never send it to the client.
const PUBLIC_FIELDS = 'user_id, name, username, email, phone_number, role, address, birthdate, gender, active_mode';

const findByEmail = async (email, columns = '*') =>
  unwrap(await supabase.from('users').select(columns).eq('email', email).maybeSingle());

const findByUsername = async (username, columns = '*') =>
  unwrap(await supabase.from('users').select(columns).eq('username', username).maybeSingle());

const findById = async (id) =>
  unwrap(await supabase.from('users').select(PUBLIC_FIELDS).eq('user_id', id).maybeSingle());

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
  const user = unwrap(
    await supabase.from('users').insert({ ...fields, role: 'customer' }).select(PUBLIC_FIELDS).single()
  );

  const { error } = await supabase.from('customers').insert({ user_id: user.user_id });
  if (error) {
    // supabase-js can't run a multi-table transaction, so undo the first insert by hand.
    await supabase.from('users').delete().eq('user_id', user.user_id);
    unwrap({ error });
  }
  return user;
};

// Which side of the app the account is using: 'customer' | 'service_provider'.
const setActiveMode = async (id, mode) =>
  unwrap(
    await supabase.from('users').update({ active_mode: mode }).eq('user_id', id).select(PUBLIC_FIELDS).single()
  );

const toPublic = ({ password, password_hash, ...rest }) => rest;

module.exports = { findByEmail, findByUsername, findById, findProvider, createCustomer, setActiveMode, toPublic };
