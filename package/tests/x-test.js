/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, TestHelper: false, MailHelper: false */
/*global Components: false, dump: false */
/*jshint -W097 */

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");
TestHelper.loadDirectly("tests/mailHelper.js");

test(function() {
    let hdr = MailHelper.createHeader();
    dump(hdr);
});
