/*global Components: false, EnigmailCore: false, Files: false, OS: false */
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

var EXPORTED_SYMBOLS = [ "EnigmailGPG" ];

Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/files.jsm");
Components.utils.import("resource://enigmail/os.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

// Making this a var makes it possible to test windows things on linux
var nsIWindowsRegKey       = Ci.nsIWindowsRegKey;

var EC = EnigmailCore;

function cloneOrNull(v) {
  if(v !== null && typeof v.clone === "function") {
    return v.clone();
  } else {
    return v;
  }
}

const EnigmailGPG = {
    // get a Windows registry value (string)
    // @ keyPath: the path of the registry (e.g. Software\\GNU\\GnuPG)
    // @ keyName: the name of the key to get (e.g. InstallDir)
    // @ rootKey: HKLM, HKCU, etc. (according to constants in nsIWindowsRegKey)
    getWinRegistryString: function(keyPath, keyName, rootKey) {
        var registry = Cc["@mozilla.org/windows-registry-key;1"].createInstance(Ci.nsIWindowsRegKey);

        var retval = "";
        try {
            registry.open(rootKey, keyPath, registry.ACCESS_READ);
            retval = registry.readStringValue(keyName);
            registry.close();
        }
        catch (ex) {}

        return retval;
    },

    determineGpgHomeDir: function (esvc) {
        var homeDir = "";

        homeDir = esvc.environment.get("GNUPGHOME");

        if (! homeDir && esvc.isWin32) {
            homeDir=EnigmailGPG.getWinRegistryString("Software\\GNU\\GNUPG", "HomeDir", nsIWindowsRegKey.ROOT_KEY_CURRENT_USER);

            if (! homeDir) {
                homeDir = esvc.environment.get("USERPROFILE");

                if (! homeDir) {
                    homeDir = esvc.environment.get("SystemRoot");
                }

                if (homeDir) homeDir += "\\Application Data\\GnuPG";
            }

            if (! homeDir) homeDir = "C:\\gnupg";
        }

        if (! homeDir) homeDir = esvc.environment.get("HOME")+"/.gnupg";

        return homeDir;
    },

    // resolve the path for GnuPG helper tools
    resolveToolPath: function(fileName) {
        if (OS.isDosLike()) {
            fileName += ".exe";
        }

        var filePath = cloneOrNull(EC.getEnigmailService().agentPath);

        if (filePath) filePath = filePath.parent;
        if (filePath) {
            filePath.append(fileName);
            if (filePath.exists()) {
                filePath.normalize();
                return filePath;
            }
        }

        var foundPath = Files.resolvePath(fileName, EC.getEnigmailService().environment.get("PATH"), OS.isDosLike());
        if (foundPath !== null) { foundPath.normalize(); }
        return foundPath;
    }
};
