// Run this once to create the first super admin
// Usage: node scripts/create-admin.js <name> <password>
const { hashPassword } = require('../lib/auth');
const { saveAdminAccount } = require('../lib/kv');
const { randomBytes } = require('crypto');

async function main() {
  const name = process.argv[2];
  const password = process.argv[3];
  if (!name || !password) {
    console.error('Usage: node scripts/create-admin.js <name> <password>');
    process.exit(1);
  }
  const account = {
    adminId: `admin_${randomBytes(6).toString('hex')}`,
    name,
    pwHash: await hashPassword(password),
    isSuperAdmin: true,
    createdAt: Date.now(),
  };
  await saveAdminAccount(account);
  console.log(`Created super admin: ${name} (${account.adminId})`);
}

main().catch(e => { console.error(e); process.exit(1); });
