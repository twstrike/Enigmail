/*global Components: false, Locale: false, Data: false, App: false, Dialog: false, Timer: false */
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
 *   Patrick Brunschwig <patrick@enigmail.net>
 *   Ludwig Hügelschäfer <ludwig@hammernoch.net>
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


/*global MimeBody: false, MimeUnknown: false, MimeMessageAttachment: false */
/*global msgHdrToMimeMessage: false, MimeMessage: false, MimeContainer: false */
Components.utils.import("resource://enigmail/glodaMime.jsm");
Components.utils.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Components.utils.import("resource://enigmail/enigmailFuncs.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/prefs.jsm");
Components.utils.import("resource://enigmail/os.jsm");
Components.utils.import("resource://enigmail/armor.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/files.jsm");
Components.utils.import("resource://enigmail/data.jsm");
Components.utils.import("resource://enigmail/app.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/timer.jsm");
Components.utils.import("resource://enigmail/events.jsm"); /*global Events: false */
Components.utils.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */
Components.utils.import("resource://enigmail/uris.jsm"); /*global URIs: false */
Components.utils.import("resource://enigmail/constants.jsm"); /*global Constants: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

try {
  Components.utils.import("resource:///modules/MailUtils.js");
}
catch(ex) {}


if (! Enigmail) var Enigmail = {};

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";
const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

Enigmail.msg = {
  editor: null,
  dirty: null,
  processed: null,
  timeoutId: null,
  sendPgpMime: false,
  sendMode: null,    // the current default for sending a message (0, SIGN, ENCRYPT, or SIGN|ENCRYPT)
  sendModeDirty: false,  // send mode or final send options changed?

  // processed reasons for encryption:
  reasonEncrypted: "",
  reasonSigned:    "",

  // encrypt/sign/pgpmime according to rules?
  // (1:ENIG_UNDEF(undef/maybe), 0:ENIG_NEVER(never/forceNo), 2:ENIG_ALWAYS(always/forceYes),
  //  22:ENIG_AUTO_ALWAYS, 99:ENIG_CONFLICT(conflict))
  encryptByRules: Constants.ENIG_UNDEF,
  signByRules:    Constants.ENIG_UNDEF,
  pgpmimeByRules: Constants.ENIG_UNDEF,

  // forced to encrypt/sign/pgpmime?
  // (1:ENIG_UNDEF(undef/maybe), 0:ENIG_NEVER(never/forceNo), 2:ENIG_ALWAYS(always/forceYes))
  encryptForced: Constants.ENIG_UNDEF,
  signForced:    Constants.ENIG_UNDEF,
  pgpmimeForced: Constants.ENIG_UNDEF,

  finalSignDependsOnEncrypt: false,  // does signing finally depends on encryption mode?

  // resulting final encrypt/sign/pgpmime mode:
  //  (-1:ENIG_FINAL_UNDEF, 0:ENIG_FINAL_NO, 1:ENIG_FINAL_YES, 10:ENIG_FINAL_FORCENO, 11:ENIG_FINAL_FORCEYES, 99:ENIG_FINAL_CONFLICT)
  statusEncrypted: Constants.ENIG_FINAL_UNDEF,
  statusSigned:    Constants.ENIG_FINAL_UNDEF,
  statusPGPMime:   Constants.ENIG_FINAL_UNDEF,
  statusEncryptedInStatusBar: null, // last statusEncyrpted when processing status buttons
                                    // to find possible broken promise of encryption

  // processed strings to signal final encrypt/sign/pgpmime state:
  statusEncryptedStr: "???",
  statusSignedStr:    "???",
  statusPGPMimeStr:   "???",
  statusInlinePGPStr:  "???",

  sendProcess: false,
  nextCommandId: null,
  docaStateListener: null,
  identity: null,
  enableRules: null,
  modifiedAttach: null,
  lastFocusedWindow: null,
  determineSendFlagId: null,
  trustAllKeys: false,
  attachOwnKeyObj: {
      appendAttachment: false,
      attachedObj: null,
      attachedKey: null
  },

  compFieldsEnig_CID: "@mozdev.org/enigmail/composefields;1",


  composeStartup: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeStartup\n");

    function delayedProcessFinalState() {
      Timer.setTimeout(function _f() {
          Enigmail.msg.processFinalState();
          Enigmail.msg.updateStatusBar();
      },
                                50);
    }

    // Relabel/hide SMIME button and menu item
    var smimeButton = document.getElementById("button-security");

    if (smimeButton) {
      smimeButton.setAttribute("label", "S/MIME");
    }

    var enigButton = document.getElementById("button-enigmail-send");

    var msgId = document.getElementById("msgIdentityPopup");
    if (msgId) {
      msgId.addEventListener("command", Enigmail.msg.setIdentityCallback);
    }

    var subj = document.getElementById("msgSubject");
    subj.addEventListener('focus', Enigmail.msg.fireSendFlags);
    //subj.setAttribute('onfocus', "Enigmail.msg.fireSendFlags()");

    // listen to S/MIME changes to potentially display "conflict" message
    let s = document.getElementById("menu_securitySign1");
    if (s) s.addEventListener("command", delayedProcessFinalState );
    s = document.getElementById("menu_securitySign2");
    if (s) s.addEventListener("command", delayedProcessFinalState );
    s = document.getElementById("menu_securityEncryptRequire1");
    if (s) s.addEventListener("command", delayedProcessFinalState );
    s = document.getElementById("menu_securityEncryptRequire2");
    if (s) s.addEventListener("command", delayedProcessFinalState );

    this.msgComposeReset(false);   // false => not closing => call setIdentityDefaults()
    this.composeOpen();
    this.processFinalState();
    this.updateStatusBar();
  },


  composeUnload: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeUnload\n");
    //if (gMsgCompose)
    //  gMsgCompose.UnregisterStateListener(Enigmail.composeStateListener);
  },


  handleClick: function (event, modifyType)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.handleClick\n");
    switch (event.button) {
    case 2:
      // do not process the event any futher
      // needed on Windows to prevent displaying the context menu
      event.preventDefault();
      this.doPgpButton();
      break;
    case 0:
      this.doPgpButton(modifyType);
      break;
    }
  },


  setIdentityCallback: function (elementId)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setIdentityCallback: elementId="+elementId+"\n");

    Timer.setTimeout(function _f() {
        Enigmail.msg.setIdentityDefaults();
    },
                              50);
  },


  /* return whether the account specific setting key is enabled or disabled
   */
  getAccDefault: function (key)
  {
    //Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.getAccDefault: identity="+this.identity.key+"("+this.identity.email+") key="+key+"\n");

    var enabled = this.identity.getBoolAttribute("enablePgp");
    if (key == "enabled") {
      return enabled;
    }

    if (enabled) {
      var res=null;
      switch (key) {
       case 'sign':
        res=(this.identity.getIntAttribute("defaultSigningPolicy") > 0); // converts int property to bool property
        break;
       case 'encrypt':
        res=(this.identity.getIntAttribute("defaultEncryptionPolicy") > 0); // converts int property to bool property
        break;
       case 'pgpMimeMode':
        res=this.identity.getBoolAttribute(key);
        break;
       case 'signIfNotEnc':
        res=this.identity.getBoolAttribute("pgpSignPlain");
        break;
       case 'signIfEnc':
        res=this.identity.getBoolAttribute("pgpSignEncrypted");
        break;
       case 'attachPgpKey':
        res=this.identity.getBoolAttribute(key);
        break;
      }
      //Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.getAccDefault:   "+key+"="+res+"\n");
      return res;
    }
    else {
      // every detail is disabled if OpenPGP in general is disabled:
      switch (key) {
       case 'sign':
       case 'encrypt':
       case 'signIfNotEnc':
       case 'signIfEnc':
       case 'pgpMimeMode':
       case 'attachPgpKey':
        return false;
      }
    }

    // should not be reached
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.getAccDefault:   internal error: invalid key '"+key+"'\n");
    return null;
  },


  setIdentityDefaults: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setIdentityDefaults\n");

    this.identity = getCurrentIdentity();
    if (this.getAccDefault("enabled")) {
      EnigmailFuncs.getSignMsg(this.identity); // convert old acc specific to new acc specific options
    }
    else {
      // reset status strings in menu to useful defaults
      this.statusEncryptedStr = Locale.getString("encryptNo");
      this.statusSignedStr = Locale.getString("signNo", [""]);
      this.statusPGPMimeStr = Locale.getString("pgpmimeYes");
      this.statusInlinePGPStr = Locale.getString("pgpmimeNo");
    }

    // reset default send settings, unless we have changed them already
    if (!this.sendModeDirty) {
      this.processAccountSpecificDefaultOptions();
      this.determineSendFlags();  // important to use identity specific settings
      this.processFinalState();
      this.updateStatusBar();
    }
  },


  // set the current default for sending a message
  // depending on the identity
  processAccountSpecificDefaultOptions: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.processAccountSpecificDefaultOptions\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    this.sendMode = 0;
    if (! this.getAccDefault("enabled")) {
      return;
    }

    if (this.getAccDefault("encrypt")) {
      this.sendMode |= ENCRYPT;
      this.reasonEncrypted = Locale.getString("reasonEnabledByDefault");
    }
    if (this.getAccDefault("sign")) {
      this.sendMode |= SIGN;
      this.reasonSigned = Locale.getString("reasonEnabledByDefault");
    }

    this.sendPgpMime = this.getAccDefault("pgpMimeMode");
    this.attachOwnKeyObj.appendAttachment = this.getAccDefault("attachPgpKey");
    this.setOwnKeyStatus();
    this.attachOwnKeyObj.attachedObj = null;
    this.attachOwnKeyObj.attachedKey = null;

    this.finalSignDependsOnEncrypt = (this.getAccDefault("signIfEnc") || this.getAccDefault("signIfNotEnc"));
  },


  getMsgProperties: function (msgUri, draft)
  {
    Log.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.getMsgProperties:\n");
    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var properties = 0;
    try {
      var messenger = Components.classes["@mozilla.org/messenger;1"].getService(Components.interfaces.nsIMessenger);
      var msgHdr = messenger.messageServiceFromURI(msgUri).messageURIToMsgHdr(msgUri);
      if (msgHdr) {
        properties = msgHdr.getUint32Property("enigmail");
        if (draft) {
          try {
            msgHdrToMimeMessage(msgHdr , null, this.getMsgPropertiesCb, true,
            { examineEncryptedParts: true });
          }
          catch (ex) {
            Log.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.getMsgProperties: cannot use msgHdrToMimeMessage\n");
          }
        }
      }
    }
    catch (ex) {
      Log.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.getMsgProperties: got exception '"+ex.toString() +"'\n");
    }

    if (URIs.isEncryptedUri(msgUri)) {
      properties |= nsIEnigmail.DECRYPTION_OKAY;
    }

    return properties;
  },

  getMsgPropertiesCb: function  (msg, mimeMsg)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.getMsgPropertiesCb\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var stat = "";
    if (mimeMsg && mimeMsg.headers["x-enigmail-draft-status"]) {
      stat = String(mimeMsg.headers["x-enigmail-draft-status"]);
    }
    else {
      return;
    }

    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.getMsgPropertiesCb: draftStatus: "+stat+"\n");

    if (stat.substr(0,1) == "N") {
      // new style drafts (Enigmail 1.7)

      var enc = "final-encryptDefault";
      switch (Number(stat.substr(1,1))) {
      case Constants.ENIG_NEVER:
          enc = "final-encryptNo";
          break;
      case Constants.ENIG_ALWAYS:
          enc = "final-encryptYes";
      }

      var sig = "final-signDefault";
      switch (Number(stat.substr(2,1))) {
      case Constants.ENIG_NEVER:
          sig = "final-signNo";
          break;
      case Constants.ENIG_ALWAYS:
          sig = "final-signYes";
      }

      var pgpMime = "final-pgpmimeDefault";
      switch (Number(stat.substr(3,1))) {
      case Constants.ENIG_NEVER:
          pgpMime = "final-pgpmimeNo";
          break;
      case Constants.ENIG_ALWAYS:
          pgpMime = "final-pgpmimeYes";
      }

      Enigmail.msg.setFinalSendMode(enc);
      Enigmail.msg.setFinalSendMode(sig);
      Enigmail.msg.setFinalSendMode(pgpMime);

      if (stat.substr(4,1) == "1") Enigmail.msg.attachOwnKeyObj.appendAttachment = true;
    }
    else {
      // drafts from older versions of Enigmail
      var flags = Number(stat);
      if (flags & nsIEnigmail.SEND_SIGNED) Enigmail.msg.setFinalSendMode('final-signYes');
      if (flags & nsIEnigmail.SEND_ENCRYPTED) Enigmail.msg.setFinalSendMode('final-encryptYes');
      if (flags & nsIEnigmail.SEND_ATTACHMENT) Enigmail.msg.attachOwnKeyObj.appendAttachment = true;
    }
    Enigmail.msg.setOwnKeyStatus();
  },


  composeOpen: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeOpen\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var msgFlags;
    var msgUri = null;
    var msgIsDraft = false;
    this.determineSendFlagId = null;
    this.disableSmime = false;

    var toobarElem = document.getElementById("composeToolbar2");
    if (toobarElem && (OS.getOS() == "Darwin")) {
      toobarElem.setAttribute("platform", "macos");
    }

    // check rules for status bar icons on each change of the recipients
    var adrCol = document.getElementById("addressCol2#1");  // recipients field
    if (adrCol) {
      let attr = adrCol.getAttribute("oninput");
      adrCol.setAttribute("oninput", attr+"; Enigmail.msg.addressOnChange().bind(Enigmail.msg);");
      attr = adrCol.getAttribute("onchange");
      adrCol.setAttribute("onchange", attr+"; Enigmail.msg.addressOnChange().bind(Enigmail.msg);");
    }
    adrCol = document.getElementById("addressCol1#1");      // to/cc/bcc/... field
    if (adrCol) {
      let attr = adrCol.getAttribute("oncommand");
      adrCol.setAttribute("oncommand", attr+"; Enigmail.msg.addressOnChange().bind(Enigmail.msg);");
    }

    var draftId = gMsgCompose.compFields.draftId;

    if (Prefs.getPref("keepSettingsForReply") && (!(this.sendMode & ENCRYPT)) || (typeof(draftId)=="string" && draftId.length>0)) {
        if (typeof(draftId)=="string" && draftId.length>0) {
          // original message is draft
          msgUri = draftId.replace(/\?.*$/, "");
          msgIsDraft = true;
        }
        else if (typeof(gMsgCompose.originalMsgURI)=="string" && gMsgCompose.originalMsgURI.length>0) {
          // original message is a "true" mail
          msgUri = gMsgCompose.originalMsgURI;
        }

        if (msgUri !== null) {
          msgFlags = this.getMsgProperties(msgUri, msgIsDraft);
          if (! msgIsDraft) {
            if (msgFlags & nsIEnigmail.DECRYPTION_OKAY) {
              Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.composeOpen: has encrypted originalMsgUri\n");
              Log.DEBUG("originalMsgURI="+gMsgCompose.originalMsgURI+"\n");
              this.setSendMode('encrypt');

              // TODO: disable S/MIME in case it is enabled

              this.disableSmime = true;
            }
            else if (msgFlags & (nsIEnigmail.GOOD_SIGNATURE |
                nsIEnigmail.BAD_SIGNATURE |
                nsIEnigmail.UNVERIFIED_SIGNATURE)) {
              this.setSendMode('sign');
            }
          }
          this.removeAttachedKey();
        }
    }

    // check for attached signature files and remove them
    var bucketList = document.getElementById("attachmentBucket");
    if (bucketList.hasChildNodes()) {
      var node = bucketList.firstChild;
      nodeNumber=0;
      while (node) {
        if (node.attachment.contentType == "application/pgp-signature") {
          if (! this.findRelatedAttachment(bucketList, node)) {
            node = bucketList.removeItemAt(nodeNumber);
            // Let's release the attachment object held by the node else it won't go away until the window is destroyed
            node.attachment = null;
          }
        }
        else {
          ++nodeNumber;
        }
        node = node.nextSibling;
      }
      if (! bucketList.hasChildNodes()) {
        try {
          // TB only
          UpdateAttachmentBucket(false);
        }
        catch (ex) {}
      }
    }

    try {
      // TB only
      UpdateAttachmentBucket(bucketList.hasChildNodes());
    }
    catch (ex) {}

    this.processFinalState();
    this.updateStatusBar();
  },


  // check if an signature is related to another attachment
  findRelatedAttachment: function (bucketList, node)
  {

    // check if filename ends with .sig
    if (node.attachment.name.search(/\.sig$/i) < 0) return null;

    var relatedNode = bucketList.firstChild;
    var findFile = node.attachment.name.toLowerCase();
    var baseAttachment = null;
    while (relatedNode) {
      if (relatedNode.attachment.name.toLowerCase()+".sig" == findFile) baseAttachment = relatedNode.attachment;
      relatedNode = relatedNode.nextSibling;
    }
    return baseAttachment;
  },

  msgComposeReopen: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeReopen\n");
    this.msgComposeReset(false);   // false => not closing => call setIdentityDefaults()
    this.composeOpen();
    this.fireSendFlags();

    Timer.setTimeout(function _f() {
        Log.DEBUG("enigmailMsgComposeOverlay: re-determine send flags\n");
        try {
          this.determineSendFlags();
          this.processFinalState();
          this.updateStatusBar();
        }
        catch(ex) {
          Log.DEBUG("enigmailMsgComposeOverlay: re-determine send flags - ERROR: "+ex.toString()+"\n");
        }
      }.bind(Enigmail.msg), 1000);
  },


  msgComposeClose: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeClose\n");

    var ioServ;
    try {
      // we should delete the original temporary files of the encrypted or signed
      // inline PGP attachments (the rest is done automatically)
      if (this.modifiedAttach) {
        ioServ = Components.classes[IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        if (!ioServ)
          return;

        for (var i in this.modifiedAttach) {
          if (this.modifiedAttach[i].origTemp) {
            Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeClose: deleting "+this.modifiedAttach[i].origUrl+"\n");
            var fileUri = ioServ.newURI(this.modifiedAttach[i].origUrl, null, null);
            var fileHandle = Components.classes[LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
            fileHandle.initWithPath(fileUri.path);
            if (fileHandle.exists()) fileHandle.remove(false);
          }
        }
        this.modifiedAttach = null;
      }

    } catch (ex) {
      Log.ERROR("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: could not delete all files:\n"+ex.toString()+"\n");
    }

    this.msgComposeReset(true);  // true => closing => don't call setIdentityDefaults()
  },


  msgComposeReset: function (closing)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.msgComposeReset\n");

    this.dirty = 0;
    this.processed = null;
    this.timeoutId = null;

    this.modifiedAttach=null;
    this.sendMode = 0;
    this.sendModeDirty = false;
    this.reasonEncrypted = "";
    this.reasonSigned =    "";
    this.encryptByRules = Constants.ENIG_UNDEF;
    this.signByRules =    Constants.ENIG_UNDEF;
    this.pgpmimeByRules = Constants.ENIG_UNDEF;
    this.signForced =    Constants.ENIG_UNDEF;
    this.encryptForced = Constants.ENIG_UNDEF;
    this.pgpmimeForced = Constants.ENIG_UNDEF;
    this.finalSignDependsOnEncrypt = false;
    this.statusSigned =    Constants.ENIG_FINAL_UNDEF;
    this.statusEncrypted = Constants.ENIG_FINAL_UNDEF;
    this.statusPGPMime =   Constants.ENIG_FINAL_UNDEF;
    this.statusEncryptedStr = "???";
    this.statusSignedStr =    "???";
    this.statusPGPMimeStr =   "???";
    this.statusInlinePGPStr = "???";
    this.enableRules = true;
    this.identity = null;
    this.sendProcess = false;
    this.trustAllKeys = false;

    if (! closing) {
      this.setIdentityDefaults();
    }
  },


  initRadioMenu: function (prefName, optionIds)
  {
    Log.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.initRadioMenu: "+prefName+"\n");

    var encryptId;

    var prefValue = Prefs.getPref(prefName);

    if (prefValue >= optionIds.length)
      return;

    var menuItem = document.getElementById("enigmail_"+optionIds[prefValue]);
    if (menuItem)
      menuItem.setAttribute("checked", "true");
  },


  usePpgMimeOption: function (value)
  {
    Log.DEBUG("enigmailMessengerOverlay.js: Enigmail.msg.usePpgMimeOption: "+value+"\n");

    Prefs.setPref("usePGPMimeOption", value);

    return true;
  },

  togglePgpMime: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.togglePgpMime\n");

    this.sendPgpMime = !this.sendPgpMime;
  },

  tempTrustAllKeys: function() {
    this.trustAllKeys = !this.trustAllKeys;
  },

  toggleAttachOwnKey: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleAttachOwnKey\n");
    EnigmailCore.getService(window); // make sure Enigmail is loaded and working

    this.attachOwnKeyObj.appendAttachment = !this.attachOwnKeyObj.appendAttachment;

    this.setOwnKeyStatus();
  },

  /***
   * set broadcaster to display whether the own key is attached or not
   */

  setOwnKeyStatus: function ()
  {
    let bc = document.getElementById("enigmail-bc-attach");

    if (this.attachOwnKeyObj.appendAttachment) {
      bc.setAttribute("addPubkey", "true");
      bc.setAttribute("checked", "true");
    }
    else {
      bc.setAttribute("addPubkey", "false");
      bc.removeAttribute("checked");
    }
  },

  attachOwnKey: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.attachOwnKey:\n");

    var userIdValue;

    if (this.identity.getIntAttribute("pgpKeyMode")>0) {
      userIdValue = this.identity.getCharAttribute("pgpkeyId");

      if (this.attachOwnKeyObj.attachedKey && (this.attachOwnKeyObj.attachedKey != userIdValue)) {
        // remove attached key if user ID changed
        this.removeAttachedKey();
      }

      if (! this.attachOwnKeyObj.attachedKey) {
        var attachedObj = this.extractAndAttachKey( [userIdValue] );
        if (attachedObj) {
          this.attachOwnKeyObj.attachedObj = attachedObj;
          this.attachOwnKeyObj.attachedKey = userIdValue;
        }
      }
    }
    else {
       Log.ERROR("enigmailMsgComposeOverlay.js: Enigmail.msg.attachOwnKey: trying to attach unknown own key!\n");
    }
  },

  attachKey: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.attachKey: \n");

    var resultObj = {};
    var inputObj = {};
    inputObj.dialogHeader = Locale.getString("keysToExport");
    inputObj.options = "multisel,allowexpired,nosending";
    if (this.trustAllKeys) {
      inputObj.options += ",trustallkeys";
    }
    var userIdValue="";

    window.openDialog("chrome://enigmail/content/enigmailKeySelection.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);
    try {
      if (resultObj.cancelled) return;
      this.extractAndAttachKey(resultObj.userList);
    } catch (ex) {
      // cancel pressed -> do nothing
      return;
    }
  },

  extractAndAttachKey: function (uid)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.attachKey: \n");
    var enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc)
      return null;

    var tmpDir=Files.getTempDir();
    var tmpFile;
    try {
      tmpFile = Components.classes[LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
      tmpFile.initWithPath(tmpDir);
      if (!(tmpFile.isDirectory() && tmpFile.isWritable())) {
        Dialog.alert(window, Locale.getString("noTempDir"));
        return null;
      }
    }
    catch (ex) {
      Log.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.extractAndAttachKey", ex);
    }
    tmpFile.append("key.asc");
    tmpFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);

    // save file
    var exitCodeObj= {};
    var errorMsgObj = {};

    KeyRing.extractKey(window, 0, uid.join(" "), tmpFile /*.path */, exitCodeObj, errorMsgObj);
    if (exitCodeObj.value !== 0) {
      Dialog.alert(window, errorMsgObj.value);
      return  null;
    }

    // create attachment
    var ioServ = Components.classes[IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
    var tmpFileURI = ioServ.newFileURI(tmpFile);
    var keyAttachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
    keyAttachment.url = tmpFileURI.spec;
    if ((uid.length == 1) && (uid[0].search(/^(0x)?[a-fA-F0-9]+$/)===0)) {
      keyAttachment.name = "0x"+uid[0].substr(-8,8)+".asc";
    }
    else {
      keyAttachment.name = "pgpkeys.asc";
    }
    keyAttachment.temporary = true;
    keyAttachment.contentType = "application/pgp-keys";

    // add attachment to msg
    this.addAttachment(keyAttachment);

    try {
      // TB only
      ChangeAttachmentBucketVisibility(false);
    }
    catch (ex) {}
    gContentChanged = true;
    return keyAttachment;
  },

  addAttachment: function (attachment)
  {
    if (typeof(AddAttachment) == "undefined") {
      // TB >= 24
      AddAttachments([attachment]);
    }
    else {
      // SeaMonkey
      AddAttachment(attachment);
    }
  },

  /**
   *  undo the encryption or signing; get back the original (unsigned/unencrypted) text
   *
   * useEditorUndo |Number|:   > 0  use undo function of editor |n| times
   *                           0: replace text with original text
   */
  undoEncryption: function (useEditorUndo)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.undoEncryption:\n");
    if (this.processed) {
      if (useEditorUndo) {
        Timer.setTimeout(function _f() {
            Enigmail.msg.editor.undo(useEditorUndo);
          }, 10);
      }
      else {
        this.replaceEditorText(this.processed.origText);
      }
      this.processed = null;

    } else {
      this.decryptQuote(true);
    }

    var node;
    var nodeNumber;
    var bucketList = document.getElementById("attachmentBucket");
    if ( this.modifiedAttach && bucketList && bucketList.hasChildNodes() ) {
      // undo inline encryption of attachments
      for (var i=0; i<this.modifiedAttach.length; i++) {
        node = bucketList.firstChild;
        nodeNumber=-1;
        while (node) {
          ++nodeNumber;
          if (node.attachment.url == this.modifiedAttach[i].newUrl) {
            if (this.modifiedAttach[i].encrypted) {
              node.attachment.url = this.modifiedAttach[i].origUrl;
              node.attachment.name = this.modifiedAttach[i].origName;
              node.attachment.temporary = this.modifiedAttach[i].origTemp;
              node.attachment.contentType = this.modifiedAttach[i].origCType;
            }
            else {
              node = bucketList.removeItemAt(nodeNumber);
              // Let's release the attachment object held by the node else it won't go away until the window is destroyed
              node.attachment = null;
            }
            // delete encrypted file
            try {
              this.modifiedAttach[i].newFile.remove(false);
            }
            catch (ex) {}

            node = null; // next attachment please
          }
          else {
            node=node.nextSibling;
          }
        }
      }
    }

    this.removeAttachedKey();
  },


  removeAttachedKey: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.removeAttachedKey: \n");

    var bucketList = document.getElementById("attachmentBucket");
    var node = bucketList.firstChild;

    if (bucketList && bucketList.hasChildNodes() && this.attachOwnKeyObj.attachedObj) {
      // undo attaching own key
      var nodeNumber=-1;
      while (node) {
        ++nodeNumber;
        if (node.attachment.url == this.attachOwnKeyObj.attachedObj.url) {
          node = bucketList.removeItemAt(nodeNumber);
          // Let's release the attachment object held by the node else it won't go away until the window is destroyed
          node.attachment = null;
          this.attachOwnKeyObj.attachedObj = null;
          this.attachOwnKeyObj.attachedKey = null;
          node = null; // exit loop
        }
        else {
          node=node.nextSibling;
        }
      }
      if (! bucketList.hasChildNodes()) {
        try {
          // TB only
          ChangeAttachmentBucketVisibility(true);
        }
        catch(ex) {}
      }
    }
  },


  replaceEditorText: function (text)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.replaceEditorText:\n");
    this.editorSelectAll();

    // Overwrite text in clipboard for security
    // (Otherwise plaintext will be available in the clipbaord)
    this.editorInsertText("Enigmail");
    this.editorSelectAll();

    this.editorInsertText(text);
  },


  getMsgFolderFromUri:  function(uri, checkFolderAttributes)
  {
    let msgfolder = null;
    if (typeof MailUtils != 'undefined') {
      return MailUtils.getFolderForURI(uri, checkFolderAttributes);
    }
    try {
      // Postbox, older versions of TB
      let resource = GetResourceFromUri(uri);
      msgfolder = resource.QueryInterface(Components.interfaces.nsIMsgFolder);
      if (checkFolderAttributes) {
        if (!(msgfolder && (msgfolder.parent || msgfolder.isServer))) {
          msgfolder = null;
        }
      }
    }
    catch (ex) {
       //dump("failed to get the folder resource\n");
    }
    return msgfolder;
  },


  goAccountManager: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.goAccountManager:\n");
    EnigmailCore.getService(window);
    var currentId=null;
    var server=null;
    try {
        currentId=getCurrentIdentity();
        var amService=Components.classes["@mozilla.org/messenger/account-manager;1"].getService();
        var servers, folderURI;
        try {
          // Gecko >= 20
          servers=amService.getServersForIdentity(currentId);
          folderURI=servers.queryElementAt(0, Components.interfaces.nsIMsgIncomingServer).serverURI;
        }
        catch(ex) {
          servers=amService.GetServersForIdentity(currentId);
          folderURI=servers.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer).serverURI;
        }

        server=this.getMsgFolderFromUri(folderURI, true).server;
    } catch (ex) {}
    window.openDialog("chrome://enigmail/content/am-enigprefs-edit.xul", "", "dialog,modal,centerscreen", {identity: currentId, account: server});
    this.setIdentityDefaults();
  },


  doPgpButton: function (what)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.doPgpButton: what="+what+"\n");

    // Note: For the toolbar button this is indirectly triggered:
    //       - the menu items trigger nextCommand()
    //       - because afterwards doPgpButton('') is always called (for whatever reason)
    if (! what) {
      what = this.nextCommandId;
    }
    this.nextCommandId = "";
    EnigmailCore.getService(window); // try to access Enigmail to launch the wizard if needed

    // ignore settings for this account?
    try {
      if (!this.getAccDefault("enabled")) {
        if (Dialog.confirmDlg(window, Locale.getString("configureNow"),
              Locale.getString("msgCompose.button.configure"))) {
          // configure account settings for the first time
          this.goAccountManager();
          if (! this.identity.getBoolAttribute("enablePgp")) {
            return;
          }
        }
        else {
          return;
        }
      }
    }
    catch (ex) {}

    switch (what) {
      case 'sign':
      case 'encrypt':
      case 'toggle-sign':
      case 'toggle-encrypt':
        this.setSendMode(what);
        break;

      // menu entries:
      case 'final-signDefault':
      case 'final-signYes':
      case 'final-signNo':
      case 'final-encryptDefault':
      case 'final-encryptYes':
      case 'final-encryptNo':
      case 'final-pgpmimeDefault':
      case 'final-pgpmimeYes':
      case 'final-pgpmimeNo':
      // status bar buttons:
      case 'toggle-final-sign':
      case 'toggle-final-encrypt':
      case 'toggle-final-mime':
        this.setFinalSendMode(what);
        break;

      case 'togglePGPMime':
        this.togglePgpMime();
        break;

      case 'toggleRules':
        this.toggleRules();
        break;

      case 'trustKeys':
        this.tempTrustAllKeys();
        break;

      case 'nothing':
        break;

      case 'displaySecuritySettings':
        this.displaySecuritySettings();
        break;
      default:
        this.displaySecuritySettings();
    }

  },


  nextCommand: function (what)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.nextCommand: what="+what+"\n");
    this.nextCommandId=what;
  },


  // changes the DEFAULT sendMode
  // - also called internally for saved emails
  setSendMode: function (sendMode)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setSendMode: sendMode="+sendMode+"\n");
    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var origSendMode = this.sendMode;
    switch (sendMode) {
      case 'sign':
        this.sendMode |= SIGN;
        break;
      case 'encrypt':
        this.sendMode |= ENCRYPT;
        break;
      case 'toggle-sign':
        if (this.sendMode & SIGN) {
          this.sendMode &= ~SIGN;
        }
        else {
          this.sendMode |= SIGN;
        }
        break;
      case 'toggle-encrypt':
        if (this.sendMode & ENCRYPT) {
          this.sendMode &= ~ENCRYPT;
        }
        else {
          this.sendMode |= ENCRYPT;
        }
        break;
      default:
        Dialog.alert(window, "Enigmail.msg.setSendMode - unexpected value: "+sendMode);
        break;
    }
    // sendMode changed ?
    // - sign and send are internal initializations
    if (!this.sendModeDirty && (this.sendMode != origSendMode) && sendMode != 'sign' && sendMode != 'encrypt') {
      this.sendModeDirty = true;
    }
    this.processFinalState();
    this.updateStatusBar();
  },


  // changes the FINAL sendMode
  // - triggered by the user interface
  setFinalSendMode: function (sendMode)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setFinalSendMode: sendMode="+sendMode+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    switch (sendMode) {

      // menu entries for final settings:

      case 'final-encryptDefault':
        // switch encryption to "use defaults & rules"
        if (this.encryptForced != Constants.ENIG_UNDEF) {  // if encrypt/noencrypt forced
          this.encryptForced = Constants.ENIG_UNDEF;       // back to defaults/rules
        }
        break;
      case 'final-encryptYes':
        // switch encryption to "force encryption"
        if (this.encryptForced != Constants.ENIG_ALWAYS) {  // if not forced to encrypt
          this.encryptForced = Constants.ENIG_ALWAYS;       // force to encrypt
        }
        break;
      case 'final-encryptNo':
        // switch encryption to "force no to encrypt"
        if (this.encryptForced != Constants.ENIG_NEVER) {  // if not forced not to encrypt
          this.encryptForced = Constants.ENIG_NEVER;       // force not to encrypt
        }
        break;

      case 'final-signDefault':
        // switch signing to "use defaults & rules"
        if (this.signForced != Constants.ENIG_UNDEF) {  // if sign/nosign forced
          // re-init if signing depends on encryption if this was broken before
          this.finalSignDependsOnEncrypt = (this.getAccDefault("signIfEnc") || this.getAccDefault("signIfNotEnc"));
          this.signForced = Constants.ENIG_UNDEF;       // back to defaults/rules
        }
        break;
      case 'final-signYes':
        if (this.signForced != Constants.ENIG_ALWAYS) {  // if not forced to sign
          this.signingNoLongerDependsOnEnc();
          this.signForced = Constants.ENIG_ALWAYS;       // force to sign
        }
        break;
      case 'final-signNo':
        if (this.signForced != Constants.ENIG_NEVER) {  // if not forced not to sign
          this.signingNoLongerDependsOnEnc();
          this.signForced = Constants.ENIG_NEVER;       // force not to sign
        }
        break;

      case 'final-pgpmimeDefault':
        if (this.pgpmimeForced != Constants.ENIG_UNDEF) {  // if any PGP mode forced
          this.pgpmimeForced = Constants.ENIG_UNDEF;       // back to defaults/rules
        }
        break;
      case 'final-pgpmimeYes':
        if (this.pgpmimeForced != Constants.ENIG_ALWAYS) {  // if not forced to PGP/Mime
          this.pgpmimeForced = Constants.ENIG_ALWAYS;       // force to PGP/Mime
        }
        break;
      case 'final-pgpmimeNo':
        if (this.pgpmimeForced != Constants.ENIG_NEVER) {  // if not forced not to PGP/Mime
          this.pgpmimeForced = Constants.ENIG_NEVER;       // force not to PGP/Mime
        }
        break;

      // status bar buttons:
      // - can only switch to force or not to force sign/enc

      case 'toggle-final-sign':
        this.signingNoLongerDependsOnEnc();
        switch (this.statusSigned) {
          case Constants.ENIG_FINAL_NO:
          case Constants.ENIG_FINAL_FORCENO:
            this.signForced = Constants.ENIG_ALWAYS;          // force to sign
            break;
          case Constants.ENIG_FINAL_YES:
          case Constants.ENIG_FINAL_FORCEYES:
            this.signForced = Constants.ENIG_NEVER;          // force not to sign
            break;
          case Constants.ENIG_FINAL_CONFLICT:
            this.signForced = Constants.ENIG_NEVER;
            break;
        }
        break;

      case 'toggle-final-encrypt':
        switch (this.statusEncrypted) {
          case Constants.ENIG_FINAL_NO:
          case Constants.ENIG_FINAL_FORCENO:
            this.encryptForced = Constants.ENIG_ALWAYS;          // force to encrypt
            break;
          case Constants.ENIG_FINAL_YES:
          case Constants.ENIG_FINAL_FORCEYES:
            this.encryptForced = Constants.ENIG_NEVER;          // force not to encrypt
            break;
          case Constants.ENIG_FINAL_CONFLICT:
            this.encryptForced = Constants.ENIG_NEVER;
            break;
        }
        break;

      case 'toggle-final-mime':
        switch (this.statusPGPMime) {
          case Constants.ENIG_FINAL_NO:
          case Constants.ENIG_FINAL_FORCENO:
            this.pgpmimeForced = Constants.ENIG_ALWAYS;          // force PGP/MIME
            break;
          case Constants.ENIG_FINAL_YES:
          case Constants.ENIG_FINAL_FORCEYES:
            this.pgpmimeForced = Constants.ENIG_NEVER;          // force Inline-PGP
            break;
          case Constants.ENIG_FINAL_CONFLICT:
            this.pgpmimeForced = Constants.ENIG_NEVER;
            break;
        }
        break;

      default:
        Dialog.alert(window, "Enigmail.msg.setFinalSendMode - unexpected value: "+sendMode);
        break;
    }

    // this is always a send mode change (only toggle effects)
    this.sendModeDirty = true;

    this.processFinalState();
    this.updateStatusBar();
  },


  // key function to process the final encrypt/sign/pgpmime state from all settings
  // sendFlags: contains the sendFlags if the message is really processed. Optional, can be null
  // - uses as INPUT:
  //   - this.sendMode
  //   - this.encryptByRules, this.signByRules, pgpmimeByRules
  //   - this.encryptForced, this.encryptSigned
  // - uses as OUTPUT:
  //   - this.statusEncrypt, this.statusSign, this.statusPGPMime
  processFinalState: function (sendFlags)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.processFinalState()\n");
    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;


    var encFinally = null;
    var encReason = "";
    var signFinally = null;
    var signReason = "";
    var pgpmimeFinally = null;

    // process resulting encrypt mode
    if (this.encryptForced == Constants.ENIG_NEVER) {  // force not to encrypt?
      encFinally = Constants.ENIG_FINAL_FORCENO;
      encReason = Locale.getString("reasonManuallyForced");
    }
    else if (this.encryptForced == Constants.ENIG_ALWAYS) {  // force to encrypt?
      encFinally = Constants.ENIG_FINAL_FORCEYES;
      encReason = Locale.getString("reasonManuallyForced");
    }
    else switch (this.encryptByRules) {
      case Constants.ENIG_NEVER:
        encFinally = Constants.ENIG_FINAL_NO;
        encReason = Locale.getString("reasonByRecipientRules");
        break;
      case Constants.ENIG_UNDEF:
        if (this.sendMode & ENCRYPT) {
          encFinally = Constants.ENIG_FINAL_YES;
          if (this.getAccDefault("encrypt")) {
            encReason = Locale.getString("reasonEnabledByDefault");
          }
        }
        else {
          encFinally = Constants.ENIG_FINAL_NO;
        }
        break;
      case Constants.ENIG_ALWAYS:
        encFinally = Constants.ENIG_FINAL_YES;
        encReason = Locale.getString("reasonByRecipientRules");
        break;
      case Constants.ENIG_AUTO_ALWAYS:
        encFinally = Constants.ENIG_FINAL_YES;
        encReason = Locale.getString("reasonByAutoEncryption");
        break;
      case Constants.ENIG_CONFLICT:
        encFinally = Constants.ENIG_FINAL_CONFLICT;
        encReason = Locale.getString("reasonByConflict");
        break;
    }
    Log.DEBUG("enigmailMsgComposeOverlay.js:   encrypt="+((this.sendMode&ENCRYPT)!==0)+" encryptByRules="+this.encryptByRules+" encFinally="+encFinally+"\n");
    Log.DEBUG("                                encReason="+encReason+"\n");

    // process resulting sign mode
    if (this.signForced == Constants.ENIG_NEVER) {  // force not to sign?
      signFinally = Constants.ENIG_FINAL_FORCENO;
      signReason = Locale.getString("reasonManuallyForced");
    }
    else if (this.signForced == Constants.ENIG_ALWAYS) {  // force to sign?
      signFinally = Constants.ENIG_FINAL_FORCEYES;
      signReason = Locale.getString("reasonManuallyForced");
    }
    else switch (this.signByRules) {
      case Constants.ENIG_NEVER:
        signFinally = Constants.ENIG_FINAL_NO;
        signReason = Locale.getString("reasonByRecipientRules");
        break;
      case Constants.ENIG_UNDEF:
        if (this.sendMode & SIGN) {
          signFinally = Constants.ENIG_FINAL_YES;
          if (this.getAccDefault("sign")) {
            signReason = Locale.getString("reasonEnabledByDefault");
          }
        }
        else {
          signFinally = Constants.ENIG_FINAL_NO;
        }
        break;
      case Constants.ENIG_ALWAYS:
        signFinally = Constants.ENIG_FINAL_YES;
        signReason = Locale.getString("reasonByRecipientRules");
        break;
      case Constants.ENIG_CONFLICT:
        signFinally = Constants.ENIG_FINAL_CONFLICT;
        signReason = Locale.getString("reasonByConflict");
        break;
    }
    Log.DEBUG("enigmailMsgComposeOverlay.js:   signed="+((this.sendMode&SIGN)!==0)+" signByRules="+this.signByRules+" signFinally="+signFinally+"\n");
    Log.DEBUG("                                signReason="+signReason+"\n");

    // process option to finally sign if encrypted/unencrypted
    // (unless rules force not to sign)
    //var derivedFromEncMode = false;
    if (this.finalSignDependsOnEncrypt) {
      if (this.signByRules == Constants.ENIG_UNDEF) {  // if final sign mode not clear yet
        //derivedFromEncMode = true;
        switch (encFinally) {
          case Constants.ENIG_FINAL_YES:
          case Constants.ENIG_FINAL_FORCEYES:
            if (this.getAccDefault("signIfEnc")) {
              signFinally = Constants.ENIG_FINAL_YES;
              signReason = Locale.getString("reasonByEncryptionMode");
            }
            break;
          case Constants.ENIG_FINAL_NO:
          case Constants.ENIG_FINAL_FORCENO:
            if (this.getAccDefault("signIfNotEnc")) {
              signFinally = Constants.ENIG_FINAL_YES;
              signReason = Locale.getString("reasonByEncryptionMode");
            }
            break;
          case Constants.ENIG_FINAL_CONFLICT:
            if (this.getAccDefault("signIfEnc") && this.getAccDefault("signIfNotEnc")) {
              signFinally = Constants.ENIG_FINAL_YES;
              signReason = Locale.getString("reasonByEncryptionMode");
            }
            else {
              signFinally = Constants.ENIG_FINAL_CONFLICT;
            }
            break;
        }
        Log.DEBUG("enigmailMsgComposeOverlay.js:   derived signFinally="+signFinally+"\n");
        Log.DEBUG("                                signReason="+signReason+"\n");
      }
    }

    if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIMsgSMIMECompFields &&
         (gMsgCompose.compFields.securityInfo.signMessage ||
          gMsgCompose.compFields.securityInfo.requireEncryptMessage)) {

      if (Prefs.getPref("mimePreferPgp") == 2) {
        encFinally = Constants.ENIG_FINAL_SMIME_DISABLED;
        encReason = Locale.getString("reasonSmimeConflict");
        signFinally = Constants.ENIG_FINAL_SMIME_DISABLED;
        signReason = Locale.getString("reasonSmimeConflict");
      }
    }



    // process resulting PGP/MIME mode
    if (this.pgpmimeForced == Constants.ENIG_NEVER) {  // force not to PGP/Mime?
      pgpmimeFinally = Constants.ENIG_FINAL_FORCENO;
    }
    else if (this.pgpmimeForced == Constants.ENIG_ALWAYS) {  // force to PGP/Mime?
      pgpmimeFinally = Constants.ENIG_FINAL_FORCEYES;
    }
    else switch (this.pgpmimeByRules) {
      case Constants.ENIG_NEVER:
        pgpmimeFinally = Constants.ENIG_FINAL_NO;
        break;
      case Constants.ENIG_UNDEF:
        pgpmimeFinally = ((this.sendPgpMime || (this.sendMode & nsIEnigmail.SEND_PGP_MIME)) ? Constants.ENIG_FINAL_YES : Constants.ENIG_FINAL_NO);
        break;
      case Constants.ENIG_ALWAYS:
        pgpmimeFinally = Constants.ENIG_FINAL_YES;
        break;
      case Constants.ENIG_CONFLICT:
        pgpmimeFinally = Constants.ENIG_FINAL_CONFLICT;
        break;
    }
    Log.DEBUG("enigmailMsgComposeOverlay.js:   pgpmimeByRules="+this.pgpmimeByRules+" pgpmimeFinally="+pgpmimeFinally+"\n");

    this.statusEncrypted = encFinally;
    this.statusSigned = signFinally;
    this.statusPGPMime = pgpmimeFinally;
    this.reasonEncrypted = encReason;
    this.reasonSigned = signReason;
  },


  // process icon/strings of status bar buttons and menu entries according to final encrypt/sign/pgpmime status
  // - uses as INPUT:
  //   - this.statusEncrypt, this.statusSign, this.statusPGPMime
  // - uses as OUTPUT:
  //   - resulting icon symbols
  //   - this.statusEncryptStr, this.statusSignStr, this.statusPGPMimeStr, this.statusInlinePGPStr
  updateStatusBar: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.updateStatusBar()\n");
    this.statusEncryptedInStatusBar = this.statusEncrypted; // to double check broken promise for encryption

    if (! this.identity) {
      this.identity = getCurrentIdentity();
    }

    var toolbarTxt = document.getElementById("enigmail-toolbar-text");
    var encBroadcaster = document.getElementById("enigmail-bc-encrypt");
    var signBroadcaster = document.getElementById("enigmail-bc-sign");
    var attachBroadcaster = document.getElementById("enigmail-bc-attach");

    // enigmail disabled for this identity?:
    if (!this.getAccDefault("enabled")) {
      // hide icons if enigmail not enabled
      encBroadcaster.removeAttribute("encrypted");
      encBroadcaster.setAttribute("disabled", "true");
      signBroadcaster.removeAttribute("signed");
      signBroadcaster.setAttribute("disabled", "true");
      attachBroadcaster.setAttribute("disabled", "true");
      if (toolbarTxt) {
        toolbarTxt.value = Locale.getString("msgCompose.toolbarTxt.disabled");
        toolbarTxt.removeAttribute("class");
      }
      return;
    }
    encBroadcaster.removeAttribute("disabled");
    signBroadcaster.removeAttribute("disabled");
    attachBroadcaster.removeAttribute("disabled");

    // process resulting icon symbol and status strings for encrypt mode
    var encSymbol = null;
    var doEncrypt = false;
    var encStr = null;
    switch (this.statusEncrypted) {
      case Constants.ENIG_FINAL_FORCENO:
        encSymbol = "forceNo";
        encStr = Locale.getString("encryptMessageNorm");
        break;
      case Constants.ENIG_FINAL_FORCEYES:
        doEncrypt = true;
        encSymbol = "forceYes";
        encStr = Locale.getString("encryptMessageNorm");
        break;
      case Constants.ENIG_FINAL_NO:
        encSymbol = "inactiveNone";
        encStr = Locale.getString("encryptMessageAuto");
        break;
      case Constants.ENIG_FINAL_YES:
        doEncrypt = true;
        encSymbol = "activeNone";
        encStr = Locale.getString("encryptMessageAuto");
        break;
      case Constants.ENIG_FINAL_CONFLICT:
        encSymbol = "inactiveConflict";
        encStr = Locale.getString("encryptMessageAuto");
        break;
    }
    var encReasonStr = null;
    if (doEncrypt) {
      if (this.reasonEncrypted && this.reasonEncrypted !== "") {
        encReasonStr = Locale.getString("encryptOnWithReason", [ this.reasonEncrypted ]);
      }
      else {
        encReasonStr = Locale.getString("encryptOn");
      }
    }
    else {
      if (this.reasonEncrypted && this.reasonEncrypted !== "") {
        encReasonStr = Locale.getString("encryptOffWithReason", [ this.reasonEncrypted ]);
      }
      else {
        encReasonStr = Locale.getString("encryptOff");
      }
    }
    Log.DEBUG("enigmailMsgComposeOverlay.js:   encSymbol="+encSymbol+"  encReasonStr="+encReasonStr+"\n");

    // update encrypt icon and tooltip/menu-text
    encBroadcaster.setAttribute("encrypted", encSymbol);
    var encIcon = document.getElementById("button-enigmail-encrypt");
    if (encIcon) {
      encIcon.setAttribute("tooltiptext", encReasonStr);
    }
    this.statusEncryptedStr = encStr;
    this.setChecked("enigmail-bc-encrypt", doEncrypt);

    // process resulting icon symbol for sign mode
    var signSymbol = null;
    var doSign = false;
    var signStr = "";
    switch (this.statusSigned) {
      case Constants.ENIG_FINAL_FORCENO:
        signSymbol = "forceNo";
        signStr = Locale.getString("signMessageNorm");
        signReasonStr = Locale.getString("signOffWithReason", [ this.reasonSigned ]);
        break;
      case Constants.ENIG_FINAL_FORCEYES:
        doSign = true;
        signSymbol = "forceYes";
        signStr = Locale.getString("signMessageNorm");
        signReasonStr = Locale.getString("signOnWithReason", [ this.reasonSigned ]);
        break;
      case Constants.ENIG_FINAL_NO:
        signSymbol = "inactiveNone";
        signStr = Locale.getString("signMessageAuto");
        signReasonStr = Locale.getString("signOffWithReason", [ this.reasonSigned ]);
        break;
      case Constants.ENIG_FINAL_YES:
        doSign = true;
        signSymbol = "activeNone";
        signStr = Locale.getString("signMessageAuto");
        signReasonStr = Locale.getString("signOnWithReason", [ this.reasonSigned ]);
        break;
      case Constants.ENIG_FINAL_CONFLICT:
        signSymbol = "inactiveConflict";
        signStr = Locale.getString("signMessageAuto");
        signReasonStr = Locale.getString("signOffWithReason", [ this.reasonSigned ]);
        break;
    }
    var signReasonStr = null;
    if (doSign) {
      if (this.reasonSigned && this.reasonSigned !== "") {
        signReasonStr = Locale.getString("signOnWithReason", [ this.reasonSigned ]);
      }
      else {
        signReasonStr = signStr;
      }
    }
    else {
      if (this.reasonSigned && this.reasonSigned !== "") {
        signReasonStr = Locale.getString("signOffWithReason", [ this.reasonSigned ]);
      }
      else {
        signReasonStr = signStr;
      }
    }
    Log.DEBUG("enigmailMsgComposeOverlay.js:   signSymbol="+signSymbol+"  signReasonStr="+signReasonStr+"\n");

    // update sign icon and tooltip/menu-text
    signBroadcaster.setAttribute("signed", signSymbol);
    var signIcon = document.getElementById("button-enigmail-sign");
    if (signIcon) {
      signIcon.setAttribute("tooltiptext", signReasonStr);
    }
    this.statusSignedStr = signStr;
    this.setChecked("enigmail-bc-sign", doSign);

    // process resulting toolbar message
    var toolbarMsg = "";
    if (doSign && doEncrypt) {
      toolbarMsg = Locale.getString("msgCompose.toolbarTxt.signAndEncrypt");
    }
    else if (doSign) {
      toolbarMsg = Locale.getString("msgCompose.toolbarTxt.signOnly");
    }
    else if (doEncrypt) {
      toolbarMsg = Locale.getString("msgCompose.toolbarTxt.encryptOnly");
    }
    else {
      toolbarMsg = Locale.getString("msgCompose.toolbarTxt.noEncryption");
    }

    if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIMsgSMIMECompFields &&
         (gMsgCompose.compFields.securityInfo.signMessage ||
          gMsgCompose.compFields.securityInfo.requireEncryptMessage)) {

      // Determine if user wants to encrypt drafts
      let doEncryptDrafts = this.identity.getBoolAttribute("autoEncryptDrafts");

      switch (Prefs.getPref("mimePreferPgp")) {
        case 0:
          // prefer OpenPGP over S/MIME
          if (doSign || doEncrypt) {
            toolbarMsg += " " + Locale.getString("msgCompose.toolbarTxt.smimeOff");
          }
          break;
        case 1:
          // ask user
          if (doSign || doEncrypt) {
            toolbarMsg += " " + Locale.getString("msgCompose.toolbarTxt.smime");
          }
          if (doEncryptDrafts) {
            toolbarMsg += " " + Locale.getString("msgCompose.toolbarTxt.smimeNoDraftEncryption");
          }
          break;
        case 2:
          // prefer S/MIME over OpenPGP
          encBroadcaster.setAttribute("disabled", "true");
          signBroadcaster.setAttribute("disabled", "true");
          toolbarMsg = Locale.getString("msgCompose.toolbarTxt.smimeSignOrEncrypt");
          if (doEncryptDrafts) {
            toolbarMsg += " " + Locale.getString("msgCompose.toolbarTxt.smimeNoDraftEncryption");
          }
          break;

      }
    }

    if (toolbarTxt) {
      toolbarTxt.value = toolbarMsg;

      if (!doSign && !doEncrypt &&
         !(gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIMsgSMIMECompFields &&
           (gMsgCompose.compFields.securityInfo.signMessage ||
             gMsgCompose.compFields.securityInfo.requireEncryptMessage))) {
        toolbarTxt.setAttribute("class", "enigmailStrong");
      }
      else {
        toolbarTxt.removeAttribute("class");
      }
    }

    // update pgp mime/inline PGP menu-text
    if (this.statusPGPMime == Constants.ENIG_FINAL_YES) {
      this.statusPGPMimeStr = Locale.getString("pgpmimeAuto");
    }
    else {
      this.statusPGPMimeStr = Locale.getString("pgpmimeNormal");
    }

    if (this.statusPGPMime == Constants.ENIG_FINAL_NO) {
      this.inlinePGPStr = Locale.getString("inlinePGPAuto");
    }
    else {
      this.inlinePGPStr = Locale.getString("inlinePGPNormal");
    }

    let allowAttachOwnKey = false;
    if (this.identity.getIntAttribute("pgpKeyMode") > 0) {
      let keyIdValue = this.identity.getCharAttribute("pgpkeyId");
      if (keyIdValue.search(/^ *(0x)?[0-9a-fA-F]* *$/) === 0) {
        allowAttachOwnKey = true;
      }
    }

    if (allowAttachOwnKey) {
      attachBroadcaster.removeAttribute("disabled");
    }
    else {
      attachBroadcaster.setAttribute("disabled", "true");
    }

  },


  /* compute whether to sign/encrypt according to current rules and sendMode
   * - without any interaction, just to process resulting status bar icons
   */
  determineSendFlags: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.focusChange: Enigmail.msg.determineSendFlags\n");
    this.statusEncryptedInStatusBar = null; // to double check broken promise for encryption

    if (! this.identity) {
      this.identity = getCurrentIdentity();
    }

    if (this.getAccDefault("enabled")) {
      var compFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
      Recipients2CompFields(compFields);

      // process list of to/cc email addresses
      // - bcc email addresses are ignored, when processing whether to sign/encrypt
      var toAddrList = [];
      var arrLen = {};
      var recList;
      if (compFields.to.length > 0) {
        recList = compFields.splitRecipients(compFields.to, true, arrLen);
        this.addRecipients(toAddrList, recList);
      }
      if (compFields.cc.length > 0) {
        recList = compFields.splitRecipients(compFields.cc, true, arrLen);
        this.addRecipients(toAddrList, recList);
      }

      this.encryptByRules = Constants.ENIG_UNDEF;
      this.signByRules    = Constants.ENIG_UNDEF;
      this.pgpmimeByRules = Constants.ENIG_UNDEF;

      // process rules
      if (toAddrList.length > 0 && Prefs.getPref("assignKeysByRules")) {
        var matchedKeysObj = {};
        var flagsObj = {};
        if (Enigmail.hlp.getRecipientsKeys(toAddrList.join(", "),
                                           false,    // not interactive
                                           false,    // forceRecipientSettings (ignored due to not interactive)
                                           matchedKeysObj, // resulting matching keys
                                           flagsObj)) {    // resulting flags (0/1/2/3 for each type)
          this.encryptByRules = flagsObj.encrypt;
          this.signByRules    = flagsObj.sign;
          this.pgpmimeByRules = flagsObj.pgpMime;

          if (matchedKeysObj.value && matchedKeysObj.value.length > 0) {
            // replace addresses with results from rules
            toAddrList = matchedKeysObj.value.split(", ");
          }
        }
      }

      // if not clear whether to encrypt yet, check whether automatically-send-encrypted applies
      if (toAddrList.length > 0 && this.encryptByRules == Constants.ENIG_UNDEF && Prefs.getPref("autoSendEncrypted") == 1) {
        var validKeyList = Enigmail.hlp.validKeysForAllRecipients(toAddrList.join(", "));
        if (validKeyList !== null) {
          this.encryptByRules = Constants.ENIG_AUTO_ALWAYS;
        }
      }
    }

    // process and signal new resulting state
    this.processFinalState();
    this.updateStatusBar();
    this.determineSendFlagId = null;

  },

  setChecked: function(elementId, checked) {
    let elem = document.getElementById(elementId);
    if (elem) {
      if (checked) {
        elem.setAttribute("checked", "true");
      }
      else
        elem.removeAttribute("checked");
    }
  },

  setMenuSettings: function (postfix)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setMenuSettings: postfix="+postfix+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var elem = document.getElementById("enigmail_compose_sign_item"+postfix);
    if (elem) {
      elem.setAttribute("label", this.statusSignedStr);
      switch (this.statusSigned) {
        case Constants.ENIG_FINAL_YES:
        case Constants.ENIG_FINAL_FORCEYES:
          elem.setAttribute("checked", "true");
          break;
        default:
          elem.setAttribute("checked", "false");
      }
    }

    elem = document.getElementById("enigmail_compose_encrypt_item"+postfix);
    if (elem) {
      elem.setAttribute("label", this.statusEncryptedStr);
      switch (this.statusEncrypted) {
        case Constants.ENIG_FINAL_YES:
        case Constants.ENIG_FINAL_FORCEYES:
          elem.setAttribute("checked", "true");
          break;
        default:
          elem.setAttribute("checked", "false");
      }
    }

    elem = document.getElementById("enigmail_compose_pgpmime_item"+postfix);
    if (elem) {
      elem.setAttribute("label",this.statusPGPMimeStr);

      switch (this.statusPGPMime) {
        case Constants.ENIG_FINAL_YES:
        case Constants.ENIG_FINAL_FORCEYES:
          elem.setAttribute("checked", "true");
          break;
        default:
          elem.setAttribute("checked", "false");
      }
    }

    elem = document.getElementById("enigmail_compose_inline_item"+postfix);
    if (elem) {
      elem.setAttribute("label",this.inlinePGPStr);

      switch (this.statusPGPMime) {
        case Constants.ENIG_FINAL_NO:
        case Constants.ENIG_FINAL_FORCENO:
        case Constants.ENIG_FINAL_CONFLICT:
        case Constants.ENIG_FINAL_UNDEF:
          elem.setAttribute("checked", "true");
          break;
        default:
          elem.setAttribute("checked", "false");
      }

    }


/*
    this.setChecked("enigmail_final_encryptDefault"+postfix, this.encryptForced == Constants.ENIG_UNDEF);
    this.setChecked("enigmail_final_encryptYes"+postfix, this.encryptForced == Constants.ENIG_ALWAYS);
    this.setChecked("enigmail_final_encryptNo"+postfix, this.encryptForced == Constants.ENIG_NEVER);
    this.setChecked("enigmail_final_signDefault"+postfix, this.signForced == Constants.ENIG_UNDEF);
    this.setChecked("enigmail_final_signYes"+postfix, this.signForced == Constants.ENIG_ALWAYS);
    this.setChecked("enigmail_final_signNo"+postfix, this.signForced == Constants.ENIG_NEVER);
    this.setChecked("enigmail_final_pgpmimeDefault"+postfix, this.pgpmimeForced == Constants.ENIG_UNDEF);
    this.setChecked("enigmail_final_pgpmimeYes"+postfix, this.pgpmimeForced == Constants.ENIG_ALWAYS);
    this.setChecked("enigmail_final_pgpmimeNo"+postfix, this.pgpmimeForced == Constants.ENIG_NEVER);
*/

    let menuElement = document.getElementById("enigmail_insert_own_key");
    if (menuElement) {
      if (this.identity.getIntAttribute("pgpKeyMode")>0) {
        menuElement.setAttribute("checked", this.attachOwnKeyObj.appendAttachment.toString());
        menuElement.removeAttribute("disabled");
      }
      else {
        menuElement.setAttribute("disabled", "true");
      }
    }
  },

  displaySecuritySettings: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.displaySecuritySettings\n");

    if (this.statusEncrypted == Constants.ENIG_FINAL_SMIME_DISABLED) {
      Dialog.alert(window, "Enigmail is not used because S/MIME is currently enabled. Please turn off S/MIME signing and/or encryption and then enable Enigmail encryption");
      return;
    }

    var inputObj = {
                     statusEncrypted: this.statusEncrypted,
                     statusSigned: this.statusSigned,
                     statusPGPMime: this.statusPGPMime,
                     success: false,
                     resetDefaults: false
                   };
    window.openDialog("chrome://enigmail/content/enigmailEncryptionDlg.xul","", "dialog,modal,centerscreen", inputObj);

    if (! inputObj.success) return; // Cancel pressed

    if (inputObj.resetDefaults) {
      // reset everything to defaults
      this.encryptForced = Constants.ENIG_UNDEF;
      this.signForced = Constants.ENIG_UNDEF;
      this.pgpmimeForced = Constants.ENIG_UNDEF;
      this.finalSignDependsOnEncrypt = true;
    }
    else {
      if (this.signForced != inputObj.sign) {
        this.dirty = 2;
        this.signForced = inputObj.sign;
        this.finalSignDependsOnEncrypt = false;
      }

      if (this.encryptForced != inputObj.encrypt || this.pgpmimeForced != inputObj.pgpmime) {
        this.dirty = 2;
      }

      this.encryptForced = inputObj.encrypt;
      this.pgpmimeForced = inputObj.pgpmime;
    }

    this.processFinalState();
    this.updateStatusBar();
  },


  signingNoLongerDependsOnEnc: function ()
  {
    if (this.finalSignDependsOnEncrypt) {
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.signingNoLongerDependsOnEnc(): unbundle final signing\n");
      this.finalSignDependsOnEncrypt = false;

      Dialog.alertPref(window, Locale.getString("signIconClicked"), "displaySignWarn");
    }
  },


  confirmBeforeSend: function (toAddrStr, gpgKeys, sendFlags, isOffline)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.confirmBeforeSend: sendFlags="+sendFlags+"\n");
    // get confirmation before sending message

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    // get wording for message status (e.g. " SIGNED ENCRYPTED")
    var msgStatus = "";
    if (sendFlags & (ENCRYPT | SIGN)) {
      if (sendFlags & nsIEnigmail.SEND_PGP_MIME) {
        msgStatus += " " + Locale.getString("statPGPMIME");
      }
      if (sendFlags & SIGN) {
        msgStatus += " " + Locale.getString("statSigned");
      }
      if (sendFlags & ENCRYPT) {
        msgStatus += " " + Locale.getString("statEncrypted");
      }
    }
    else {
      msgStatus += " " + Locale.getString("statPlain");
    }

    // create message
    var msgConfirm = "";
    if (isOffline || sendFlags & nsIEnigmail.SEND_LATER) {
      msgConfirm = Locale.getString("offlineSave", [ msgStatus, EnigmailFuncs.stripEmail(toAddrStr).replace(/,/g, ", ") ]);
    }
    else {
      msgConfirm = Locale.getString("onlineSend", [ msgStatus, EnigmailFuncs.stripEmail(toAddrStr).replace(/,/g, ", ") ]);
    }

    // add list of keys
    if (sendFlags & ENCRYPT) {
      gpgKeys=gpgKeys.replace(/^, /, "").replace(/, $/,"");
      msgConfirm += "\n\n"+Locale.getString("encryptKeysNote", [ gpgKeys ]);
    }

    return Dialog.confirmDlg(window, msgConfirm,
                             Locale.getString((isOffline || sendFlags & nsIEnigmail.SEND_LATER) ?
                                              "msgCompose.button.save" : "msgCompose.button.send"));
  },


  addRecipients: function (toAddrList, recList)
  {
    for (var i=0; i<recList.length; i++) {
      toAddrList.push(EnigmailFuncs.stripEmail(recList[i].replace(/[\",]/g, "")));
    }
  },

  setDraftStatus: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.setDraftStatus - enabling draft mode\n");

    // Draft Status:
    // N (for new style) plus String of 4 numbers:
    // 1: encryption
    // 2: signing
    // 3: PGP/MIME
    // 4: attach own key

    var draftStatus = "N" + this.encryptForced + this.signForced + this.pgpmimeForced +
      (this.attachOwnKeyObj.appendAttachment ? "1" : "0");

    this.setAdditionalHeader("X-Enigmail-Draft-Status", draftStatus);
  },


  getSenderUserId: function ()
  {
    var userIdValue = null;

    if (this.identity.getIntAttribute("pgpKeyMode")>0) {
       userIdValue = this.identity.getCharAttribute("pgpkeyId");

      if (!userIdValue) {

        var mesg = Locale.getString("composeSpecifyEmail");

        var valueObj = {
          value: userIdValue
        };

        if (Dialog.promptValue(window, mesg, valueObj)) {
          userIdValue = valueObj.value;
        }
      }

      if (userIdValue) {
        this.identity.setCharAttribute("pgpkeyId", userIdValue);

      }
      else {
        this.identity.setIntAttribute("pgpKeyMode", 0);
      }
    }

    if (typeof(userIdValue) != "string") {
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.getSenderUserId: type of userIdValue="+typeof(userIdValue)+"\n");
      userIdValue = this.identity.email;
    }
    return userIdValue;
  },


  /* process rules and find keys for passed email addresses
   * This is THE core method to prepare sending encryptes emails.
   * - it processes the recipient rules (if not disabled)
   * - it
   *
   * @sendFlags:    Longint - all current combined/processed send flags (incl. optSendFlags)
   * @optSendFlags: Longint - may only be SEND_ALWAYS_TRUST or SEND_ENCRYPT_TO_SELF
   * @gotSendFlags: Longint - initial sendMode of encryptMsg() (0 or SIGN or ENCRYPT or SIGN|ENCRYPT)
   * @fromAddr:     String - from email
   * @toAddrList:   Array  - both to and cc receivers
   * @bccAddrList:  Array  - bcc receivers
   * @return:       Object:
   *                - sendFlags (Longint)
   *                - toAddrStr  comma separated string of unprocessed to/cc emails
   *                - bccAddrStr comma separated string of unprocessed to/cc emails
   *                or null (cancel sending the email)
   */
  keySelection: function (enigmailSvc, sendFlags, optSendFlags, gotSendFlags, fromAddr, toAddrList, bccAddrList)
  {
    Log.DEBUG("=====> keySelection()\n");
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.keySelection()\n");
    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var toAddrStr = toAddrList.join(", ");
    var bccAddrStr = bccAddrList.join(", ");

    // NOTE: If we only have bcc addresses, we currently do NOT process rules and select keys at all
    //       This is GOOD because sending keys for bcc addresses makes bcc addresses visible
    //       (thus compromising the concept of bcc)
    //       THUS, we disable encryption even though all bcc receivers might want to have it encrypted.
    if (toAddrStr.length === 0) {
       Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.keySelection(): skip key selection because we neither have \"to\" nor \"cc\" addresses\n");

       if (this.statusPGPMime == Constants.ENIG_FINAL_YES ||
           this.statusPGPMime == Constants.ENIG_FINAL_FORCEYES) {
          sendFlags |= nsIEnigmail.SEND_PGP_MIME;
       }
       else if (this.statusPGPMime == Constants.ENIG_FINAL_NO ||
           this.statusPGPMime == Constants.ENIG_FINAL_FORCENO ||
           this.statusPGPMime == Constants.ENIG_FINAL_CONFLICT)
       {
          sendFlags &= ~nsIEnigmail.SEND_PGP_MIME;
       }

       return {
         sendFlags: sendFlags,
         toAddrStr: toAddrStr,
         bccAddrStr: bccAddrStr,
       };
    }

    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.keySelection(): toAddrStr=\""+toAddrStr+"\" bccAddrStr=\""+bccAddrStr+"\"\n");

    // force add-rule dialog for each missing key?:
    var forceRecipientSettings = false;
    // if keys are ONLY assigned by rules, force add-rule dialog for each missing key
    if (Prefs.getPref("assignKeysByRules") &&
        ! Prefs.getPref("assignKeysByEmailAddr") &&
        ! Prefs.getPref("assignKeysManuallyIfMissing") &&
        ! Prefs.getPref("assignKeysManuallyAlways")) {
      forceRecipientSettings = true;
    }

    // REPEAT 1 or 2 times:
    // NOTE: The only way to call this loop twice is to come to the "continue;" statement below,
    //       which forces a second iteration (with forceRecipientSettings==true)
    var doRulesProcessingAgain;
    do {
      doRulesProcessingAgain=false;

      // process rules if not disabled
      // - enableRules: rules not temporarily disabled
      // REPLACES email addresses by keys in its result !!!
      var refreshKeyList = true;
      if (Prefs.getPref("assignKeysByRules") && this.enableRules) {
        let result = this.processRules (forceRecipientSettings, sendFlags, optSendFlags, toAddrStr, bccAddrStr);
        if (!result) {
          return null;
        }
        sendFlags = result.sendFlags;
        optSendFlags = result.optSendFlags;
        toAddrStr = result.toAddr;    // replace email addresses with rules by the corresponding keys
        bccAddrStr = result.bccAddr;  // replace email addresses with rules by the corresponding keys
        refreshKeyList = !result.didRefreshKeyList;  // if key list refreshed we don't have to do it again
      }

      // if encryption is requested for the email:
      // - encrypt test message for default encryption
      // - might trigger a second iteration through this loop
      //   - if during its dialog for manual key selection "create per-recipient rules" is pressed
      //   to force manual settings for missing keys
      // LEAVES remaining email addresses not covered by rules as they are
      if (sendFlags & ENCRYPT) {
        let result = this.encryptTestMessage (enigmailSvc, sendFlags, optSendFlags,
                                              fromAddr, toAddrStr, bccAddrStr, bccAddrList, refreshKeyList);
        if (!result) {
          return null;
        }
        sendFlags = result.sendFlags;
        toAddrStr = result.toAddrStr;
        bccAddrStr = result.bccAddrStr;
        if (result.doRulesProcessingAgain) {  // start rule processing again ?
          doRulesProcessingAgain=true;
          if (result.createNewRule) {
            forceRecipientSettings=true;
          }
        }
      }
    } while (doRulesProcessingAgain);

    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.keySelection(): return toAddrStr=\""+toAddrStr+"\" bccAddrStr=\""+bccAddrStr+"\"\n");
    Log.DEBUG("  <=== keySelection()");
    return {
      sendFlags: sendFlags,
      toAddrStr: toAddrStr,
      bccAddrStr: bccAddrStr,
    };
  },


  /* Determine if S/MIME or OpenPGP should be used
   *
   * return: Boolean:
   *   - true:  use OpenPGP
   *   - false: use S/MIME
   *   - null:  dialog aborted - cancel sending
   */
  preferPgpOverSmime: function(sendFlags) {

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIMsgSMIMECompFields &&
        (sendFlags & (nsIEnigmail.SEND_SIGNED | nsIEnigmail.SEND_ENCRYPTED))) {

      if (gMsgCompose.compFields.securityInfo.requireEncryptMessage ||
         gMsgCompose.compFields.securityInfo.signMessage) {

         if (sendFlags & nsIEnigmail.SAVE_MESSAGE) {
           // use S/MIME if it's enabled for saving drafts
           return false;
         }
         else {
           var promptSvc = Dialog.getPromptSvc();
           var prefAlgo = Prefs.getPref("mimePreferPgp");
           if (prefAlgo == 1) {
             var checkedObj={ value: null};
             prefAlgo = promptSvc.confirmEx(window,
                        Locale.getString("enigConfirm"),
                        Locale.getString("pgpMime_sMime.dlg.text"),
                        (promptSvc. BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_0) +
                        (promptSvc. BUTTON_TITLE_CANCEL * promptSvc.BUTTON_POS_1) +
                        (promptSvc. BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_2),
                        Locale.getString("pgpMime_sMime.dlg.pgpMime.button"),
                        null,
                        Locale.getString("pgpMime_sMime.dlg.sMime.button"),
                        Locale.getString("dlgKeepSetting"),
                        checkedObj);
             if (checkedObj.value && (prefAlgo===0 || prefAlgo==2)) Prefs.setPref("mimePreferPgp", prefAlgo);
           }
           switch (prefAlgo) {
           case 0:
              // use OpenPGP and not S/MIME
              gMsgCompose.compFields.securityInfo.requireEncryptMessage = false;
              gMsgCompose.compFields.securityInfo.signMessage = false;
              return true;
           case 2:
              // use S/MIME and not OpenPGP
              return false;
           case 1:
              return null;
           default:
              // cancel or ESC pressed
              return null;
           }
         }
      }
    }

    return true;
  },


  /* process rules
   *
   * @forceRecipientSetting: force manual selection for each missing key?
   * @sendFlags:    INPUT/OUTPUT all current combined/processed send flags (incl. optSendFlags)
   * @optSendFlags: INPUT/OUTPUT may only be SEND_ALWAYS_TRUST or SEND_ENCRYPT_TO_SELF
   * @toAddrStr:    INPUT/OUTPUT comma separated string of keys and unprocessed to/cc emails
   * @bccAddrStr:   INPUT/OUTPUT comma separated string of keys and unprocessed bcc emails
   * @return:       { sendFlags, toAddr, bccAddr }
   *                or null (cancel sending the email)
   */
  processRules: function (forceRecipientSettings, sendFlags, optSendFlags, toAddrStr, bccAddrStr)
  {
    Log.DEBUG("=====> processRules()\n");
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.processRules(): toAddrStr=\""+toAddrStr+"\" bccAddrStr=\""+bccAddrStr+"\" forceRecipientSettings="+forceRecipientSettings+"\n");

    // process defaults
    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;
    var didRefreshKeyList = false;    // return value to signal whether the key list was refreshed

    // get keys for to and cc addresses:
    // - matchedKeysObj will contain the keys and the remaining toAddrStr elements
    var matchedKeysObj = {};  // returned value for matched keys
    var flagsObj = {};        // returned value for flags
    if (!Enigmail.hlp.getRecipientsKeys(toAddrStr,
                                        true,           // interactive
                                        forceRecipientSettings,
                                        matchedKeysObj,
                                        flagsObj)) {
      return null;
    }
    if (matchedKeysObj.value) {
      toAddrStr = matchedKeysObj.value;
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.processRules(): after getRecipientsKeys() toAddrStr=\""+toAddrStr+"\"\n");
    }
    this.encryptByRules = flagsObj.encrypt;
    this.signByRules    = flagsObj.sign;
    this.pgpmimeByRules = flagsObj.pgpMime;

    // if not clear whether to encrypt yet, check whether automatically-send-encrypted applies
    // - check whether bcc is empty here? if (bccAddrStr.length === 0)
    if (toAddrStr.length > 0 && this.encryptByRules == Constants.ENIG_UNDEF && Prefs.getPref("autoSendEncrypted") == 1) {
      var validKeyList = Enigmail.hlp.validKeysForAllRecipients(toAddrStr);
      if (validKeyList !== null) {
        this.encryptByRules = Constants.ENIG_AUTO_ALWAYS;
        toAddrStr = validKeyList.join(", ");
      }
    }

    // process final state
    this.processFinalState(sendFlags);

    // final handling of conflicts:
    // - pgpMime conflicts always result into pgpMime = 0/'never'
    if (this.statusPGPMime == Constants.ENIG_FINAL_CONFLICT) {
      this.statusPGPMime = Constants.ENIG_FINAL_NO;
    }
    // - encrypt/sign conflicts result into result 0/'never'
    //   with possible dialog to give a corresponding feedback
    var conflictFound = false;
    if (this.statusEncrypted == Constants.ENIG_FINAL_CONFLICT) {
      this.statusEncrypted = Constants.ENIG_FINAL_NO;
      conflictFound = true;
    }
    if (this.statusSigned == Constants.ENIG_FINAL_CONFLICT) {
      this.statusSigned = Constants.ENIG_FINAL_NO;
      conflictFound = true;
    }
    if (conflictFound) {
      if (!Enigmail.hlp.processConflicts(this.statusEncrypted==Constants.ENIG_FINAL_YES || this.statusEncrypted==Constants.ENIG_FINAL_FORCEYES,
                                         this.statusSigned==Constants.ENIG_FINAL_YES || this.statusSigned==Constants.ENIG_FINAL_FORCEYES)) {
        return null;
      }
    }

    // process final sendMode
    //  ENIG_FINAL_CONFLICT no longer possible
    switch (this.statusEncrypted) {
      case Constants.ENIG_FINAL_NO:
      case Constants.ENIG_FINAL_FORCENO:
        sendFlags &= ~ENCRYPT;
        break;
      case Constants.ENIG_FINAL_YES:
      case Constants.ENIG_FINAL_FORCEYES:
        sendFlags |= ENCRYPT;
        break;
    }
    switch (this.statusSigned) {
      case Constants.ENIG_FINAL_NO:
      case Constants.ENIG_FINAL_FORCENO:
        sendFlags &= ~SIGN;
        break;
      case Constants.ENIG_FINAL_YES:
      case Constants.ENIG_FINAL_FORCEYES:
        sendFlags |= SIGN;
        break;
    }
    switch (this.statusPGPMime) {
      case Constants.ENIG_FINAL_NO:
      case Constants.ENIG_FINAL_FORCENO:
        sendFlags &= ~nsIEnigmail.SEND_PGP_MIME;
        break;
      case Constants.ENIG_FINAL_YES:
      case Constants.ENIG_FINAL_FORCEYES:
        sendFlags |= nsIEnigmail.SEND_PGP_MIME;
        break;
    }

    // get keys according to rules for bcc addresses:
    // - matchedKeysObj will contain the keys and the remaining bccAddrStr elements
    // - NOTE: bcc recipients are ignored when in general computing whether to sign or encrypt or pgpMime
    if (!Enigmail.hlp.getRecipientsKeys(bccAddrStr,
                                        true,           // interactive
                                        forceRecipientSettings,
                                        matchedKeysObj,
                                        flagsObj)) {
      return null;
    }
    if (matchedKeysObj.value) {
      bccAddrStr = matchedKeysObj.value;
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.processRules(): after getRecipientsKeys() bccAddrStr=\""+bccAddrStr+"\"\n");
    }

    Log.DEBUG("  <=== processRules()\n");
    return {
      sendFlags: sendFlags,
      optSendFlags: optSendFlags,
      toAddr: toAddrStr,
      bccAddr: bccAddrStr,
      didRefreshKeyList: didRefreshKeyList,
    };
  },


  /* encrypt a test message to see whether we have all necessary keys
   *
   * @sendFlags:    all current combined/processed send flags (incl. optSendFlags)
   * @optSendFlags: may only be SEND_ALWAYS_TRUST or SEND_ENCRYPT_TO_SELF
   * @fromAddr:     from email
   * @toAddrStr:    comma separated string of keys and unprocessed to/cc emails
   * @bccAddrStr:   comma separated string of keys and unprocessed bcc emails
   * @bccAddrList:  bcc receivers
   * @return:       doRulesProcessingAgain: start with rule processing once more
   *                or null (cancel sending the email)
   */
  encryptTestMessage: function (enigmailSvc, sendFlags, optSendFlags, fromAddr, toAddrStr, bccAddrStr, bccAddrList, refresh)
  {
    Log.DEBUG("=====> encryptTestMessage()\n");
    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var testCipher = null;
    var testExitCodeObj    = {};
    var testStatusFlagsObj = {};
    var testErrorMsgObj    = {};

    // get keys for remaining email addresses
    // - NOTE: This should not be necessary; however, in GPG there is a problem:
    //         Only the first key found for an email is used.
    //         If this is invalid, no other keys are tested.
    //         Thus, WE make it better here in enigmail until the bug is fixed.
    var details = {};  // will contain msgList[] afterwards
    if (Prefs.getPref("assignKeysByEmailAddr")) {
      var validKeyList = Enigmail.hlp.validKeysForAllRecipients(toAddrStr, details);
      if (validKeyList !== null) {
        toAddrStr = validKeyList.join(", ");
      }
    }

    // encrypt test message for test recipients
    var testPlain = "Test Message";
    var testUiFlags   = nsIEnigmail.UI_TEST;
    var testSendFlags = nsIEnigmail.SEND_TEST | ENCRYPT | optSendFlags ;
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptTestMessage(): call encryptMessage() for fromAddr=\""+fromAddr+"\" toAddrStr=\""+toAddrStr+"\" bccAddrStr=\""+bccAddrStr+"\"\n");
    testCipher = enigmailSvc.encryptMessage(window, testUiFlags, testPlain,
                                            fromAddr, toAddrStr, bccAddrStr,
                                            testSendFlags,
                                            testExitCodeObj,
                                            testStatusFlagsObj,
                                            testErrorMsgObj);

    if (testStatusFlagsObj.value) {
      // check if own key is invalid
      let s = new RegExp("^INV_(RECP|SGNR) [0-9]+ \\<?" + fromAddr + "\\>?", "m");
      if (testErrorMsgObj.value.search(s) >= 0)  {
        Dialog.alert(window, Locale.getString("errorKeyUnusable", [ fromAddr ]));
        return null;
      }
    }

    // if
    // - "always ask/manually" (even if all keys were found) or
    // - unless "ask for missing keys":
    //   - we have an invalid recipient or
    //   - we could not resolve any/all keys
    //     (due to disabled "assignKeysByEmailAddr"" or multiple keys with same trust for a recipient)
    // start the dialog for user selected keys
    if (Prefs.getPref("assignKeysManuallyAlways") ||
        (((testStatusFlagsObj.value & nsIEnigmail.INVALID_RECIPIENT) ||
          toAddrStr.indexOf('@') >= 0) &&
         Prefs.getPref("assignKeysManuallyIfMissing")) ||
        (details && details.errArray && details.errArray.length>0)
        ) {

      // check for invalid recipient keys
      var resultObj = {};
      var inputObj = {};
      inputObj.toAddr = toAddrStr;
      inputObj.invalidAddr = Enigmail.hlp.getInvalidAddress(testErrorMsgObj.value);
      if (details && details.errArray && details.errArray.length>0) {
        inputObj.errArray = details.errArray;
      }

      // prepare dialog options:
      inputObj.options = "multisel";
      if (Prefs.getPref("assignKeysByRules")) {
        inputObj.options += ",rulesOption"; // enable button to create per-recipient rule
      }
      if (Prefs.getPref("assignKeysManuallyAlways")) {
        inputObj.options += ",noforcedisp";
      }
      if (!(sendFlags&SIGN)) {
        inputObj.options += ",unsigned";
      }
      if (this.trustAllKeys) {
        inputObj.options += ",trustallkeys";
      }
      if (sendFlags&nsIEnigmail.SEND_LATER) {
        sendLaterLabel = Locale.getString("sendLaterCmd.label");
        inputObj.options += ",sendlabel=" + sendLaterLabel;
      }
      inputObj.options += ",";
      inputObj.dialogHeader = Locale.getString("recipientsSelectionHdr");

      // perform key selection dialog:
      window.openDialog("chrome://enigmail/content/enigmailKeySelection.xul","", "dialog,modal,centerscreen,resizable", inputObj, resultObj);

      // process result from key selection dialog:
      try {
        // CANCEL:
        if (resultObj.cancelled) {
          return null;
        }


        // repeat checking of rules etc. (e.g. after importing new key)
        if (resultObj.repeatEvaluation) {
          // THIS is the place that triggers a second iteration
          let returnObj = {
            doRulesProcessingAgain : true,
            createNewRule : false,
            sendFlags : sendFlags,
            toAddrStr : toAddrStr,
            bccAddrStr : bccAddrStr,
          };

          // "Create per recipient rule(s)":
          if (resultObj.perRecipientRules && this.enableRules) {
            // do an extra round because the user wants to set a PGP rule
            returnObj.createNewRule = true;
          }

          return returnObj;
        }

        // process OK button:
        if (resultObj.encrypt) {
          sendFlags |= ENCRYPT;  // should anyway be set
          if (bccAddrList.length > 0) {
            toAddrStr = "";
            bccAddrStr = resultObj.userList.join(", ");
          }
          else {
            toAddrStr = resultObj.userList.join(", ");
            bccAddrStr = "";
          }
        }
        else {
          // encryption explicitely turned off
          sendFlags &= ~ENCRYPT;
          // counts as forced non-encryption
          // (no internal error if different state was processed before)
          this.statusEncrypted = Constants.ENIG_FINAL_NO;
          this.statusEncryptedInStatusBar = Constants.ENIG_FINAL_NO;
        }
        if (resultObj.sign) {
          sendFlags |= SIGN;
        }
        else {
          sendFlags &= ~SIGN;
        }
        testCipher="ok";
        testExitCodeObj.value = 0;
      } catch (ex) {
        // cancel pressed -> don't send mail
        return null;
      }
    }
    // If test encryption failed and never ask manually, turn off default encryption
    if ((!testCipher || (testExitCodeObj.value !== 0)) &&
        !Prefs.getPref("assignKeysManuallyIfMissing") &&
        !Prefs.getPref("assignKeysManuallyAlways")) {
      sendFlags &= ~ENCRYPT;
      this.statusEncrypted = Constants.ENIG_FINAL_NO;
      this.statusEncryptedInStatusBar = Constants.ENIG_FINAL_NO;
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptTestMessage: No default encryption because test failed\n");
    }
    Log.DEBUG("  <=== encryptTestMessage()");
    return {
      doRulesProcessingAgain : false,
      createNewRule : false,
      sendFlags : sendFlags,
      toAddrStr : toAddrStr,
      bccAddrStr : bccAddrStr,
    };
  },

  /* Manage the wrapping of inline signed mails
   *
   * @wrapresultObj: Result:
   * @wrapresultObj.cancelled, true if send operation is to be cancelled, else false
   * @wrapresultObj.usePpgMime, true if message send option was changed to PGP/MIME, else false
   */

  wrapInLine: function (wrapresultObj)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: WrapInLine\n");
    wrapresultObj.cancelled = false;
    wrapresultObj.usePpgMime = false;
    {
      try {
        const dce = Components.interfaces.nsIDocumentEncoder;
        var wrapper = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
        var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
        var encoderFlags = dce.OutputFormatted | dce.OutputLFLineBreak;

        var wrapWidth = this.getMailPref("mailnews.wraplength");
        if (wrapWidth > 0 && wrapWidth < 68 && editor.wrapWidth > 0) {
          if (Dialog.confirmDlg(window, Locale.getString("minimalLineWrapping", [ wrapWidth ] ))) {
            wrapWidth = 68;
            Prefs.getPrefRoot().setIntPref("mailnews.wraplength", wrapWidth);
          }
        }

        if (wrapWidth && editor.wrapWidth > 0) {
          // First use standard editor wrap mechanism:
          editor.wrapWidth = wrapWidth - 2;
          wrapper.rewrap(true);
          editor.wrapWidth = wrapWidth;

          // Now get plaintext from editor
          var wrapText = this.editorGetContentAs("text/plain", encoderFlags);

          // split the lines into an array
          wrapText = wrapText.split(/\r\n|\r|\n/g);

          var i = 0;
          var excess = 0;
          // inspect all lines of mail text to detect if we still have excessive lines which the "standard" editor wrapper leaves
          for (i=0;i<wrapText.length;i++) {
            if (wrapText[i].length > wrapWidth) {
              excess = 1;
            }
          }

          if (excess) {
            Log.DEBUG("enigmailMsgComposeOverlay.js: Excess lines detected\n");
            var resultObj = {};
            window.openDialog("chrome://enigmail/content/enigmailWrapSelection.xul","", "dialog,modal,centerscreen", resultObj);
            try {
              if (resultObj.cancelled) {
                // cancel pressed -> do not send, return instead.
                wrapresultObj.cancelled = true;
                return;
              }
            }
            catch (ex) {
              // cancel pressed -> do not send, return instead.
              wrapresultObj.cancelled = true;
              return;
            }

            var quote = "";
            var limitedLine = "";
            var restOfLine = "";

            var WrapSelect=resultObj.Select;
            switch (WrapSelect) {
              case "0":  // Selection: Force rewrap
                for (i=0;i<wrapText.length;i++) {
                  if (wrapText[i].length > wrapWidth) {

                    // If the current line is too long, limit it hard to wrapWidth and insert the rest as the next line into wrapText array
                    limitedLine = wrapText[i].slice(0, wrapWidth);
                    restOfLine = wrapText[i].slice(wrapWidth);

                    // We should add quotes at the beginning of "restOfLine", if limitedLine is a quoted line
                    // However, this would be purely academic, because limitedLine will always be "standard"-wrapped
                    // by the editor-rewrapper at the space between quote sign (>) and the quoted text.

                    wrapText.splice(i,1,limitedLine,restOfLine);
                  }
                }
                break;
              case "1":  // Selection: Send as is
                break;
              case "2":  // Selection: Use MIME
                wrapresultObj.usePpgMime = true;
                break;
              case "3":  // Selection: Edit manually -> do not send, return instead.
                wrapresultObj.cancelled = true;
                return;
            } //switch
          }
          // Now join all lines together again and feed it back into the compose editor.
          var newtext = wrapText.join("\n");
          this.replaceEditorText(newtext);
        }
      }
      catch (ex) {
        Log.DEBUG("enigmailMsgComposeOverlay.js: Exception while wrapping="+ex+"\n");
      }
    }
  },

    // Save draft message. We do not want most of the other processing for encrypted mails here...
  saveDraftMessage: function() {
    Log.DEBUG("enigmailMsgComposeOverlay.js: saveDraftMessage()\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    let doEncrypt = this.getAccDefault("enabled") && this.identity.getBoolAttribute("autoEncryptDrafts");

    this.setDraftStatus();

    if (! doEncrypt) {
      Log.DEBUG("enigmailMsgComposeOverlay.js: drafts disabled\n");

      try {
        if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIEnigMsgCompFields) {
          gMsgCompose.compFields.securityInfo.sendFlags = 0;
        }
      }
      catch(ex) {}

      return true;
    }

    let sendFlags = nsIEnigmail.SEND_PGP_MIME | nsIEnigmail.SEND_ENCRYPTED | nsIEnigmail.SAVE_MESSAGE | nsIEnigmail.SEND_ALWAYS_TRUST;

    let fromAddr = this.identity.email;
    let userIdValue = this.getSenderUserId();
    if (userIdValue) {
      fromAddr = userIdValue;
    }

    let enigmailSvc = EnigmailCore.getService(window);
    if (! enigmailSvc) return true;

    let useEnigmail = this.preferPgpOverSmime(sendFlags);

    if (useEnigmail === null) return false; // dialog aborted
    if (useEnigmail === false) return true; // use S/MIME

    // Try to save draft

    var testCipher = null;
    var testExitCodeObj    = {};
    var testStatusFlagsObj = {};
    var testErrorMsgObj    = {};

    // encrypt test message for test recipients
    var testPlain = "Test Message";
    var testUiFlags   = nsIEnigmail.UI_TEST;
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.saveDraft(): call encryptMessage() for fromAddr=\""+fromAddr+"\"\n");
    testCipher = enigmailSvc.encryptMessage(null, testUiFlags, testPlain,
                                            fromAddr, fromAddr, "",
                                            sendFlags | nsIEnigmail.SEND_TEST,
                                            testExitCodeObj,
                                            testStatusFlagsObj,
                                            testErrorMsgObj);

    if (testStatusFlagsObj.value) {
      // check if own key is invalid
      let s = new RegExp("^INV_RECP [0-9]+ \\<?" + fromAddr + "\\>?", "m");
      if (testErrorMsgObj.value.search(s) >= 0)  {
        Dialog.alert(window,
          Locale.getString("saveDraftError")+ "\n\n" +
          Locale.getString("errorOwnKeyUnusable", [ fromAddr ]));
        return false;
      }
    }

    let newSecurityInfo;

    try {
      if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIEnigMsgCompFields) {
        newSecurityInfo = gMsgCompose.compFields.securityInfo;
      }
      else {
        throw "dummy";
      }
    }
    catch (ex) {
      try {
        newSecurityInfo = Components.classes[this.compFieldsEnig_CID].createInstance(Components.interfaces.nsIEnigMsgCompFields);
        if (newSecurityInfo) {
          let oldSecurityInfo = gMsgCompose.compFields.securityInfo;
          newSecurityInfo.init(oldSecurityInfo);
          gMsgCompose.compFields.securityInfo = newSecurityInfo;
        }
      }
      catch (ex2) {
        Log.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.saveDraftMessage", ex);
        return false;
      }
    }

    newSecurityInfo.sendFlags = sendFlags;
    newSecurityInfo.UIFlags = 0;
    newSecurityInfo.senderEmailAddr = fromAddr;
    newSecurityInfo.recipients = fromAddr;
    newSecurityInfo.bccRecipients = "";
    this.dirty = true;

    return true;
  },

  encryptMsg: function (msgSendType)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: msgSendType="+msgSendType+", Enigmail.msg.sendMode="+this.sendMode+", Enigmail.msg.statusEncrypted="+this.statusEncrypted+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;
    const CiMsgCompDeliverMode = Components.interfaces.nsIMsgCompDeliverMode;
    var promptSvc = Dialog.getPromptSvc();

    var gotSendFlags = this.sendMode;
    // here we process the final state:
    if (this.statusEncrypted == Constants.ENIG_FINAL_YES ||
        this.statusEncrypted == Constants.ENIG_FINAL_FORCEYES) {
      gotSendFlags |= ENCRYPT;
    }
    if (this.statusSigned == Constants.ENIG_FINAL_YES ||
        this.statusSigned == Constants.ENIG_FINAL_FORCEYES) {
      gotSendFlags |= SIGN;
    }

    var sendFlags=0;
    window.enigmailSendFlags=0;

    switch (msgSendType) {
    case CiMsgCompDeliverMode.Later:
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: adding SEND_LATER\n");
      sendFlags |= nsIEnigmail.SEND_LATER;
      break;
    case CiMsgCompDeliverMode.SaveAsDraft:
    case CiMsgCompDeliverMode.SaveAsTemplate:
    case CiMsgCompDeliverMode.AutoSaveAsDraft:
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: detected save draft\n");

      // saving drafts is simpler and works differently than the rest of Enigmail.
      // All rules except account-settings are ignored.
      return this.saveDraftMessage();
    }

    var msgCompFields = gMsgCompose.compFields;
    var newsgroups = msgCompFields.newsgroups;  // Check if sending to any newsgroups

    if (msgCompFields.to === "" &&
        msgCompFields.cc === "" &&
        msgCompFields.bcc === "" &&
        newsgroups === "") {
      // don't attempt to send message if no recipient specified
      var bundle = document.getElementById("bundle_composeMsgs");
      Dialog.alert(window, bundle.getString("12511"));
      return false;
    }

    if (gotSendFlags & SIGN) sendFlags |= SIGN;
    if (gotSendFlags & ENCRYPT) sendFlags |= ENCRYPT;

    this.identity = getCurrentIdentity();
    var encryptIfPossible = false;

    if (gWindowLocked) {
      Dialog.alert(window, Locale.getString("windowLocked"));
      return false;
    }

    if (this.dirty) {
      // make sure the sendFlags are reset before the message is processed
      // (it may have been set by a previously cancelled send operation!)
      try {
        if (gMsgCompose.compFields.securityInfo instanceof Components.interfaces.nsIEnigMsgCompFields) {
          gMsgCompose.compFields.securityInfo.sendFlags=0;
        }
        else if (gMsgCompose.compFields.securityInfo === null) {
          throw "dummy";
        }
      }
      catch (ex){
        try {
          var newSecurityInfo = Components.classes[this.compFieldsEnig_CID].createInstance(Components.interfaces.nsIEnigMsgCompFields);
          if (newSecurityInfo) {
            newSecurityInfo.sendFlags=0;
            gMsgCompose.compFields.securityInfo = newSecurityInfo;
          }
        }
        catch (ex2) {
          Log.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.attachKey", ex);
        }
      }
    }
    this.dirty = 1;

    var enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc) {
       var msg=Locale.getString("sendUnencrypted");
        if (EnigmailCore.getEnigmailService() && EnigmailCore.getEnigmailService().initializationError) {
          msg = EnigmailCore.getEnigmailService().initializationError +"\n\n"+msg;
       }

       return Dialog.confirmDlg(window, msg, Locale.getString("msgCompose.button.send"));
    }

    try {

       this.modifiedAttach = null;

       Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: currentId="+this.identity+
                ", "+this.identity.email+"\n");
       var fromAddr = this.identity.email;

       var pgpEnabled = this.getAccDefault("enabled");

       if (! pgpEnabled) return true;

       var optSendFlags = 0;
       var inlineEncAttach=false;

       // request or preference to always accept (even non-authenticated) keys?
       if (this.trustAllKeys) {
         optSendFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;
       }
       else {
         var acceptedKeys = Prefs.getPref("acceptedKeys");
         switch (acceptedKeys) {
           case 0: // accept valid/authenticated keys only
             break;
           case 1: // accept all but revoked/disabled/expired keys
             optSendFlags |= nsIEnigmail.SEND_ALWAYS_TRUST;
             break;
           default:
             Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: INVALID VALUE for acceptedKeys: \""+acceptedKeys+"\"\n");
             break;
         }
       }

       if (Prefs.getPref("encryptToSelf")) {
         optSendFlags |= nsIEnigmail.SEND_ENCRYPT_TO_SELF;
       }

       sendFlags |= optSendFlags;

       var userIdValue = this.getSenderUserId();
       if (userIdValue) {
         fromAddr = userIdValue;
       }

       Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg:gMsgCompose="+gMsgCompose+"\n");

       var toAddrList = [];
       var bccAddrList = [];

       var splitRecipients;
       var arrLen =  {};
       var recList;
       splitRecipients = msgCompFields.splitRecipients;

       //Dialog.alert(window, typeof(msgCompFields.cc));
       if (msgCompFields.to.length > 0) {
         recList = splitRecipients(msgCompFields.to, true, arrLen);
         this.addRecipients(toAddrList, recList);
       }

       if (msgCompFields.cc.length > 0) {
         recList = splitRecipients(msgCompFields.cc, true, arrLen);
         this.addRecipients(toAddrList, recList);
       }

       // special handling of bcc:
       // - note: bcc and encryption is a problem
       // - but bcc to the sender is fine
       if (msgCompFields.bcc.length > 0) {
         recList = splitRecipients(msgCompFields.bcc, true, arrLen);

         var bccLC = EnigmailFuncs.stripEmail(msgCompFields.bcc).toLowerCase();
         Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: BCC: "+bccLC+"\n");

         var selfBCC = this.identity.email && (this.identity.email.toLowerCase() == bccLC);

         if (selfBCC) {
           Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: Self BCC\n");
           this.addRecipients(toAddrList, recList);

         }
         else if (sendFlags & ENCRYPT) {
           // BCC and encryption

           if (encryptIfPossible) {
             sendFlags &= ~ENCRYPT;
             Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: No default encryption because of BCC\n");
           }
           else {
             var dummy={value: null};

             var hideBccUsers = promptSvc.confirmEx(window,
                        Locale.getString("enigConfirm"),
                        Locale.getString("sendingHiddenRcpt"),
                        (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_0) +
                        (promptSvc. BUTTON_TITLE_CANCEL * promptSvc.BUTTON_POS_1) +
                        (promptSvc. BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_2),
                        Locale.getString("sendWithShownBcc"),
                        null,
                        Locale.getString("sendWithHiddenBcc"),
                        null,
                        dummy);
              switch (hideBccUsers) {
              case 2:
                this.addRecipients(bccAddrList, recList);
                this.addRecipients(toAddrList, recList);
                break;
              case 0:
                this.addRecipients(toAddrList, recList);
                break;
              case 1:
               return false;
              }
           }
         }
       }

       if (newsgroups) {
         toAddrList.push(newsgroups);

         if (sendFlags & ENCRYPT) {

           if (!encryptIfPossible) {
             if (!Prefs.getPref("encryptToNews")) {
               Dialog.alert(window, Locale.getString("sendingNews"));
               return false;
             }
             else if (!Dialog.confirmPref(window,
                          Locale.getString("sendToNewsWarning"),
                          "warnOnSendingNewsgroups",
                          Locale.getString("msgCompose.button.send"))) {
               return false;
             }
           }
           else {
             sendFlags &= ~ENCRYPT;
             Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: No default encryption because of newsgroups\n");
           }
         }
       }

       var usePGPMimeOption = Prefs.getPref("usePGPMimeOption");

       if (this.sendPgpMime) {
         // Use PGP/MIME
         sendFlags |= nsIEnigmail.SEND_PGP_MIME;
       }

       var result = this.keySelection(enigmailSvc,
                                      sendFlags,    // all current combined/processed send flags (incl. optSendFlags)
                                      optSendFlags, // may only be SEND_ALWAYS_TRUST or SEND_ENCRYPT_TO_SELF
                                      gotSendFlags, // initial sendMode (0 or SIGN or ENCRYPT or SIGN|ENCRYPT)
                                      fromAddr, toAddrList, bccAddrList);
       if (!result) {
         return false;
       }

       var toAddrStr;
       var bccAddrStr;
       sendFlags = result.sendFlags;
       toAddrStr = result.toAddrStr;
       bccAddrStr = result.bccAddrStr;

       var useEnigmail = this.preferPgpOverSmime(sendFlags);

       if (useEnigmail === null) return false; // dialog aborted
       if (useEnigmail === false) {
          // use S/MIME
          sendFlags = 0;
          return true;
       }

       if (this.attachOwnKeyObj.appendAttachment) this.attachOwnKey();

       var bucketList = document.getElementById("attachmentBucket");
       var hasAttachments = ((bucketList && bucketList.hasChildNodes()) || gMsgCompose.compFields.attachVCard);

       Log.DEBUG("enigmailMsgComposeOverlay.js: hasAttachments = "+hasAttachments+"\n");

       if ( hasAttachments &&
          (sendFlags & (ENCRYPT | SIGN)) &&
          !(sendFlags & nsIEnigmail.SEND_PGP_MIME)) {

          inputObj = {
            pgpMimePossible: true,
            inlinePossible: true,
            restrictedScenario: false,
            reasonForCheck: ""
          };
          // init reason for dialog to be able to use the right labels
          if (sendFlags & ENCRYPT) {
            if (sendFlags & SIGN) {
              inputObj.reasonForCheck = "encryptAndSign";
            }
            else {
              inputObj.reasonForCheck = "encrypt";
            }
          }
          else {
            if (sendFlags & SIGN) {
              inputObj.reasonForCheck = "sign";
            }
          }

          // determine if attachments are all local files (currently the only
          // supported kind of attachments)
          var node = bucketList.firstChild;
          while (node) {
            if (node.attachment.url.substring(0,7) != "file://") {
               inputObj.inlinePossible = false;
            }
            node = node.nextSibling;
          }

          if (inputObj.pgpMimePossible || inputObj.inlinePossible) {
            resultObj = {
              selected: Prefs.getPref("encryptAttachments")
            };

            //skip or not
            var skipCheck=Prefs.getPref("encryptAttachmentsSkipDlg");
            if (skipCheck == 1) {
              if ((resultObj.selected == 2 && inputObj.pgpMimePossible === false) || (resultObj.selected == 1 && inputObj.inlinePossible === false)) {
                //add var to disable remember box since we're dealing with restricted scenarios...
                inputObj.restrictedScenario = true;
                resultObj.selected = -1;
                window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
              }
            } else {
              resultObj.selected = -1;
              window.openDialog("chrome://enigmail/content/enigmailAttachmentsDialog.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
            }
            if (resultObj.selected < 0) {
              // dialog cancelled
              return false;
            }
            else if (resultObj.selected == 1) {
              // encrypt attachments
              inlineEncAttach=true;
            }
            else if (resultObj.selected == 2) {
              // send as PGP/MIME
              sendFlags |= nsIEnigmail.SEND_PGP_MIME;
            }
            else if (resultObj.selected == 3) {
              // cancel the encryption/signing for the whole message
              sendFlags &= ~ENCRYPT;
              sendFlags &= ~SIGN;
            }
          }
          else {
            if (sendFlags & ENCRYPT) {
              if (!Dialog.confirmDlg(window,
                    Locale.getString("attachWarning"),
                    Locale.getString("msgCompose.button.send")))
                return false;
            }
          }
       }

       var usingPGPMime = (sendFlags & nsIEnigmail.SEND_PGP_MIME) &&
                          (sendFlags & (ENCRYPT | SIGN));

       // ----------------------- Rewrapping code, taken from function "encryptInline"

       // Check wrapping, if sign only and inline and plaintext
       if ((sendFlags & SIGN) && !(sendFlags & ENCRYPT) && !(usingPGPMime) && !(gMsgCompose.composeHTML)) {
         var wrapresultObj = {};

         this.wrapInLine(wrapresultObj);

         if (wrapresultObj.usePpgMime) {
           sendFlags |= nsIEnigmail.SEND_PGP_MIME;
           usingPGPMime = nsIEnigmail.SEND_PGP_MIME;
         }
         if (wrapresultObj.cancelled) {
           return;
         }
       }

       var uiFlags = nsIEnigmail.UI_INTERACTIVE;

       if (usingPGPMime)
         uiFlags |= nsIEnigmail.UI_PGP_MIME;

       if ((sendFlags & (ENCRYPT | SIGN)) && usingPGPMime) {
         // Use PGP/MIME
         Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: Using PGP/MIME, flags="+sendFlags+"\n");

         var oldSecurityInfo = gMsgCompose.compFields.securityInfo;

         Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: oldSecurityInfo = "+oldSecurityInfo+"\n");

         if (!oldSecurityInfo) {
           try {
             newSecurityInfo = oldSecurityInfo.QueryInterface(Components.interfaces.nsIEnigMsgCompFields);
           } catch (ex) {}
         }

         if (!newSecurityInfo) {
           newSecurityInfo = Components.classes[this.compFieldsEnig_CID].createInstance(Components.interfaces.nsIEnigMsgCompFields);

           if (!newSecurityInfo)
             throw Components.results.NS_ERROR_FAILURE;

           newSecurityInfo.init(oldSecurityInfo);
           gMsgCompose.compFields.securityInfo = newSecurityInfo;
         }


         newSecurityInfo.sendFlags = sendFlags;
         newSecurityInfo.UIFlags = uiFlags;
         newSecurityInfo.senderEmailAddr = fromAddr;
         newSecurityInfo.recipients = toAddrStr;
         newSecurityInfo.bccRecipients = bccAddrStr;

         Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: securityInfo = "+newSecurityInfo+"\n");

       }
       else if (!this.processed && (sendFlags & (ENCRYPT | SIGN))) {
         // use inline PGP

         var sendInfo = {
           sendFlags: sendFlags,
           inlineEncAttach: inlineEncAttach,
           fromAddr: fromAddr,
           toAddr: toAddrStr,
           bccAddr: bccAddrStr,
           uiFlags: uiFlags,
           bucketList: bucketList
         };

         if (! this.encryptInline(sendInfo)) {
           return false;
         }
       }

       var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
       // EnigSend: Handle both plain and encrypted messages below
       var isOffline = (ioService && ioService.offline);
       window.enigmailSendFlags=sendFlags;

       // update the list of attachments
       Attachments2CompFields(msgCompFields);

       // process whether final confirmation is necessary
       var confirm = false;
       var conf = Prefs.getPref("confirmBeforeSending");
       switch (conf) {
         case 0:  // never
           confirm = false;
           break;
         case 1:  // always
           confirm = true;
           break;
         case 2:  // if send encrypted
           confirm = ((sendFlags&ENCRYPT) == ENCRYPT);
           break;
         case 3:  // if send unencrypted
           confirm = ((sendFlags&ENCRYPT) === 0);
           break;
         case 4:  // if encryption changed due to rules
           confirm = ((sendFlags&ENCRYPT) != (this.sendMode&ENCRYPT));
           break;
       }

       // double check that no internal error did result in broken promise of encryption
       // - if NOT send encrypted
       //   - although encryption was
       //     - the recent processed resulting encryption status or
       //     - was signaled in the status bar but is not the outcome now
      if ((sendFlags&ENCRYPT) === 0 &&
            (this.statusEncrypted == Constants.ENIG_FINAL_YES ||
             this.statusEncrypted == Constants.ENIG_FINAL_FORCEYES ||
             this.statusEncryptedInStatusBar == Constants.ENIG_FINAL_YES ||
             this.statusEncryptedInStatusBar == Constants.ENIG_FINAL_FORCEYES)) {
         Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: promised encryption did not succeed\n");
         if (!Dialog.confirmDlg(window,
                                        Locale.getString("msgCompose.internalEncryptionError"),
                                        Locale.getString("msgCompose.button.sendAnyway"))) {
           return false; // cancel sending
         }
         // without canceling sending, force firnal confirmation
         confirm = true;
       }

       // perform confirmation dialog if necessary/requested
       if (confirm) {
         if (!this.confirmBeforeSend(toAddrList.join(", "), toAddrStr+", "+bccAddrStr, sendFlags, isOffline)) {
           if (this.processed) {
             this.undoEncryption(0);
           }
           else {
             this.removeAttachedKey();
           }
           return false;
         }
       }
       else if ( (sendFlags & nsIEnigmail.SEND_WITH_CHECK) &&
                   !this.messageSendCheck() ) {
         // Abort send
         if (this.processed) {
            this.undoEncryption(0);
         }
         else {
            this.removeAttachedKey();
         }

         return false;
       }

       if (msgCompFields.characterSet != "ISO-2022-JP") {
         if ((usingPGPMime &&
             ((sendFlags & (ENCRYPT | SIGN)))) || ((! usingPGPMime) && (sendFlags & ENCRYPT))) {
           try {
              // make sure plaintext is not changed to 7bit
              if (typeof(msgCompFields.forceMsgEncoding) == "boolean") {
                msgCompFields.forceMsgEncoding = true;
                Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: enabled forceMsgEncoding\n");
              }
           }
           catch (ex) {}
        }
      }
    } catch (ex) {
       Log.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg", ex);
       msg=Locale.getString("signFailed");
       if (EnigmailCore.getEnigmailService() && EnigmailCore.getEnigmailService().initializationError) {
          msg += "\n"+EnigmailCore.getEnigmailService().initializationError;
       }
       return Dialog.confirmDlg(window, msg, Locale.getString("msgCompose.button.sendUnencrypted"));
    }

    // The encryption process for PGP/MIME messages follows "here". It's
    // called automatically from nsMsgCompose->sendMsg().
    // registration for this is dome in chrome.manifest

    return true;
  },

  encryptInline: function (sendInfo)
  {
    // sign/encrpyt message using inline-PGP

    const dce = Components.interfaces.nsIDocumentEncoder;
    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var enigmailSvc = EnigmailCore.getService(window);
    if (! enigmailSvc) return false;

    if (gMsgCompose.composeHTML) {
      var errMsg = Locale.getString("hasHTML");
      Dialog.alertCount(window, "composeHtmlAlertCount", errMsg);
    }

    try {
      var convert = DetermineConvertibility();
      if (convert == nsIMsgCompConvertible.No) {
        if (!Dialog.confirmDlg(window,
                                       Locale.getString("strippingHTML"),
                                       Locale.getString("msgCompose.button.sendAnyway"))) {
          return false;
        }
      }
    } catch (ex) {
       Log.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptInline", ex);
    }

    try {
      if (this.getMailPref("mail.strictly_mime")) {
        if (Dialog.confirmPref(window,
              Locale.getString("quotedPrintableWarn"), "quotedPrintableWarn")) {
          Prefs.getPrefRoot().setBoolPref("mail.strictly_mime", false);
        }
      }
    } catch (ex) {}


    var sendFlowed;
    try {
      sendFlowed = this.getMailPref("mailnews.send_plaintext_flowed");
    } catch (ex) {
      sendFlowed = true;
    }
    var encoderFlags = dce.OutputFormatted | dce.OutputLFLineBreak;

    var wrapper = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
    var editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
    var wrapWidth=72;

    if (! (sendInfo.sendFlags & ENCRYPT)) {
      // signed messages only
      if (gMsgCompose.composeHTML) {
        // enforce line wrapping here
        // otherwise the message isn't signed correctly
        try {
          wrapWidth = this.getMailPref("editor.htmlWrapColumn");

          if (wrapWidth > 0 && wrapWidth < 68 && gMsgCompose.wrapLength > 0) {
            if (Dialog.confirmDlg(window, Locale.getString("minimalLineWrapping", [ wrapWidth ] ))) {
              Prefs.getPrefRoot().setIntPref("editor.htmlWrapColumn", 68);
            }
          }
          if (Prefs.getPref("wrapHtmlBeforeSend")) {
            if (wrapWidth) {
              editor.wrapWidth = wrapWidth-2; // prepare for the worst case: a 72 char's long line starting with '-'
              wrapper.rewrap(false);
            }
          }
        }
        catch (ex) {}
      }
      else {
        // plaintext: Wrapping code has been moved to superordinate function encryptMsg to enable interactive format switch
      }
    }

    var exitCodeObj    = {};
    var statusFlagsObj = {};
    var errorMsgObj    = {};
    var exitCode;

    // Get plain text
    // (Do we need to set the nsIDocumentEncoder.* flags?)
    var origText = this.editorGetContentAs("text/plain",
                                           encoderFlags);
    if (! origText) origText = "";

    if (origText.length > 0) {
      // Sign/encrypt body text

      var escText = origText; // Copy plain text for possible escaping

      if (sendFlowed && !(sendInfo.sendFlags & ENCRYPT)) {
        // Prevent space stuffing a la RFC 2646 (format=flowed).

        //Log.DEBUG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

        // MULTILINE MATCHING ON
        RegExp.multiline = true;

        escText = escText.replace(/^From /g, "~From ");
        escText = escText.replace(/^>/g, "|");
        escText = escText.replace(/^[ \t]+$/g, "");
        escText = escText.replace(/^ /g, "~ ");

        // MULTILINE MATCHING OFF
        RegExp.multiline = false;

        //Log.DEBUG("enigmailMsgComposeOverlay.js: escText = '"+escText+"'\n");
        // Replace plain text and get it again
        this.replaceEditorText(escText);

        escText = this.editorGetContentAs("text/plain", encoderFlags);
      }

      // Replace plain text and get it again (to avoid linewrapping problems)
      this.replaceEditorText(escText);

      escText = this.editorGetContentAs("text/plain", encoderFlags);

      //Log.DEBUG("enigmailMsgComposeOverlay.js: escText["+encoderFlags+"] = '"+escText+"'\n");

      // Encrypt plaintext
      var charset = this.editorGetCharset();
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptMsg: charset="+charset+"\n");

      // Encode plaintext to charset from unicode
      var plainText = (sendInfo.sendFlags & ENCRYPT) ?
              Data.convertFromUnicode(origText, charset) :
              Data.convertFromUnicode(escText, charset);

      var cipherText = enigmailSvc.encryptMessage(window, sendInfo.uiFlags, plainText,
                                                  sendInfo.fromAddr, sendInfo.toAddr, sendInfo.bccAddr,
                                                  sendInfo.sendFlags,
                                                  exitCodeObj, statusFlagsObj,
                                                  errorMsgObj);

      exitCode = exitCodeObj.value;

      //Log.DEBUG("enigmailMsgComposeOverlay.js: cipherText = '"+cipherText+"'\n");
      if (cipherText && (exitCode === 0)) {
        // Encryption/signing succeeded; overwrite plaintext

        if (gMsgCompose.composeHTML) {
          // workaround for Thunderbird bug (TB adds an extra space in front of the text)
          cipherText = "\n"+cipherText;
        }
        else
          cipherText = cipherText.replace(/\r\n/g, "\n");

        if ( (sendInfo.sendFlags & ENCRYPT) && charset &&
          (charset.search(/^us-ascii$/i) !== 0) ) {
          // Add Charset armor header for encrypted blocks
          cipherText = cipherText.replace(/(-----BEGIN PGP MESSAGE----- *)(\r?\n)/, "$1$2Charset: "+charset+"$2");
        }

        // Decode ciphertext from charset to unicode and overwrite
        this.replaceEditorText( Data.convertToUnicode(cipherText, charset) );

        // Save original text (for undo)
        this.processed = {"origText":origText, "charset":charset};

      }
      else {
        // Restore original text
        this.replaceEditorText(origText);

        if (sendInfo.sendFlags & (ENCRYPT | SIGN)) {
          // Encryption/signing failed

          if (errorMsgObj.value) {
            // check if own key is invalid
            let s = new RegExp("^\\[GNUPG:\\] INV_(RECP|SGNR) [0-9]+ \\<?" + sendInfo.fromAddr + "\\>?", "m");
            if (errorMsgObj.value.search(s) >= 0)  {
              Dialog.alert(window, Locale.getString("errorKeyUnusable", [ sendInfo.fromAddr ]));
              return false;
            }
          }

          this.sendAborted(window, errorMsgObj);
          return false;
        }
      }
    }

    if (sendInfo.inlineEncAttach) {
      // encrypt attachments
      this.modifiedAttach = [];
      exitCode = this.encryptAttachments(sendInfo.bucketList, this.modifiedAttach,
                              window, sendInfo.uiFlags, sendInfo.fromAddr, sendInfo.toAddr, sendInfo.bccAddr,
                              sendInfo.sendFlags, errorMsgObj);
      if (exitCode !== 0) {
        this.modifiedAttach = null;
        this.sendAborted(window, errorMsgObj);
        if (this.processed) {
          this.undoEncryption(0);
        }
        else {
          this.removeAttachedKey();
        }
        return false;
      }
    }
    return true;
  },


  sendAborted: function (window, errorMsgObj)
  {
    if (errorMsgObj && errorMsgObj.value) {
      var txt = errorMsgObj.value;
      var txtLines = txt.split(/\r?\n/);
      var errorMsg = "";
      for (var i = 0; i < txtLines.length; ++i) {
        var line = txtLines[i];
        var tokens = line.split(/ /);
        // process most important business reasons for invalid recipient (and sender) errors:
        if (tokens.length == 3 && (tokens[0] == "INV_RECP" || tokens[0] == "INV_SGNR")) {
          var reason = tokens[1];
          var key = tokens[2];
          if (reason == "10") {
            errorMsg += Locale.getString("keyNotTrusted", [ key ]) + "\n";
          }
          else if (reason == "1") {
            errorMsg += Locale.getString("keyNotFound", [ key ]) + "\n";
          }
          else if (reason == "4") {
            errorMsg += Locale.getString("keyRevoked", [ key ]) + "\n";
          }
          else if (reason == "5") {
            errorMsg += Locale.getString("keyExpired", [ key ]) + "\n";
          }
        }
      }
      if (errorMsg !== "") {
        txt = errorMsg + "\n" + txt;
      }
      Dialog.alert(window, Locale.getString("sendAborted") + txt);
    }
    else {
      Dialog.alert(window, Locale.getString("sendAborted") + "an internal error has occurred");
    }
  },


  getMailPref: function (prefName)
  {
     let prefRoot = Prefs.getPrefRoot();

     var prefValue = null;
     try {
        var prefType = prefRoot.getPrefType(prefName);
        // Get pref value
        switch (prefType) {
        case prefRoot.PREF_BOOL:
           prefValue = prefRoot.getBoolPref(prefName);
           break;

        case prefRoot.PREF_INT:
           prefValue = prefRoot.getIntPref(prefName);
           break;

        case prefRoot.PREF_STRING:
           prefValue = prefRoot.getCharPref(prefName);
           break;

        default:
           prefValue = undefined;
           break;
       }

     } catch (ex) {
        // Failed to get pref value
        Log.ERROR("enigmailMsgComposeOverlay.js: Enigmail.msg.getMailPref: unknown prefName:"+prefName+" \n");
     }

     return prefValue;
  },

  messageSendCheck: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.messageSendCheck\n");

    try {
      var warn = this.getMailPref("mail.warn_on_send_accel_key");

      if (warn) {
          var checkValue = {value:false};
          var bundle = document.getElementById("bundle_composeMsgs");
          var buttonPressed = Dialog.getPromptSvc().confirmEx(window,
                bundle.getString('sendMessageCheckWindowTitle'),
                bundle.getString('sendMessageCheckLabel'),
                (Dialog.getPromptSvc().BUTTON_TITLE_IS_STRING * Dialog.getPromptSvc().BUTTON_POS_0) +
                (Dialog.getPromptSvc().BUTTON_TITLE_CANCEL * Dialog.getPromptSvc().BUTTON_POS_1),
                bundle.getString('sendMessageCheckSendButtonLabel'),
                null, null,
                bundle.getString('CheckMsg'),
                checkValue);
          if (buttonPressed !== 0) {
              return false;
          }
          if (checkValue.value) {
            Prefs.getPrefRoot().setBoolPref("mail.warn_on_send_accel_key", false);
          }
      }
    } catch (ex) {}

    return true;
  },


  /**
   * set non-standard message Header
   * (depending on TB version)
   *
   * hdr: String: header type (e.g. X-Enigmail-Version)
   * val: String: header data (e.g. 1.2.3.4)
   */
  setAdditionalHeader: function (hdr, val) {
    if ("otherRandomHeaders" in gMsgCompose.compFields) {
      // TB <= 36
      gMsgCompose.compFields.otherRandomHeaders += hdr +": " + val + "\r\n";
    }
    else {
      gMsgCompose.compFields.setHeader(hdr, val);
    }
  },

  modifyCompFields: function ()
  {

    const HEADERMODE_KEYID = 0x01;
    const HEADERMODE_URL   = 0x10;

    try {

      if (! this.identity) {
        this.identity = getCurrentIdentity();
      }

      if (this.identity.getBoolAttribute("enablePgp")) {
        if (Prefs.getPref("addHeaders")) {
          this.setAdditionalHeader("X-Enigmail-Version: ", App.getVersion());
        }
        var pgpHeader="";
        var openPgpHeaderMode = this.identity.getIntAttribute("openPgpHeaderMode");

        if (openPgpHeaderMode & HEADERMODE_KEYID) {

          var fpr = KeyRing.getFingerprintForKey(this.identity.getCharAttribute("pgpkeyId"));
          if (fpr && fpr.length > 0) {
            pgpHeader += "id=" + fpr;
          }
        }
        if (openPgpHeaderMode & HEADERMODE_URL) {
          if (pgpHeader.indexOf("=") > 0) pgpHeader += ";\r\n\t";
          pgpHeader += "url="+this.identity.getCharAttribute("openPgpUrlName");
        }
        if (pgpHeader.length > 0) {
          this.setAdditionalHeader("OpenPGP", pgpHeader);
        }
      }
    }
    catch (ex) {
      Log.writeException("enigmailMsgComposeOverlay.js: Enigmail.msg.modifyCompFields", ex);
    }
  },

  sendMessageListener: function (event)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.sendMessageListener\n");
    let msgcomposeWindow = document.getElementById("msgcomposeWindow");
    let sendMsgType = Number(msgcomposeWindow.getAttribute("msgtype"));

    if (! (this.sendProcess && sendMsgType == Components.interfaces.nsIMsgCompDeliverMode.AutoSaveAsDraft)) {
      this.sendProcess = true;

      try {
        this.modifyCompFields();
        if (! this.encryptMsg(sendMsgType)) {
          this.removeAttachedKey();
          event.preventDefault();
          event.stopPropagation();
        }
      }
      catch (ex) {}
    }
    else {
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.sendMessageListener: sending in progress - autosave aborted\n");
      event.preventDefault();
      event.stopPropagation();
    }
    this.sendProcess = false;
  },

  // Replacement for wrong charset conversion detection of Thunderbird

  checkCharsetConversion: function (msgCompFields)
  {

    const dce = Components.interfaces.nsIDocumentEncoder;
    try {
      var encoderFlags = dce.OutputFormatted | dce.OutputLFLineBreak;
      var docText = this.editorGetContentAs("text/plain", encoderFlags);

      if (docText.length > 0) {
        var converter = Components.classes["@mozilla.org/intl/saveascharset;1"].
          createInstance(Components.interfaces.nsISaveAsCharset);

        converter.Init(msgCompFields.characterSet, 0, 1);

        return (converter.Convert(docText).length >= docText.length);
      }
    }
    catch (ex) {}

    return true;
  },



  // encrypt attachments when sending inline PGP mails
  // It's quite a hack: the attachments are stored locally
  // and the attachments list is modified to pick up the
  // encrypted file(s) instead of the original ones.
  encryptAttachments: function (bucketList, newAttachments, window, uiFlags,
                                  fromAddr, toAddr, bccAddr, sendFlags,
                                  errorMsgObj)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptAttachments\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;
    const SIGN    = nsIEnigmail.SEND_SIGNED;
    const ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;

    var ioServ;
    var fileTemplate;
    errorMsgObj.value="";

    try {
      ioServ = Components.classes[IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
      if (!ioServ)
          return -1;

    } catch (ex) {
      return -1;
    }

    var tmpDir=Files.getTempDir();
    var extAppLauncher = Components.classes["@mozilla.org/mime;1"].
      getService(Components.interfaces.nsPIExternalAppLauncher);

    try {
      fileTemplate = Components.classes[LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
      fileTemplate.initWithPath(tmpDir);
      if (!(fileTemplate.isDirectory() && fileTemplate.isWritable())) {
        errorMsgObj.value=Locale.getString("noTempDir");
        return -1;
      }
      fileTemplate.append("encfile");
    }
    catch (ex) {
      errorMsgObj.value=Locale.getString("noTempDir");
      return -1;
    }
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.encryptAttachments tmpDir=" + tmpDir+"\n");
    var enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc)
      return null;

    var exitCodeObj = {};
    var statusFlagsObj = {};

    var node = bucketList.firstChild;
    while (node) {
      var origUrl = node.attachment.url;
      if (origUrl.substring(0,7) != "file://") {
        // this should actually never happen since it is pre-checked!
        errorMsgObj.value="The attachment '"+node.attachment.name+"' is not a local file";
        return -1;
      }

      // transform attachment URL to platform-specific file name
      var origUri = ioServ.newURI(origUrl, null, null);
      var origFile=origUri.QueryInterface(Components.interfaces.nsIFileURL);
      if (node.attachment.temporary) {
        try {
          var origLocalFile=Components.classes[LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
          origLocalFile.initWithPath(origFile.file.path);
          extAppLauncher.deleteTemporaryFileOnExit(origLocalFile);
        }
        catch (ex) {}
      }

      var newFile = fileTemplate.clone();
      var txtMessage;
      try {
        newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
        txtMessage = enigmailSvc.encryptAttachment(window, fromAddr, toAddr, bccAddr, sendFlags,
                                  origFile.file, newFile,
                                  exitCodeObj, statusFlagsObj,
                                  errorMsgObj);
      } catch (ex) {}

      if (exitCodeObj.value !== 0) {
        return exitCodeObj.value;
      }

      var fileInfo = {
        origFile  : origFile,
        origUrl   : node.attachment.url,
        origName  : node.attachment.name,
        origTemp  : node.attachment.temporary,
        origCType : node.attachment.contentType
      };

      // transform platform specific new file name to file:// URL
      var newUri = ioServ.newFileURI(newFile);
      fileInfo.newUrl  = newUri.asciiSpec;
      fileInfo.newFile = newFile;
      fileInfo.encrypted = (sendFlags & ENCRYPT);

      newAttachments.push(fileInfo);
      node = node.nextSibling;
    }

    var i=0;
    if (sendFlags & ENCRYPT) {
      // if we got here, all attachments were encrpted successfully,
      // so we replace their names & urls
      node = bucketList.firstChild;

      while (node) {
        node.attachment.url = newAttachments[i].newUrl;
        node.attachment.name += Prefs.getPref("inlineAttachExt");
        node.attachment.contentType="application/octet-stream";
        node.attachment.temporary=true;

        ++i; node = node.nextSibling;
      }
    }
    else {
      // for inline signing we need to add new attachments for every
      // signed file
      for (i=0; i<newAttachments.length; i++) {
        // create new attachment
        var fileAttachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
        fileAttachment.temporary = true;
        fileAttachment.url = newAttachments[i].newUrl;
        fileAttachment.name = newAttachments[i].origName + Prefs.getPref("inlineSigAttachExt");

        // add attachment to msg
        this.addAttachment(fileAttachment);
      }

    }
    return 0;
  },

  toggleAttribute: function (attrName)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleAttribute('"+attrName+"')\n");

    var menuElement = document.getElementById("enigmail_"+attrName);

    var oldValue = Prefs.getPref(attrName);
    Prefs.setPref(attrName, !oldValue);
  },

  toggleAccountAttr: function (attrName)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleAccountAttr('"+attrName+"')\n");

    var oldValue = this.identity.getBoolAttribute(attrName);
    this.identity.setBoolAttribute(attrName, !oldValue);

  },

  toggleRules: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.toggleRules: Enigmail.msg.enableRules="+Enigmail.msg.enableRules+"\n");
    this.enableRules = !this.enableRules;
  },

  decryptQuote: function (interactive)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: "+interactive+"\n");
    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    if (gWindowLocked || this.processed)
      return;

    var enigmailSvc = EnigmailCore.getService(window);
    if (!enigmailSvc)
      return;

    const dce = Components.interfaces.nsIDocumentEncoder;
    var encoderFlags = dce.OutputFormatted | dce.OutputLFLineBreak;

    var docText = this.editorGetContentAs("text/plain", encoderFlags);

    var blockBegin = docText.indexOf("-----BEGIN PGP ");
    if (blockBegin < 0)
      return;

    // Determine indentation string
    var indentBegin = docText.substr(0, blockBegin).lastIndexOf("\n");
    var indentStr = docText.substring(indentBegin+1, blockBegin);

    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: indentStr='"+indentStr+"'\n");

    var beginIndexObj = {};
    var endIndexObj = {};
    var indentStrObj = {};
    var blockType = Armor.locateArmoredBlock(docText, 0, indentStr, beginIndexObj, endIndexObj, indentStrObj);
    if ((blockType != "MESSAGE") && (blockType != "SIGNED MESSAGE"))
      return;

    var beginIndex = beginIndexObj.value;
    var endIndex   = endIndexObj.value;

    var head = docText.substr(0, beginIndex);
    var tail = docText.substr(endIndex+1);

    var pgpBlock = docText.substr(beginIndex, endIndex-beginIndex+1);
    var indentRegexp;

    if (indentStr) {
      // MULTILINE MATCHING ON
      RegExp.multiline = true;

      if (indentStr == "> ") {
        // replace ">> " with "> > " to allow correct quoting
        pgpBlock = pgpBlock.replace(/^>>/g, "> >");
      }

      // Delete indentation
      indentRegexp = new RegExp("^"+indentStr, "g");

      pgpBlock = pgpBlock.replace(indentRegexp, "");
      //tail     =     tail.replace(indentRegexp, "");

      if (indentStr.match(/[ \t]*$/)) {
        indentStr = indentStr.replace(/[ \t]*$/g, "");
        indentRegexp = new RegExp("^"+indentStr+"$", "g");

        pgpBlock = pgpBlock.replace(indentRegexp, "");
      }


      // Handle blank indented lines
      pgpBlock = pgpBlock.replace(/^[ \t]*>[ \t]*$/g, "");
      //tail     =     tail.replace(/^[ \t]*>[ \t]*$/g, "");

      // Trim leading space in tail
      tail = tail.replace(/^\s*\n/, "\n");

      // MULTILINE MATCHING OFF
      RegExp.multiline = false;
    }

    if (tail.search(/\S/) < 0) {
      // No non-space characters in tail; delete it
      tail = "";
    }

    //Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: pgpBlock='"+pgpBlock+"'\n");

    var charset = this.editorGetCharset();
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: charset="+charset+"\n");

    // Encode ciphertext from unicode to charset
    var cipherText = Data.convertFromUnicode(pgpBlock, charset);

    if ((! this.getMailPref("mailnews.reply_in_default_charset")) && (blockType == "MESSAGE")) {
      // set charset according to PGP block, if available (encrypted messages only)
      cipherText = cipherText.replace(/\r\n/g, "\n");
      cipherText = cipherText.replace(/\r/g,   "\n");
      let cPos = cipherText.search(/\nCharset: .+\n/i);
      if (cPos < cipherText.search(/\n\n/)) {
        var charMatch = cipherText.match(/\n(Charset: )(.+)\n/i);
        if (charMatch && charMatch.length > 2) {
          charset = charMatch[2];
          gMsgCompose.SetDocumentCharset(charset);
        }
      }
    }

    // Decrypt message
    var signatureObj   = {};
    signatureObj.value = "";
    var exitCodeObj    = {};
    var statusFlagsObj = {};
    var userIdObj      = {};
    var keyIdObj       = {};
    var sigDetailsObj  = {};
    var errorMsgObj    = {};
    var blockSeparationObj  = {};
    var encToDetailsObj     = {};

    var uiFlags = nsIEnigmail.UI_UNVERIFIED_ENC_OK;

    var plainText = enigmailSvc.decryptMessage(window, uiFlags, cipherText,
                                               signatureObj, exitCodeObj, statusFlagsObj,
                                               keyIdObj, userIdObj, sigDetailsObj,
                                               errorMsgObj, blockSeparationObj, encToDetailsObj);

    // Decode plaintext from charset to unicode
    plainText = Data.convertToUnicode(plainText, charset);
    if (Prefs.getPref("keepSettingsForReply")) {
      if (statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY)
        this.setSendMode('encrypt');
    }

    var exitCode = exitCodeObj.value;

    if (exitCode !== 0) {
      // Error processing
      var errorMsg = errorMsgObj.value;

      var statusLines = errorMsg.split(/\r?\n/);

      var displayMsg;
      if (statusLines && statusLines.length) {
        // Display only first ten lines of error message
        while (statusLines.length > 10)
          statusLines.pop();

        displayMsg = statusLines.join("\n");

        if (interactive)
          Dialog.alert(window, displayMsg);
      }
    }

    if (blockType == "MESSAGE" && exitCode === 0 && plainText.length === 0) {
      plainText = " ";
    }

    if (!plainText) {
      if (blockType != "SIGNED MESSAGE")
        return;

      // Extract text portion of clearsign block
      plainText = Armor.extractSignaturePart(pgpBlock, nsIEnigmail.SIGNATURE_TEXT);
    }

    var doubleDashSeparator = Prefs.getPref("doubleDashSeparator");
    if (gMsgCompose.type != nsIMsgCompType.Template &&
        gMsgCompose.type != nsIMsgCompType.Draft &&
        doubleDashSeparator) {
      var signOffset = plainText.search(/[\r\n]-- +[\r\n]/);

      if (signOffset < 0 && blockType == "SIGNED MESSAGE") {
        signOffset = plainText.search(/[\r\n]--[\r\n]/);
      }

      if (signOffset > 0) {
        // Strip signature portion of quoted message
        plainText = plainText.substr(0, signOffset+1);
      }
    }

    var clipBoard = Components.classes["@mozilla.org/widget/clipboard;1"].
                      getService(Components.interfaces.nsIClipboard);
    var data;
    if (clipBoard.supportsSelectionClipboard()) {
      // get the clipboard contents for selected text (X11)
      try {
        var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
                  createInstance(Components.interfaces.nsITransferable);
        transferable.addDataFlavor("text/unicode");
        clipBoard.getData(transferable, clipBoard.kSelectionClipboard);
        var flavour = {};
        data = {};
        var length = {};
        transferable.getAnyTransferData(flavour, data, length);
      }
      catch(ex) {}
    }

    // Replace encrypted quote with decrypted quote (destroys selection clipboard on X11)
    this.editorSelectAll();

    //Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: plainText='"+plainText+"'\n");

    if (head)
      this.editorInsertText(head);

    var quoteElement;

    if (indentStr) {
      quoteElement = this.editorInsertAsQuotation(plainText);

    } else {
      this.editorInsertText(plainText);
    }

    if (tail)
      this.editorInsertText(tail);

    if (clipBoard.supportsSelectionClipboard()) {
      try {
        // restore the clipboard contents for selected text (X11)
        var pasteClipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"].
                getService(Components.interfaces.nsIClipboardHelper);
        data = data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
        pasteClipboard.copyStringToClipboard(data, clipBoard.kSelectionClipboard);
      }
      catch (ex) {}
    }

    if (interactive)
      return;

    // Position cursor
    var replyOnTop = 1;
    try {
      replyOnTop = this.identity.replyOnTop;
    } catch (ex) {}

    if (!indentStr || !quoteElement) replyOnTop = 1;

    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.decryptQuote: replyOnTop="+replyOnTop+", quoteElement="+quoteElement+"\n");

    var nsISelectionController = Components.interfaces.nsISelectionController;

    if (this.editor.selectionController) {
      var selection = this.editor.selectionController;
      selection.completeMove(false, false); // go to start;

      switch (replyOnTop) {
      case 0:
        // Position after quote
        this.editor.endOfDocument();
        if (tail) {
          for (let cPos = 0; cPos < tail.length; cPos++) {
            selection.characterMove(false, false); // move backwards
          }
        }
        break;

      case 2:
        // Select quote

        if (head) {
          for (let cPos = 0; cPos < head.length; cPos++) {
            selection.characterMove(true, false);
          }
        }
        selection.completeMove(true, true);
        if (tail) {
          for (let cPos = 0; cPos < tail.length; cPos++) {
            selection.characterMove(false, true); // move backwards
          }
        }
        break;

      default:
        // Position at beginning of document

        if (this.editor) {
          this.editor.beginningOfDocument();
        }
      }

      this.editor.selectionController.scrollSelectionIntoView(nsISelectionController.SELECTION_NORMAL,
                                     nsISelectionController.SELECTION_ANCHOR_REGION,
                                     true);
    }

    this.processFinalState();
    this.updateStatusBar();
  },

  editorInsertText: function (plainText)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertText\n");
    if (this.editor) {
      var mailEditor;
      try {
        mailEditor = this.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
        mailEditor.insertTextWithQuotations(plainText);
      } catch (ex) {
        Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertText: no mail editor\n");
        this.editor.insertText(plainText);
      }
    }
  },

  editorInsertAsQuotation: function (plainText)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertAsQuotation\n");
    if (this.editor) {
      var mailEditor;
      try {
        mailEditor = this.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
      } catch (ex) {}

      if (!mailEditor)
        return 0;

      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorInsertAsQuotation: mailEditor="+mailEditor+"\n");

      mailEditor.insertAsQuotation(plainText);

      return 1;
    }
    return 0;
  },


  editorSelectAll: function ()
  {
    if (this.editor) {
      this.editor.selectAll();
    }
  },

  editorGetCharset: function ()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorGetCharset\n");
    return this.editor.documentCharacterSet;
  },

  editorGetContentAs: function (mimeType, flags) {
    Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.editorGetContentAs\n");
    if (this.editor) {
      return this.editor.outputToString(mimeType, flags);
    }
  },

  addrOnChangeTimer: null,

  addressOnChange: function(element)
  {
     Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.addressOnChange\n");
     if (! this.addrOnChangeTimer) {
        var self = this;
        this.addrOnChangeTimer = Timer.setTimeout(function _f() {
           self.fireSendFlags();
           self.addrOnChangeTimer = null;
        }, 200);
     }
  },

  focusChange: function ()
  {
    // call original TB function
    CommandUpdate_MsgCompose();

    var focusedWindow = top.document.commandDispatcher.focusedWindow;

    // we're just setting focus to where it was before
    if (focusedWindow == Enigmail.msg.lastFocusedWindow) {
      // skip
      return;
    }

    Enigmail.msg.lastFocusedWindow = focusedWindow;

    Enigmail.msg.fireSendFlags();
  },

  fireSendFlags: function ()
  {
    try {
      Log.DEBUG("enigmailMsgComposeOverlay.js: Enigmail.msg.fireSendFlags\n");
      if (! this.determineSendFlagId) {
        this.determineSendFlagId = Events.dispatchEvent(
          function _sendFlagWrapper() {
            Enigmail.msg.determineSendFlags();
          },
          0);
      }
    }
    catch (ex) {}
  }
};


Enigmail.composeStateListener = {
  NotifyComposeFieldsReady: function() {
    // Note: NotifyComposeFieldsReady is only called when a new window is created (i.e. not in case a window object is reused).
    Log.DEBUG("enigmailMsgComposeOverlay.js: ECSL.NotifyComposeFieldsReady\n");

    try {
      Enigmail.msg.editor = gMsgCompose.editor.QueryInterface(Components.interfaces.nsIEditor);
    } catch (ex) {}

    if (!Enigmail.msg.editor)
      return;

    function enigDocStateListener () {}

    enigDocStateListener.prototype = {
      QueryInterface: function (iid)
      {
        if (!iid.equals(Components.interfaces.nsIDocumentStateListener) &&
            !iid.equals(Components.interfaces.nsISupports))
           throw Components.results.NS_ERROR_NO_INTERFACE;

        return this;
      },

      NotifyDocumentCreated: function ()
      {
        Log.DEBUG("enigmailMsgComposeOverlay.js: EDSL.NotifyDocumentCreated\n");
      },

      NotifyDocumentWillBeDestroyed: function ()
      {
        Log.DEBUG("enigmailMsgComposeOverlay.js: EDSL.enigDocStateListener.NotifyDocumentWillBeDestroyed\n");
      },

      NotifyDocumentStateChanged: function (nowDirty)
      {
        Log.DEBUG("enigmailMsgComposeOverlay.js: EDSL.enigDocStateListener.NotifyDocumentStateChanged\n");
      }
    };

    var docStateListener = new enigDocStateListener();

    Enigmail.msg.editor.addDocumentStateListener(docStateListener);
  },

  ComposeProcessDone: function(aResult)
  {
    // Note: called after a mail was sent (or saved)
    Log.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeProcessDone: "+aResult+"\n");

    if (aResult != Components.results.NS_OK) {
      if (Enigmail.msg.processed) {
        Enigmail.msg.undoEncryption(4);
      }
      Enigmail.msg.removeAttachedKey();
    }

  },

  NotifyComposeBodyReady: function()
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: ECSL.ComposeBodyReady\n");

    var isEmpty, isEditable;

    isEmpty    = Enigmail.msg.editor.documentIsEmpty;
    isEditable = Enigmail.msg.editor.isDocumentEditable;

    Log.DEBUG("enigmailMsgComposeOverlay.js: EDSL.ComposeBodyReady: isEmpty="+isEmpty+", isEditable="+isEditable+"\n");

    //FIXME
    Log.DEBUG("enigmailMsgComposeOverlay.js: EDSL.ComposeBodyReady: disableSmime="+Enigmail.msg.disableSmime+"\n");

    if (Enigmail.msg.disableSmime) {
      if (gMsgCompose && gMsgCompose.compFields && gMsgCompose.compFields.securityInfo) {
        gMsgCompose.compFields.securityInfo.signMessage = false;
        gMsgCompose.compFields.securityInfo.requireEncryptMessage = false;
      }
      else {
        Log.DEBUG("enigmailMsgComposeOverlay.js: EDSL.ComposeBodyReady: could not disable S/MIME\n");
      }
    }

    if (!isEditable || isEmpty)
      return;

    if (!Enigmail.msg.timeoutId && !Enigmail.msg.dirty) {
      Enigmail.msg.timeoutId = Timer.setTimeout(function () {
          Enigmail.msg.decryptQuote(false);

        },
        0);
    }

  },

  SaveInFolderDone: function(folderURI)
  {
    //Log.DEBUG("enigmailMsgComposeOverlay.js: ECSL.SaveInFolderDone\n");
  }
};


window.addEventListener("load",
  function _enigmail_composeStartup (event)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: got load event\n");

    Enigmail.msg.composeStartup(event);
  },
  false);

window.addEventListener("unload",
  function _enigmail_composeUnload (event)
  {
    Enigmail.msg.composeUnload(event);
  },
  false);

// Handle recycled windows
window.addEventListener('compose-window-close',
  function _enigmail_msgComposeClose (event)
  {
    Enigmail.msg.msgComposeClose(event);
  },
  true);

window.addEventListener('compose-window-reopen',
  function _enigmail_msgComposeReopen (event)
  {
    Enigmail.msg.msgComposeReopen(event);
  },
  true);

// Listen to message sending event
window.addEventListener('compose-send-message',
  function _enigmail_sendMessageListener (event)
  {
    Enigmail.msg.sendMessageListener(event);
  },
  true);

window.addEventListener('compose-window-init',
  function _enigmail_composeWindowInit (event)
  {
    Log.DEBUG("enigmailMsgComposeOverlay.js: _enigmail_composeWindowInit\n");
    gMsgCompose.RegisterStateListener(Enigmail.composeStateListener);
  },
  true);
