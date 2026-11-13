// Disposable, invented-only full app/review -> maintained owner harness.
// Registration is applied ONLY to these newly generated synthetic fixtures.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildMagazineFixture,treeHashes,ownChild} from './magazine-fixture.mjs';
import {apply as register,dryRun} from '../../tools/magazine/register.mjs';
import {createMagazinePortfolio} from '../../runtime/services/magazine-portfolio.mjs';
import {createExistingWorkReview} from '../../scripts/review-existing.mjs';
import {installFixtureOverlay} from '../../fixture-overlay.mjs';

const repo=path.resolve(import.meta.dirname,'../..');
export const TRANSITION_DEV='Workflow/3-Develop/DEV - Clay Teacher (story).md';
export const TRANSITION_SELECTION={storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working'};
const freePort=()=>new Promise(resolve=>{const server=net.createServer().listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const listen=(server,port)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});

export async function startMagazineTransitionHarness({ownerPort=0,reviewPort=0}={}){
 const f=buildMagazineFixture({extra:{
  'Workflow/3-Develop/DEV - River Potter (story).md':'---\ntype: DEV\nstory: River Potter\n---\n\nIndependent sibling working words.\n',
  '_archive/DEV - Clay Teacher (earlier).md':'---\ntype: DEV\nstory: Clay Teacher\ntitle: Earlier retained edition\n---\n\nEarlier retained words, distinct from the current draft.\n',
  'Workflow/4-Review/CHECK - Unrelated calibration.md':'An unrelated invented check remains unassigned.\n'
 }});
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-create-magazine-transition-'))),dataDir=path.join(temporary,'owner-data');fs.mkdirSync(dataDir);
 const currentFile=path.join(f.vault,TRANSITION_DEV);
 fs.writeFileSync(currentFile,fs.readFileSync(currentFile,'utf8').replace('updated: 2026-10-10','updated: 2026-10-10\npublished: https://example.invalid/invented-earlier-edition'));
 const publishedFile=path.join(temporary,'published-edition.html'),overridesFile=path.join(temporary,'published-overrides.json');
 fs.writeFileSync(publishedFile,'<article><h1>Earlier published edition</h1><p>Invented historical words.</p></article>\n');
 fs.writeFileSync(overridesFile,JSON.stringify({edition:'invented-earlier-capture',fields:{'intro-field':'An independently saved published override.'},plateOrder:['invented-plate-1']}));
 const initialFiles=treeHashes(f.vault),initialPublished={capture:hash(publishedFile),overrides:hash(overridesFile)};
 const registrationPreview=await dryRun({mag:f.vault,files:f.files});
 const registration=await register({mag:f.vault,files:f.files,data:dataDir,verification:path.join(temporary,'verification')});
 if(!registration.applied||!registration.identical)throw Error('Synthetic registrar did not preserve fixture bytes.');
 ownerPort||=await freePort();reviewPort||=await freePort();
 if([8841,59955,59958].includes(ownerPort)||[8841,59955,59958].includes(reviewPort)||ownerPort===reviewPort)throw Error('Use distinct disposable candidate ports.');
 const ownerOrigin='http://127.0.0.1:'+ownerPort,origin='http://127.0.0.1:'+reviewPort;
 const ownerConfig=path.join(temporary,'owner-config.json');
 fs.writeFileSync(ownerConfig,JSON.stringify({dataDir,port:ownerPort,allowScratchRoots:true,tools:{},sourceRoots:[],magazine:{vaultRoot:f.vault,filesRoot:f.files,writable:true,machine:'invented-transition'}}));
 let child=null,ownerLog='';
 async function startOwner(){
  child=ownChild(spawn(process.execPath,[path.join(repo,'serve.mjs'),'--config',ownerConfig],{cwd:repo,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},stdio:['ignore','pipe','pipe']}));
  const launched=child;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Synthetic owner did not start: '+ownerLog)),10000);const onData=chunk=>{ownerLog+=chunk;if(String(chunk).includes('AR Create:')){clearTimeout(timer);resolve();}};launched.stdout.on('data',onData);launched.stderr.on('data',chunk=>{ownerLog+=chunk;});launched.once('exit',code=>{clearTimeout(timer);reject(Error('Synthetic owner exited '+code+': '+ownerLog));});});
 }
 async function stopOwner(){const stopped=child;child=null;if(stopped&&stopped.exitCode===null)await new Promise(resolve=>{stopped.once('exit',resolve);stopped.kill('SIGTERM');});}
 await startOwner();const initialPID=child.pid;
 const roots=[{id:'invented-canonical-magazine',label:'Invented magazine',path:f.vault}],portfolio=createMagazinePortfolio({roots}),listed=await portfolio.list();
 const story=listed.stories.find(story=>story.artifacts.some(a=>a.relativePath===TRANSITION_DEV&&!a.archived));
 if(!story)throw Error('Synthetic current DEV has no portfolio identity.');
 const projectLinks={[story.id]:{nativeProjectId:'notes'}},config={port:reviewPort,authorityURL:ownerOrigin,allowedAuthorityPort:ownerPort,magazineRoots:roots,projectLinks,magazineDraftCorrections:true};
 const review=await createExistingWorkReview({config});
 const fixturesDir=path.join(temporary,'browser-fixtures');fs.mkdirSync(fixturesDir);
 fs.writeFileSync(path.join(fixturesDir,'synthetic-study-data.js'),`const PORCELAIN_HTML='<p>Invented retained public words.</p>';const HK_LINEUP={slides:[],caption:''};const WORKFLOW_RECORDS={};const AR_CREATE_SYNTHETIC_PROJECTS=[{id:'notes',name:'Invented existing story',title:'Earlier retained browser edition',step:'Draft',status:'Invented fixture',subtitle:'Invented material only',view:'record',viewedStage:1,blocks:[{id:'retained-public-block',tag:'p',html:'Earlier retained browser words stay separate.',source:'Invented retained edition',quote:false}],history:[],note:null,originalNotes:[],slides:[],rev:1},{id:'other-browser-story',name:'Independent browser story',title:'Other retained words',view:'record',viewedStage:1,blocks:[{id:'other-retained',tag:'p',html:'Independent retained browser words.'}],history:[],note:null,originalNotes:[],slides:[],rev:1}];`);
 installFixtureOverlay(review.server,{fixturesDir,port:reviewPort});await listen(review.server,reviewPort);
 fs.writeFileSync(path.join(temporary,'review-config.json'),JSON.stringify(config));
 return {
  origin,ownerOrigin,temporary,dataDir,f,currentFile,storyId:story.id,initialFiles,initialPublished,publishedFile,overridesFile,registrationPreview,initialPID,
  get ownerPID(){return child?.pid;},
  async restart(){const previous=child?.pid;await stopOwner();await startOwner();return {previous,current:child.pid};},
  async close(){await new Promise(resolve=>{review.server.closeAllConnections();review.server.close(resolve);});await stopOwner();f.cleanup();fs.rmSync(temporary,{recursive:true,force:true});}
 };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const harness=await startMagazineTransitionHarness({ownerPort:Number(process.env.AR_CREATE_TRANSITION_OWNER_PORT)||0,reviewPort:Number(process.env.AR_CREATE_TRANSITION_REVIEW_PORT)||0});
 console.log(JSON.stringify({inventedOnly:true,preview:harness.origin+'/document-study/index.html',owner:harness.ownerOrigin,ownerPID:harness.ownerPID,temporary:harness.temporary,storyId:harness.storyId}));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>harness.close().then(()=>process.exit(0)));
}
