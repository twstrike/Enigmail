/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global decryptionFailed: false, newContext: false, detectForgedInsets: false */
/*jshint -W097 */
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

"use strict";

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withTestGpgHome: false */

testing("enigmailErrorHandling.jsm"); /*global EnigmailErrorHandling: false */

test(function decryptionFailedWillSetDecryptionFailedFlag() {
    var context = {};
    decryptionFailed(context);
    Assert.equal(context.inDecryptionFailed, true, "expected decryption failing to set the correct flag in the context");
});

test(function shouldExtractSingleBlockSeparation() {
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
    detectForgedInsets(context);
    Assert.equal(context.retStatusObj.blockSeparation, "1:15 ");
});

test(function shouldExtractMultipleBlockSeparation() {
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
    detectForgedInsets(context);
    Assert.equal(context.retStatusObj.blockSeparation, "1:14 1:14 0:15 ");
});

test(function shouldHandleNoDataErrors() {
    const errorOutput = "gpg: no valid OpenPGP data found.\n" +
            "[GNUPG:] NODATA 1\n" +
            "[GNUPG:] NODATA 2\n" +
            "gpg: decrypt_message failed: Unknown system error\n";

    const result = EnigmailErrorHandling.parseErrorOutput(errorOutput, {});

    Assert.assertContains(result, "no valid OpenPGP data found");
});

test(function shouldHandleErrorOutput() {
    const errorOutput = "[GNUPG:] USERID_HINT 781617319CE311C4 anonymous strike <strike.devtest@gmail.com>\n" +
              "[GNUPG:] NEED_PASSPHRASE 781617319CE311C4 781617319CE311C4 1 0\n" +
              "gpg-agent[14654]: command get_passphrase failed: Operation cancelled\n" +
              "gpg: cancelled by user\n" +
              "[GNUPG:] MISSING_PASSPHRASE\n" +
              "gpg: skipped \"<strike.devtest@gmail.com>\": Operation cancelled\n" +
              "[GNUPG:] INV_SGNR 0 <strike.devtest@gmail.com>\n" +
              "gpg: [stdin]: clearsign failed: Operation cancelled\n";
    const retStatusObj = {};
    EnigmailErrorHandling.parseErrorOutput(errorOutput, retStatusObj);
    Assert.assertContains(retStatusObj.statusMsg,"Missing Passphrase");
    Assert.equal(retStatusObj.extendedStatus, "");
});

test(function shouldHandleFailedEncryption() {
    const errorOutput = "gpg: encrypted with 4096-bit RSA key, ID B60E9E71, created 2015-05-04\n" +
              "\"anonymous strike <strike.devtest@gmail.com>\"\n" +
              "[GNUPG:] BEGIN_DECRYPTION\n" +
              "[GNUPG:] DECRYPTION_INFO 2 9\n" +
              "[GNUPG:] PLAINTEXT 62 1431644287 text.txt\n" +
              "[GNUPG:] PLAINTEXT_LENGTH 15\n" +
              "File `textd.txt' exists. Overwrite? (y/N) y\n" +
              "gpg: mdc_packet with invalid encoding\n" +
              "[GNUPG:] DECRYPTION_FAILED\n" +
              "gpg: decryption failed: Invalid packet\n" +
              "[GNUPG:] END_DECRYPTION";

    const result = EnigmailErrorHandling.parseErrorOutput(errorOutput, {});
    Assert.assertContains(result, "decryption failed: Invalid packet");
});

test(withTestGpgHome(function shouldHandleSuccessfulImport() {
    const errorOutput = "gpg: key 9CE311C4: public key \"anonymous strike <strike.devtest@gmail.com>\" imported\n" +
              "[GNUPG:] IMPORTED 781617319CE311C4 anonymous strike <strike.devtest@gmail.com>\n" +
              "[GNUPG:] IMPORT_OK 1 65537E212DC19025AD38EDB2781617319CE311C4\n" +
              "gpg: key 9CE311C4: secret key imported\n" +
              "[GNUPG:] IMPORT_OK 17 65537E212DC19025AD38EDB2781617319CE311C4\n" +
              "[GNUPG:] IMPORT_OK 0 65537E212DC19025AD38EDB2781617319CE311C4\n" +
              "gpg: key 9CE311C4: \"anonymous strike <strike.devtest@gmail.com>\" not changed\n" +
              "gpg: Total number processed: 2\n" +
              "gpg:               imported: 1  (RSA: 1)\n" +
              "gpg:              unchanged: 1\n" +
              "gpg:       secret keys read: 1\n" +
              "gpg:   secret keys imported: 1\n" +
              "[GNUPG:] IMPORT_RES 2 0 1 1 1 0 0 0 0 1 1 0 0 0";

    const result = EnigmailErrorHandling.parseErrorOutput(errorOutput, {});
    Assert.assertContains(result, "secret key imported");
}));

test(function shouldHandleUnverifiedSignature() {
    const errorOutput = "gpg: B60E9E71: There is no assurance this key belongs to the named user\n" +
              "\n" +
              "pub  4096R/B60E9E71 2015-05-04 anonymous strike <strike.devtest@gmail.com>\n" +
              " Primary key fingerprint: 6553 7E21 2DC1 9025 AD38  EDB2 7816 1731 9CE3 11C4\n" +
              "      Subkey fingerprint: D093 CD82 3BE1 3BD3 81EE  FF7A D535 623B B60E 9E71\n" +
              "\n" +
              "It is NOT certain that the key belongs to the person named\n" +
              "in the user ID.  If you *really* know what you are doing,\n" +
              "you may answer the next question with yes.\n" +
              "\n" +
              "[GNUPG:] USERID_HINT D535623BB60E9E71 anonymous strike <strike.devtest@gmail.com>\n" +
              "Use this key anyway? (y/N) y";

    const result = EnigmailErrorHandling.parseErrorOutput(errorOutput, {});

    Assert.assertContains(result, "Use this key anyway");
});

test(function shouldHandleEncryptionFailedNoPublicKey() {
    const errorOutput = "gpg: iapazmino@thoughtworks.com: skipped: No public key\n" +
              "[GNUPG:] INV_RECP 0 iapazmino@thoughtworks.com\n" +
              "gpg: salida3.xtxt: encryption failed: No public key";

    const result = EnigmailErrorHandling.parseErrorOutput(errorOutput, {});

    Assert.assertContains(result, "No public key");
});

test(function shouldHandleErrors() {
    const errorOutput = "gpg: problem with the agent: Invalid IPC response \n" +
              "gpg: /dev/fd/5:0: key generation canceled\n" +
              "\n" +
              "Status text: [GNUPG:] NEED_PASSPHRASE_SYM 3 3 2 \n" +
              "[GNUPG:] ERROR get_passphrase 260 \n" +
              "[GNUPG:] MISSING_PASSPHRASE \n" +
              "[GNUPG:] KEY_NOT_CREATED";

    const result = EnigmailErrorHandling.parseErrorOutput(errorOutput, {});

    Assert.assertContains(result, "Invalid IPC response");
});
