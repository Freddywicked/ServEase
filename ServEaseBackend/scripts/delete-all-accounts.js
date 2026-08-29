/**
 * One-off cleanup script: deletes EVERY account and all account-owned data.
 *
 * Removes, in dependency order:
 *   notifications, service_requests, provider_applications (also cascade),
 *   otp_codes, users, and all files in the verification-docs storage bucket.
 * The service catalog (service_categories, services) is left untouched.
 *
 * Usage:  node scripts/delete-all-accounts.js
 * @format
 */

import config from '../src/config/index.js';
import { getSupabase } from '../src/config/supabase.js';

const deleteAll = async (supabase, table) => {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .not('id', 'is', null);
  if (error) {
    throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
  return count ?? 0;
};

const clearStorageBucket = async supabase => {
  const bucket = config.supabase.storageBucket;
  // Files are stored as "<ownerId>/<file>" - list top-level folders first.
  const { data: folders, error } = await supabase.storage.from(bucket).list();
  if (error) {
    throw new Error(`Failed to list ${bucket} bucket: ${error.message}`);
  }
  let removed = 0;
  for (const folder of folders ?? []) {
    const { data: files } = await supabase.storage
      .from(bucket)
      .list(folder.name, { limit: 1000 });
    const paths = (files ?? []).map(file => `${folder.name}/${file.name}`);
    if (paths.length) {
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(paths);
      if (removeError) {
        throw new Error(`Failed to remove storage files: ${removeError.message}`);
      }
      removed += paths.length;
    }
  }
  return removed;
};

const main = async () => {
  const supabase = getSupabase();

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone, role, status')
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }
  console.log(`Found ${users.length} account(s):`);
  for (const user of users) {
    console.log(
      `  - ${user.full_name} <${user.email}> ${user.phone} [${user.role}/${user.status}]`,
    );
  }
  if (!users.length) {
    console.log('Nothing to delete.');
    return;
  }

  // Child tables first (they also cascade from users, but be explicit in
  // case the schema was created without the cascade clauses).
  for (const table of [
    'notifications',
    'service_requests',
    'provider_applications',
    'otp_codes',
  ]) {
    const deleted = await deleteAll(supabase, table);
    console.log(`Deleted ${deleted} row(s) from ${table}.`);
  }

  const deletedUsers = await deleteAll(supabase, 'users');
  console.log(`Deleted ${deletedUsers} row(s) from users.`);

  const removedFiles = await clearStorageBucket(supabase);
  console.log(`Removed ${removedFiles} file(s) from the storage bucket.`);

  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });
  console.log(`Accounts remaining: ${count}.`);
};

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
