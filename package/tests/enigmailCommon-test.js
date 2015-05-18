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

function run_test() { var md = do_get_cwd().parent;
    md.append("enigmailCommon.jsm");
    do_load_module("file://" + md.path);
    shouldHandleNoDataErrors_test();
    shouldHandleErrorOutput_test();
    shouldHandleFailedEncryption_test();
    shouldHandleSuccessfulImport_test();
    shouldHandleUnverifiedSignature_test();
}

function shouldHandleNoDataErrors_test() {
  var errorOutput = "gpg: no valid OpenPGP data found.\n" +
    "[GNUPG:] NODATA 1\n" +
    "[GNUPG:] NODATA 2\n" +
    "gpg: decrypt_message failed: Unknown system error\n";

  var result = EnigmailCommon.parseErrorOutput(errorOutput, response = {});

  Assert.assertContains(result, "no valid OpenPGP data found");
}

function shouldHandleErrorOutput_test() {
    var errorOutput = "[GNUPG:] USERID_HINT 781617319CE311C4 anonymous strike <strike.devtest@gmail.com>\n" +
        "[GNUPG:] NEED_PASSPHRASE 781617319CE311C4 781617319CE311C4 1 0\n" +
        "gpg-agent[14654]: command get_passphrase failed: Operation cancelled\n" +
        "gpg: cancelled by user\n" +
        "[GNUPG:] MISSING_PASSPHRASE\n" +
        "gpg: skipped \"<strike.devtest@gmail.com>\": Operation cancelled\n" +
        "[GNUPG:] INV_SGNR 0 <strike.devtest@gmail.com>\n" +
        "gpg: [stdin]: clearsign failed: Operation cancelled\n";

    EnigmailCommon.parseErrorOutput(errorOutput, retStatusObj = {});
    Assert.assertContains(retStatusObj.statusMsg,"Missing Passphrase");
    Assert.equal(retStatusObj.extendedStatus, "");
}

function shouldHandleFailedEncryption_test() {
     var errorOutput = "gpg: encrypted with 4096-bit RSA key, ID B60E9E71, created 2015-05-04\n" +
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

     var result = EnigmailCommon.parseErrorOutput(errorOutput, status = {});

     Assert.assertContains(result, "decryption failed: Invalid packet");
}

function shouldHandleSuccessfulImport_test() {
     var errorOutput = "gpg: key 9CE311C4: public key \"anonymous strike <strike.devtest@gmail.com>\" imported\n" +
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

     EnigmailCommon.enigmailSvc = initializeEnigmail();
     var result = EnigmailCommon.parseErrorOutput(errorOutput, status = {});

     Assert.assertContains(result, "secret key imported");
}

function shouldHandleUnverifiedSignature_test() {
    var errorOutput = "gpg: B60E9E71: There is no assurance this key belongs to the named user\n" +
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

     EnigmailCommon.enigmailSvc = initializeEnigmail();
     var result = EnigmailCommon.parseErrorOutput(errorOutput, status = {});

     Assert.assertContains(result, "Use this key anyway");
}

function initializeEnigmail() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    window = JSUnit.createStubWindow();
    enigmail.initialize(window, "", EnigmailCore.prefBranch);
    return enigmail;
}

Assert.assertContains = function(actual, expected, message) {
    var msg = message || "Searching for <".concat(expected)
      .concat("> to be contained within ")
      .concat("<").concat(actual).concat(">");
    Assert.equal(actual.search(expected) > -1, true, msg);
};
