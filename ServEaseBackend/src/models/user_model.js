const supabase = require('../config/supabase');
const { unwrap } = require('../utils/db');

// Only select `password` when you must check it (login). Never send it to the client.
const PUBLIC_FIELDS = 'user_id, name, username, email, phone_number, role, address, birthdate, gender';

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

const toPublic = ({ password, ...rest }) => rest;

module.exports = { findByEmail, findByUsername, findById, findProvider, createCustomer, toPublic };