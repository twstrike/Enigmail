/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
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
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
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

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("encryption.jsm"); /*global Encryption: false, nsIEnigmail: false */
component("enigmail/keyRing.jsm"); /*global KeyRing: fales */
component("enigmail/armor.jsm"); /*global Armor: fales */

test(withTestGpgHome(withEnigmail(function shouldSignMessage() {
    const secretKey = do_get_file("resources/dev-strike.sec", false);
    const errorMsgObj = {};
    const importedKeysObj = {};
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), secretKey, errorMsgObj, importedKeysObj);
    const parentWindow = JSUnit.createStubWindow();
    const plainText = "Hello there!";
    const strikeAccount = "strike.devtest@gmail.com";
    const exitCodeObj = {};
    const statusFlagObj = {};
    const encryptResult = Encryption.encryptMessage(parentWindow,
        nsIEnigmail.UI_TEST,
        plainText,
        strikeAccount,
        strikeAccount,
        "",
        nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED,
        exitCodeObj,
        statusFlagObj,
        errorMsgObj
    );
    Assert.equal(0, exitCodeObj.value);
    Assert.equal(0, errorMsgObj.value);
    Assert.equal(true, (statusFlagObj.value == nsIEnigmail.SIG_CREATED));
    const blockType = Armor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
    Assert.equal("SIGNED MESSAGE", blockType);
})));

test(withTestGpgHome(withEnigmail(function shouldEncryptMessage() {
    const publicKey = do_get_file("resources/dev-strike.asc", false);
    const errorMsgObj = {};
    const importedKeysObj = {};
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    const parentWindow = JSUnit.createStubWindow();
    const plainText = "Hello there!";
    const strikeAccount = "strike.devtest@gmail.com";
    const exitCodeObj = {};
    const statusFlagObj = {};
    const encryptResult = Encryption.encryptMessage(parentWindow,
        nsIEnigmail.UI_TEST,
        plainText,
        strikeAccount,
        strikeAccount,
        "",
        nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_ENCRYPTED | nsIEnigmail.SEND_ALWAYS_TRUST,
        exitCodeObj,
        statusFlagObj,
        errorMsgObj
    );
    Assert.equal(0, exitCodeObj.value);
    Assert.equal(0, errorMsgObj.value);
    Assert.equal(true, (statusFlagObj.value & nsIEnigmail.END_ENCRYPTION) !== 0);
    const blockType = Armor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
    Assert.equal("MESSAGE", blockType);
})));
