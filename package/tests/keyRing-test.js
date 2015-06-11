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

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global withEnigmail: false, withTestGpgHome: false */

testing("keyRing.jsm"); /*global KeyRing: false */

test(withTestGpgHome(withEnigmail(function shouldGetKeyDetails() {
    const publicKey = do_get_file("resources/dev-strike.asc", false);
    const errorMsgObj = {};
    const importedKeysObj = {};
    const importResult = KeyRing.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    Assert.equal(importResult, 0, errorMsgObj);
    const keyDetails = KeyRing.getKeyDetails("0xD535623BB60E9E71", false, true);
    Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
})));

test(withTestGpgHome(withEnigmail(function shouldGetKeyListEntryOfKey() {
    const publicKey = do_get_file("resources/dev-strike.asc", false);
    const importResult = KeyRing.importKeyFromFile(JSUnit.createStubWindow(), publicKey, {}, {});
    const keyDetails = getKeyListEntryOfKey("0xD535623BB60E9E71");
    Assert.equal(keyDetails,
        "pub:-:4096:1:781617319CE311C4:1430756251:1556986651::-:::scESC:\n" +
        "fpr:::::::::65537E212DC19025AD38EDB2781617319CE311C4:\n" +
        "uid:-::::1430756251::DB54FB278F6AE719DE0DE881B17D4C762F5752A9::anonymous strike <strike.devtest@gmail.com>:\n" +
        "sub:-:4096:1:D535623BB60E9E71:1430756251:1556986651:::::e:\n");
})));

test(withTestGpgHome(withEnigmail(function shouldGetUserIdList(){
    const publicKey = do_get_file("resources/dev-strike.asc", false);
    const secretKey = do_get_file("resources/dev-strike.sec", false);
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), publicKey, {}, {});
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), secretKey, {}, {});
    KeyRing.getUserIdList(false, false, {}, {}, {});
    Assert.equal(secretKeyList, null);
    Assert.notEqual(userIdList, null);
    KeyRing.getUserIdList(true, false, {}, {}, {});
    Assert.notEqual(secretKeyList, null);
    Assert.notEqual(userIdList, null);
})));

test(withTestGpgHome(withEnigmail(function shouldCleanupInvalidateUserIdList(){
    const publicKey = do_get_file("resources/dev-strike.asc", false);
    const secretKey = do_get_file("resources/dev-strike.sec", false);
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), publicKey, {}, {});
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), secretKey, {}, {});
    KeyRing.getUserIdList(false, false, {}, {}, {});
    KeyRing.getUserIdList(true, false, {}, {}, {});
    KeyRing.invalidateUserIdList();
    Assert.equal(secretKeyList, null);
    Assert.equal(userIdList, null);
})));
