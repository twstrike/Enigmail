#!/usr/bin/env python

import sys
import os
import glob
import subprocess
import select
import re

class TestRunner:
    TEST_OUTPUT_FILE = 'test_output.log'

    @staticmethod
    def all_tests():
        for root, dirs, files in os.walk("."):
            for file in files:
                if file.endswith("-test.js"):
                    yield os.path.join(root, file)

    def __init__(self, tbpath, tests):
        self.tbpath = tbpath
        self.tests = tests

    def run(self):
        with open(TestRunner.TEST_OUTPUT_FILE, 'w') as test_output:
            self.test_output = test_output
            self.total_executed = 0
            self.total_succeeded = 0
            self.total_failed = 0
            for t in tests:
                self.run_test(t)
            return (self.total_executed, self.total_succeeded, self.total_failed)

    def polling(self, tsk, on_stdout, on_stderr):
        poll = select.poll()
        poll.register(tsk.stdout,select.POLLIN | select.POLLHUP)
        poll.register(tsk.stderr,select.POLLIN | select.POLLHUP)
        pollc = 2
        events = poll.poll()
        while pollc > 0 and len(events) > 0:
            for event in events:
                (rfd,event) = event
                if event & select.POLLIN:
                    if rfd == tsk.stdout.fileno():
                        line = tsk.stdout.readline()
                        if len(line) > 0:
                            on_stdout(line[:-1])
                    if rfd == tsk.stderr.fileno():
                        line = tsk.stderr.readline()
                        if len(line) > 0:
                            on_stderr(line[:-1])
                if event & select.POLLHUP:
                    poll.unregister(rfd)
                    pollc = pollc - 1
                if pollc > 0:
                    events = poll.poll()
        return tsk.wait()

    def is_jsunit(self, str):
        return str.startswith("TestResult: ") or "resource://jsunit/jsunit-main.jsm" in str

    def extract_number(self, str):
        return int(re.search('\d+', str).group(0))

    def analyze_output(self, str):
        if str.startswith("TestResult: "):
            if   str.startswith("TestResult: executed :"):
                self.executed = self.extract_number(str)
            elif str.startswith("TestResult: succeeded:"):
                self.succeeded = self.extract_number(str)
            elif str.startswith("TestResult: failed   :"):
                self.failed = self.extract_number(str)
        elif str.startswith("Succeed: "):
            pass
        else:
            print str

    def write_to_log(self):
        def ret(str):
            if self.test_output:
                self.test_output.write(str + "\n")
        return ret

    def combine(self, left, right):
        def ret(str):
            left(str)
            right(str)
        return ret

    def reporting(self):
        def ret(str):
            if self.is_jsunit(str):
                self.analyze_output(str)
        return ret

    def reset_stats(self):
        self.executed = 0
        self.succeeded = 0
        self.failed = 0

    def add_stats(self):
        self.total_executed = self.total_executed + self.executed
        self.total_succeeded = self.total_succeeded + self.succeeded
        self.total_failed = self.total_failed + self.failed

    def run_test(self, t):
        test_name = os.path.basename(t)
        dir_name = os.path.dirname(t)
        tmp_file = t.replace(".js", "-loader.js")
        print "running", t, test_name

        self.reset_stats()

        try:
            with open(tmp_file, 'w') as f:
                f.write("do_subtest(\"" + test_name + "\");\n")
            tsk = subprocess.Popen([self.tbpath, '-jsunit', os.path.basename(tmp_file)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=dir_name)
            ret = self.polling(tsk, self.combine(self.write_to_log(), self.reporting()), self.write_to_log())
            self.add_stats()
            return ret
        finally:
            os.remove(tmp_file)

if __name__ == '__main__':
    tbpath = os.environ.get('TB_PATH', '/usr/bin/thunderbird')
    if len(sys.argv) < 2:
        tests = sorted([f for f in TestRunner.all_tests()])
    else:
        tests = sys.argv[1:]
    (ran, suc, fail) = TestRunner(tbpath, tests).run()
    print "Ran " + str(ran) + " tests"
    if fail > 0:
        print "  Had " + str(fail) + " failures"
        sys.exit(1)
