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
 *   Ramalingam Saravanan <svn@xmlterm.org>
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

var EXPORTED_SYMBOLS = [ "EnigmailErrorHandling" ];

const Ci = Components.interfaces;

var EnigmailErrorHandling = {
  handleError: function(statusLine, retStatusObj) {
    var lineSplit = statusLine.split(/ +/);
    if (lineSplit.length > 0 &&
        lineSplit[1] === "check_hijacking") {
      // TODO: we might display some warning to the user
      retStatusObj.extendedStatus += "invalid_gpg_agent ";
      return true;
    } else {
      return false;
    }
  },

  parseErrorOutput: function(ecom, statusFlagLookup, errOutput, retStatusObj) {
    ecom.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: status message: \n"+errOutput+"\n");

    var errLines = errOutput.split(/\r?\n/);

    // Discard last null string, if any
    if ((errLines.length > 1) && !errLines[errLines.length-1]) {
        errLines.pop();
    }

    var errArray    = new Array();
    var statusArray = new Array();
    var lineSplit = null;
    var errCode = 0;
    var detectedCard = null;
    var requestedCard = null;
    var errorMsg = "";
    retStatusObj.statusMsg = "";
    retStatusObj.extendedStatus = "";

    var statusPat = /^\[GNUPG:\] /;
    var statusFlags = 0;

    // parse all error lines
    var inDecryptionFailed = false;  // to save details of encryption failed messages
    for (var j=0; j<errLines.length; j++) {
      if (errLines[j].search(statusPat) == 0) {
        // status line
        var statusLine = errLines[j].replace(statusPat,"");
        if (inDecryptionFailed) {
          inDecryptionFailed = false;
        }
        statusArray.push(statusLine);

        // extract first word as flag
        var matches = statusLine.match(/^((\w+)\b)/);

        if (matches && (matches.length > 1)) {

          if (matches[1] == "ERROR") {
            // special treatment for some ERROR messages (currently only check_hijacking)
            if (EnigmailErrorHandling.handleError(statusLine, retStatusObj)) {
              continue;
            }
          }

          var flag = statusFlagLookup[matches[1]];  // yields known flag or undefined

          if (flag == Ci.nsIEnigmail.DECRYPTION_FAILED) {
            inDecryptionFailed = true;
          }
          else if (flag == Ci.nsIEnigmail.NODATA) {
            // Recognize only "NODATA 1"
            if (statusLine.search(/NODATA 1\b/) < 0)
              flag = 0;
          }
          else if (flag == Ci.nsIEnigmail.CARDCTRL) {
            lineSplit = statusLine.split(/ +/);
            if (lineSplit[1] == "3") {
              detectedCard=lineSplit[2];
            }
            else {
              errCode = Number(lineSplit[1]);
              if (errCode == 1) requestedCard = lineSplit[2];
            }
          }
          else if (flag == Ci.nsIEnigmail.UNVERIFIED_SIGNATURE) {
            lineSplit = statusLine.split(/ +/);
            if (lineSplit.length > 7 && lineSplit[7] == "4") {
              flag = Ci.nsIEnigmail.UNKNOWN_ALGO;
            }
          }
          else if (flag == statusFlagLookup["IMPORT_OK"]) {
            lineSplit = statusLine.split(/ +/);
            if (lineSplit.length > 1) {
              ecom.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: key imported: "+ lineSplit[2]+ "\n");
            }
            else {
              ecom.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: key without FPR imported\n");
            }

            let importFlag = Number(lineSplit[1]);
            if (importFlag & (1 | 2 | 8)) {
              ecom.enigmailSvc.invalidateUserIdList();
            }
          }
          else if (flag == statusFlagLookup["MISSING_PASSPHRASE"]){
            lineSplit = statusLine.split(/ +/);
            statusFlags |= Ci.nsIEnigmail.MISSING_PASSPHRASE;
            statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
            flag = 0;
            ecom.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: missing passphrase"+"\n");
            retStatusObj.statusMsg += "Missing Passphrase\n";
          }
          else if (flag == statusFlagLookup["INV_SGNR"]) {
            lineSplit = statusLine.split(/ +/);
            statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
            flag = 0;
            ecom.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: detected invalid sender: "+lineSplit[2]+" / code: "+lineSplit[1]+"\n");
            retStatusObj.statusMsg += ecom.getString("gnupg.invalidKey.desc", [ lineSplit[2] ]);
          }

          // if known flag, story it in our status
          if (flag) {
            statusFlags |= flag;
          }
        }
      }
      else {
        // non-status line (details of previous status command)
        errArray.push(errLines[j]);
        // save details of DECRYPTION_FAILED message ass error message
        if (inDecryptionFailed) {
          errorMsg += errLines[j];
        }
      }
    }

    // detect forged message insets

    retStatusObj.blockSeparation = "";

    var plaintextCount=0;
    var withinCryptoMsg = false;
    var cryptoStartPat = /^BEGIN_DECRYPTION/;
    var cryptoEndPat = /^END_DECRYPTION/;
    var plaintextPat = /^PLAINTEXT /;
    var plaintextLengthPat = /^PLAINTEXT_LENGTH /;
    for (j=0; j<statusArray.length; j++) {
      if (statusArray[j].search(cryptoStartPat) == 0) {
        withinCryptoMsg = true;
      }
      else if (withinCryptoMsg && statusArray[j].search(cryptoEndPat) == 0) {
        withinCryptoMsg = false;
      }
      else if (statusArray[j].search(plaintextPat) == 0) {
        ++plaintextCount;
        if ((statusArray.length > j+1) && (statusArray[j+1].search(plaintextLengthPat) == 0)) {
          matches = statusArray[j+1].match(/(\w+) (\d+)/);
          if (matches.length>=3) {
            retStatusObj.blockSeparation += (withinCryptoMsg ? "1" : "0") + ":"+matches[2]+" ";
          }
        }
        else {
          // strange: we got PLAINTEXT XX, but not PLAINTEXT_LENGTH XX
          retStatusObj.blockSeparation += (withinCryptoMsg ? "1" : "0") + ":0 ";
        }
      }
    }

    if (plaintextCount > 1) {
      statusFlags |= (Ci.nsIEnigmail.PARTIALLY_PGP | Ci.nsIEnigmail.DECRYPTION_FAILED | Ci.nsIEnigmail.BAD_SIGNATURE);
    }

    retStatusObj.blockSeparation = retStatusObj.blockSeparation.replace(/ $/, "");
    retStatusObj.statusFlags = statusFlags;
    if (retStatusObj.statusMsg.length == 0) retStatusObj.statusMsg = statusArray.join("\n");
    if (errorMsg.length == 0) {
      errorMsg = errArray.map(ecom.convertGpgToUnicode, ecom).join("\n");
    }

    if ((statusFlags & Ci.nsIEnigmail.CARDCTRL) && errCode >0) {
      switch (errCode) {
      case 1:
        if (detectedCard) {
          errorMsg = ecom.getString("sc.wrongCardAvailable", [ detectedCard, requestedCard ]);
        }
        else {
          errorMsg = ecom.getString("sc.insertCard", [ requestedCard ]);
        }
        break;
      case 2:
        errorMsg = ecom.getString("sc.removeCard");
      case 4:
        errorMsg = ecom.getString("sc.noCardAvailable");
        break;
      case 5:
        errorMsg = ecom.getString("sc.noReaderAvailable");
        break;
      }
      statusFlags |= Ci.nsIEnigmail.DISPLAY_MESSAGE;
    }

    ecom.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput: statusFlags = "+ecom.bytesToHex(ecom.pack(statusFlags,4))+"\n");

    ecom.DEBUG_LOG("enigmailCommon.jsm: parseErrorOutput(): return with errorMsg = "+errorMsg+"\n");
    return errorMsg;
  }
};
