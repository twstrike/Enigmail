/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2010 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Fan Jiang <fanjiang@thoughtworks.com>
 *  Iván Pazmiño <iapamino@thoughtworks.com>
 *  Ola Bini <obini@thoughtworks.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("keyManagement.jsm");
importKeyForEdit();
test(shouldEditKey);
test(shouldSetTrust);
test(shouldSignKey);
function shouldEditKey() {
    do_test_pending();
    EnigmailKeyMgmt.editKey(
        window,
        false,
        null,
        "781617319CE311C4",
        "trust",
        {trustLevel: 5},
        function (inputData, keyEdit, ret) {
            ret.writeTxt = "";
            ret.errorMsg = "";
            ret.quitNow=true;
            ret.exitCode=0;
        },
        null,
        function (exitCode, errorMsg) {
            Assert.equal(exitCode, 0);
            Assert.equal("", errorMsg);
            do_test_finished();
        }
    );
}

function shouldSetTrust() {
    do_test_pending();
    EnigmailKeyMgmt.setKeyTrust(window,
        "781617319CE311C4",
        5,
        function (exitCode, errorMsg) {
            Assert.equal(exitCode, 0);
            Assert.equal("", errorMsg);
            do_test_finished();
        }
    );
}

function shouldSignKey() {
    do_test_pending();
    EnigmailKeyMgmt.signKey(window,
        "anonymous strike <strike.devtest@gmail.com>",
        "781617319CE311C4",
        false,
        5,
        function (exitCode, errorMsg) {
            Assert.equal(exitCode, 0);
            //Assert.equal("The key is already signed, you cannot sign it twice.",errorMsg);
            do_test_finished();
        }
    );
}

function importKeyForEdit() {
    Components.utils.import("resource://enigmail/enigmailCore.jsm");
    Components.utils.import("resource://enigmail/enigmailCommon.jsm");
    window = JSUnit.createStubWindow();
    EnigmailCommon.enigmailSvc = initializeEnigmail();
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    var importResult = EnigmailCommon.enigmailSvc.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
}

function initializeEnigmail() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    window = JSUnit.createStubWindow();
    enigmail.initialize(window, "", EnigmailCore.prefBranch);
    return enigmail;
}
