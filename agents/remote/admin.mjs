import {loadConfig,validateConfig} from './server.mjs';
import {createAuthorization} from './authorization.mjs';
const [flag,file,action,...args]=process.argv.slice(2);
try{
 if(flag!=='--config'||!['requests','approve','revoke-principal'].includes(action))throw Error('Use --config ABS requests | approve TICKET PRINCIPAL | revoke-principal PRINCIPAL');
 const {config}=loadConfig(file),auth=createAuthorization(validateConfig(config));
 if(action==='requests'&&args.length===0)process.stdout.write(JSON.stringify(auth.requests(),null,2)+'\n');
 else if(action==='approve'&&args.length===2)process.stdout.write(JSON.stringify(auth.approve(...args),null,2)+'\n');
 else if(action==='revoke-principal'&&args.length===1)process.stdout.write(JSON.stringify(auth.revokePrincipal(args[0]),null,2)+'\n');
 else throw Error('Wrong arguments.');
}catch(e){process.stderr.write((e.status?e.message:'Local connection administration failed; check the external private configuration and arguments.')+'\n');process.exitCode=1;}
