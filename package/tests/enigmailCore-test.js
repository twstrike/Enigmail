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

testing("enigmailCore.jsm");

test(shouldReadProperty);
test(shouldSetGetPreference);
test(shouldCreateLogFile);

function shouldReadProperty() {
    var importBtnProp = "enigHeader";
    var importBtnValue = EnigmailCore.getString(importBtnProp);
    Assert.equal("Enigmail:", importBtnValue);
}

function shouldSetGetPreference() {
    var prefName = "mypref";
    EnigmailCore.setPref(prefName, "yourpref");
    Assert.equal("yourpref", EnigmailCore.getPref(prefName));
}

function shouldCreateLogFile() {
    EnigmailCore.setLogDirectory(do_get_cwd().path);
    EnigmailCore.setLogLevel(5);
    EnigmailCore.createLogFiles();
    var filePath = EnigmailCore._logDirectory + "enigdbug.txt";
    var localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
    initPath(localFile, filePath);

    Assert.equal(localFile.exists(), true);
    if (localFile.exists()) {
        localFile.remove(false);
    }
}

// testing: readFile
test(function readFileReturnsContentOfExistingFile() {
    var md = do_get_cwd().clone();
    md.append("..");
    md.append("..");
    md.append("uuid_enig.txt");
    var result = EnigmailCore.readFile(md);
    Assert.assertContains(result, "847b3a00-7ab1-11d4-8f02-006008948af5");
});

test(function readFileReturnsEmptyStringForNonExistingFile() {
    var md = do_get_cwd().clone();
    md.append("..");
    md.append("..");
    md.append("THIS_FILE_DOESNT_EXIST");
    var result = EnigmailCore.readFile(md);
    Assert.equal("", result);
});
