/*global Components EnigmailCommon */
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
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@enigmail.net>
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

Components.utils.import("resource://enigmail/enigmailCommon.jsm");
Components.utils.import("resource://enigmail/commonFuncs.jsm");
Components.utils.import("resource://enigmail/mimeVerify.jsm");

if (! Enigmail) var Enigmail = {};


Enigmail.hdrView = {

  statusBar: null,
  enigmailBox: null,
  lastEncryptedMsgKey: null,


  hdrViewLoad: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.hdrViewLoad\n");

    // Override SMIME ui
    var signedHdrElement = document.getElementById("signedHdrIcon");
    if (signedHdrElement) {
      signedHdrElement.setAttribute("onclick", "Enigmail.msg.viewSecurityInfo(event, true);");
    }

    var encryptedHdrElement = document.getElementById("encryptedHdrIcon");
    if (encryptedHdrElement) {
      encryptedHdrElement.setAttribute("onclick", "Enigmail.msg.viewSecurityInfo(event, true);");
    }

    this.statusBar = document.getElementById("enigmail-status-bar");
    this.enigmailBox = document.getElementById("enigmailBox");

    var addrPopup = document.getElementById("emailAddressPopup");
    if (addrPopup) {
      var attr = addrPopup.getAttribute("onpopupshowing");
      attr = "EnigmailFuncs.collapseAdvanced(this, 'hidden'); "+attr;
      addrPopup.setAttribute("onpopupshowing", attr);
    }
  },


  statusBarHide: function ()
  {
    try {
      this.statusBar.removeAttribute("signed");
      this.statusBar.removeAttribute("encrypted");
      this.enigmailBox.setAttribute("collapsed", "true");
      Enigmail.msg.setAttachmentReveal(null);
      if (Enigmail.msg.securityInfo) {
        Enigmail.msg.securityInfo.statusFlags = 0;
        Enigmail.msg.securityInfo.msgSigned = 0;
        Enigmail.msg.securityInfo.msgEncrypted = 0;
      }

    }
    catch (ex) {}
  },

  // Match the userId from gpg to the sender's from address
  matchUidToSender: function (userId)
  {
    var fromAddr = gFolderDisplay.selectedMessage.author;
    try {
      fromAddr=EnigmailFuncs.stripEmail(fromAddr);
    }
    catch(ex) {}

    var userIdList=userId.split(/\n/);
    try {
      for (var i=0; i<userIdList.length; i++) {
        if (fromAddr.toLowerCase() == EnigmailFuncs.stripEmail(userIdList[i]).toLowerCase()) {
          userId = userIdList[i];
          break;
        }
      }
      if (i>=userIdList.length) userId=userIdList[0];
    }
    catch (ex) {
      userId=userIdList[0];
    }
    return userId;
  },


  setStatusText: function(txt) {
    let s = document.getElementById("enigmailStatusText");
    s.firstChild.data = txt;
  },

  updateHdrIcons: function (exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation, encToDetails, xtraStatus)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.updateHdrIcons: exitCode="+exitCode+", statusFlags="+statusFlags+", keyId="+keyId+", userId="+userId+", "+errorMsg+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    this.statusBar = document.getElementById("enigmail-status-bar");
    this.enigmailBox = document.getElementById("enigmailBox");

    if (gFolderDisplay.selectedMessageUris.length > 0) {
      this.lastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
    }
    var bodyElement = document.getElementById("messagepanebox");

    if (!errorMsg) errorMsg="";

    var replaceUid=null;
    if (userId && (userId.indexOf("\n")>=0)) {
      replaceUid = this.matchUidToSender(userId);
    }
    else {
      replaceUid = userId;
    }

    if (Enigmail.msg.savedHeaders && (Enigmail.msg.savedHeaders["x-pgp-encoding-format"].search(/partitioned/i)===0)) {
      if (currentAttachments && currentAttachments.length) {
        Enigmail.msg.setAttachmentReveal(currentAttachments);
      }
    }

    if (userId && replaceUid) {
      // no EnigConvertGpgToUnicode() here; strings are already UTF-8
      replaceUid = replaceUid.replace(/\\[xe]3a/gi, ":");
      errorMsg = errorMsg.replace(userId, replaceUid);
    }

    var errorLines="";
    var fullStatusInfo="";

    if (exitCode == EnigmailCommon.POSSIBLE_PGPMIME) {
      exitCode = 0;
    }
    else {
      if (errorMsg) {
      // no EnigConvertGpgToUnicode() here; strings are already UTF-8
        errorLines = errorMsg.split(/\r?\n/);
        fullStatusInfo=errorMsg;
      }
    }

    if (errorLines && (errorLines.length > 22) ) {
      // Retain only first twenty lines and last two lines of error message
      var lastLines = errorLines[errorLines.length-2] + "\n" +
                      errorLines[errorLines.length-1] + "\n";

      while (errorLines.length > 20)
        errorLines.pop();

      errorMsg = errorLines.join("\n") + "\n...\n" + lastLines;
    }

    var statusInfo = "";
    var statusLine = "";
    var statusArr = [];

    if (statusFlags & nsIEnigmail.NODATA) {
      if (statusFlags & nsIEnigmail.PGP_MIME_SIGNED)
        statusFlags |= nsIEnigmail.UNVERIFIED_SIGNATURE;

      if (statusFlags & nsIEnigmail.PGP_MIME_ENCRYPTED)
        statusFlags |= nsIEnigmail.DECRYPTION_INCOMPLETE;
    }

    if (! EnigmailCommon.getPref("displayPartiallySigned")) {
      if ((statusFlags & (nsIEnigmail.PARTIALLY_PGP)) &&
          (statusFlags & (nsIEnigmail.BAD_SIGNATURE))) {
        statusFlags &= ~(nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.PARTIALLY_PGP);
        if (statusFlags === 0) {
          errorMsg="";
          fullStatusInfo="";
        }
      }
    }

    var msgSigned = (statusFlags & (nsIEnigmail.BAD_SIGNATURE |
                                    nsIEnigmail.GOOD_SIGNATURE |
                                    nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                                    nsIEnigmail.EXPIRED_SIGNATURE |
                                    nsIEnigmail.UNVERIFIED_SIGNATURE |
                                    nsIEnigmail.REVOKED_KEY |
                                    nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                                    nsIEnigmail.EXPIRED_SIGNATURE));
    var msgEncrypted = (statusFlags & (nsIEnigmail.DECRYPTION_OKAY |
                                       nsIEnigmail.DECRYPTION_INCOMPLETE |
                                       nsIEnigmail.DECRYPTION_FAILED));

    if (msgSigned && (statusFlags & nsIEnigmail.IMPORTED_KEY)) {
      statusFlags &= (~nsIEnigmail.IMPORTED_KEY);
    }

    if (((!(statusFlags & (nsIEnigmail.DECRYPTION_INCOMPLETE |
                           nsIEnigmail.DECRYPTION_FAILED |
                           nsIEnigmail.UNVERIFIED_SIGNATURE |
                           nsIEnigmail.BAD_SIGNATURE))) ||
         (statusFlags & nsIEnigmail.DISPLAY_MESSAGE) &&
          !(statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
            !(statusFlags & nsIEnigmail.IMPORTED_KEY)) {
      // normal exit / display message
      statusLine = errorMsg;
      statusInfo = statusLine;

      if (sigDetails) {
        var detailArr=sigDetails.split(/ /);

        let dateTime = EnigmailCommon.getDateTime(detailArr[2], true, true);
        var txt = EnigmailCommon.getString("keyAndSigDate", [ keyId.substr(-8, 8), dateTime ] );
        statusArr.push(txt);
        statusInfo += "\n" + txt;
        var fpr = "";
        if (detailArr.length >= 10) {
          fpr = EnigmailFuncs.formatFpr(detailArr[9]);
        }
        else {
          EnigmailFuncs.formatFpr(detailArr[0]);
        }
        if (fpr) {
          statusInfo += "\n"+EnigmailCommon.getString("keyFpr", [ fpr ]);
        }
      }
      fullStatusInfo = statusInfo;

    }
    else {
      // no normal exit / don't display message
      // - process failed decryptions first because they imply bad signature handling
      if (statusFlags & nsIEnigmail.DECRYPTION_FAILED) {
        if (statusFlags & nsIEnigmail.NO_SECKEY) {
          statusInfo = EnigmailCommon.getString("needKey");
        } else {
          statusInfo = EnigmailCommon.getString("failedDecrypt");
        }
        statusLine = statusInfo + EnigmailCommon.getString("clickDetailsButton");
      }
      else if (statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
        statusInfo = EnigmailCommon.getString("badPhrase");
        statusLine = statusInfo + EnigmailCommon.getString("clickDecryptRetry");
      }
      else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        statusInfo = EnigmailCommon.getString("unverifiedSig");
        if (keyId) {
          statusLine = statusInfo + EnigmailCommon.getString("clickImportButton");
        }
        else {
          statusLine = statusInfo + EnigmailCommon.getString("keyTypeUnsupported");
        }
      }
      else if (statusFlags & (nsIEnigmail.BAD_SIGNATURE |
                              nsIEnigmail.EXPIRED_SIGNATURE |
                              nsIEnigmail.EXPIRED_KEY_SIGNATURE)) {
        statusInfo = EnigmailCommon.getString("failedSig");
        statusLine = statusInfo + EnigmailCommon.getString("clickDetailsButton");
      }
      else if (statusFlags & nsIEnigmail.DECRYPTION_INCOMPLETE) {
        statusInfo = EnigmailCommon.getString("incompleteDecrypt");
        statusLine = statusInfo + EnigmailCommon.getString("clickDetailsButton");
      }
      else if (statusFlags & nsIEnigmail.IMPORTED_KEY) {
        statusLine = "";
        statusInfo = "";
        EnigmailCommon.alert(window, errorMsg);
      }
      else {
        statusInfo = EnigmailCommon.getString("failedDecryptVerify");
        statusLine = statusInfo + EnigmailCommon.getString("viewInfo");
      }
      // add key infos if available
      if (keyId) {
        var si = EnigmailCommon.getString("unverifiedSig");  // "Unverified signature"
        if (statusInfo === "") {
          statusInfo += si;
          statusLine = si + EnigmailCommon.getString("clickDetailsButton");
        }
        //if (statusFlags & nsIEnigmail.INLINE_KEY) {
        //  statusLine = statusInfo + EnigmailCommon.getString("clickDecrypt");
        //} else {
        //  statusLine = statusInfo + EnigmailCommon.getString("clickPen");
        //}
        if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
          statusInfo += "\n" + EnigmailCommon.getString("keyNeeded", [ keyId ]);  // "public key ... needed"
        }
        else {
          statusInfo += "\n" + EnigmailCommon.getString("keyUsed", [ keyId ]);  // "public key ... used"
        }
      }
      statusInfo += "\n\n" + errorMsg;
    }

    if (statusFlags & nsIEnigmail.DECRYPTION_OKAY ||
        (this.statusBar.getAttribute("encrypted")=="ok")) {
      var statusMsg;
      if (xtraStatus && xtraStatus == "buggyMailFormat") {
        statusMsg = EnigmailCommon.getString("decryptedMsgWithFormatError");
      }
      else {
        statusMsg = EnigmailCommon.getString("decryptedMsg");
      }
      if (!statusInfo) {
        statusInfo = statusMsg;
      }
      else {
        statusInfo = statusMsg + "\n" + statusInfo;
      }
      if (!statusLine) {
        statusLine = statusInfo;
      }
      else {
        statusLine = statusMsg + "; " + statusLine;
      }
    }

    if (EnigmailCommon.getPref("displayPartiallySigned")) {
      if (statusFlags & nsIEnigmail.PARTIALLY_PGP) {
        if (msgSigned && msgEncrypted) {
          statusLine = EnigmailCommon.getString("msgPart", [ EnigmailCommon.getString("msgSignedAndEnc") ]);
          statusLine += EnigmailCommon.getString("clickDetailsButton");
          statusInfo = EnigmailCommon.getString("msgPart", [ EnigmailCommon.getString("msgSigned") ]) +
                "\n" + statusInfo;
        }
        else if (msgEncrypted) {
          statusLine = EnigmailCommon.getString("msgPart", [ EnigmailCommon.getString("msgEncrypted") ]);
          statusLine += EnigmailCommon.getString("clickDetailsButton");
            statusInfo = EnigmailCommon.getString("msgPart", [ EnigmailCommon.getString("msgEncrypted") ]) +
                "\n" + statusInfo;
        }
        else if (msgSigned) {
          if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
            statusLine = EnigmailCommon.getString("msgPart", [ EnigmailCommon.getString("msgSignedUnkownKey") ]);
            if (keyId) {
              statusLine += EnigmailCommon.getString("clickImportButton");
            }
            else {
              statusLine += EnigmailCommon.getString("keyTypeUnsupported");
            }
          }
          else {
            statusLine = EnigmailCommon.getString("msgPart", [ EnigmailCommon.getString("msgSigned") ]);
            statusLine += EnigmailCommon.getString("clickDetailsButton");
          }
          statusInfo = EnigmailCommon.getString("msgPart", [ EnigmailCommon.getString("msgSigned") ]) +
                "\n" + statusInfo;
        }
      }
    }

    // if we have parsed ENC_TO entries, add them as status info
    if (encToDetails && encToDetails.length > 0) {
      statusInfo += "\n\n" + EnigmailCommon.getString("encryptKeysNote", [ encToDetails ]);
    }

    if (! statusLine) {
      return;
    }

    Enigmail.msg.securityInfo = { statusFlags: statusFlags,
                          keyId: keyId,
                          userId: userId,
                          statusLine: statusLine,
                          msgSigned: msgSigned,
                          statusArr: statusArr,
                          statusInfo: statusInfo,
                          fullStatusInfo: fullStatusInfo,
                          blockSeparation: blockSeparation };

    var statusText  = document.getElementById("enigmailStatusText");
    var expStatusText  = document.getElementById("expandedEnigmailStatusText");
    var icon = document.getElementById("enigToggleHeaderView2");

    if (statusArr.length>0) {
      expStatusText.value = statusArr[0];
      expStatusText.setAttribute("state", "true");
      icon.removeAttribute("collapsed");
    }
    else {
      expStatusText.value = "";
      expStatusText.setAttribute("state", "false");
      icon.setAttribute("collapsed", "true");
    }

    if (statusLine) {
      this.setStatusText(statusLine +" ");
      this.enigmailBox.removeAttribute("collapsed");
      this.displayExtendedStatus(true);

      if (Enigmail.msg.securityInfo.keyId &&
          (Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) ) {
        document.getElementById("enigmail_importKey").removeAttribute("hidden");
      }
      else {
        document.getElementById("enigmail_importKey").setAttribute("hidden", "true");
      }

    } else {
      this.setStatusText("");
      this.enigmailBox.setAttribute("collapsed", "true");
      this.displayExtendedStatus(false);
    }

    if (!gSMIMEContainer)
      return;

    // Update icons and header-box css-class
    try {
      gSMIMEContainer.collapsed = false;
      gSignedUINode.collapsed = false;
      gEncryptedUINode.collapsed = false;

      if ((statusFlags & nsIEnigmail.BAD_SIGNATURE) &&
          !(statusFlags & nsIEnigmail.GOOD_SIGNATURE)){
        // Display untrusted/bad signature icon
        gSignedUINode.setAttribute("signed", "notok");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
        this.statusBar.setAttribute("signed", "notok");
      }
      else if ((statusFlags & nsIEnigmail.GOOD_SIGNATURE) &&
          (statusFlags & nsIEnigmail.TRUSTED_IDENTITY) &&
          !(statusFlags & (nsIEnigmail.REVOKED_KEY |
                         nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                         nsIEnigmail.EXPIRED_SIGNATURE))) {
        // Display trusted good signature icon
        gSignedUINode.setAttribute("signed", "ok");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
        this.statusBar.setAttribute("signed", "ok");
        bodyElement.setAttribute("enigSigned", "ok");
      }
      else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        // Display unverified signature icon
        gSignedUINode.setAttribute("signed", "unknown");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
        this.statusBar.setAttribute("signed", "unknown");
      }
      else if (statusFlags & (nsIEnigmail.REVOKED_KEY |
                         nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                         nsIEnigmail.EXPIRED_SIGNATURE |
                         nsIEnigmail.GOOD_SIGNATURE)) {
        // Display unverified signature icon
        gSignedUINode.setAttribute("signed", "unknown");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureVerified");
        this.statusBar.setAttribute("signed", "unknown");
      }
      else if (statusFlags & nsIEnigmail.INLINE_KEY) {
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureUnknown");
      }
      else {
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelNoSignature");
      }

      if (statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
        EnigmailCommon.rememberEncryptedUri(this.lastEncryptedMsgKey);

        // Display encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "ok");
        this.statusBar.setAttribute("encrypted", "ok");
      }
      else if (statusFlags &
        (nsIEnigmail.DECRYPTION_INCOMPLETE | nsIEnigmail.DECRYPTION_FAILED) ) {
        // Display un-encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "notok");
        this.statusBar.setAttribute("encrypted", "notok");
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureNotOk");
      }

      // special handling after trying to fix buggy mail format (see buggyExchangeEmailContent in code)
      if (xtraStatus && xtraStatus == "buggyMailFormat") {
        this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelBuggyMailFormat");
      }

      this.updateMsgDb();


    } catch (ex) {}
  },

  dispSecurityContext: function ()
  {

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    try {
      if (Enigmail.msg.securityInfo) {
        if ( (Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.NODATA) &&
             (Enigmail.msg.securityInfo.statusFlags &
               (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ) {
          document.getElementById("enigmail_reloadMessage").removeAttribute("hidden");
        }
        else {
          document.getElementById("enigmail_reloadMessage").setAttribute("hidden", "true");
        }
      }

      var optList = ["pgpSecurityInfo", "copySecurityInfo"];
      for (var j=0; j<optList.length; j++) {
        var menuElement = document.getElementById("enigmail_"+optList[j]);
        if (Enigmail.msg.securityInfo) {
          menuElement.removeAttribute("disabled");
        }
        else {
          menuElement.setAttribute("disabled", "true");
        }
      }

      this.setSenderStatus("signSenderKey", "editSenderKeyTrust" , "showPhoto", "dispKeyDetails");
    }
    catch(ex) {
      EnigmailCommon.ERROR_LOG("error on displaying Security menu:\n"+ex.toString()+"\n");
    }
  },


  updateSendersKeyMenu: function ()
  {
    this.setSenderStatus("keyMgmtSignKey",
                         "keyMgmtKeyTrust",
                         "keyMgmtShowPhoto",
                         "keyMgmtDispKeyDetails",
                         "importpublickey");
  },


  setSenderStatus: function (elemSign, elemTrust, elemPhoto, elemKeyProps, elemImportKey)
  {

    function setElemStatus(elemName, disabledValue) {
      document.getElementById("enigmail_"+elemName).setAttribute("disabled", !disabledValue);

      let secondElem = document.getElementById("enigmail_"+elemName+"2");
      if (secondElem) secondElem.setAttribute("disabled", !disabledValue);
    }

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var photo=false;
    var sign=false;
    var trust=false;
    var unknown = false;
    var signedMsg = false;

    if (Enigmail.msg.securityInfo) {
      if (Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.PHOTO_AVAILABLE) {
        photo=true;
      }
      if (Enigmail.msg.securityInfo.msgSigned ) {
        signedMsg = true;
        if (!(Enigmail.msg.securityInfo.statusFlags &
             (nsIEnigmail.REVOKED_KEY | nsIEnigmail.EXPIRED_KEY_SIGNATURE | nsIEnigmail.UNVERIFIED_SIGNATURE))) {
          sign=true;
        }
        if (!(Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) {
          trust=true;
        }

        if (Enigmail.msg.securityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
          unknown = true;
        }
      }
    }

    if (elemTrust) setElemStatus(elemTrust, trust);
    if (elemSign) setElemStatus(elemSign, sign);
    if (elemPhoto) setElemStatus(elemPhoto, photo);
    if (elemKeyProps) setElemStatus(elemKeyProps, (signedMsg && !unknown));
    if (elemImportKey) setElemStatus(elemImportKey, unknown);
  },

  editKeyExpiry: function ()
  {
    EnigmailFuncs.editKeyExpiry(window, [Enigmail.msg.securityInfo.userId], [Enigmail.msg.securityInfo.keyId]);
    gDBView.reloadMessageWithAllParts();
  },

  editKeyTrust: function ()
  {
    let enigmailSvc = EnigmailCommon.getService();
    let keyId = enigmailSvc.getPubKeyIdForSubkey(Enigmail.msg.securityInfo.keyId);

    EnigmailFuncs.editKeyTrust(window, [Enigmail.msg.securityInfo.userId], [keyId]);
    gDBView.reloadMessageWithAllParts();
  },

  signKey: function ()
  {
    let enigmailSvc = EnigmailCommon.getService();
    let keyId = enigmailSvc.getPubKeyIdForSubkey(Enigmail.msg.securityInfo.keyId);

    EnigmailFuncs.signKey(window, Enigmail.msg.securityInfo.userId, keyId, null);
    gDBView.reloadMessageWithAllParts();
  },


  msgHdrViewLoad: function (event)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewLoad\n");

    var listener = {
      enigmailBox: document.getElementById("enigmailBox"),
      onStartHeaders: function _listener_onStartHeaders ()
      {
        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: _listener_onStartHeaders\n");

        try {

          Enigmail.hdrView.statusBarHide();

          EnigmailVerify.setMsgWindow(msgWindow, Enigmail.msg.getCurrentMsgUriSpec());

          Enigmail.hdrView.setStatusText("");

          this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");

          var msgFrame = EnigmailCommon.getFrame(window, "messagepane");

          if (msgFrame) {
            EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");

            msgFrame.addEventListener("unload", Enigmail.hdrView.messageUnload.bind(Enigmail.hdrView), true);
            msgFrame.addEventListener("load", Enigmail.msg.messageAutoDecrypt.bind(Enigmail.msg), false);
          }

          Enigmail.hdrView.forgetEncryptedMsgKey();

          if (messageHeaderSink) {
            try {
              messageHeaderSink.enigmailPrepSecurityInfo();
            }
            catch (ex) {}
          }
        }
        catch (ex) {}
      },

      onEndHeaders: function _listener_onEndHeaders ()
      {
        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: _listener_onEndHeaders\n");
        try {
          Enigmail.hdrView.statusBarHide();

          this.enigmailBox.setAttribute("class", "expandedEnigmailBox enigmailHeaderBoxLabelSignatureOk");
        }
        catch (ex) {}
      },

      beforeStartHeaders: function _listener_beforeStartHeaders ()
      {
        return true;
      }
    };

    gMessageListeners.push(listener);
  },

  messageUnload: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.messageUnload\n");
  },

  hdrViewUnload: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.hdrViewUnLoad\n");
    this.forgetEncryptedMsgKey();
  },

  copyStatusInfo: function ()
  {
    if (Enigmail.msg.securityInfo) {
      var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);
      clipHelper.copyString(Enigmail.msg.securityInfo.statusInfo);
    }

  },

  showPhoto: function ()
  {
    if (! Enigmail.msg.securityInfo) return;

    let enigmailSvc = EnigmailCommon.getService();
    let keyId = enigmailSvc.getPubKeyIdForSubkey(Enigmail.msg.securityInfo.keyId);

    EnigmailFuncs.showPhoto(window, keyId, Enigmail.msg.securityInfo.userId);
  },


  dispKeyDetails: function ()
  {
    if (! Enigmail.msg.securityInfo) return;

    let enigmailSvc = EnigmailCommon.getService();
    let keyId = enigmailSvc.getPubKeyIdForSubkey(Enigmail.msg.securityInfo.keyId);

    EnigmailFuncs.openKeyDetails(window, keyId, false);
  },

  createRuleFromAddress: function (emailAddressNode)
  {
    if (emailAddressNode)
    {
      if (typeof(findEmailNodeFromPopupNode)=="function") {
        emailAddressNode = findEmailNodeFromPopupNode(emailAddressNode, 'emailAddressPopup');
      }
      EnigmailFuncs.createNewRule(window, emailAddressNode.getAttribute("emailAddress"));
    }
  },

  forgetEncryptedMsgKey: function ()
  {
    if (Enigmail.hdrView.lastEncryptedMsgKey)
    {
      EnigmailCommon.forgetEncryptedUri(Enigmail.hdrView.lastEncryptedMsgKey);
      Enigmail.hdrView.lastEncryptedMsgKey = null;
    }
  },

  msgHdrViewHide: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewHide\n");
    this.enigmailBox.setAttribute("collapsed", true);

    Enigmail.msg.securityInfo = { statusFlags: 0,
                        keyId: "",
                        userId: "",
                        statusLine: "",
                        statusInfo: "",
                        fullStatusInfo: "" };

  },

  msgHdrViewUnhide: function (event)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.msgHdrViewUnhide:\n");

    if (Enigmail.msg.securityInfo.statusFlags !== 0) {
      this.enigmailBox.removeAttribute("collapsed");
    }
  },

  displayExtendedStatus: function (displayOn)
  {
    var expStatusText  = document.getElementById("expandedEnigmailStatusText");
    if (displayOn && expStatusText.getAttribute("state") == "true") {
      if (expStatusText.getAttribute("display") == "true") {
        expStatusText.removeAttribute("collapsed");
      }
      else {
        expStatusText.setAttribute("collapsed", "true");
      }
    }
    else {
      expStatusText.setAttribute("collapsed", "true");
    }
  },

  toggleHeaderView: function ()
  {
    var viewToggle = document.getElementById("enigToggleHeaderView2");
    var expandedText = document.getElementById("expandedEnigmailStatusText");
    var state = viewToggle.getAttribute("state");

    if (state=="true") {
      viewToggle.setAttribute("state", "false");
      viewToggle.setAttribute("class", "enigmailExpandViewButton");
      expandedText.setAttribute("display", "false");
      this.displayExtendedStatus(false);
    }
    else {
      viewToggle.setAttribute("state", "true");
      viewToggle.setAttribute("class", "enigmailCollapseViewButton");
      expandedText.setAttribute("display", "true");
      this.displayExtendedStatus(true);
    }
  },

  enigOnShowAttachmentContextMenu: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.enigOnShowAttachmentContextMenu\n");
    // first, call the original function ...

    try {
      // Thunderbird
      onShowAttachmentItemContextMenu();
    }
    catch (ex) {
      // SeaMonkey
      onShowAttachmentContextMenu();
    }

    // then, do our own additional stuff ...

    // Thunderbird
    var contextMenu = document.getElementById('attachmentItemContext');
    var selectedAttachments = contextMenu.attachments;

    if (! contextMenu) {
      // SeaMonkey
      contextMenu = document.getElementById('attachmentListContext');
      selectedAttachments = attachmentList.selectedItems;
    }

    var decryptOpenMenu = document.getElementById('enigmail_ctxDecryptOpen');
    var decryptSaveMenu = document.getElementById('enigmail_ctxDecryptSave');
    var importMenu = document.getElementById('enigmail_ctxImportKey');
    var verifyMenu = document.getElementById('enigmail_ctxVerifyAtt');

    if (selectedAttachments.length > 0) {
      if (selectedAttachments[0].contentType.search(/^application\/pgp-keys/i) === 0) {
        importMenu.removeAttribute('disabled');
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.setAttribute('disabled', true);
      }
      else if (Enigmail.msg.checkSignedAttachment(selectedAttachments[0], null)) {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.removeAttribute('disabled');
      }
      else if (Enigmail.msg.checkEncryptedAttach(selectedAttachments[0])) {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.removeAttribute('disabled');
        decryptSaveMenu.removeAttribute('disabled');
        verifyMenu.setAttribute('disabled', true);
        if (typeof(selectedAttachments[0].displayName) == "undefined") {
          if (! selectedAttachments[0].name) {
            selectedAttachments[0].name="message.pgp";
          }
        }
        else
          if (! selectedAttachments[0].displayName) {
            selectedAttachments[0].displayName="message.pgp";
          }
      }
      else {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.setAttribute('disabled', true);
      }
    }
    else {
      openMenu.setAttribute('disabled', true);
      saveMenu.setAttribute('disabled', true);
      decryptOpenMenu.setAttribute('disabled', true);
      decryptSaveMenu.setAttribute('disabled', true);
      importMenu.setAttribute('disabled', true);
      verifyMenu.setAttribute('disabled', true);
    }
  },

  updateMsgDb: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.updateMsgDb\n");
    var msg = gFolderDisplay.selectedMessage;
    var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
    if (this.statusBar.getAttribute("encrypted") == "ok")
      Enigmail.msg.securityInfo.statusFlags |= Components.interfaces.nsIEnigmail.DECRYPTION_OKAY;
    msgHdr.setUint32Property("enigmail", Enigmail.msg.securityInfo.statusFlags);
  },

  enigCanDetachAttachments: function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: this.enigCanDetachAttachments\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var canDetach = true;
    if (Enigmail.msg.securityInfo && (typeof(Enigmail.msg.securityInfo.statusFlags) != "undefined")) {
      canDetach = ((Enigmail.msg.securityInfo.statusFlags &
                   (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ? false : true);
    }
    return canDetach;
  },

  fillAttachmentListPopup: function (item)
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: Enigmail.hdrView.fillAttachmentListPopup\n");
    FillAttachmentListPopup(item);

    if (! this.enigCanDetachAttachments()) {
      for (var i=0; i< item.childNodes.length; i++) {
        if (item.childNodes[i].className == "menu-iconic") {
          var mnu = item.childNodes[i].firstChild.firstChild;
          while (mnu) {
            if (mnu.getAttribute("oncommand").search(/(detachAttachment|deleteAttachment)/) >=0) {
              mnu.setAttribute("disabled" , true);
            }
            mnu = mnu.nextSibling;
          }
        }
      }
    }
  }

};

window.addEventListener("load", Enigmail.hdrView.hdrViewLoad.bind(Enigmail.hdrView), false);
addEventListener('messagepane-loaded', Enigmail.hdrView.msgHdrViewLoad.bind(Enigmail.hdrView), true);
addEventListener('messagepane-unloaded', Enigmail.hdrView.hdrViewUnload.bind(Enigmail.hdrView), true);
addEventListener('messagepane-hide', Enigmail.hdrView.msgHdrViewHide.bind(Enigmail.hdrView), true);
addEventListener('messagepane-unhide', Enigmail.hdrView.msgHdrViewUnhide.bind(Enigmail.hdrView), true);

////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

// there is unfortunately no other way to add Enigmail to the validator than this

function CanDetachAttachments()
{
  var canDetach = !gFolderDisplay.selectedMessageIsNews &&
                  (!gFolderDisplay.selectedMessageIsImap || MailOfflineMgr.isOnline());

  if (canDetach && ("content-type" in currentHeaderData))
  {
    var contentType = currentHeaderData["content-type"].headerValue;

    canDetach = !ContentTypeIsSMIME(currentHeaderData["content-type"].headerValue);
  }
  return canDetach && Enigmail.hdrView.enigCanDetachAttachments();
}


////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING EXTENDS CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

if (messageHeaderSink) {
  messageHeaderSink.enigmailPrepSecurityInfo = function ()
  {
    EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: enigmailPrepSecurityInfo\n");


    /// BEGIN EnigMimeHeaderSink definition
    function EnigMimeHeaderSink(innerSMIMEHeaderSink) {
        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.innerSMIMEHeaderSink="+innerSMIMEHeaderSink+"\n");
      this._smimeHeaderSink = innerSMIMEHeaderSink;
    }

    EnigMimeHeaderSink.prototype =
    {
      _smimeHeaderSink: null,

      QueryInterface : function(iid)
      {
        //EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.QI: "+iid+"\n");
        if (iid.equals(Components.interfaces.nsIMsgSMIMEHeaderSink) &&
            this._smimeHeaderSink)
          return this;

        if (iid.equals(Components.interfaces.nsIEnigMimeHeaderSink) ||
            iid.equals(Components.interfaces.nsISupports) )
          return this;

        throw Components.results.NS_NOINTERFACE;
      },

      updateSecurityStatus: function (unusedUriSpec, exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation, uri, encToDetails)
      {
        // unusedUriSpec is not used anymore. It is here becaue other addons rely on the same API

        let uriSpec = (uri ? uri.spec : null);

        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: uri.spec="+uriSpec+"\n");

        let msgUriSpec = Enigmail.msg.getCurrentMsgUriSpec();

        let url = {};
        try{
          let messenger = Components.classes["@mozilla.org/messenger;1"].getService(Components.interfaces.nsIMessenger);
          let msgSvc = messenger.messageServiceFromURI(msgUriSpec);
          msgSvc.GetUrlForUri(msgUriSpec, url, null);
        }
        catch (ex) {
          EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: could not determine URL\n");
          url.value = { spec: "enigmail://invalid/message" };
        }

        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.updateSecurityStatus: url="+url.value.spec+"\n");

        if (!uriSpec || uriSpec.search(/^enigmail:/) === 0 || (uriSpec.indexOf(url.value.spec) === 0 &&
              uriSpec.substr(url.value.spec.length).search(/([\?&].*)?$/) === 0)) {
          Enigmail.hdrView.updateHdrIcons(exitCode, statusFlags, keyId, userId, sigDetails,
                                          errorMsg, blockSeparation, encToDetails,
                                          null);   // xtraStatus
        }

        if (uriSpec && uriSpec.search(/^enigmail:message\//) === 0) {
          // display header for broken MS-Exchange message
          let ebeb = document.getElementById("enigmailBrokenExchangeBox");
          ebeb.removeAttribute("collapsed");
        }

        return;
      },

      maxWantedNesting: function ()
      {
        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.maxWantedNesting:\n");
        return this._smimeHeaderSink.maxWantedNesting();
      },

      signedStatus: function (aNestingLevel, aSignatureStatus, aSignerCert)
      {
        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.signedStatus:\n");
        return this._smimeHeaderSink.signedStatus(aNestingLevel, aSignatureStatus, aSignerCert);
      },

      encryptionStatus: function (aNestingLevel, aEncryptionStatus, aRecipientCert)
      {
        EnigmailCommon.DEBUG_LOG("enigmailMsgHdrViewOverlay.js: EnigMimeHeaderSink.encryptionStatus:\n");
        return this._smimeHeaderSink.encryptionStatus(aNestingLevel, aEncryptionStatus, aRecipientCert);
      }

    };
    /// END EnigMimeHeaderSink definition

    var innerSMIMEHeaderSink = null;
    var enigmailHeaderSink = null;

    try {
      innerSMIMEHeaderSink = this.securityInfo.QueryInterface(Components.interfaces.nsIMsgSMIMEHeaderSink);

      try {
        enigmailHeaderSink = innerSMIMEHeaderSink.QueryInterface(Components.interfaces.nsIEnigMimeHeaderSink);
      } catch (ex) {}
    } catch (ex) {}

    if (!enigmailHeaderSink) {
      this.securityInfo = new EnigMimeHeaderSink(innerSMIMEHeaderSink);
    }
  };
}
