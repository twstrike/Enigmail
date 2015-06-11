/*global Components: false, Data: false, Log: false, Prefs: false, Locale: false, Armor: false, Data: false, Execution: false, Dialog: false */
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

const EXPORTED_SYMBOLS = [ "Decryption" ];

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/prefs.jsm");
Cu.import("resource://enigmail/armor.jsm");
Cu.import("resource://enigmail/locale.jsm");
Cu.import("resource://enigmail/data.jsm");
Cu.import("resource://enigmail/execution.jsm");
Cu.import("resource://enigmail/dialog.jsm");
Cu.import("resource://enigmail/httpProxy.jsm"); /*global HttpProxy: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/enigmailErrorHandling.jsm"); /*global EnigmailErrorHandling: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */
Cu.import("resource://enigmail/key.jsm"); /*global Key: false */
Cu.import("resource://enigmail/passwords.jsm"); /*global Passwords: false */

const nsIEnigmail = Ci.nsIEnigmail;
const EC = EnigmailCore;

const STATUS_ERROR = nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.DECRYPTION_FAILED;
const STATUS_DECRYPTION_OK = nsIEnigmail.DECRYPTION_OKAY;
const STATUS_GOODSIG = nsIEnigmail.GOOD_SIGNATURE;

const NS_WRONLY      = 0x02;

function statusObjectFrom(signatureObj, exitCodeObj, statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj, encToDetailsObj) {
    return {
        signature: signatureObj,
        exitCode: exitCodeObj,
        statusFlags: statusFlagsObj,
        keyId: keyIdObj,
        userId: userIdObj,
        sigDetails: sigDetailsObj,
        message: errorMsgObj,
        blockSeparation: blockSeparationObj,
        encToDetails: encToDetailsObj
    };
}

function newStatusObject() {
    return statusObjectFrom({value: ""}, {}, {}, {}, {}, {}, {}, {}, {});
}

const Decryption = {
    decryptMessageStart: function (win, verifyOnly, noOutput, listener,
                                   statusFlagsObj, errorMsgObj, mimeSignatureFile,
                                   maxOutputLength) {
        Log.DEBUG("enigmailCommon.jsm: decryptMessageStart: verifyOnly="+verifyOnly+"\n");

        if (!EnigmailCore.getService(win)) {
            Log.ERROR("enigmailCommon.jsm: decryptMessageStart: not yet initialized\n");
            errorMsgObj.value = Locale.getString("notInit");
            return null;
        }

        if (KeyRing.isGeneratingKey()) {
            errorMsgObj.value = Locale.getString("notComplete");
            return null;
        }

        var args = Gpg.getStandardArgs(true);

        var keyserver = Prefs.getPref("autoKeyRetrieve");
        if (keyserver && keyserver !== "") {
            args.push("--keyserver-options");
            var keySrvArgs="auto-key-retrieve";
            var srvProxy = HttpProxy.getHttpProxy(keyserver);
            if (srvProxy) {
                keySrvArgs += ",http-proxy="+srvProxy;
            }
            args.push(keySrvArgs);
            args.push("--keyserver");
            args.push(keyserver);
        }

        if (noOutput) {
            args.push("--verify");

            if (mimeSignatureFile) {
                args.push(mimeSignatureFile);
                args.push("-");
            }

        } else {
            if (maxOutputLength) {
                args.push("--max-output");
                args.push(String(maxOutputLength));
            }

            args.push("--decrypt");
        }

        var proc = Execution.execStart(EnigmailGpgAgent.agentPath,
                                       args, !verifyOnly, win,
                                       listener, statusFlagsObj);

        if (statusFlagsObj.value & nsIEnigmail.MISSING_PASSPHRASE) {
            Log.ERROR("enigmailCommon.jsm: decryptMessageStart: Error - no passphrase supplied\n");

            errorMsgObj.value = Locale.getString("noPassphrase");
            return null;
        }

        return proc;
    },


    decryptMessageEnd: function (stderrStr, exitCode, outputLen, verifyOnly, noOutput, uiFlags, retStatusObj) {
        Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: uiFlags="+uiFlags+", verifyOnly="+verifyOnly+", noOutput="+noOutput+"\n");

        stderrStr = stderrStr.replace(/\r\n/g,"\n");
        Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: stderrStr=\n"+stderrStr+"\n");
        var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
        var pgpMime     = uiFlags & nsIEnigmail.UI_PGP_MIME;
        var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
        var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
        var j;

        retStatusObj.statusFlags = 0;
        retStatusObj.errorMsg    = "";
        retStatusObj.blockSeparation  = "";

        var errorMsg = EnigmailErrorHandling.parseErrorOutput(stderrStr, retStatusObj);
        if (retStatusObj.statusFlags & STATUS_ERROR) {
            retStatusObj.errorMsg = errorMsg;
        }
        else {
            retStatusObj.errorMsg = "";
        }

        if (pgpMime) {
            retStatusObj.statusFlags |= verifyOnly ? nsIEnigmail.PGP_MIME_SIGNED
                : nsIEnigmail.PGP_MIME_ENCRYPTED;
        }

        var statusMsg = retStatusObj.statusMsg;
        exitCode = Execution.fixExitCode(exitCode, retStatusObj.statusFlags);
        if ((exitCode === 0) && !noOutput && !outputLen &&
            ((retStatusObj.statusFlags & (STATUS_DECRYPTION_OK | STATUS_GOODSIG)) === 0)) {
            exitCode = -1;
        }

        var errLines;
        if (statusMsg) {
            errLines = statusMsg.split(/\r?\n/);
        }
        else {
            // should not really happen ...
            errLines = stderrStr.split(/\r?\n/);
        }

        // possible STATUS Patterns (see GPG dod DETAILS.txt):
        // one of these should be set for a signature:
        var goodsigPat    = /GOODSIG (\w{16}) (.*)$/i;
        var badsigPat     = /BADSIG (\w{16}) (.*)$/i;
        var expsigPat     = /EXPSIG (\w{16}) (.*)$/i;
        var expkeysigPat  = /EXPKEYSIG (\w{16}) (.*)$/i;
        var revkeysigPat  = /REVKEYSIG (\w{16}) (.*)$/i;
        var errsigPat     = /ERRSIG (\w{16}) (.*)$/i;
        // additional infos for good signatures:
        var validSigPat   = /VALIDSIG (\w+) (.*) (\d+) (.*)/i;
        // hint for a certain key id:
        var userIdHintPat = /USERID_HINT (\w{16}) (.*)$/i;
        // to find out for which recipients the email was encrypted:
        var encToPat      = /ENC_TO (\w{16}) (.*)$/i;

        var matches;

        var signed = false;
        var goodOrExpOrRevSignature = false;
        var sigKeyId = "";             // key of sender
        var sigUserId = "";            // user ID of sender
        var sigDetails = "";
        var encToDetails = "";
        var encToArray = [];  // collect ENC_TO lines here

        for (j=0; j<errLines.length; j++) {
            Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: process: "+errLines[j]+"\n");

            // ENC_TO entry
            // - collect them for later processing to print details
            matches = errLines[j].match(encToPat);
            if (matches && (matches.length > 2)) {
                encToArray.push("0x"+matches[1]);
            }

            // USERID_HINT entry
            // - NOTE: NO END of loop
            // ERROR: wrong to set userId because ecom is NOT the sender:
            //matches = errLines[j].match(userIdHintPat);
            //if (matches && (matches.length > 2)) {
            //  sigKeyId = matches[1];
            //  sigUserId = matches[2];
            //}

            // check for one of the possible SIG entries:
            // GOODSIG entry
            matches = errLines[j].match(goodsigPat);
            if (matches && (matches.length > 2)) {
                if (signed) {
                    Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                }
                signed = true;
                goodOrExpOrRevSignature = true;
                sigKeyId = matches[1];
                sigUserId = matches[2];
            }
            else {
                // BADSIG entry => signature found but bad
                matches = errLines[j].match(badsigPat);
                if (matches && (matches.length > 2)) {
                    if (signed) {
                        Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                    }
                    signed = true;
                    goodOrExpOrRevSignature = false;
                    sigKeyId = matches[1];
                    sigUserId = matches[2];
                }
                else {
                    // EXPSIG entry => expired signature found
                    matches = errLines[j].match(expsigPat);
                    if (matches && (matches.length > 2)) {
                        if (signed) {
                            Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                        }
                        signed = true;
                        goodOrExpOrRevSignature = true;
                        sigKeyId = matches[1];
                        sigUserId = matches[2];
                    }
                    else {
                        // EXPKEYSIG entry => signature found but key expired
                        matches = errLines[j].match(expkeysigPat);
                        if (matches && (matches.length > 2)) {
                            if (signed) {
                                Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                            }
                            signed = true;
                            goodOrExpOrRevSignature = true;
                            sigKeyId = matches[1];
                            sigUserId = matches[2];
                        }
                        else {
                            // REVKEYSIG entry => signature found but key revoked
                            matches = errLines[j].match(revkeysigPat);
                            if (matches && (matches.length > 2)) {
                                if (signed) {
                                    Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                                }
                                signed = true;
                                goodOrExpOrRevSignature = true;
                                sigKeyId = matches[1];
                                sigUserId = matches[2];
                            }
                            else {
                                // ERRSIG entry => signature found but key revoked
                                matches = errLines[j].match(errsigPat);
                                if (matches && (matches.length > 2)) {
                                    if (signed) {
                                        Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: OOPS: multiple SIGN entries\n");
                                    }
                                    signed = true;
                                    goodOrExpOrRevSignature = false;
                                    sigKeyId = matches[1];
                                    // no user id with ecom istatus entry
                                }
                            }
                        }
                    }
                }
            }

        }// end loop of processing errLines

        if (goodOrExpOrRevSignature) {
            for (j=0; j<errLines.length; j++) {
                matches = errLines[j].match(validSigPat);
                if (matches && (matches.length > 4)) {
                    if (matches[4].length==40)
                        // in case of several subkeys refer to the main key ID.
                        // Only works with PGP V4 keys (Fingerprint length ==40)
                        sigKeyId = matches[4].substr(-16);
                }
                if (matches && (matches.length > 2)) {
                    sigDetails = errLines[j].substr(9);
                    break;
                }
            }
        }

        if (sigUserId && sigKeyId && Prefs.getPref("displaySecondaryUid")) {
            let uids = KeyRing.getKeyDetails(sigKeyId, true, true);
            if (uids) {
                sigUserId = uids;
            }
            if (uids && uids.indexOf("uat:jpegPhoto:") >= 0) {
                retStatusObj.statusFlags |= nsIEnigmail.PHOTO_AVAILABLE;
            }
        }

        if (sigUserId) {
            sigUserId = Data.convertToUnicode(sigUserId, "UTF-8");
        }

        // add list of keys used for encryption if known (and their user IDs) if known
        // Parsed status messages are something like (here the German version):
        //    [GNUPG:] ENC_TO AAAAAAAAAAAAAAAA 1 0
        //    [GNUPG:] ENC_TO 5B820D2D4553884F 16 0
        //    [GNUPG:] ENC_TO 37904DF2E631552F 1 0
        //    [GNUPG:] ENC_TO BBBBBBBBBBBBBBBB 1 0
        //    gpg: verschlüsselt mit 3072-Bit RSA Schlüssel, ID BBBBBBBB, erzeugt 2009-11-28
        //          "Joe Doo <joe.doo@domain.de>"
        //    [GNUPG:] NO_SECKEY E71712DF47BBCC40
        //    gpg: verschlüsselt mit RSA Schlüssel, ID AAAAAAAA
        //    [GNUPG:] NO_SECKEY AAAAAAAAAAAAAAAA
        if (encToArray.length > 0) {
            // for each key also show an associated user ID if known:
            for (var encIdx=0; encIdx<encToArray.length; ++encIdx) {
                var localKeyId = encToArray[encIdx];
                // except for ID 00000000, which signals hidden keys
                if (localKeyId != "0x0000000000000000") {
                    var localUserId = KeyRing.getFirstUserIdOfKey(localKeyId);
                    if (localUserId) {
                        localUserId = Data.convertToUnicode(localUserId, "UTF-8");
                        encToArray[encIdx] += " (" + localUserId + ")";
                    }
                }
                else {
                    encToArray[encIdx] = Locale.getString("hiddenKey");
                }
            }
            encToDetails = "\n  " + encToArray.join(",\n  ") + "\n";
        }

        retStatusObj.userId = sigUserId;
        retStatusObj.keyId = sigKeyId;
        retStatusObj.sigDetails = sigDetails;
        retStatusObj.encToDetails = encToDetails;

        if (signed) {
            var trustPrefix = "";

            if (retStatusObj.statusFlags & nsIEnigmail.UNTRUSTED_IDENTITY) {
                trustPrefix += Locale.getString("prefUntrusted")+" ";
            }

            if (retStatusObj.statusFlags & nsIEnigmail.REVOKED_KEY) {
                trustPrefix += Locale.getString("prefRevoked")+" ";
            }

            if (retStatusObj.statusFlags & nsIEnigmail.EXPIRED_KEY_SIGNATURE) {
                trustPrefix += Locale.getString("prefExpiredKey")+" ";

            } else if (retStatusObj.statusFlags & nsIEnigmail.EXPIRED_SIGNATURE) {
                trustPrefix += Locale.getString("prefExpired")+" ";
            }

            if (goodOrExpOrRevSignature) {
                retStatusObj.errorMsg = trustPrefix + Locale.getString("prefGood", [sigUserId]); /* + ", " +
                                                                                                Locale.getString("keyId") + " 0x" + sigKeyId.substring(8,16); */
            } else {
                retStatusObj.errorMsg = trustPrefix + Locale.getString("prefBad", [sigUserId]); /*+ ", " +
                                                                                               Locale.getString("keyId") + " 0x" + sigKeyId.substring(8,16); */
                if (!exitCode)
                    exitCode = 1;
            }
        }

        if (retStatusObj.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
            retStatusObj.keyId = Key.extractPubkey(statusMsg);

            if (retStatusObj.statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
                exitCode=0;
            }
        }

        if (exitCode !== 0) {
            // Error processing
            Log.DEBUG("enigmailCommon.jsm: decryptMessageEnd: command execution exit code: "+exitCode+"\n");
        }

        return exitCode;
    },

    /**
     *  Decrypts a PGP ciphertext and returns the the plaintext
     *
     *in  @parent a window object
     *in  @uiFlags see flag options in nsIEnigmail.idl, UI_INTERACTIVE, UI_ALLOW_KEY_IMPORT
     *in  @cipherText a string containing a PGP Block
     *out @signatureObj
     *out @exitCodeObj contains the exit code
     *out @statusFlagsObj see status flags in nslEnigmail.idl, GOOD_SIGNATURE, BAD_SIGNATURE
     *out @keyIdObj holds the key id
     *out @userIdObj holds the user id
     *out @sigDetailsObj
     *out @errorMsgObj  error string
     *out @blockSeparationObj
     *out @encToDetailsObj  returns in details, which keys the mesage was encrypted for (ENC_TO entries)
     *
     * @return string plaintext ("" if error)
     *
     */
    decryptMessage: function (parent, uiFlags, cipherText,
                              signatureObj, exitCodeObj,
                              statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj,
                              blockSeparationObj, encToDetailsObj) {
        const esvc = EnigmailCore.getEnigmailService();

        Log.DEBUG("enigmail.js: Enigmail.decryptMessage: "+cipherText.length+" bytes, "+uiFlags+"\n");

        if (! cipherText)
            return "";

        var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;
        var allowImport = uiFlags & nsIEnigmail.UI_ALLOW_KEY_IMPORT;
        var unverifiedEncryptedOK = uiFlags & nsIEnigmail.UI_UNVERIFIED_ENC_OK;
        var oldSignature = signatureObj.value;

        Log.DEBUG("enigmail.js: Enigmail.decryptMessage: oldSignature="+oldSignature+"\n");

        signatureObj.value   = "";
        exitCodeObj.value    = -1;
        statusFlagsObj.value = 0;
        keyIdObj.value       = "";
        userIdObj.value      = "";
        errorMsgObj.value    = "";

        var beginIndexObj = {};
        var endIndexObj = {};
        var indentStrObj = {};
        var blockType = Armor.locateArmoredBlock(cipherText, 0, "", beginIndexObj, endIndexObj, indentStrObj);
        if (!blockType || blockType == "SIGNATURE") {
            errorMsgObj.value = Locale.getString("noPGPblock");
            statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
            return "";
        }

        var publicKey = (blockType == "PUBLIC KEY BLOCK");

        var verifyOnly = (blockType == "SIGNED MESSAGE");

        var pgpBlock = cipherText.substr(beginIndexObj.value,
                                         endIndexObj.value - beginIndexObj.value + 1);

        if (indentStrObj.value) {
            RegExp.multiline = true;
            var indentRegexp = new RegExp("^"+indentStrObj.value, "g");
            pgpBlock = pgpBlock.replace(indentRegexp, "");
            if (indentStrObj.value.substr(-1) == " ") {
                var indentRegexpStr = "^"+indentStrObj.value.replace(/ $/, "$");
                indentRegexp = new RegExp(indentRegexpStr, "g");
                pgpBlock = pgpBlock.replace(indentRegexp, "");
            }
            RegExp.multiline = false;
        }

        // HACK to better support messages from Outlook: if there are empty lines, drop them
        if (pgpBlock.search(/MESSAGE-----\r?\n\r?\nVersion/) >=0) {
            Log.DEBUG("enigmail.js: Enigmail.decryptMessage: apply Outlook empty line workaround\n");
            pgpBlock = pgpBlock.replace( /\r?\n\r?\n/g, "\n" );
        }

        var head = cipherText.substr(0, beginIndexObj.value);
        var tail = cipherText.substr(endIndexObj.value+1,
                                     cipherText.length - endIndexObj.value - 1);

        if (publicKey) {
            if (!allowImport) {
                errorMsgObj.value = Locale.getString("decryptToImport");
                statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;
                statusFlagsObj.value |= nsIEnigmail.INLINE_KEY;

                return "";
            }

            // Import public key
            var importFlags = nsIEnigmail.UI_INTERACTIVE;
            exitCodeObj.value = KeyRing.importKey(parent, importFlags, pgpBlock, "",
                                                  errorMsgObj);
            if (exitCodeObj.value === 0) {
                statusFlagsObj.value |= nsIEnigmail.IMPORTED_KEY;
            }
            return "";
        }

        var newSignature = "";

        if (verifyOnly) {
            newSignature = Armor.extractSignaturePart(pgpBlock, nsIEnigmail.SIGNATURE_ARMOR);
            if (oldSignature && (newSignature != oldSignature)) {
                Log.ERROR("enigmail.js: Enigmail.decryptMessage: Error - signature mismatch "+newSignature+"\n");
                errorMsgObj.value = Locale.getString("sigMismatch");
                statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

                return "";
            }
        }

        var startErrorMsgObj = {};
        var noOutput = false;

        var listener = Execution.newSimpleListener(
            function _stdin (pipe) {
                pipe.write(pgpBlock);
                pipe.close();
            });

        var maxOutput = pgpBlock.length * 100;  // limit output to 100 times message size
        // to avoid DoS attack
        var proc = Decryption.decryptMessageStart(parent, verifyOnly, noOutput, listener,
                                                  statusFlagsObj, startErrorMsgObj,
                                                  null, maxOutput);

        if (!proc) {
            errorMsgObj.value = startErrorMsgObj.value;
            statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

            return "";
        }

        // Wait for child to close
        proc.wait();

        var plainText = Data.getUnicodeData(listener.stdoutData);

        var retStatusObj = {};
        var exitCode = Decryption.decryptMessageEnd(Data.getUnicodeData(listener.stderrData), listener.exitCode,
                                                    plainText.length, verifyOnly, noOutput,
                                                    uiFlags, retStatusObj);
        exitCodeObj.value = exitCode;
        statusFlagsObj.value = retStatusObj.statusFlags;
        errorMsgObj.value = retStatusObj.errorMsg;

        userIdObj.value = retStatusObj.userId;
        keyIdObj.value = retStatusObj.keyId;
        sigDetailsObj.value = retStatusObj.sigDetails;
        if (encToDetailsObj) {
            encToDetailsObj.value = retStatusObj.encToDetails;
        }
        blockSeparationObj.value = retStatusObj.blockSeparation;

        if ((head.search(/\S/) >= 0) ||
            (tail.search(/\S/) >= 0)) {
            statusFlagsObj.value |= nsIEnigmail.PARTIALLY_PGP;
        }


        if (exitCodeObj.value === 0) {
            // Normal return

            var doubleDashSeparator = false;
            try {
                doubleDashSeparator = Prefs.getPrefBranch().getBoolPref("doubleDashSeparator");
            } catch(ex) { }

            if (doubleDashSeparator && (plainText.search(/(\r|\n)-- +(\r|\n)/) < 0) ) {
                // Workaround for MsgCompose stripping trailing spaces from sig separator
                plainText = plainText.replace(/(\r|\n)--(\r|\n)/, "$1-- $2");
            }

            statusFlagsObj.value |= nsIEnigmail.DISPLAY_MESSAGE;

            if (verifyOnly && indentStrObj.value) {
                RegExp.multiline = true;
                plainText = plainText.replace(/^/g, indentStrObj.value);
                RegExp.multiline = false;
            }

            return Decryption.inlineInnerVerification(parent, uiFlags, plainText,
                                                      statusObjectFrom(signatureObj, exitCodeObj, statusFlagsObj, keyIdObj, userIdObj,
                                                                       sigDetailsObj, errorMsgObj, blockSeparationObj, encToDetailsObj));
        }

        var pubKeyId = keyIdObj.value;

        if (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE) {
            if (verifyOnly && indentStrObj.value) {
                // Probably replied message that could not be verified
                errorMsgObj.value = Locale.getString("unverifiedReply")+"\n\n"+errorMsgObj.value;
                return "";
            }

            // Return bad signature (for checking later)
            signatureObj.value = newSignature;

        } else if (pubKeyId &&
                   (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE)) {

            var innerKeyBlock;
            if (verifyOnly) {
                // Search for indented public key block in signed message
                var innerBlockType = Armor.locateArmoredBlock(pgpBlock, 0, "- ", beginIndexObj, endIndexObj, indentStrObj);
                if (innerBlockType == "PUBLIC KEY BLOCK") {

                    innerKeyBlock = pgpBlock.substr(beginIndexObj.value,
                                                    endIndexObj.value - beginIndexObj.value + 1);

                    innerKeyBlock = innerKeyBlock.replace(/- -----/g, "-----");

                    statusFlagsObj.value |= nsIEnigmail.INLINE_KEY;
                    Log.DEBUG("enigmail.js: Enigmail.decryptMessage: innerKeyBlock found\n");
                }
            }

            if (allowImport) {

                var importedKey = false;

                if (innerKeyBlock) {
                    var importErrorMsgObj = {};
                    var importFlags2 = nsIEnigmail.UI_INTERACTIVE;
                    var exitStatus = KeyRing.importKey(parent, importFlags2, innerKeyBlock,
                                                       pubKeyId, importErrorMsgObj);

                    importedKey = (exitStatus === 0);

                    if (exitStatus > 0) {
                        Dialog.alert(parent, Locale.getString("cantImport")+importErrorMsgObj.value);
                    }
                }

                if (importedKey) {
                    // Recursive call; note that nsIEnigmail.UI_ALLOW_KEY_IMPORT is unset
                    // to break the recursion
                    var uiFlagsDeep = interactive ? nsIEnigmail.UI_INTERACTIVE : 0;
                    signatureObj.value = "";
                    return Decryption.decryptMessage(parent, uiFlagsDeep, pgpBlock,
                                                     signatureObj, exitCodeObj, statusFlagsObj,
                                                     keyIdObj, userIdObj, sigDetailsObj, errorMsgObj);
                }

            }

            if (plainText && !unverifiedEncryptedOK) {
                // Append original PGP block to unverified message
                plainText = "-----BEGIN PGP UNVERIFIED MESSAGE-----\r\n" + plainText +
                    "-----END PGP UNVERIFIED MESSAGE-----\r\n\r\n" + pgpBlock;
            }

        }

        return verifyOnly ? "" : plainText;
    },

    inlineInnerVerification: function (parent, uiFlags, text, statusObject) {
        Log.DEBUG("enigmail.js: Enigmail.inlineInnerVerification\n");

        if (text && text.indexOf("-----BEGIN PGP SIGNED MESSAGE-----") === 0) {
            var status = newStatusObject();
            var newText = Decryption.decryptMessage(parent, uiFlags, text,
                                                    status.signature, status.exitCode, status.statusFlags, status.keyId, status.userId,
                                                    status.sigDetails, status.message, status.blockSeparation, status.encToDetails);
            if (status.exitCode.value === 0) {
                text = newText;
                // merge status into status object:
                statusObject.statusFlags.value = statusObject.statusFlags.value | status.statusFlags.value;
                statusObject.keyId.value = status.keyId.value;
                statusObject.userId.value = status.userId.value;
                statusObject.sigDetails.value = status.sigDetails.value;
                statusObject.message.value = status.message.value;
                // we don't merge encToDetails
            }
        }

        return text;
    },

    decryptAttachment: function (parent, outFile, displayName, byteData,
                                 exitCodeObj, statusFlagsObj, errorMsgObj) {
        const esvc = EnigmailCore.getEnigmailService();

        Log.DEBUG("enigmail.js: Enigmail.decryptAttachment: parent="+parent+", outFileName="+outFile.path+"\n");

        var attachmentHead = byteData.substr(0,200);
        if (attachmentHead.match(/\-\-\-\-\-BEGIN PGP \w+ KEY BLOCK\-\-\-\-\-/)) {
            // attachment appears to be a PGP key file

            if (Dialog.confirmDlg(parent, Locale.getString("attachmentPgpKey", [ displayName ]),
                                  Locale.getString("keyMan.button.import"), Locale.getString("dlg.button.view"))) {
                exitCodeObj.value = KeyRing.importKey(parent, 0, byteData, "", errorMsgObj);
                statusFlagsObj.value = nsIEnigmail.IMPORTED_KEY;
            }
            else {
                exitCodeObj.value = 0;
                statusFlagsObj.value = nsIEnigmail.DISPLAY_MESSAGE;
            }
            return true;
        }

        var outFileName = Files.getEscapedFilename(Files.getFilePathReadonly(outFile.QueryInterface(Ci.nsIFile), NS_WRONLY));

        var args = Gpg.getStandardArgs(true);
        args = args.concat(["-o", outFileName, "--yes"]);
        args = args.concat(Passwords.command());
        args.push("-d");


        statusFlagsObj.value = 0;

        var listener = Execution.newSimpleListener(
            function _stdin(pipe) {
                pipe.write(byteData);
                pipe.close();
            });


        var proc = Execution.execStart(EnigmailGpgAgent.agentPath, args, false, parent,
                                       listener, statusFlagsObj);

        if (!proc) {
            return false;
        }

        // Wait for child STDOUT to close
        proc.wait();

        var statusMsgObj = {};
        var cmdLineObj   = {};

        exitCodeObj.value = Execution.execEnd(listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj);

        return true;
    },

    registerOn: function(target) {
        target.decryptMessage = Decryption.decryptMessage;
        target.decryptAttachment = Decryption.decryptAttachment;
    }
};
