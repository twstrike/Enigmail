/*global do_load_module do_get_cwd do_get_file testing test Assert component JSUnit Cc resetting EnigmailCore Enigmail gEnigmailSvc EnigmailCommon */
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

testing("enigmail.js");
component("enigmail/enigmailCommon.jsm");

test(shouldLocateArmoredBlock);
test(shouldExtractSignaturePart);
test(shouldGetKeyDetails);
test(shouldSignMessage);
test(shouldEncryptMessage);
test(shouldDecryptMessage);

function initalizeService(enigmail) {
    window = JSUnit.createStubWindow();
    enigmail.initialize(window, "", EnigmailCore.prefBranch);
    return enigmail;
}

function shouldLocateArmoredBlock() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    var text = ""
        + "    -----BEGIN PGP SIGNATURE-----\n"
        + "    Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n"
        + "    Comment: GPGTools - https://gpgtools.org\n"
        + "\n"
        + "    iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n"
        + "    6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n"
        + "    R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n"
        + "    95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n"
        + "    xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n"
        + "    9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n"
        + "    4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n"
        + "    yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n"
        + "    j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n"
        + "    kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n"
        + "    P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n"
        + "    o29CFuiGhiz3ISDRKrtH\n"
        + "    =MeaY\n"
        + "    -----END PGP SIGNATURE-----";
    var beginIndexObj = {};
    var endIndexObj = {};
    var indentStrObj = {};
    var indentStr = "";
    var blockType = enigmail.locateArmoredBlock(text, 0, indentStr, beginIndexObj, endIndexObj, indentStrObj);
    Assert.equal(0, beginIndexObj.value);
    Assert.equal("    ", indentStrObj.value);
    Assert.equal("SIGNATURE", blockType);
}

function shouldExtractSignaturePart() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    const signature = {
        text: "Hello I'm here.\n please contact me via this email! \n",
        header: "Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n"
        + "Comment: GPGTools - https://gpgtools.org\n",
        armor: "iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n"
        + "6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n"
        + "R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n"
        + "95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n"
        + "xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n"
        + "9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n"
        + "4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n"
        + "yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n"
        + "j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n"
        + "kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n"
        + "P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n"
        + "o29CFuiGhiz3ISDRKrtH\n"
        + "=MeaY"
    };
    var signature_block = "\n\n"
        + signature.text
        + "-----BEGIN PGP SIGNATURE-----\n"
        + signature.header
        + "\n"
        + signature.armor
        + "\n"
        + "-----END PGP SIGNATURE-----";

    var signature_text = enigmail.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_TEXT);
    var signature_headers = enigmail.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_HEADERS);
    var signature_armor = enigmail.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_ARMOR);
    Assert.equal(signature.text, signature_text);
    Assert.equal(signature.header, signature_headers);
    Assert.equal(signature.armor.replace(/\s*/g, ""), signature_armor);
}

function shouldGetKeyDetails() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    var importResult = enigmail.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    Assert.equal(importResult, 0, errorMsgObj);
    var keyDetails = enigmail.getKeyDetails("0xD535623BB60E9E71", false, true);
    Assert.assertContains(keyDetails, "strike.devtest@gmail.com");
}

function shouldSignMessage() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    enigmail.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    var parentWindow = JSUnit.createStubWindow();
    var plainText = "Hello there!";
    var strikeAccount = "strike.devtest@gmail.com";
    var encryptResult = enigmail.encryptMessage(parentWindow,
        nsIEnigmail.UI_TEST,
        plainText,
        strikeAccount,
        strikeAccount,
        "",
        nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED,
        exitCodeObj = {},
        statusFlagObj = {},
        errorMsgObj = {},
        passphrase = "STRIKEfreedom@Qu1to"
    );
    Assert.equal(0, exitCodeObj.value);
    Assert.equal(0, errorMsgObj.value);
    Assert.equal(true, (statusFlagObj.value == nsIEnigmail.SIG_CREATED));
    var blockType = enigmail.locateArmoredBlock(encryptResult, 0, indentStr = "", beginIndexObj = {}, endIndexObj = {}, indentStrObj = {});
    Assert.equal("SIGNED MESSAGE", blockType);
}

function shouldEncryptMessage() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    enigmail.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    var parentWindow = JSUnit.createStubWindow();
    var plainText = "Hello there!";
    var strikeAccount = "strike.devtest@gmail.com";
    var encryptResult = enigmail.encryptMessage(parentWindow,
        nsIEnigmail.UI_TEST,
        plainText,
        strikeAccount,
        strikeAccount,
        "",
        nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_ENCRYPTED | nsIEnigmail.SEND_ALWAYS_TRUST,
        exitCodeObj = {},
        statusFlagObj = {},
        errorMsgObj = {},
        passphrase = "STRIKEfreedom@Qu1to"
    );
    Assert.equal(0, exitCodeObj.value);
    Assert.equal(0, errorMsgObj.value);
    Assert.equal(true, (statusFlagObj.value == nsIEnigmail.END_ENCRYPTION));
    var blockType = enigmail.locateArmoredBlock(encryptResult, 0, indentStr = "", beginIndexObj = {}, endIndexObj = {}, indentStrObj = {});
    Assert.equal("MESSAGE", blockType);
}

function shouldDecryptMessage() {
    var enigmail = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
    enigmail = initalizeService(enigmail);
    var publicKey = do_get_file("resources/dev-strike.asc", false);
    var errorMsgObj = {};
    var importedKeysObj = {};
    enigmail.importKeyFromFile(JSUnit.createStubWindow(), publicKey, errorMsgObj, importedKeysObj);
    encryptResult = "-----BEGIN PGP MESSAGE-----\n"+
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
    var decryptResult = enigmail.decryptMessage(parentWindow,
        nsIEnigmail.UI_TEST,
        encryptResult,
        signatureObj = {},
        exitCodeObj = {},
        statusFlagObj = {},
        keyIdObj = {},
        userIdObj = {},
        sigDetailsObj = {},
        errorMsgObj = {},
        blockSeparationObj = {},
        encToDetailsObj = {},
        passphrase = "STRIKEfreedom@Qu1to"
    );
    Assert.equal(0, exitCodeObj.value);
    Assert.equal(0, errorMsgObj.value);
    Assert.equal("Hello there!", decryptResult);
    Assert.equal(true, (statusFlagObj.value == (nsIEnigmail.DISPLAY_MESSAGE | nsIEnigmail.DECRYPTION_OKAY)));
    var blockType = enigmail.locateArmoredBlock(encryptResult, 0, indentStr = "", beginIndexObj = {}, endIndexObj = {}, indentStrObj = {});
    Assert.equal("MESSAGE", blockType);
}

// testing: readFile
test(function readFileReturnsContentOfExistingFile() {
    var md = do_get_cwd().clone();
    md.append("..");
    md.append("..");
    md.append("uuid_enig.txt");
    var result = readFile(md);
    Assert.assertContains(result, "847b3a00-7ab1-11d4-8f02-006008948af5");
});

test(function readFileReturnsEmptyStringForNonExistingFile() {
    var md = do_get_cwd().clone();
    md.append("..");
    md.append("..");
    md.append("THIS_FILE_DOESNT_EXIST");
    var result = readFile(md);
    Assert.equal("", result);
});

// testing: initialize
test(function initializeWillPassEnvironmentIfAskedTo() {
    var window = JSUnit.createStubWindow();
    withEnvironment({
        "ENIGMAIL_PASS_ENV": "STUFF:BLARG",
        "STUFF": "testing"
    }, function() {
        var enigmail = gEnigmailSvc = new Enigmail();
        enigmail.initialize(window, "", EnigmailCore.prefBranch);
        Assert.assertArrayContains(EnigmailCommon.envList, "STUFF=testing");
    });
});

test(function initializeWillNotPassEnvironmentsNotAskedTo() {
    var window = JSUnit.createStubWindow();
    var environment = Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
    environment.set("ENIGMAIL_PASS_ENV", "HOME");
    environment.set("STUFF", "testing");
    var enigmail = gEnigmailSvc = new Enigmail();
    enigmail.initialize(window, "", EnigmailCore.prefBranch);
    Assert.assertArrayNotContains(EnigmailCommon.envList, "STUFF=testing");
});

test(function initializeWillNotSetEmptyEnvironmentValue() {
    var window = JSUnit.createStubWindow();
    var environment = Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);
    environment.set("APPDATA", "");
    var enigmail = gEnigmailSvc = new Enigmail();
    enigmail.initialize(window, "", EnigmailCore.prefBranch);
    Assert.assertArrayNotContains(EnigmailCommon.envList, "APPDATA=");
});

// testing: useGpgAgent
// useGpgAgent depends on several values:
//   EnigmailCore.isDosLike()
//   EnigmailCommon.getGpgFeature("supports-gpg-agent")
//   EnigmailCommon.getGpgFeature("autostart-gpg-agent")
//   this.gpgAgentInfo.envStr.length>0
//   this.prefBranch.getBoolPref("useGpgAgent")

function asDosLike(f) {
    resetting(EnigmailCore, 'isDosLikeVal', true, f);
};

function notDosLike(f) {
    resetting(EnigmailCore, 'isDosLikeVal', false, f);
};

function withGpgFeatures(features, f) {
    resetting(EnigmailCommon, 'getGpgFeature', function(feature) {
        return features.indexOf(feature) != -1;
    }, f);
};

function mockPrefs(prefs) {
    return {
        getBoolPref: function(name) { return prefs[name]; }
    };
}

test(function useGpgAgentIsFalseIfIsDosLikeAndDoesntSupportAgent() {
    asDosLike(function() {
        withGpgFeatures([], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            Assert.ok(!enigmail.useGpgAgent());
        });
    });
});

test(function useGpgAgentIsTrueIfIsDosLikeAndSupportsAgentAndAutostartsAgent() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent", "autostart-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            Assert.ok(enigmail.useGpgAgent());
        });
    });
});

test(function useGpgAgentIsTrueIfIsDosLikeAndSupportsAgentAndThereExistsAnAgentString() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            enigmail.gpgAgentInfo.envStr = "blarg";
            Assert.ok(enigmail.useGpgAgent());
        });
    });
});

test(function useGpgAgentIsFalseIfIsDosLikeAndSupportsAgentButNoAgentInfoAvailable() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            enigmail.gpgAgentInfo.envStr = "";
            Assert.ok(!enigmail.useGpgAgent());
        });
    });
});

test(function useGpgAgentIsTrueIfIsDosLikeAndSupportsAgentAndPrefIsSet() {
    asDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            enigmail.prefBranch = mockPrefs({useGpgAgent: true});
            Assert.ok(enigmail.useGpgAgent());
        });
    });
});


test(function useGpgAgentIsTrueIfNotDosLikeAndSupportsAgentAndAutostartsAgent() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent", "autostart-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            Assert.ok(enigmail.useGpgAgent());
        });
    });
});

test(function useGpgAgentIsTrueIfNotDosLikeAndSupportsAgentAndThereExistsAnAgentString() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            enigmail.gpgAgentInfo.envStr = "blarg";
            Assert.ok(enigmail.useGpgAgent());
        });
    });
});

test(function useGpgAgentIsFalseIfNotDosLikeAndSupportsAgentButNoAgentInfoAvailable() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            enigmail.gpgAgentInfo.envStr = "";
            Assert.ok(!enigmail.useGpgAgent());
        });
    });
});

test(function useGpgAgentIsTrueIfNotDosLikeAndSupportsAgentAndPrefIsSet() {
    notDosLike(function() {
        withGpgFeatures(["supports-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            enigmail.prefBranch = mockPrefs({useGpgAgent: true});
            Assert.ok(enigmail.useGpgAgent());
        });
    });
});

// setAgentPath

test(function setAgentPathDefaultValues() {
    withEnvironment({}, function(e) {
        var enigmail = gEnigmailSvc = new Enigmail();
        enigmail.environment = e;
        enigmail.setAgentPath(JSUnit.createStubWindow());
        Assert.equal("gpg", enigmail.agentType);
        Assert.equal("/usr/bin/gpg2", enigmail.agentPath.path);
//        Assert.equal("2.0.22", enigmail.agentVersion); // this will vary between environments.
        Assert.equal("/usr/bin/gpgconf", enigmail.gpgconfPath.path);
        Assert.equal("/usr/bin/gpg-connect-agent", enigmail.connGpgAgentPath.path);
    });
});

// resolveToolPath

test(function resolveToolPathDefaultValues() {
    withEnvironment({}, function(e) {
        var enigmail = gEnigmailSvc = new Enigmail();
        enigmail.environment = e;
        enigmail.agentPath = "/usr/bin/gpg-agent";
        var result = enigmail.resolveToolPath("zip");
        Assert.equal("/usr/bin/zip", result.path);
    });
});

test(function resolveToolPathFromPATH() {
    withEnvironment({PATH: "/sbin"}, function(e) {
        var enigmail = gEnigmailSvc = new Enigmail();
        enigmail.environment = e;
        enigmail.agentPath = null;
        var result = enigmail.resolveToolPath("route");
        Assert.equal("/sbin/route", result.path);
    });
});

// detectGpgAgent
test(function detectGpgAgentSetsAgentInfoFromEnvironmentVariable() {
    withEnvironment({GPG_AGENT_INFO: "a happy agent"}, function(e) {
        var enigmail = gEnigmailSvc = new Enigmail();
        enigmail.environment = e;
        enigmail.detectGpgAgent(JSUnit.createStubWindow());

        Assert.ok(enigmail.gpgAgentInfo.preStarted);
        Assert.equal("a happy agent", enigmail.gpgAgentInfo.envStr);
        Assert.ok(!Ec.gpgAgentIsOptional);
    });
});

test(function detectGpgAgentWithNoAgentInfoInEnvironment() {
    withEnvironment({}, function(e) {
        var enigmail = gEnigmailSvc = new Enigmail();
        enigmail.environment = e;
        enigmail.detectGpgAgent(JSUnit.createStubWindow());

        Assert.ok(!enigmail.gpgAgentInfo.preStarted);
        Assert.ok(!Ec.gpgAgentIsOptional);
    });
});

test(function detectGpgAgentWithAutostartFeatureWillDoNothing() {
    withEnvironment({}, function(e) {
        withGpgFeatures(["autostart-gpg-agent"], function() {
            var enigmail = gEnigmailSvc = new Enigmail();
            enigmail.environment = e;
            enigmail.detectGpgAgent(JSUnit.createStubWindow());
            Assert.equal("none", enigmail.gpgAgentInfo.envStr);
        });
    });
});


// getRulesFile
test(function getRulesFileReturnsTheFile() {
    var enigmail = gEnigmailSvc = new Enigmail();
    Assert.equal(EC.getProfileDirectory().path + "/pgprules.xml", enigmail.getRulesFile().path);
});

// loadRulesFile
test(function loadRulesFileReturnsFalseIfNoRulesFileExists() {
    var enigmail = gEnigmailSvc = new Enigmail();
    var result = enigmail.loadRulesFile();
    Assert.ok(!result);
});

test(function loadRulesFileReturnsFalseIfTheFileExistsButIsEmpty() {
    var enigmail = gEnigmailSvc = new Enigmail();
    resetting(enigmail, 'getRulesFile', function() {
        return do_get_file("resources/emptyRules.xml", false);
    }, function() {
        var result = enigmail.loadRulesFile();
        Assert.ok(!result);
    });
});

test(function loadRulesFileReturnsTrueIfTheFileExists() {
    var enigmail = gEnigmailSvc = new Enigmail();
    resetting(enigmail, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        var result = enigmail.loadRulesFile();
        Assert.ok(result);
    });
});

function xmlToData(x) {
    var result = [];
    var node = x.firstChild.firstChild;
    while(node) {
        let name = node.tagName;
        let res = {tagName: name};
        if(name) {
            let attrs = node.attributes;
            for(let i = 0; i < attrs.length; i++) {
                res[attrs[i].name] = attrs[i].value;
            }
            result.push(res);
        }
        node = node.nextSibling;
    }
    return result;
}

test(function loadRulesFileSetsRulesBasedOnTheFile() {
    var enigmail = gEnigmailSvc = new Enigmail();
    resetting(enigmail, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        enigmail.loadRulesFile();
        var d = xmlToData(enigmail.rulesList);
        var expected = [
            {tagName: "pgpRule",
             email: "{user1@some.domain}",
             keyId: "0x1234ABCD",
             sign: "1",
             encrypt: "1",
             pgpMime: "1"},
            {tagName: "pgpRule",
             email: "user2@some.domain",
             keyId: "0x1234ABCE",
             sign: "2",
             encrypt: "1",
             pgpMime: "0"}
        ];
        Assert.deepEqual(expected, d);
    });
});

// getRulesData
test(function getRulesDataReturnsFalseAndNullIfNoRulesExist() {
    var enigmail = gEnigmailSvc = new Enigmail();
    var res = {};
    var ret = enigmail.getRulesData(res);
    Assert.ok(!ret);
    Assert.equal(null, res.value);
});

test(function getRulesDataReturnsTrueAndTheRulesListIfExist() {
    var enigmail = gEnigmailSvc = new Enigmail();
    resetting(enigmail, 'getRulesFile', function() {
        return do_get_file("resources/rules.xml", false);
    }, function() {
        var res = {};
        var ret = enigmail.getRulesData(res);
        Assert.ok(ret);
        Assert.equal(enigmail.rulesList, res.value);
    });
});
