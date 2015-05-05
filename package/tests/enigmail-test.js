/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


function run_test() {
    var md = do_get_cwd().parent;
    md.append("enigmail.js");
    do_load_module("file://" + md.path);
    shouldNotUseGpgAgent_test();
    shouldUseGpgAgent_test();
}

function shouldNotUseGpgAgent_test() {
    var enigmail = new Enigmail();
    var isuseGpgAgent = enigmail.useGpgAgent();
    Assert.equal(false, isuseGpgAgent);
}

function shouldUseGpgAgent_test() {
    Ec.enigmailSvc = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    window = JSUnit.createStubWindow();
    Ec.enigmailSvc.initialize(window, "", EnigmailCore.prefBranch);
    Assert.equal(true, Ec.enigmailSvc.useGpgAgent());
}
