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

testing("decryption.jsm"); /*global Decryption: false, nsIEnigmail: false */
component("enigmail/keyRing.jsm"); /*global KeyRing: fales */
component("enigmail/armor.jsm"); /*global Armor: fales */

test(withTestGpgHome(withEnigmail(function shouldDecryptMessage() {
    const secretKey = do_get_file("resources/dev-strike.sec", false);
    const importedKeysObj = {};
    KeyRing.importKeyFromFile(JSUnit.createStubWindow(), secretKey, {}, importedKeysObj);
    var encryptResult = "-----BEGIN PGP MESSAGE-----\n"+
        "Version: GnuPG v2.0.22 (GNU/Linux)\n"+
        "\n"+
        "hQIMA9U1Yju2Dp5xAQ//eeoS38nAWPdJslfVaEuUhthZk4WxAua97+JNGX9vDiae\n"+
        "jKJbjmQ5T2Sl2wvSqwjEIKzzjRAzr6SYuL9xaRkt3/BbMpSm/aSjc/cWNgcKtbHt\n"+
        "u8u9Ha016XZke3/EpjLqMcXmK1eT9oa+UqR8u+B3ggOjz5BrjW+FMR+zfyiWv1cb\n"+
        "6U4KO0YHuOq7G0lO4i3ro0ckhzZqCBLfCiQSfnF8R7p/KfQdUFBIdB41OALP0q4x\n"+
        "UD+CNWhbIjyhfE0VX5KUn/5S5Se31VjKjfeo+5fN8HRUVQYu8uj2F+gPvALF5KKW\n"+
        "an63O3IcUvZo6yOSoMjkMVJBHZRY6An2if+GXm330yQD3CDaonuihR+e+k6sd0kj\n"+
        "hpwQs+4/uE96slRMqQMx573krc/p/WUWwG5qexOvwxzcqEdE5LYPEMKdH1fUX3tC\n"+
        "kktNpSU8gJqluTk6cvtjCfMSwcEyKFmM13/RoitAw22DVOdLlcTHxbaNsIoxeRk/\n"+
        "rxpsraIEs2H4uyF19K1nLioGkyubeUKPnBTB6qAwp0ZhZ1RleMwHRTFQU+jpbi51\n"+
        "t87E+JI0UuLd14pDb7YJUKenHvAqa1jHAZKEfa2XFMfT/1MZzohlwjNpcPhYFWeB\n"+
        "zq3cg/m/J5sb+FpdD42nfYnLsSYu7CwcTX8MU2vrSwHyHnmux6SjDXGrAaddWsrS\n"+
            "RwGvjZsiFW/E82l2eMj5Zpm6HXY8kZx9TBSbWLSgU44nBhDvX1MrIGdd+rmYT2xt\n"+
            "j4KAKpyV51VzmJUOqHrb7bPv70ncMx0w\n"+
            "=uadZ\n"+
            "-----END PGP MESSAGE-----\n\n";

    const parentWindow = JSUnit.createStubWindow();
    const exitCodeObj = {};
    const statusFlagObj = {};
    const errorMsgObj = {};
    const decryptResult = Decryption.decryptMessage(parentWindow,
                                                  nsIEnigmail.UI_TEST,
                                                  encryptResult,
                                                  {},
                                                  exitCodeObj,
                                                  statusFlagObj,
                                                  {},
                                                  {},
                                                  {},
                                                  errorMsgObj,
                                                  {},
                                                  {},
                                                  "STRIKEfreedom@Qu1to"
                                                 );
    Assert.equal(0, exitCodeObj.value);
    Assert.equal(0, errorMsgObj.value);
    Assert.equal("Hello there!", decryptResult);
    Assert.equal(true, (statusFlagObj.value & (nsIEnigmail.DISPLAY_MESSAGE | nsIEnigmail.DECRYPTION_OKAY)) !== 0);
    const blockType = Armor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
    Assert.equal("MESSAGE", blockType);
})));
