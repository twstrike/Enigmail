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

testing("enigmailErrorHandling.jsm");
test(decryptionFailedWillSetDecryptionFailedFlag);
test(shouldExtractSingleBlockSeparation_test);
test(shouldExtractMutipleBlockSeparation_test);

function decryptionFailedWillSetDecryptionFailedFlag() {
  var context = {};
  decryptionFailed(context);
  Assert.equal(context.inDecryptionFailed, true, "expected decryption failing to set the correct flag in the context");
}

function shouldExtractSingleBlockSeparation_test() {
    var testStatusArray = [
        "BEGIN_DECRYPTION" ,
        "DECRYPTION_INFO 2 9" ,
        "PLAINTEXT 62 1431644287 text.txt" ,
        "PLAINTEXT_LENGTH 15" ,
        "DECRYPTION_FAILED" ,
        "END_DECRYPTION"
    ];

    var context = newContext({},{},{},{});
    context.statusArray=testStatusArray;
    extractBlockSeparation(context);
    Assert.equal(context.retStatusObj.blockSeparation, "1:15 ");
}

function shouldExtractMutipleBlockSeparation_test() {
    var testStatusArray = [
        "FILE_START 3 file1.gpg",
        "ENC_TO D535623BB60E9E71 1 0",
        "USERID_HINT D535623BB60E9E71 anonymous strike <strike.devtest@gmail.com>",
        "NEED_PASSPHRASE D535623BB60E9E71 781617319CE311C4 1 0",
        "GOOD_PASSPHRASE",
        "BEGIN_DECRYPTION",
        "DECRYPTION_INFO 2 9",
        "PLAINTEXT 62 1432677982 test",
        "PLAINTEXT_LENGTH 14",
        "DECRYPTION_OKAY",
        "GOODMDC",
        "END_DECRYPTION",
        "FILE_DONE",
        "FILE_START 3 file0.gpg",
        "ENC_TO D535623BB60E9E71 1 0",
        "GOOD_PASSPHRASE",
        "BEGIN_DECRYPTION",
        "DECRYPTION_INFO 2 9",
        "PLAINTEXT 62 1432677982 test",
        "PLAINTEXT_LENGTH 14",
        "DECRYPTION_OKAY",
        "GOODMDC",
        "END_DECRYPTION",
        "FILE_DONE",
        "PLAINTEXT 62 1432677982 test",
        "PLAINTEXT_LENGTH 15"
    ];

    var context = newContext({},{},{},{});
    context.statusArray=testStatusArray;
    extractBlockSeparation(context);
    Assert.equal(context.retStatusObj.blockSeparation, "1:14 1:14 0:15 ");
}
