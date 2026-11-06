import {loadConfig,validateConfig} from './server.mjs';
import {createAuthorization} from './authorization.mjs';
const [flag,file,action,...args]=process.argv.slice(2);
try{
 if(flag!=='--config'||!['requests','approve','revoke-principal','enrollment','open-enrollment','close-enrollment','cleanup-enrollment'].includes(action))throw Error('Use --config ABS requests | approve TICKET PRINCIPAL | revoke-principal PRINCIPAL | enrollment | open-enrollment SECONDS | close-enrollment | cleanup-enrollment');
 const {config}=loadConfig(file),auth=createAuthorization(validateConfig(config));
 if(action==='requests'&&args.length===0)process.stdout.write(JSON.stringify(auth.requests(),null,2)+'\n');
 else if(action==='approve'&&args.length===2)process.stdout.write(JSON.stringify(auth.approve(...args),null,2)+'\n');
 else if(action==='revoke-principal'&&args.length===1)process.stdout.write(JSON.stringify(auth.revokePrincipal(args[0]),null,2)+'\n');
 else if(action==='enrollment'&&args.length===0)process.stdout.write(JSON.stringify(auth.enrollment())+'\n');
 else if(action==='open-enrollment'&&args.length===1&&/^\d+$/.test(args[0]))process.stdout.write(JSON.stringify(auth.openEnrollment(Number(args[0])))+'\n');
 else if(action==='close-enrollment'&&args.length===0)process.stdout.write(JSON.stringify(auth.closeEnrollment())+'\n');
 else if(action==='cleanup-enrollment'&&args.length===0)process.stdout.write(JSON.stringify(auth.cleanupEnrollment())+'\n');
 else throw Error('Wrong arguments.');
}catch(e){process.stderr.write((e.status?e.message:'Local connection administration failed; check the external private configuration and arguments.')+'\n');process.exitCode=1;}
