import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Only the stdlib provisioning helper is imported. No model library, inference,
// real download, installed cache, credential or production recording is used.
test('speaker provisioning fails closed offline and preserves existing explicit online provisioning',t=>{
 const python=process.env.AR_CREATE_PYTHON||'python3',module=fileURLToPath(new URL('../runtime/services/runtime/transcription/sherpa.py',import.meta.url));
 const result=spawnSync(python,['-B','-c',String.raw`
import importlib.util, os, pathlib, sys, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location("ar_sherpa_under_test",sys.argv[1])
sherpa=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sherpa)

class Provisioning(unittest.TestCase):
 def setUp(self):
  self.temporary=tempfile.TemporaryDirectory(prefix="ar-offline-models-")
  self.addCleanup(self.temporary.cleanup)
  self.root=pathlib.Path(self.temporary.name)/"models"
  self.environment=patch.dict(os.environ,{"MAG_DIARIZATION_MODELS":str(self.root)},clear=False)
  self.environment.start(); self.addCleanup(self.environment.stop)
  os.environ.pop("HF_HUB_OFFLINE",None); os.environ.pop("TRANSFORMERS_OFFLINE",None)
 def paths(self):
  return self.root/"sherpa-onnx-pyannote-segmentation-3-0/model.onnx",self.root/"wespeaker_en_voxceleb_resnet34_LM.onnx"
 def snapshot(self):
  return {str(p.relative_to(self.root)):p.read_bytes() if p.is_file() else None for p in self.root.rglob("*")}
 def test_missing_directory_never_downloads_or_creates_caches_for_either_offline_flag(self):
  for flag,value in ((flag,value) for flag in ("HF_HUB_OFFLINE","TRANSFORMERS_OFFLINE") for value in ("1","TRUE","yes","on")):
   with self.subTest(flag=flag,value=value),patch.dict(os.environ,{flag:value}),patch.object(sherpa.urllib.request,"urlretrieve",side_effect=AssertionError("Unexpected network")) as download:
    with self.assertRaisesRegex(RuntimeError,"[Oo]ffline.*speaker model"):
     sherpa.ensure_models(lambda event:self.fail("Offline failure must not start provisioning"))
    download.assert_not_called(); self.assertFalse(self.root.exists())
 def test_partial_offline_models_leave_existing_bytes_and_directory_unchanged(self):
  for missing in (0,1):
   with self.subTest(missing=missing),tempfile.TemporaryDirectory(dir=self.temporary.name) as directory:
    self.root=pathlib.Path(directory);segmentation,embedding=self.paths();present=(embedding,segmentation)[missing]
    present.parent.mkdir(parents=True,exist_ok=True);present.write_bytes(b"invented retained model bytes")
    before=self.snapshot()
    with patch.dict(os.environ,{"MAG_DIARIZATION_MODELS":str(self.root),"HF_HUB_OFFLINE":"1","TRANSFORMERS_OFFLINE":"1"}),patch.object(sherpa.urllib.request,"urlretrieve",side_effect=AssertionError("Unexpected network")) as download:
     with self.assertRaisesRegex(RuntimeError,"[Oo]ffline.*speaker model"):
      sherpa.ensure_models(lambda event:self.fail("Offline failure must not start provisioning"))
     download.assert_not_called(); self.assertEqual(self.snapshot(),before)
 def test_complete_offline_models_are_read_without_provisioning_or_directory_writes(self):
  segmentation,embedding=self.paths();segmentation.parent.mkdir(parents=True);segmentation.write_bytes(b"invented segmentation");embedding.write_bytes(b"invented embedding");before=self.snapshot()
  with patch.dict(os.environ,{"HF_HUB_OFFLINE":"1"}),patch.object(sherpa.urllib.request,"urlretrieve",side_effect=AssertionError("Unexpected network")) as download,patch.object(pathlib.Path,"mkdir",side_effect=AssertionError("Offline models must stay read-only")):
   self.assertEqual(sherpa.ensure_models(lambda event:self.fail("No provisioning needed")),(segmentation,embedding));download.assert_not_called();self.assertEqual(self.snapshot(),before)
 def test_explicit_online_behavior_still_downloads_extracts_and_reuses_cached_models(self):
  events=[]
  def authored_download(url,target):
   if url==sherpa.SEGMENTATION_URL:pathlib.Path(target).write_bytes(b"invented archive")
   elif url==sherpa.EMBEDDING_URL:pathlib.Path(target).write_bytes(b"invented embedding")
   else:self.fail("Unexpected provisioning URL")
  class AuthoredArchive:
   def __enter__(archive):return archive
   def __exit__(archive,*error):return False
   def extractall(archive,folder,*,filter):
    self.assertEqual(filter,"data");self.assertEqual(pathlib.Path(folder),self.root)
    segmentation,_=self.paths();segmentation.parent.mkdir();segmentation.write_bytes(b"invented segmentation")
  with patch.dict(os.environ,{"HF_HUB_OFFLINE":"0","TRANSFORMERS_OFFLINE":"0"}),patch.object(sherpa.urllib.request,"urlretrieve",side_effect=authored_download) as download,patch.object(sherpa.tarfile,"open",return_value=AuthoredArchive()) as archive:
   segmentation,embedding=sherpa.ensure_models(events.append)
   archive.assert_called_once_with(self.root/"segmentation.tar.bz2")
   self.assertEqual([call.args[0] for call in download.call_args_list],[sherpa.SEGMENTATION_URL,sherpa.EMBEDDING_URL]);self.assertEqual(segmentation.read_bytes(),b"invented segmentation");self.assertEqual(embedding.read_bytes(),b"invented embedding");self.assertEqual(len(events),2)
   before=self.snapshot();sherpa.ensure_models(lambda event:self.fail("Cached online models must be reused"));self.assertEqual(download.call_count,2);self.assertEqual(self.snapshot(),before)

suite=unittest.defaultTestLoader.loadTestsFromTestCase(Provisioning)
result=unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
`,module],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:15000});
 if(result.error?.code==='ENOENT'){t.skip('Python is unavailable; no provisioning or inference was attempted.');return;}
 assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});
