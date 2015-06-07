/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global EnigmailCore: false, Enigmail: false, EnigmailCommon: false, component: false, Cc: false, Ci: false, withEnvironment: false, nsIEnigmail: false, nsIEnvironment: false, Ec: false, Prefs: false, OS: false, Armor: false, EnigmailKeyMgmt: false */
/*jshint -W120 */
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

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("enigmail.js");
component("enigmail/enigmailCommon.jsm");
component("enigmail/prefs.jsm");
component("enigmail/os.jsm");
component("enigmail/armor.jsm");
component("enigmail/keyManagement.jsm");

test(shouldLocateArmoredBlock);
test(shouldExtractSignaturePart);
test(shouldGetKeyDetails);
test(shouldSignMessage);
test(shouldEncryptMessage);
test(shouldDecryptMessage);

function initializeService(enigmail) {
    var window = JSUnit.createStubWindow();
    enigmail.initialize(window, "", Prefs.getPrefBranch());
    return enigmail;
}

function shouldLocateArmoredBlock() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initializeService(enigmail);
    var text = "" +
            "    -----BEGIN PGP SIGNATURE-----\n" +
            "    Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n" +
            "    Comment: GPGTools - https://gpgtools.org\n" +
            "\n" +
            "    iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n" +
            "    6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n" +
            "    R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n" +
            "    95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n" +
            "    xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n" +
            "    9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n" +
            "    4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n" +
            "    yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n" +
            "    j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n" +
            "    kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n" +
            "    P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n" +
            "    o29CFuiGhiz3ISDRKrtH\n" +
            "    =MeaY\n" +
            "    -----END PGP SIGNATURE-----";
    var beginIndexObj = {};
    var endIndexObj = {};
    var indentStrObj = {};
    var indentStr = "";
    var blockType = Armor.locateArmoredBlock(text, 0, indentStr, beginIndexObj, endIndexObj, indentStrObj);
    Assert.equal(0, beginIndexObj.value);
    Assert.equal("    ", indentStrObj.value);
    Assert.equal("SIGNATURE", blockType);
}

function shouldExtractSignaturePart() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initializeService(enigmail);
    const signature = {
        text: "Hello I'm here.\n please contact me via this email! \n",
        header: "Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n" +
            "Comment: GPGTools - https://gpgtools.org\n",
        armor: "iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n" +
            "6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n" +
            "R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n" +
            "95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n" +
            "xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n" +
            "9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n" +
            "4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n" +
            "yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n" +
            "j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n" +
            "kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n" +
            "P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n" +
            "o29CFuiGhiz3ISDRKrtH\n" +
            "=MeaY"
    };
    var signature_block = "\n\n" +
            signature.text +
            "-----BEGIN PGP SIGNATURE-----\n" +
            signature.header +
            "\n" +
            signature.armor +
            "\n" +
            "-----END PGP SIGNATURE-----";

    var signature_text = Armor.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_TEXT);
    var signature_headers = Armor.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_HEADERS);
    var signature_armor = Armor.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_ARMOR);
    Assert.equal(signature.text, signature_text);
    Assert.equal(signature.header, signature_headers);
    Assert.equal(signature.armor.replace(/\s*/g, ""), signature_armor);
}

function shouldGetKeyDetails() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initializeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    var importResult = EnigmailKeyMgmt.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    Assert.equal(importResult, 0, errorMsgObj);
    var keyDetails = enigmail.getKeyDetails("0xD535623BB60E9E71", false, true);
    Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
}

function shouldSignMessage() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initializeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    EnigmailKeyMgmt.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    var parentWindow = JSUnit.createStubWindow();
    var plainText = "Hello there!";
    var strikeAccount = "strike.devtest@gmail.com";
    var exitCodeObj = {};
    var statusFlagObj = {};
    var encryptResult = enigmail.encryptMessage(parentWindow,
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
    var blockType = Armor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
    Assert.equal("SIGNED MESSAGE", blockType);
}

function shouldEncryptMessage() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initializeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    EnigmailKeyMgmt.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    var parentWindow = JSUnit.createStubWindow();
    var plainText = "Hello there!";
    var strikeAccount = "strike.devtest@gmail.com";
    var exitCodeObj = {};
    var statusFlagObj = {};
    var encryptResult = enigmail.encryptMessage(parentWindow,
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
    Assert.equal(true, (statusFlagObj.value == nsIEnigmail.END_ENCRYPTION));
    var blockType = Armor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
    Assert.equal("MESSAGE", blockType);
}

function shouldDecryptMessage() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initializeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    EnigmailKeyMgmt.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
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

    var parentWindow = JSUnit.createStubWindow();
    var exitCodeObj = {};
    var statusFlagObj = {};
    var decryptResult = enigmail.decryptMessage(parentWindow,
                                                nsIEnigmail.UI_TEST,
                                                encryptResult,
                                                {},
                                                exitCodeObj,
                                                statusFlagObj,
                                                {},
                                                {},
                                                {},
                                                errorMsgObj = {},
                                                {},
                                                {},
                                                "STRIKEfreedom@Qu1to"
                                               );
    Assert.equal(0, exitCodeObj.value);
    Assert.equal(0, errorMsgObj.value);
    Assert.equal("Hello there!", decryptResult);
    Assert.equal(true, (statusFlagObj.value == (nsIEnigmail.DISPLAY_MESSAGE | nsIEnigmail.DECRYPTION_OKAY)));
    var blockType = Armor.locateArmoredBlock(encryptResult, 0, "", {}, {}, {});
    Assert.equal("MESSAGE", blockType);
}

function newEnigmail(f) {
    var oldEnigmail = EnigmailCore.getEnigmailService();
    try {
        var enigmail = new Enigmail();
        EnigmailCore.setEnigmailService(enigmail);
        f(enigmail);
    } finally {
        EnigmailCore.setEnigmailService(oldEnigmail);
    }
}


// testing: initialize
test(function initializeWillPassEnvironmentIfAskedTo() {
    var window = JSUnit.createStubWindow();
    withEnvironment({
        "ENIGMAIL_PASS_ENV": "STUFF:BLARG",
        "STUFF": "testing"
    }, function() {
        newEnigmail(function(enigmail) {
            enigmail.initialize(window, "", Prefs.getPrefBranch());
            Assert.assertArrayContains(EnigmailCommon.envList, "STUFF=testing");
        });
    });
});

test(function initializeWillNotPassEnvironmentsNotAskedTo() {
    var window = JSUnit.createStubWindow();
    var environment = Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
    environment.set("ENIGMAIL_PASS_ENV", "HOME");
    environment.set("STUFF", "testing");
    newEnigmail(function(enigmail) {
        enigmail.initialize(window, "", Prefs.getPrefBranch());
        Assert.assertArrayNotContains(EnigmailCommon.envList, "STUFF=testing");
    });
});

test(function initializeWillNotSetEmptyEnvironmentValue() {
    var window = JSUnit.createStubWindow();
    var environment = Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
    environment.set("APPDATA", "");
    newEnigmail(function(enigmail) {
        enigmail.initialize(window, "", Prefs.getPrefBranch());
        Assert.assertArrayNotContains(EnigmailCommon.envList, "APPDATA=");
    });
});

// testing: useGpgAgent
// useGpgAgent depends on several values:
//   OS.isDosLike()
//   EnigmailCommon.getGpgFeature("supports-gpg-agent")
//   EnigmailCommon.getGpgFeature("autostart-gpg-agent")
//   this.gpgAgentInfo.envStr.length>0
//   Prefs.getPrefBranch().getBoolPref("useGpgAgent")

function asDosLike(f) {
    resetting(OS, 'isDosLikeVal', true, f);
}

function notDosLike(f) {
    resetting(OS, 'isDosLikeVal', false, f);
}

function withGpgFeatures(features, f) {
    resetting(EnigmailCommon, 'getGpgFeature', function(feature) {
        return features.indexOf(feature) != -1;
    }, f);
}

function mockPrefs(prefs) {
    return {
        getBoolPref: function(name) { return prefs[name]; }
    };
}

test(function useGpgAgentIsFalseIfIsDosLikeAndDoesntSupportAgent() {
    asDosLike(function() {
        withGpgFeatures([], function() {
            newEnigmail(function(enigmail) {
                Assert.ok(!enigmail.useGpgAgent());
            });
        });
    });
});

test(function useGpgAgentIsTrueIfIsDosLikeAndSupportsAgentAndAutostartsAgent() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent", "autostart-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                Assert.ok(enigmail.useGpgAgent());
            });
        });
    });
});

test(function useGpgAgentIsTrueIfIsDosLikeAndSupportsAgentAndThereExistsAnAgentString() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                enigmail.gpgAgentInfo.envStr = "blarg";
                Assert.ok(enigmail.useGpgAgent());
            });
        });
    });
});

test(function useGpgAgentIsFalseIfIsDosLikeAndSupportsAgentButNoAgentInfoAvailable() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                enigmail.gpgAgentInfo.envStr = "";
                Assert.ok(!enigmail.useGpgAgent());
            });
        });
    });
});

test(function useGpgAgentIsTrueIfIsDosLikeAndSupportsAgentAndPrefIsSet() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                enigmail.prefBranch = mockPrefs({useGpgAgent: true});
                Assert.ok(enigmail.useGpgAgent());
            });
        });
    });
});


test(function useGpgAgentIsTrueIfNotDosLikeAndSupportsAgentAndAutostartsAgent() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent", "autostart-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                Assert.ok(enigmail.useGpgAgent());
            });
        });
    });
});

test(function useGpgAgentIsTrueIfNotDosLikeAndSupportsAgentAndThereExistsAnAgentString() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                enigmail.gpgAgentInfo.envStr = "blarg";
                Assert.ok(enigmail.useGpgAgent());
            });
        });
    });
});

test(function useGpgAgentIsFalseIfNotDosLikeAndSupportsAgentButNoAgentInfoAvailable() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                enigmail.gpgAgentInfo.envStr = "";
                Assert.ok(!enigmail.useGpgAgent());
            });
        });
    });
});

test(function useGpgAgentIsTrueIfNotDosLikeAndSupportsAgentAndPrefIsSet() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                enigmail.prefBranch = mockPrefs({useGpgAgent: true});
                Assert.ok(enigmail.useGpgAgent());
            });
        });
    });
});

// setAgentPath

test(function setAgentPathDefaultValues() {
    withEnvironment({}, function(e) {
        newEnigmail(function(enigmail) {
            enigmail.environment = e;
            enigmail.setAgentPath(JSUnit.createStubWindow());
            Assert.equal("gpg", enigmail.agentType);
            Assert.equal("/usr/bin/gpg2", enigmail.agentPath.path);
            //        Assert.equal("2.0.22", enigmail.agentVersion); // this will vary between environments.
            Assert.equal("/usr/bin/gpgconf", enigmail.gpgconfPath.path);
            Assert.equal("/usr/bin/gpg-connect-agent", enigmail.connGpgAgentPath.path);
        });
    });
});

// resolveToolPath

test(function resolveToolPathDefaultValues() {
    withEnvironment({}, function(e) {
        newEnigmail(function(enigmail) {
            enigmail.environment = e;
            enigmail.agentPath = "/usr/bin/gpg-agent";
            var result = enigmail.resolveToolPath("zip");
            Assert.equal("/usr/bin/zip", result.path);
        });
    });
});

test(function resolveToolPathFromPATH() {
    withEnvironment({PATH: "/sbin"}, function(e) {
        newEnigmail(function(enigmail) {
            enigmail.environment = e;
            enigmail.agentPath = null;
            var result = enigmail.resolveToolPath("route");
            Assert.equal("/sbin/route", result.path);
        });
    });
});

// detectGpgAgent
test(function detectGpgAgentSetsAgentInfoFromEnvironmentVariable() {
    withEnvironment({GPG_AGENT_INFO: "a happy agent"}, function(e) {
        newEnigmail(function(enigmail) {
            enigmail.environment = e;
            enigmail.detectGpgAgent(JSUnit.createStubWindow());

            Assert.ok(enigmail.gpgAgentInfo.preStarted);
            Assert.equal("a happy agent", enigmail.gpgAgentInfo.envStr);
            Assert.ok(!Ec.gpgAgentIsOptional);
        });
    });
});

test(function detectGpgAgentWithNoAgentInfoInEnvironment() {
    withEnvironment({}, function(e) {
        newEnigmail(function(enigmail) {
            enigmail.environment = e;
            enigmail.detectGpgAgent(JSUnit.createStubWindow());

            Assert.ok(!enigmail.gpgAgentInfo.preStarted);
            Assert.ok(!Ec.gpgAgentIsOptional);
        });
    });
});

test(function detectGpgAgentWithAutostartFeatureWillDoNothing() {
    withEnvironment({}, function(e) {
        withGpgFeatures(["autostart-gpg-agent"], function() {
            newEnigmail(function(enigmail) {
                enigmail.environment = e;
                enigmail.detectGpgAgent(JSUnit.createStubWindow());
                Assert.equal("none", enigmail.gpgAgentInfo.envStr);
            });
        });
    });
});
