"""Regression checks for bounded C++ trace checkpoints (no debugger required)."""
import builtins
import pathlib
import runpy
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
import json
import os

class TraceCheckpointTest(unittest.TestCase):
    def test_size_budget_preserves_valid_prefix_without_repeated_trimming(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            real_open=builtins.open
            real_unlink=os.unlink
            def redirected_unlink(path,*args,**kwargs):
                if str(path).startswith('/tmp/work/'):path=root/pathlib.Path(path).name
                return real_unlink(path,*args,**kwargs)
            def redirected(path,*args,**kwargs):
                if str(path).startswith('/tmp/work/'):
                    path=root/pathlib.Path(path).name
                return real_open(path,*args,**kwargs)
            fake=types.ModuleType('gdb')
            def unavailable(*args,**kwargs):raise RuntimeError('No debugger in unit test')
            fake.execute=unavailable
            with patch.dict(sys.modules,{'gdb':fake}),patch('builtins.open',redirected),patch('os.unlink',redirected_unlink):
                scope=runpy.run_path(str(pathlib.Path(__file__).parents[1]/'guest/gdb_trace.py'))
                frame={'line':1,'event':'line','locals':{'large':'x'*40000},'stack':['main']}
                self.assertTrue(scope['append_step'](frame))
                self.assertFalse(scope['append_step'](frame))
                scope['checkpoint'](True)
                raw=(root/'trace.json').read_bytes()
                self.assertLessEqual(len(raw),60000)
                self.assertEqual(json.loads(raw),[frame])
                self.assertTrue((root/'trace-truncated').exists())

    def test_checkpoint_survives_interruption_before_final_flush(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            real_open=builtins.open
            real_unlink=os.unlink
            def redirected_unlink(path,*args,**kwargs):
                if str(path).startswith('/tmp/work/'):path=root/pathlib.Path(path).name
                return real_unlink(path,*args,**kwargs)
            def redirected(path,*args,**kwargs):
                if str(path).startswith('/tmp/work/'):path=root/pathlib.Path(path).name
                return real_open(path,*args,**kwargs)
            fake=types.ModuleType('gdb')
            def unavailable(*args,**kwargs):raise RuntimeError('No debugger in unit test')
            fake.execute=unavailable
            with patch.dict(sys.modules,{'gdb':fake}),patch('builtins.open',redirected),patch('os.unlink',redirected_unlink):
                scope=runpy.run_path(str(pathlib.Path(__file__).parents[1]/'guest/gdb_trace.py'))
                for i in range(8):
                    scope['append_step']({'line':i+1,'locals':{'text':'한글\n"quoted"'},'stack':['main']})
                # Read the checkpoint without calling the final flush.
                frames=json.loads((root/'trace.json').read_text())
                self.assertEqual(len(frames),8)
                self.assertEqual(frames[-1]['line'],8)
                self.assertTrue((root/'trace-truncated').exists())

if __name__=='__main__':unittest.main()

