/*global Components: false */
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

const EXPORTED_SYMBOLS = [ "KeyRing" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/execution.jsm"); /*global Execution: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */

const KeyRing = {
    importKeyFromFile: function (parent, inputFile, errorMsgObj, importedKeysObj){
        Log.setLogLevel(5);
        var enigmailSvc = EnigmailCore.getEnigmailService();
        if (!enigmailSvc) {
            Log.ERROR("keyRing.jsm: KeyRing.importKeyFromFile: not yet initialized\n");
            errorMsgObj.value = Locale.getString("notInit");
            return 1;
        }

        var command= EnigmailGpgAgent.agentPath;
        var args = Gpg.getStandardArgs(false);
        Log.DEBUG("keyRing.jsm: KeyRing.importKeyFromFile: fileName="+inputFile.path+"\n");
        importedKeysObj.value="";

        var fileName=Files.getEscapedFilename((inputFile.QueryInterface(Ci.nsIFile)).path);

        args.push("--import");
        args.push(fileName);

        var statusFlagsObj = {};
        var statusMsgObj   = {};
        var exitCodeObj    = {};

        var output = Execution.execCmd(command, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);
        Log.ERROR("keyRing.jsm: KeyRing.importKeyFromFile: error="+errorMsgObj.value+"\n");

        var statusMsg = statusMsgObj.value;

        var keyList = [];

        if (exitCodeObj.value === 0) {
            // Normal return
            enigmailSvc.invalidateUserIdList();

            var statusLines = statusMsg.split(/\r?\n/);

            // Discard last null string, if any

            for (var j=0; j<statusLines.length; j++) {
                var matches = statusLines[j].match(/IMPORT_OK ([0-9]+) (\w+)/);
                if (matches && (matches.length > 2)) {
                    if (typeof (keyList[matches[2]]) != "undefined") {
                        keyList[matches[2]] |= Number(matches[1]);
                    }
                    else
                        keyList[matches[2]] = Number(matches[1]);

                    Log.DEBUG("keyRing.jsm: KeyRing.importKeyFromFile: imported "+matches[2]+":"+matches[1]+"\n");
                }
            }

            for (j in keyList) {
                importedKeysObj.value += j+":"+keyList[j]+";";
            }
        }

        return exitCodeObj.value;
    },
};
