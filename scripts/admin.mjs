// Run only on the server by its owner, after registering the intended account.
import {createMembership} from '../membership.mjs';
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const email=process.argv[2]?.trim().toLowerCase();
if(!email){console.error('Usage: node scripts/admin.mjs your-registered-email');process.exit(1);}
const {db}=createMembership();
const result=db.prepare('UPDATE users SET is_admin=1 WHERE email=?').run(email);
console.log(result.changes?'Admin role enabled. Sign in again.':'No such registered account.');db.close();
