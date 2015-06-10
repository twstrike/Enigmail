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
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/trust.jsm"); /*global Trust: false */
Cu.import("resource://enigmail/armor.jsm"); /*global Armor: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/os.jsm"); /*global OS: false */

const nsIEnigmail = Ci.nsIEnigmail;

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";

// TODO: fix usages of these
let userIdList = null;
let secretKeyList = null;

const KeyRing = {
    importKeyFromFile: function (parent, inputFile, errorMsgObj, importedKeysObj){
        var command= Gpg.agentPath;
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
            KeyRing.invalidateUserIdList();

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

    /**
     * return key ID of public key for subkey
     *
     * @param  String  keyId key with or without leading 0x
     * @return String  public key ID, or null if key not found
     */
    getPubKeyIdForSubkey: function (keyId) {
        const entry = KeyRing.getKeyListEntryOfKey(keyId);
        if (entry === null) {
            return null;
        }

        const lineArr = entry.split(/\n/);
        for (let i=0; i<lineArr.length; ++i) {
            const lineTokens = lineArr[i].split(/:/);
            if( lineTokens[0] === "pub" ) {
                return lineTokens[4];
            }
        }
        return null;
    },

    /**
     * Return string with all colon-separated data of key list entry of given key.
     * - key may be pub or sub key.
     *
     * @param  String  keyId of 8 or 16 chars key with optionally leading 0x
     * @return String  entry of first found user IDs with keyId or null if none
     */
    getKeyListEntryOfKey: function (keyId) {
        keyId = keyId.replace(/^0x/, "");

        let statusFlags = {};
        let errorMsg = {};
        let exitCodeObj = {};
        let listText = KeyRing.getUserIdList(false, false, exitCodeObj, statusFlags, errorMsg);

        // listText contains lines such as:
        // tru::0:1407688184:1424970931:3:1:5
        // pub:f:1024:17:D581C6F8EBB80E50:1107251639:::-:::scESC:
        // fpr:::::::::492A198AEA5EBE5574A1CE00D581C6F8EBB80E50:
        // uid:f::::1107251639::2D505D1F6E744365B3B35FF11F32A19779E3A417::Giosue Vitaglione <gvi@whitestein.com>:
        // sub:f:2048:16:2223D7E0301A66C6:1107251647::::::e:

        // search for key or subkey
        let regexKey = new RegExp("^(pub|sub):[^:]*:[^:]*:[^:]*:[A-Fa-f0-9]*" + keyId + ":", "m");
        let foundPos = listText.search(regexKey);
        if (foundPos < 0) {
            return null;
        }

        // find area of key entries in key list
        // note: if subkey matches, key entry starts before
        let regexPub = new RegExp("^pub:", "ym");
        let startPos;
        if (listText[foundPos] == "p") {  // ^pub:
            // KEY matches
            startPos = foundPos;
        } else {
            // SUBKEY matches
            // search for pub entry right before sub entry
            startPos = 0;
            let match = regexPub.exec(listText.substr(0, foundPos));
            while (match && match.index < foundPos) {
                startPos = match.index;
                match = regexPub.exec(listText);
            }
        }
        // find end of entry (next pub entry or end):
        let match = regexPub.exec(listText.substr(startPos+1));
        if (match && match.index) {
            return listText.substring(startPos,  startPos+1 + match.index);
        } else {
            return listText.substring(startPos);
        }
    },

    /**
     * Return first found userId of given key.
     * - key may be pub or sub key.
     * @param  String  keyId key with leading 0x
     * @return String  First found of user IDs or null if none
     */
    getFirstUserIdOfKey: function (keyId) {
        Log.DEBUG("enigmail.js: Enigmail.getFirstUserIdOfKey() keyId='"+ keyId +"'\n");

        const entry = KeyRing.getKeyListEntryOfKey(keyId);
        if (entry === null) {
            return null;
        }

        const lineArr = entry.split(/\n/);
        for (let i=0; i<lineArr.length; ++i) {
            const lineTokens = lineArr[i].split(/:/);
            if(lineTokens[0] === "uid") {
                return lineTokens[9];
            }
        }
        return null;
    },

    invalidateUserIdList: function () {
        // clean the userIdList to force reloading the list at next usage
        Log.DEBUG("keyRing.jsm: KeyRing.invalidateUserIdList\n");
        userIdList = null;
        secretKeyList = null;
    },

    // returns the output of --with-colons --list[-secret]-keys
    getUserIdList: function  (secretOnly, refresh, exitCodeObj, statusFlagsObj, errorMsgObj) {
        if (refresh ||
            (secretOnly && secretKeyList === null) ||
            ((! secretOnly) && userIdList === null)) {
            let args = Gpg.getStandardArgs(true);

            if (secretOnly) {
                args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"]);
            } else {
                args = args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-keys"]);
            }

            statusFlagsObj.value = 0;

            const cmdErrorMsgObj = {};
            let listText = Execution.execCmd(Gpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, cmdErrorMsgObj);

            if (! (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
                // ignore exit code as recommended by GnuPG authors
                exitCodeObj.value = 0;
            }

            if (exitCodeObj.value !== 0) {
                errorMsgObj.value = Locale.getString("badCommand");
                if (cmdErrorMsgObj.value) {
                    errorMsgObj.value += "\n" + Files.formatCmdLine(Gpg.agentPath, args);
                    errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
                }

                return "";
            }

            listText = listText.replace(/(\r\n|\r)/g, "\n");
            if (secretOnly) {
                secretKeyList = listText;
                return listText;
            }
            userIdList = listText;
        } else {
            exitCodeObj.value=0;
            statusFlagsObj.value=0;
            errorMsgObj.value="";
        }

        if (secretOnly) {
            return secretKeyList;
        }

        return userIdList;
    },

    // returns the output of --with-colons --list-sig
    getKeySig: function  (keyId, exitCodeObj, errorMsgObj) {
        const args = Gpg.getStandardArgs(true).
                  concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]).
                  concat(keyId.split(" "));

        const statusFlagsObj = {};
        const cmdErrorMsgObj = {};
        const listText = Execution.execCmd(Gpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, cmdErrorMsgObj);

        if (! (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
            // ignore exit code as recommended by GnuPG authors
            exitCodeObj.value = 0;
        }

        if (exitCodeObj.value !== 0) {
            errorMsgObj.value = Locale.getString("badCommand");
            if (cmdErrorMsgObj.value) {
                errorMsgObj.value += "\n" + Files.formatCmdLine(Gpg.agentPath, args);
                errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
            }

            return "";
        }
        return listText;
    },

    /**
     * Return details of given keys.
     *
     * @param  String  keyId              List of keys with 0x, separated by spaces.
     * @param  Boolean uidOnly            false:
     *                                      return all key details (full output of GnuPG)
     *                                    true:
     *                                      return only the user ID fields. Only UIDs with highest trust
     *                                      level are returned.
     * @param  Boolean withUserAttributes true: if uidOnly include "uat:jpegPhoto" (but not subkey IDs)
     *
     * @return String all key details or list of user IDs separated by \n.
     */
    getKeyDetails: function (keyId, uidOnly, withUserAttributes) {
        const args = Gpg.getStandardArgs(true).
                  concat([ "--fixed-list-mode", "--with-fingerprint", "--with-colons", "--list-keys"]).
                  concat(keyId.split(" "));

        const statusFlagsObj = {};
        const exitCodeObj = {};
        let listText = Execution.execCmd(Gpg.agentPath, args, "", exitCodeObj, statusFlagsObj, {}, {});

        if (! (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
            // ignore exit code as recommended by GnuPG authors
            exitCodeObj.value = 0;
        }

        if (exitCodeObj.value !== 0) {
            return "";
        }

        listText=listText.replace(/(\r\n|\r)/g, "\n");

        const TRUSTLEVELS_SORTED = Trust.trustLevelsSorted();
        let maxTrustLevel = -1;

        if (uidOnly) {
            let userList="";
            let hideInvalidUid=true;
            const lineArr=listText.split(/\n/);
            for (let i=0; i<lineArr.length; i++) {
                // process lines such as:
                //  tru::1:1395895453:1442881280:3:1:5
                //  pub:f:4096:1:C1B875ED336XX959:2299509307:1546189300::f:::scaESCA:
                //  fpr:::::::::102A1C8CC524A966849C33D7C8B157EA336XX959:
                //  uid:f::::1388511201::67D5B96DC564598D4D4D9E0E89F5B83C9931A154::Joe Fox <joe@fox.com>:
                //  sig:::1:C8B157EA336XX959:2299509307::::Joe Fox <joe@fox.com>:13x:::::2:
                //  sub:e:2048:1:B214734F0F5C7041:1316219469:1199912694:::::e:
                //  sub:f:2048:1:70E7A471DABE08B0:1316221524:1546189300:::::s:
                const lineTokens = lineArr[i].split(/:/);
                switch (lineTokens[0]) {
                case "pub":
                    if (Trust.isInvalid(lineTokens[1])) {
                        // pub key not valid (anymore)-> display all UID's
                        hideInvalidUid = false;
                    }
                    break;
                case "uid":
                    if (uidOnly && hideInvalidUid) {
                        const thisTrust = TRUSTLEVELS_SORTED.indexOf(lineTokens[1]);
                        if (thisTrust > maxTrustLevel) {
                            userList = lineTokens[9] + "\n";
                            maxTrustLevel = thisTrust;
                        }
                        else if (thisTrust == maxTrustLevel) {
                            userList += lineTokens[9] + "\n";
                        }
                        // else do not add uid
                    }
                    else if (!Trust.isInvalid(lineTokens[1]) || !hideInvalidUid) {
                        // UID valid  OR  key not valid, but invalid keys allowed
                        userList += lineTokens[9] + "\n";
                    }
                    break;
                case "uat":
                    if (withUserAttributes) {
                        if (!Trust.isInvalid(lineTokens[1]) || !hideInvalidUid) {
                            // IF  UID valid  OR  key not valid and invalid keys allowed
                            userList += "uat:jpegPhoto:" + lineTokens[4] + "\n";
                        }
                    }
                    break;
                }
            }
            return userList.
                replace(/^\n+/, "").
                replace(/\n+$/, "").
                replace(/\n\n+/g, "\n");
        }

        return listText;
    },

    extractKey: function (parent, exportFlags, userId, outputFile, exitCodeObj, errorMsgObj) {
        Log.DEBUG("keyRing.jsm: KeyRing.extractKey: "+userId+"\n");

        const args = Gpg.getStandardArgs(true).
                  concat(["-a", "--export"]).
                  concat(userId.split(/[ ,\t]+/));

        const cmdErrorMsgObj = {};
        let keyBlock = Execution.execCmd(Gpg.agentPath, args, "", exitCodeObj, {}, {}, cmdErrorMsgObj);

        if ((exitCodeObj.value === 0) && !keyBlock) {
            exitCodeObj.value = -1;
        }

        if (exitCodeObj.value !== 0) {
            errorMsgObj.value = Locale.getString("failKeyExtract");

            if (cmdErrorMsgObj.value) {
                errorMsgObj.value += "\n" + Files.formatCmdLine(Gpg.agentPath, args);
                errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
            }

            return "";
        }

        if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
            const secretArgs = Gpg.getStandardArgs(true).
                      concat(["-a", "--export-secret-keys"]).
                      concat(userId.split(/[ ,\t]+/));

            const secKeyBlock = Execution.execCmd(Gpg.agentPath, secretArgs, "", exitCodeObj, {}, {}, cmdErrorMsgObj);

            if ((exitCodeObj.value === 0) && !secKeyBlock) {
                exitCodeObj.value = -1;
            }

            if (exitCodeObj.value !== 0) {
                errorMsgObj.value = Locale.getString("failKeyExtract");

                if (cmdErrorMsgObj.value) {
                    errorMsgObj.value += "\n" + Files.formatCmdLine(Gpg.agentPath, secretArgs);
                    errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
                }

                return "";
            }

            if(keyBlock.substr(-1,1).search(/[\r\n]/) < 0) {
                keyBlock += "\n";
            }
            keyBlock += secKeyBlock;
        }

        if (outputFile) {
            if (! Files.writeFileContents(outputFile, keyBlock, DEFAULT_FILE_PERMS)) {
                exitCodeObj.value = -1;
                errorMsgObj.value = Locale.getString("fileWriteFailed", [ outputFile ]);
            }
            return "";
        }
        return keyBlock;
    },

    // ExitCode == 0  => success
    // ExitCode > 0   => error
    // ExitCode == -1 => Cancelled by user
    importKey: function (parent, uiFlags, msgText, keyId, errorMsgObj) {
        Log.DEBUG("keyRing.jsm: KeyRing.importKey: id="+keyId+", "+uiFlags+"\n");

        const beginIndexObj = {};
        const endIndexObj   = {};
        const blockType = Armor.locateArmoredBlock(msgText, 0, "", beginIndexObj, endIndexObj, {});
        if (!blockType) {
            errorMsgObj.value = Locale.getString("noPGPblock");
            return 1;
        }

        if (blockType != "PUBLIC KEY BLOCK") {
            errorMsgObj.value = Locale.getString("notFirstBlock");
            return 1;
        }

        const pgpBlock = msgText.substr(beginIndexObj.value,
                                        endIndexObj.value - beginIndexObj.value + 1);

        if (uiFlags & nsIEnigmail.UI_INTERACTIVE) {
            if (!Dialog.confirmDlg(parent, Locale.getString("importKeyConfirm"), Locale.getString("keyMan.button.import"))) {
                errorMsgObj.value = Locale.getString("failCancel");
                return -1;
            }
        }

        const args = Gpg.getStandardArgs(true).
                  concat(["--import"]);

        const exitCodeObj    = {};
        const statusMsgObj   = {};

        Execution.execCmd(Gpg.agentPath, args, pgpBlock, exitCodeObj, {}, statusMsgObj, errorMsgObj);

        const statusMsg = statusMsgObj.value;

        if (exitCodeObj.value === 0) {
            // Normal return
            KeyRing.invalidateUserIdList();
            if (statusMsg && (statusMsg.search("IMPORTED ") > -1)) {
                const matches = statusMsg.match(/(^|\n)IMPORTED (\w{8})(\w{8})/);
                if (matches && (matches.length > 3)) {
                    Log.DEBUG("enigmail.js: Enigmail.importKey: IMPORTED 0x" + matches[3]+"\n");
                }
            }
        }

        return exitCodeObj.value;
    },

    showKeyPhoto: function(keyId, photoNumber, exitCodeObj, errorMsgObj) {
        // TODO: fix usages!
        Log.DEBUG("keyRing.js: KeyRing.showKeyPhoto, keyId="+keyId+" photoNumber="+photoNumber+"\n");

        const args = Gpg.getStandardArgs().
                  concat(["--no-secmem-warning", "--no-verbose", "--no-auto-check-trustdb",
                          "--batch", "--no-tty", "--status-fd", "1", "--attribute-fd", "2",
                         "--fixed-list-mode", "--list-keys", keyId]);

        const photoDataObj = {};
        const outputTxt = Execution.simpleExecCmd(Gpg.agentPath, args, exitCodeObj, photoDataObj);

        if (!outputTxt) {
            exitCodeObj.value = -1;
            return "";
        }

        if (OS.isDosLike() && Gpg.getGpgFeature("windows-photoid-bug")) {
            // workaround for error in gpg
            photoDataObj.value = photoDataObj.value.replace(/\r\n/g, "\n");
        }

        // [GNUPG:] ATTRIBUTE A053069284158FC1E6770BDB57C9EB602B0717E2 2985
        let foundPicture = -1;
        let skipData = 0;
        let imgSize = -1;
        const statusLines = outputTxt.split(/[\n\r+]/);

        for (let i=0; i < statusLines.length; i++) {
            const matches = statusLines[i].match(/\[GNUPG:\] ATTRIBUTE ([A-F\d]+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)/);
            if (matches && matches[3]=="1") {
                // attribute is an image
                foundPicture++;
                if (foundPicture === photoNumber) {
                    imgSize = Number(matches[2]);
                    break;
                } else {
                    skipData += Number(matches[2]);
                }
            }
        }

        if (foundPicture>=0 && foundPicture === photoNumber) {
            const pictureData = photoDataObj.value.substr(16+skipData, imgSize);
            if (!pictureData.length) {
                return "";
            }

            try {
                const flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;
                const picFile = Files.getTempDirObj();

                picFile.append(keyId+".jpg");
                picFile.createUnique(picFile.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);

                const fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
                fileStream.init(picFile, flags, DEFAULT_FILE_PERMS, 0);
                if (fileStream.write(pictureData, pictureData.length) !== pictureData.length) {
                    throw Components.results.NS_ERROR_FAILURE;
                }

                fileStream.flush();
                fileStream.close();
                return picFile.path;

            } catch (ex) {
                exitCodeObj.value = -1;
                return "";
            }
        }
        return "";
    },

};
