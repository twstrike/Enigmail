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
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
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

const EXPORTED_SYMBOLS = [ "Verify" ];

const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/execution.jsm"); /*global Execution: false */
Cu.import("resource://enigmail/time.jsm"); /*global Time: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/decryption.jsm"); /*global Decryption: false */

const Ci = Components.interfaces;

const nsIEnigmail = Ci.nsIEnigmail;

const Verify = {
    attachment: function (parent, verifyFile, sigFile, statusFlagsObj, errorMsgObj) {
        Log.DEBUG("verify.jsm: Verify.attachment:\n");

        const verifyFilePath  = Files.getEscapedFilename(Files.getFilePathReadonly(verifyFile.QueryInterface(Ci.nsIFile)));
        const sigFilePath     = Files.getEscapedFilename(Files.getFilePathReadonly(sigFile.QueryInterface(Ci.nsIFile)));

        const args = Gpg.getStandardArgs(true).
                  concat(["--verify", sigFilePath, verifyFilePath]);

        const listener = Execution.newSimpleListener();

        const proc = Execution.execStart(EnigmailGpgAgent.agentPath, args, false, parent, listener, statusFlagsObj);

        if (!proc) {
            return -1;
        }

        proc.wait();

        const retObj = {};
        Decryption.decryptMessageEnd(listener.stderrData, listener.exitCode, 1, true, true, nsIEnigmail.UI_INTERACTIVE, retObj);

        if (listener.exitCode === 0) {
            const detailArr = retObj.sigDetails.split(/ /);
            const dateTime = Time.getDateTime(detailArr[2], true, true);
            const msg1 = retObj.errorMsg.split(/\n/)[0];
            const msg2 = Locale.getString("keyAndSigDate", ["0x"+retObj.keyId.substr(-8, 8), dateTime ]);
            errorMsgObj.value = msg1 + "\n" + msg2;
        } else {
            errorMsgObj.value = retObj.errorMsg;
        }

        return listener.exitCode;
    },

    registerOn: function(target) {
        target.verifyAttachment = Verify.attachment;
    }
};
