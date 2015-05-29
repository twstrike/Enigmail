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


/*
 * Import into a JS component using
 * 'Components.utils.import("resource://enigmail/enigmailCommon.jsm");'
 */


Components.utils.import("resource://enigmail/pipeConsole.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");
Components.utils.import("resource://enigmail/pipeConsole.jsm");
Components.utils.import("resource://enigmail/enigmailErrorHandling.jsm");
Components.utils.import("resource://enigmail/encryption.jsm");
Components.utils.import("resource://enigmail/decryption.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";
const DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";
const LOCALE_SVC_CONTRACTID = "@mozilla.org/intl/nslocaleservice;1";
const SCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";
const NS_PREFS_SERVICE_CID = "@mozilla.org/preferences-service;1";
const NS_STRING_INPUT_STREAM_CONTRACTID = "@mozilla.org/io/string-input-stream;1";
const NS_INPUT_STREAM_CHNL_CONTRACTID = "@mozilla.org/network/input-stream-channel;1";
const NS_PROMPTSERVICE_CONTRACTID = "@mozilla.org/embedcomp/prompt-service;1";
const NS_TIMER_CONTRACTID       = "@mozilla.org/timer;1";


const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const SEAMONKEY_ID   = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";


const hexTable = "0123456789abcdef";

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const GPG_BATCH_OPT_LIST = [ "--batch", "--no-tty", "--status-fd", "2" ];

const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

var gPromptSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
var gDispatchThread = null;


var gEnigExtensionVersion;
var gEnigInstallLocation;
var gCachedPassphrase = null;

var gEncryptedUris = [];

var gKeyAlgorithms = [];



var gStatusFlags = {
  GOODSIG:         nsIEnigmail.GOOD_SIGNATURE,
  BADSIG:          nsIEnigmail.BAD_SIGNATURE,
  ERRSIG:          nsIEnigmail.UNVERIFIED_SIGNATURE,
  EXPSIG:          nsIEnigmail.EXPIRED_SIGNATURE,
  REVKEYSIG:       nsIEnigmail.GOOD_SIGNATURE,
  EXPKEYSIG:       nsIEnigmail.EXPIRED_KEY_SIGNATURE,
  KEYEXPIRED:      nsIEnigmail.EXPIRED_KEY,
  KEYREVOKED:      nsIEnigmail.REVOKED_KEY,
  NO_PUBKEY:       nsIEnigmail.NO_PUBKEY,
  NO_SECKEY:       nsIEnigmail.NO_SECKEY,
  IMPORTED:        nsIEnigmail.IMPORTED_KEY,
  INV_RECP:        nsIEnigmail.INVALID_RECIPIENT,
  MISSING_PASSPHRASE: nsIEnigmail.MISSING_PASSPHRASE,
  BAD_PASSPHRASE:  nsIEnigmail.BAD_PASSPHRASE,
  BADARMOR:        nsIEnigmail.BAD_ARMOR,
  NODATA:          nsIEnigmail.NODATA,
  ERROR:           nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.DECRYPTION_FAILED,
  DECRYPTION_FAILED: nsIEnigmail.DECRYPTION_FAILED,
  DECRYPTION_OKAY: nsIEnigmail.DECRYPTION_OKAY,
  TRUST_UNDEFINED: nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_NEVER:     nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_MARGINAL:  nsIEnigmail.UNTRUSTED_IDENTITY,
  TRUST_FULLY:     nsIEnigmail.TRUSTED_IDENTITY,
  TRUST_ULTIMATE:  nsIEnigmail.TRUSTED_IDENTITY,
  CARDCTRL:        nsIEnigmail.CARDCTRL,
  SC_OP_FAILURE:   nsIEnigmail.SC_OP_FAILURE,
  UNKNOWN_ALGO:    nsIEnigmail.UNKNOWN_ALGO,
  SIG_CREATED:     nsIEnigmail.SIG_CREATED,
  END_ENCRYPTION : nsIEnigmail.END_ENCRYPTION,
  INV_SGNR:        0x100000000,
  IMPORT_OK:       0x200000000
};

const gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5" ];


// various global variables
var gKeygenProcess = null;

var EnigmailCommon = {

  // "constants"
  POSSIBLE_PGPMIME: -2081,
  PGP_DESKTOP_ATT : -2082,

  MSG_BUFFER_SIZE:  96000,
  MSG_HEADER_SIZE:  16000,

  APPSHELL_MEDIATOR_CONTRACTID: "@mozilla.org/appshell/window-mediator;1",
  APPSHSVC_CONTRACTID: "@mozilla.org/appshell/appShellService;1",
  ENIGMAIL_CONTRACTID: "@mozdev.org/enigmail/enigmail;1",
  IOSERVICE_CONTRACTID: "@mozilla.org/network/io-service;1",
  LOCAL_FILE_CONTRACTID: "@mozilla.org/file/local;1",
  MIME_CONTRACTID: "@mozilla.org/mime;1",
  SIMPLEURI_CONTRACTID: "@mozilla.org/network/simple-uri;1",

  // possible values for
  // - encryptByRule, signByRules, pgpmimeByRules
  // - encryptForced, signForced, pgpmimeForced (except CONFLICT)
  // NOTE:
  // - values 0/1/2 are used with this fixed semantics in the persistent rules
  // - see also enigmailEncryptionDlg.xul
  ENIG_NEVER:        0,
  ENIG_UNDEF:        1,
  ENIG_ALWAYS:       2,
  ENIG_AUTO_ALWAYS: 22,
  ENIG_CONFLICT:    99,

  ENIG_FINAL_UNDEF:    -1,
  ENIG_FINAL_NO:        0,
  ENIG_FINAL_YES:       1,
  ENIG_FINAL_FORCENO:  10,
  ENIG_FINAL_FORCEYES: 11,
  ENIG_FINAL_SMIME_DISABLED: 98,  // disabled to to preferring S/MIME
  ENIG_FINAL_CONFLICT: 99,

  // variables
  enigmailSvc: null,
  statusFlags: gStatusFlags,
  envList: null, // currently filled from enigmail.js
  gpgAgentIsOptional: true,

  // methods

    isGeneratingKey: function() {
        return gKeygenProcess !== null;
    },

  /**
   * get and or initialize the Enigmail service,
   * including the handling for upgrading old preferences to new versions
   *
   * @win:                - nsIWindow: parent window (optional)
   * @startingPreferences - Boolean: true - called while switching to new preferences
   *                        (to avoid re-check for preferences)
   */
  getService: function (win, startingPreferences) {
    // Lazy initialization of Enigmail JS component (for efficiency)

    if (this.enigmailSvc) {
      return this.enigmailSvc.initialized ? this.enigmailSvc : null;
    }

    try {
      this.enigmailSvc = Cc[this.ENIGMAIL_CONTRACTID].createInstance(Ci.nsIEnigmail);
    }
    catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: Error in instantiating EnigmailService: "+ex+"\n");
      return null;
    }

    if (! win) {
      win = this.getBestParentWin();
    }

    this.DEBUG_LOG("enigmailCommon.jsm: this.enigmailSvc = "+this.enigmailSvc+"\n");

    if (!this.enigmailSvc.initialized) {
      // Initialize enigmail

      var firstInitialization = !this.enigmailSvc.initializationAttempted;

      try {
        // Initialize enigmail
        EnigmailCore.init(this.getVersion());
        this.enigmailSvc.initialize(win, this.getVersion(), EnigmailCore.prefBranch);

        try {
          // Reset alert count to default value
          EnigmailCore.prefBranch.clearUserPref("initAlert");
        }
        catch(ex) { }

      }
      catch (ex) {

        if (firstInitialization) {
          // Display initialization error alert
          var errMsg = this.enigmailSvc.initializationError ? this.enigmailSvc.initializationError : this.getString("accessError");

          errMsg += "\n\n"+this.getString("initErr.howToFixIt");

          var checkedObj = {value: false};
          if (this.getPref("initAlert")) {
            var r = this.longAlert(win, "Enigmail: "+errMsg,
                                   this.getString("dlgNoPrompt"),
                                   null, this.getString("initErr.setupWizard.button"),
                                   null, checkedObj);
            if (r >= 0 && checkedObj.value) {
              this.setPref("initAlert", false);
            }
            if (r == 1) {
              // start setup wizard
              launchSetupWizard(win);
              return this.getService(win);
            }
          }
          if (this.getPref("initAlert")) {
            this.enigmailSvc.initializationAttempted = false;
            this.enigmailSvc = null;
          }
        }

        return null;
      }

      var configuredVersion = this.getPref("configuredVersion");

      this.DEBUG_LOG("enigmailCommon.jsm: getService: "+configuredVersion+"\n");

      if (firstInitialization && this.enigmailSvc.initialized &&
          this.enigmailSvc.agentType && this.enigmailSvc.agentType == "pgp") {
        this.alert(win, this.getString("pgpNotSupported"));
      }

      if (this.enigmailSvc.initialized && (this.getVersion() != configuredVersion)) {
        ConfigureEnigmail(win, startingPreferences);
      }
    }

    return this.enigmailSvc.initialized ? this.enigmailSvc : null;
  },

  getAppName: EnigmailCore.getAppName.bind(EnigmailCore),

  /**
   * get the Enigmail version
   *
   * @return: String - Enigmail version
   */
  getVersion: function()
  {
    this.DEBUG_LOG("enigmailCommon.jsm: getVersion\n");

    var addonVersion = gEnigExtensionVersion;

    this.DEBUG_LOG("enigmailCommon.jsm: installed version: "+addonVersion+"\n");
    return addonVersion;
  },

  /**
   * return a pre-initialized prompt service
   */
  getPromptSvc: function() {
    return gPromptSvc;
  },

  /**
   * obtain a list of all environment variables
   *
   * @return: Array of Strings with the following structrue
   *          variable_name=variable_content
   */
  getEnvList: function() {
    return this.envList;
  },

  /**
   * Save the Mozilla preferences file (prefs.js)
   *
   * no return value
   */
  savePrefs: function ()
  {
    this.DEBUG_LOG("enigmailCommon.js: savePrefs\n");
    try {
      EnigmailCore.prefService.savePrefFile(null);
    }
    catch (ex) {
    }
  },

  initPrefService: EnigmailCore.initPrefService.bind(EnigmailCore),

  getPref: EnigmailCore.getPref.bind(EnigmailCore),

  setPref: EnigmailCore.setPref.bind(EnigmailCore),

  /**
   * Displays an alert dialog.
   *
   * @win:         nsIWindow - parent window to display modal dialog; can be null
   * @mesg:        String    - message text
   *
   * no return value
   */
  alert: function (win, mesg)
  {
    if (mesg.length > 1000) {
      this.longAlert(win, mesg, null, this.getString("dlg.button.close"));
    }
    else {
      try {
        gPromptSvc.alert(win, this.getString("enigAlert"), mesg);
      }
      catch(ex) {
        this.writeException("alert" , ex);
      }
    }
  },

  /**
   * Displays an alert dialog with 1-3 optional buttons.
   *
   * @win:           nsIWindow - parent window to display modal dialog; can be null
   * @mesg:          String    - message text
   * @checkBoxLabel: String    - if not null, display checkbox with text; the
   *                             checkbox state is returned in checkedObj.value
   * @button-Labels: String    - use "&" to indicate access key
   *     use "buttonType:label" or ":buttonType" to indicate special button types
   *        (buttonType is one of cancel, help, extra1, extra2)
   * @checkedObj:    Object    - holding the checkbox value
   *
   * @return: 0-2: button Number pressed
   *          -1: ESC or close window button pressed
   *
   */
  longAlert: function (win, mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj)
  {
    var result = {
      value: -1,
      checked: false
    };

    if (! win) {
      win = this.getBestParentWin();
    }

    win.openDialog("chrome://enigmail/content/enigmailAlertDlg.xul", "",
              "chrome,dialog,modal,centerscreen",
              {
                msgtext: mesg,
                checkboxLabel: checkBoxLabel,
                button1: okLabel,
                button2: labelButton2,
                button3: labelButton3
              },
              result);

    if (checkBoxLabel) {
      checkedObj.value=result.checked;
    }
    return result.value;
  },

  /***
   * Confirmation dialog with OK / Cancel buttons (both customizable)
   *
   * @win:         nsIWindow - parent window to display modal dialog; can be null
   * @mesg:        String    - message text
   * @okLabel:     String    - OPTIONAL label for OK button
   * @cancelLabel: String    - OPTIONAL label for cancel button
   *
   * @return:      Boolean   - true: OK pressed / false: Cancel or ESC pressed
   */
  confirmDlg: function (win, mesg, okLabel, cancelLabel)
  {
    var dummy=new Object();

    var buttonTitles = 0;
    if (okLabel == null && cancelLabel == null) {
      buttonTitles = (gPromptSvc.BUTTON_TITLE_YES * BUTTON_POS_0) +
                     (gPromptSvc.BUTTON_TITLE_NO * BUTTON_POS_1);
    }
    else {
      if (okLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_0);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0;
      }

      if (cancelLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_1);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_CANCEL * BUTTON_POS_1;
      }
    }

    var buttonPressed = gPromptSvc.confirmEx(win,
                          this.getString("enigConfirm"),
                          mesg,
                          buttonTitles,
                          okLabel, cancelLabel, null,
                          null, dummy);

    return (buttonPressed == 0);
  },


  /**
   * Display a confirmation dialog with OK / Cancel buttons (both customizable) and
   * a checkbox to remember the selected choice.
   *
   *
   * @win:         nsIWindow - parent window to display modal dialog; can be null
   * @mesg:        String    - message text
   * @prefText     String    - the name of the Enigmail preference to read/store the
   *                           the future display status.
   *                           the default action is chosen
   * @okLabel:     String    - OPTIONAL label for OK button
   * @cancelLabel: String    - OPTIONAL label for cancel button
   *
   * @return:      Boolean   - true: 1 pressed / 0: Cancel pressed / -1: ESC pressed
   *
   * If the dialog is not displayed:
   *  - if @prefText is type Boolean: return 1
   *  - if @prefText is type Number:  return the last choice of the user
   */

  confirmPref: function (win, mesg, prefText, okLabel, cancelLabel)
  {
    const notSet = 0;
    const yes = 1;
    const no = 2;
    const display = true;
    const dontDisplay = false;

    var buttonTitles = 0;
    if (okLabel == null && cancelLabel == null) {
      buttonTitles = (gPromptSvc.BUTTON_TITLE_YES * BUTTON_POS_0) +
                     (gPromptSvc.BUTTON_TITLE_NO * BUTTON_POS_1);
    }
    else {
      if (okLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_0);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0;
      }

      if (cancelLabel != null) {
        buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_1);
      }
      else {
        buttonTitles += gPromptSvc.BUTTON_TITLE_CANCEL * BUTTON_POS_1;
      }
    }

    var prefValue = this.getPref(prefText);

    if (typeof(prefValue) != "boolean") {
      // number: remember user's choice
      switch (prefValue) {
      case notSet:
        var checkBoxObj = { value: false} ;
        var buttonPressed = gPromptSvc.confirmEx(win,
                              this.getString("enigConfirm"),
                              mesg,
                              buttonTitles,
                              okLabel, cancelLabel, null,
                              this.getString("dlgKeepSetting"), checkBoxObj);
        if (checkBoxObj.value) {
          this.setPref(prefText, (buttonPressed==0 ? yes : no));
        }
        return (buttonPressed==0 ? 1 : 0);

      case yes:
        return 1;

      case no:
        return 0;

      default:
        return -1;
      }
    }
    else {
      // boolean: "do not show this dialog anymore" (and return default)
      switch (prefValue) {
      case display:
        var checkBoxObj = { value: false} ;
        var buttonPressed = gPromptSvc.confirmEx(win,
                              this.getString("enigConfirm"),
                              mesg,
                              buttonTitles,
                              okLabel, cancelLabel, null,
                              this.getString("dlgNoPrompt"), checkBoxObj);
        if (checkBoxObj.value) {
          this.setPref(prefText, false);
        }
        return (buttonPressed==0 ? 1 : 0);

      case dontDisplay:
        return 1;

      default:
        return -1;
      }

    }
  },

  /**
   * Display a dialog with a message and a text entry field
   *
   * @win:      nsIWindow - parent window to display modal dialog; can be null
   * @mesg:     String    - message text
   * @valueObj: Object    - object to hold the entered text in .value
   *
   * @return:   Boolean - true if OK was pressed / false otherwise
   */

  promptValue: function (win, mesg, valueObj)
  {
    var checkObj = new Object();
    return gPromptSvc.prompt(win, this.getString("enigPrompt"),
                                 mesg, valueObj, "", checkObj);
  },

  /**
   * Display an alert message with an OK button and a checkbox to hide
   * the message in the future.
   * In case the checkbox was pressed in the past, the dialog is skipped
   *
   * @win:      nsIWindow - the parent window to hold the modal dialog
   * @mesg:     String    - the localized message to display
   * @prefText: String    - the name of the Enigmail preference to read/store the
   *                        the future display status
   */
  alertPref: function (win, mesg, prefText) {
    const display = true;
    const dontDisplay = false;

    var prefValue = this.getPref(prefText);
    if (prefValue == display) {
      var checkBoxObj = { value: false } ;
      var buttonPressed = gPromptSvc.confirmEx(win,
                            this.getString("enigAlert"),
                            mesg,
                            (gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0),
                            null, null, null,
                            this.getString("dlgNoPrompt"), checkBoxObj);
      if (checkBoxObj.value && buttonPressed==0) {
        this.setPref(prefText, dontDisplay);
      }
    }
  },

  /**
   * Display an alert dialog together with the message "this dialog will be
   * displayed |counter| more times".
   * If |counter| is 0, the dialog is not displayed.
   *
   * @win:           nsIWindow - the parent window to hold the modal dialog
   * @countPrefName: String    - the name of the Enigmail preference to read/store the
   *                             the |counter| value
   * @mesg:          String    - the localized message to display
   *
   */

  alertCount: function (win, countPrefName, mesg)
  {
    var alertCount = this.getPref(countPrefName);

    if (alertCount <= 0)
      return;

    alertCount--;
    this.setPref(countPrefName, alertCount);

    if (alertCount > 0) {
      mesg += this.getString("repeatPrefix", [ alertCount ]) + " ";
      mesg += (alertCount == 1) ? this.getString("repeatSuffixSingular") : this.getString("repeatSuffixPlural");
    } else {
      mesg += this.getString("noRepeat");
    }

    this.alert(win, mesg);
  },

  /**
   * Determine the best possible window to serve as parent window for dialogs.
   *
   * @return: nsIWindow object
   */
  getBestParentWin: function() {
    var windowManager = Cc[this.APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

    var bestFit = null;
    var winEnum=windowManager.getEnumerator(null);

    while (winEnum.hasMoreElements()) {
      var thisWin = winEnum.getNext();
      if (thisWin.location.href.search(/\/messenger.xul$/) > 0) {
        bestFit = thisWin
      };
      if (! bestFit && thisWin.location.href.search(/\/messengercompose.xul$/) > 0) {
        bestFit = thisWin
      };
    }

    if (! bestFit) {
      winEnum=windowManager.getEnumerator(null);
      bestFit = winEnum.getNext();
    }

    return bestFit;
  },

  /**
   * Open a window, or focus it if it is already open
   *
   * @winName   : String - name of the window; used to identify if it is already open
   * @spec      : String - window URL (e.g. chrome://enigmail/content/test.xul)
   * @winOptions: String - window options as defined in nsIWindow.open
   * @optObj    : any    - an Object, Array, String, etc. that is passed as parameter
   *                       to the window
   */
  openWin: function (winName, spec, winOptions, optObj)
  {
    var windowManager = Cc[this.APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);

    var winEnum=windowManager.getEnumerator(null);
    var recentWin=null;
    while (winEnum.hasMoreElements() && ! recentWin) {
      var thisWin = winEnum.getNext();
      if (thisWin.location.href==spec) {
        recentWin = thisWin;
        break;
      }
      if (winName && thisWin.name && thisWin.name == winName) {
        thisWin.focus();
        break;
      }

    }

    if (recentWin) {
      recentWin.focus();
    } else {
      var appShellSvc = Cc[this.APPSHSVC_CONTRACTID].getService(Ci.nsIAppShellService);
      var domWin = appShellSvc.hiddenDOMWindow;
      try {
        domWin.open(spec, winName, "chrome,"+winOptions, optObj);
      }
      catch (ex) {
        domWin = windowManager.getMostRecentWindow(null);
        domWin.open(spec, winName, "chrome,"+winOptions, optObj);
      }
    }
  },

  /**
   * Iterate through the frames of a window and return the first frame with a
   * matching name.
   *
   * @win:       nsIWindow - XUL window to search
   * @frameName: String    - name of the frame to seach
   *
   * @return:    the frame object or null if not found
   */
  getFrame: function(win, frameName)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: getFrame: name="+frameName+"\n");
    for (var j=0; j<win.frames.length; j++) {
      if (win.frames[j].name == frameName) {
        return win.frames[j];
      }
    }
    return null;
  },


  /**
   * Convert GnuPG list output encoded in UTF-8 to Mozilla's representation in Unicode.
   *
   * @text:   String - UTF-8 encoded list text
   *
   * @return: String - Unicode string
   */
  convertGpgToUnicode: function (text)
  {
    if (typeof(text)=="string") {
      text = text.replace(/\\x3a/ig, "\\e3A");
      var a=text.search(/\\x[0-9a-fA-F]{2}/);
      while (a>=0) {
          var ch = unescape('%'+text.substr(a+2,2));
          var r = new RegExp("\\"+text.substr(a,4));
          text=text.replace(r, ch);

          a=text.search(/\\x[0-9a-fA-F]{2}/);
      }

      text = this.convertToUnicode(text, "utf-8").replace(/\\e3A/g, ":");
    }

    return text;
  },

  /**
   * Transform a Unix-Timestamp to a human-readable date/time string
   *
   * @dateNum:  Number  - Unix timestamp
   * @withDate: Boolean - if true, include the date in the output
   * @withTime: Boolean - if true, include the time in the output
   *
   * @return: String - formatted date/time string
   */
  getDateTime: function (dateNum, withDate, withTime)
  {
    if (dateNum && dateNum != 0) {
      var dat=new Date(dateNum * 1000);
      var appLocale = Cc[LOCALE_SVC_CONTRACTID].getService(Ci.nsILocaleService).getApplicationLocale();
      var dateTimeFormat = Cc[DATE_FORMAT_CONTRACTID].getService(Ci.nsIScriptableDateFormat);

      var dateFormat = (withDate ? dateTimeFormat.dateFormatShort : dateTimeFormat.dateFormatNone);
      var timeFormat = (withTime ? dateTimeFormat.timeFormatNoSeconds : dateTimeFormat.timeFormatNone);
      return dateTimeFormat.FormatDateTime(appLocale.getCategory("NSILOCALE_TIME"),
                dateFormat,
                timeFormat,
                dat.getFullYear(), dat.getMonth()+1, dat.getDate(),
                dat.getHours(), dat.getMinutes(), 0);
    }
    else {
      return "";
    }
  },

  /**
   *  Display a "open file" or "save file" dialog
   *
   *  win:              nsIWindow - parent window
   *  title:            String    - window title
   *  displayDir:       String    - optional: directory to be displayed
   *  save:             Boolean   - true = Save file / false = Open file
   *  defaultExtension: String    - optional: extension for the type of files to work with, e.g. "asc"
   *  defaultName:      String    - optional: filename, incl. extension, that should be suggested to
   *                                the user as default, e.g. "keys.asc"
   *  filterPairs:      Array     - optional: [title, extension], e.g. ["Pictures", "*.jpg; *.png"]
   *
   *  return value:     nsIFile object representing the file to load or save
   */
  filePicker: function (win, title, displayDir, save, defaultExtension, defaultName, filterPairs)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: filePicker: "+save+"\n");

    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance();
    filePicker = filePicker.QueryInterface(Ci.nsIFilePicker);

    var mode = save ? Ci.nsIFilePicker.modeSave : Ci.nsIFilePicker.modeOpen;

    filePicker.init(win, title, mode);

    if (displayDir) {
      var localFile = Cc[this.LOCAL_FILE_CONTRACTID].createInstance(this.getLocalFileApi());

      try {
        localFile.initWithPath(displayDir);
        filePicker.displayDirectory = localFile;
      } catch (ex) {
      }
    }

    if (defaultExtension)
      filePicker.defaultExtension = defaultExtension;

    if (defaultName)
      filePicker.defaultString=defaultName;

    var nfilters = 0;
    if (filterPairs && filterPairs.length)
      nfilters = filterPairs.length / 2;

    for (var index=0; index < nfilters; index++) {
      filePicker.appendFilter(filterPairs[2*index], filterPairs[2*index+1]);
    }

    filePicker.appendFilters(Ci.nsIFilePicker.filterAll);

    if (filePicker.show() == Ci.nsIFilePicker.returnCancel)
      return null;

    var file = filePicker.file.QueryInterface(this.getLocalFileApi());

    return file;
  },

  /**
   * Get the OS-dependent path as UTF-8 string for a given file object
   *
   * @nsFileObj: nsIFile
   *
   * @return: String - the path encoded with UTF-8
   */

  getFilePath: function (nsFileObj)
  {
    if (this.getOS() == "WINNT")
      return this.convertToUnicode(nsFileObj.persistentDescriptor, "utf-8");

    return this.convertFromUnicode(nsFileObj.path, "utf-8");
  },

  isDosLike: EnigmailCore.isDosLike.bind(EnigmailCore),

  /**
   * Get an escaped version of a file system path specification
   *
   * @fileNameStr: String - the file path
   *
   * @return: String - the escaped path
   */
  getEscapedFilename: function (fileNameStr) {
    if (this.isDosLike()) {
      // escape the backslashes and the " character (for Windows and OS/2)
      fileNameStr = fileNameStr.replace(/([\\\"])/g, "\\$1");
    }

    if (this.getOS() == "WINNT") {
      // replace leading "\\" with "//"
      fileNameStr = fileNameStr.replace(/^\\\\*/, "//");
    }
    return fileNameStr;
  },

  /**
   *  Get the temp directory as nsIFile Object
   *
   *  @return nsIFile object to the temporary directory
   */
  getTempDirObj: function ()
  {
    const TEMPDIR_PROP = "TmpD";
    var tmpDirObj;

    try {
      var ds = Cc[DIRSERVICE_CONTRACTID].getService();
      var dsprops = ds.QueryInterface(Ci.nsIProperties);
      var tmpDirObj = dsprops.get(TEMPDIR_PROP, this.getLocalFileApi());
    }
    catch (ex) {
      // let's guess ...
      tmpDirObj = Cc[this.LOCAL_FILE_CONTRACTID].createInstance(this.getLocalFileApi());
      if (this.getOS() == "WINNT") {
        tmpDirObj.initWithPath("C:/TEMP");
      } else {
        tmpDirObj.initWithPath("/tmp");
      }
    }
    return tmpDirObj;
  },

  /**
   *  Get the temp directory as string
   *  @return |String| containing the temporary directory name
   */

  getTempDir: function ()
  {
    let tmpDir = this.getTempDirObj();
    return tmpDir.path;
  },

  /**
   * create an nsIStreamListener object to read String data from an nsIInputStream
   *
   * @onStopCallback: Function - function(data) that is called when the stream has stopped
   *                             string data is passed as |data|
   *
   * @return: the nsIStreamListener to pass to the stream
   */
  newStringStreamListener: function (onStopCallback)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: newStreamListener\n");

    var simpleStreamListener = {
      data: "",
      inStream: Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream),
      _onStopCallback: onStopCallback,
      QueryInterface: XPCOMUtils.generateQI([ Ci.nsIStreamListener, Ci.nsIRequestObserver ]),

      onStartRequest: function (channel, ctxt)
      {
        // EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: stringListener.onStartRequest\n");
      },

      onStopRequest: function (channel, ctxt, status)
      {
        // EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: stringListener.onStopRequest: "+ctxt+"\n");
        this.inStream = null;
        var cbFunc = this._onStopCallback;
        var cbData = this.data;

        EnigmailCommon.setTimeout(function _cb() {
          cbFunc(cbData);
        });
      },

      onDataAvailable: function(req, sup, stream, offset, count)
      {
        // get data from stream
        // EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: stringListener.onDataAvailable: "+count+"\n");
        this.inStream.setInputStream(stream);
        this.data += this.inStream.readBytes(count);
      }
    };

    return simpleStreamListener;
  },

  /**
   * create a nsIRequestObserver object to observe an nsIRequest
   *
   * @terminateFunc: Function - function that is called asynchronously when the request
   *                            has stopped
   * @terminateArg:  Object   - arguments to pass to terminateFunc as array
   *
   * @return: the nsIRequestObserver
   */
  newRequestObserver: function (terminateFunc, terminateArg)
  {
    var requestObserver = function (terminateFunc, terminateArg)
    {
      this._terminateFunc = terminateFunc;
      this._terminateArg = terminateArg;
    };

    requestObserver.prototype = {

      _terminateFunc: null,
      _terminateArg: null,

      QueryInterface: function (iid) {
        if (!iid.equals(Ci.nsIRequestObserver) &&
            !iid.equals(Ci.nsISupports))
          throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
      },

      onStartRequest: function (channel, ctxt)
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: requestObserver.onStartRequest\n");
      },

      onStopRequest: function (channel, ctxt, status)
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: requestObserver.onStopRequest: "+ctxt+"\n");
        EnigmailCommon.dispatchEvent(this._terminateFunc, 0, [ this._terminateArg ]);
      }
    };

    return new requestObserver(terminateFunc, terminateArg);
  },

  /**
   *  Log an exception including the stack trace
   *
   *  referenceInfo: String - arbitraty text to write before the exception is logged
   *  ex:            exception object
   */
  writeException: function (referenceInfo, ex)
  {
    this.ERROR_LOG(referenceInfo+": caught exception: "
              +ex.name+"\n"
              +"Message: '"+ex.message+"'\n"
              +"File:    "+ex.fileName+"\n"
              +"Line:    "+ex.lineNumber+"\n"
              +"Stack:   "+ex.stack+"\n");
  },


  WRITE_LOG: EnigmailCore.WRITE_LOG.bind(EnigmailCore),

  DEBUG_LOG: EnigmailCore.DEBUG_LOG.bind(EnigmailCore),

  WARNING_LOG: EnigmailCore.WARNING_LOG.bind(EnigmailCore),

  ERROR_LOG: EnigmailCore.ERROR_LOG.bind(EnigmailCore),

  CONSOLE_LOG: EnigmailCore.CONSOLE_LOG.bind(EnigmailCore),

  getString: EnigmailCore.getString.bind(EnigmailCore),

  getOS: EnigmailCore.getOS.bind(EnigmailCore),

  isSuite: EnigmailCore.isSuite.bind(EnigmailCore),


  /***
    * decode text encoded with quoted-printable
    * @str: String - encoded input data
    *
    * @return: String - decoded output data
    */

  decodeQuotedPrintable: function(str) {
    return unescape(str.replace(/%/g, "=25").replace(/=/g,'%'));
  },

  /**
   * Convert string data from a given charset to Unicode (Mozilla's internal
   * representation)
   *
   * @text    String - text to convert
   * @charset String - optional charset. If not specified, UTF-8 is assumed
   *
   * @return: Unicode form of text
   */

  convertToUnicode: function (text, charset)
  {
    //this.DEBUG_LOG("enigmailCommon.jsm: convertToUnicode: "+charset+"\n");

    if (!text || (charset && (charset.toLowerCase() == "iso-8859-1")))
      return text;

    if (! charset) charset = "utf-8";

    // Encode plaintext
    try {
      var unicodeConv = Cc[SCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Ci.nsIScriptableUnicodeConverter);

      unicodeConv.charset = charset;
      return unicodeConv.ConvertToUnicode(text);

    } catch (ex) {
      return text;
    }
  },

  /**
   * Convert string data from Unicode (Mozilla's internal representation) to a given
   * character set.
   *
   * @text    String - text to convert
   * @charset String - optional charset. If not specified, UTF-8 is assumed
   *
   * @return: converted text
   */
  convertFromUnicode: function (text, charset) {
    //this.DEBUG_LOG("enigmailCommon.jsm: convertFromUnicode: "+charset+"\n");

    if (!text)
      return "";

    if (! charset) charset="utf-8";

    // Encode plaintext
    try {
      var unicodeConv = Cc[SCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(Ci.nsIScriptableUnicodeConverter);

      unicodeConv.charset = charset;
      return unicodeConv.ConvertFromUnicode(text);

    } catch (ex) {
      this.DEBUG_LOG("enigmailCommon.jsm: convertFromUnicode: caught an exception\n");

      return text;
    }
  },

  /**
   * Parse error output from GnuPG
   *
   * @errOutput:    String - the output from GnuPG
   * @retStatusObj: Object: {
   *                  - statusMsg:       String - status message
   *                  - statusFlags:     Number - status flags as defined in nsIEnigmail.
   *                  - blockSeparation: String - list of blocks with markers.
   *                  - extendedStatus:  String - space-separated list of additional status
   *                                              information that could be useful for the caller
   *
   * @return: human readable error message from GnuPG
   */
  parseErrorOutput: function (errOutput, retStatusObj)
  {
    return EnigmailErrorHandling.parseErrorOutput(this, gStatusFlags, errOutput, retStatusObj);
  },


  /**
   * pack Network (big-endian) byte order
   *
   * @value: Number - value to pack
   * @bytes: Number - number of bytes to use
   *
   * @return: String - packed bytes
   */
  pack: function (value, bytes)
  {
    var str = '';
    var mask = 0xff;
    for (var j=0; j < bytes; j++) {
      str = String.fromCharCode( (value & mask) >> j*8 ) + str;
      mask <<= 8;
    }

    return str;
  },

  /**
   * unpack Network (big-endian) byte order
   *
   * @str: String to unpack
   *
   * @return: Number (Long int)
   */
  unpack: function (str)
  {
    var len = str.length;
    var value = 0;

    for (var j=0; j < len; j++) {
      value <<= 8;
      value  |= str.charCodeAt(j);
    }

    return value;
  },


  /**
   * convert a string to hexadecimal character, interperting each character
   * of the string as byte
   *
   * @str - String holding the bytes to convert
   *
   * @return - hexadecimal string
   */
  bytesToHex: function (str)
  {
    var len = str.length;

    var hex = '';
    for (var j=0; j < len; j++) {
      var charCode = str.charCodeAt(j);
      hex += hexTable.charAt((charCode & 0xf0) >> 4) +
             hexTable.charAt((charCode & 0x0f));
    }

    return hex;
  },

  getLogLevel: EnigmailCore.getLogLevel.bind(EnigmailCore),

  /**
   * initialize this module
   */
  initialize: function (enigmailSvc)
  {
    this.enigmailSvc = enigmailSvc;
  },


  /**
   * wait a defined number of miliseconds, then call a callback function
   * asynchronously
   *
   * @callbackFunction: Function - any function specification
   * @sleepTimeMs:      Number - optional number of miliseconds to delay
   *                             (0 if not specified)
   */

  setTimeout: function( callbackFunction, sleepTimeMs ) {
    if (sleepTimeMs == null) sleepTimeMs = 0;
    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback(callbackFunction, sleepTimeMs, Ci.nsITimer.TYPE_ONE_SHOT);
    return timer;
  },

  /**
   * dispatch event aynchronously to the main thread
   *
   * @callbackFunction: Function - any function specification
   * @sleepTimeMs:      Number - optional number of miliseconds to delay
   *                             (0 if not specified)
   * @arrayOfArgs:      Array - arguments to pass to callbackFunction
   */

  dispatchEvent: function (callbackFunction, sleepTimeMs, arrayOfArgs)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: dispatchEvent f="+callbackFunction.name+"\n");

    // object for dispatching callback back to main thread
    var mainEvent = function(cbFunc, arrayOfArgs) {
      this.cbFunc = cbFunc;
      this.args   = arrayOfArgs;
    };

    mainEvent.prototype = {
      QueryInterface: function(iid) {
        if (iid.equals(Ci.nsIRunnable) ||
            iid.equals(Ci.nsISupports)) {
                return this;
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
      },

      run: function()
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: dispatchEvent running mainEvent\n");
        this.cbFunc(this.args);
      },

      notify: function()
      {
        EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: dispatchEvent got notified\n");
        this.cbFunc(this.args);
      }

    };

    var event = new mainEvent(callbackFunction, arrayOfArgs);
    if (sleepTimeMs > 0) {
      return this.setTimeout(event, sleepTimeMs);
    }
    else {
      var tm = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager);

      // dispatch the event to the main thread
      tm.mainThread.dispatch(event, Ci.nsIThread.DISPATCH_NORMAL);
    }

    return event;
  },

  /*
   * remember the fact a URI is encrypted
   *
   * @param String msgUri
   *
   * @return null
   */

  rememberEncryptedUri: function (uri) {
    this.DEBUG_LOG("enigmailCommon.jsm: rememberEncryptedUri: uri="+uri+"\n");
    if (gEncryptedUris.indexOf(uri) < 0)
      gEncryptedUris.push(uri);
  },

  /*
   * unremember the fact a URI is encrypted
   *
   * @param String msgUri
   *
   * @return null
   */

  forgetEncryptedUri: function (uri) {
    this.DEBUG_LOG("enigmailCommon.jsm: forgetEncryptedUri: uri="+uri+"\n");
    var pos = gEncryptedUris.indexOf(uri);
    if (pos >= 0) {
      gEncryptedUris.splice(pos, 1);
    }
  },

  /*
   * determine if a URI was remebered as encrypted
   *
   * @param String msgUri
   *
   * @return: Boolean true if yes, false otherwise
   */

  isEncryptedUri: function (uri) {
    this.DEBUG_LOG("enigmailCommon.jsm: isEncryptedUri: uri="+uri+"\n");
    return gEncryptedUris.indexOf(uri) >= 0;
  },

  /*
   * Get GnuPG command line options for receiving the password depending
   * on the various user and system settings (gpg-agent/no passphrase)
   *
   * @return: Array the GnuPG command line options
   */

  passwdCommand: function () {
    var commandArgs = [];

    if (this.enigmailSvc.useGpgAgent()) {
       commandArgs.push("--use-agent");
    }
    else {
      if (! this.getPref("noPassphrase")) {
        commandArgs = commandArgs.concat([ "--passphrase-fd", "0", "--no-use-agent"]);
      }
    }

    return commandArgs;
  },

  /**
   * determine if a password needs to be provided on stdin to GnuPG
   *
   * @return: true: password is required / false: no password required
   */
  requirePassword: function () {

    return false;
  },

  /**
   * get the standard arguments to pass to every GnuPG subprocess
   *
   * @withBatchOpts: Boolean - true: use --batch and some more options
   *                           false: don't use --batch and co.
   *
   * @return: Array of String - the list of arguments
   */
  getAgentArgs: function (withBatchOpts) {
    // return the arguments to pass to every GnuPG subprocess

    function pushTrimmedStr(arr, str, splitStr) {
      // Helper function for pushing a string without leading/trailing spaces
      // to an array
      str = str.replace(/^ */, "").replace(/ *$/, "");
      if (str.length > 0) {
        if (splitStr) {
          var tmpArr = str.split(/[\t ]+/);
          for (var i=0; i< tmpArr.length; i++) {
            arr.push(tmpArr[i]);
          }
        }
        else {
          arr.push(str);
        }
      }
      return (str.length > 0);
    }

    var r = [ "--charset", "utf-8", "--display-charset", "utf-8" ]; // mandatory parameter to add in all cases

    try {
      var p = "";
      p = this.getPref("agentAdditionalParam").replace(/\\\\/g, "\\");

      var i = 0;
      var last = 0;
      var foundSign="";
      var startQuote=-1;

      while ((i=p.substr(last).search(/['"]/)) >= 0) {
        if (startQuote==-1) {
          startQuote = i;
          foundSign=p.substr(last).charAt(i);
          last = i +1;
        }
        else if (p.substr(last).charAt(i) == foundSign) {
          // found enquoted part
          if (startQuote > 1) pushTrimmedStr(r, p.substr(0, startQuote), true);

          pushTrimmedStr(r, p.substr(startQuote + 1, last + i - startQuote -1), false);
          p = p.substr(last + i + 1);
          last = 0;
          startQuote = -1;
          foundSign = "";
        }
        else {
          last = last + i + 1;
        }
      }

      pushTrimmedStr(r, p, true);
    }
    catch (ex) {}


    if (withBatchOpts) {
      r = r.concat(GPG_BATCH_OPT_LIST);
    }

    return r;
  },

  getFilePathDesc: EnigmailCore.getFilePathDesc.bind(EnigmailCore),

  printCmdLine: EnigmailCore.printCmdLine.bind(EnigmailCore),

  /**
   * Fix the exit code of GnuPG (which may be wrong in some circumstances)
   *
   * @exitCode:    Number - the exitCode obtained from GnuPG
   * @statusFlags: Numebr - the statusFlags as calculated by parseErrorOutput()
   *
   * @return: Number - fixed exit code
   */
  fixExitCode: function (exitCode, statusFlags) {
    if (exitCode != 0) {
      if ((statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
          (statusFlags & nsIEnigmail.DECRYPTION_OKAY )) {
        this.DEBUG_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode for decrypted msg "+exitCode+"->0\n");
        exitCode = 0;
      }
    }

    if ((this.enigmailSvc.agentType == "gpg") && (exitCode == 256) && (this.getOS() == "WINNT")) {
      this.WARNING_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
      if (statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
        this.WARNING_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->2\n");
        exitCode = 2;
      } else {
        this.WARNING_LOG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->0\n");
        exitCode = 0;
      }
    }

    return exitCode;
  },

  /**
   * Generate a new key pair with GnuPG
   *
   * @parent:     nsIWindow  - parent window (not used anymore)
   * @name:       String     - name part of UID
   * @comment:    String     - comment part of UID (brackets are added)
   * @comment:    String     - email part of UID (<> will be added)
   * @expiryDate: Number     - Unix timestamp of key expiry date; 0 if no expiry
   * @keyLength:  Number     - size of key in bytes (e.g 4096)
   * @keyType:    Number     - 1 = DSA / 2 = RSA
   * @passphrase: String     - password; null if no password
   * @listener:   Object     - {
   *                             function onDataAvailable(data) {...},
   *                             function onStopRequest(exitCode) {...}
   *                           }
   *
   * @return: handle to process
   */
  generateKey: function (parent, name, comment, email, expiryDate, keyLength, keyType,
            passphrase, listener) {
    this.WRITE_LOG("enigmailCommon.jsm: generateKey:\n");

    if (gKeygenProcess) {
      // key generation already ongoing
      throw Components.results.NS_ERROR_FAILURE;
    }

    var args = this.getAgentArgs(true);
    args.push("--gen-key");

    this.CONSOLE_LOG(this.printCmdLine(this.enigmailSvc.agentPath, args));

    var inputData = "%echo Generating key\nKey-Type: ";

    switch (keyType) {
    case KEYTYPE_DSA:
      inputData += "DSA\nKey-Length: "+keyLength+"\nSubkey-Type: 16\nSubkey-Length: ";
      break;
    case KEYTYPE_RSA:
      inputData += "RSA\nKey-Usage: sign,auth\nKey-Length: "+keyLength;
      inputData += "\nSubkey-Type: RSA\nSubkey-Usage: encrypt\nSubkey-Length: ";
      break;
    default:
      return null;
    }

    inputData += keyLength+"\n";
    if (name.replace(/ /g, "").length)
      inputData += "Name-Real: "+name+"\n";
    if (comment && comment.replace(/ /g, "").length)
      inputData += "Name-Comment: "+comment+"\n";
    inputData += "Name-Email: "+email+"\n";
    inputData += "Expire-Date: "+String(expiryDate)+"\n";

    this.CONSOLE_LOG(inputData+" \n");

    if (passphrase.length)
      inputData += "Passphrase: "+passphrase+"\n";

    inputData += "%commit\n%echo done\n";

    var proc = null;
    var self = this;

    try {
      proc = subprocess.call({
        command:     this.enigmailSvc.agentPath,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        stdin: function (pipe) {
          pipe.write(inputData);
          pipe.close();
        },
        stderr: function(data) {
          listener.onDataAvailable(data);
        },
        done: function(result) {
          gKeygenProcess = null;
          try {
            if (result.exitCode == 0) {
              self.enigmailSvc.invalidateUserIdList();
            }
            listener.onStopRequest(result.exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    } catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: generateKey: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    gKeygenProcess = proc;

    this.DEBUG_LOG("enigmailCommon.jsm: generateKey: subprocess = "+proc+"\n");

    return proc;
  },

  /**
   * get nsIIOService object
   */
  getIoService: function() {
    var ioServ = Cc[this.IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
    return ioServ;
  },

  /**
   * create a nsIInputStream object that is fed with string data
   *
   * @uri:            nsIURI - object representing the URI that will deliver the data
   * @contentType:    String - the content type as specified in nsIChannel
   * @contentCharset: String - the character set; automatically determined if null
   * @data:           String - the data to feed to the stream
   *
   * @return nsIChannel object
   */
  newStringChannel: function(uri, contentType, contentCharset, data)
  {
    this.DEBUG_LOG("enigmailCommon.jsm: newStringChannel\n");

    var inputStream = Cc[NS_STRING_INPUT_STREAM_CONTRACTID].createInstance(Ci.nsIStringInputStream);
    inputStream.setData(data, -1);

    if (! contentCharset || contentCharset.length==0) {
      var ioServ = this.getIoService();
      var netUtil = ioServ.QueryInterface(Ci.nsINetUtil);
      var newCharset = {};
      var hadCharset = {};
      var mimeType = netUtil.parseContentType(contentType, newCharset, hadCharset);
      contentCharset = newCharset.value;

    }

    var isc = Cc[NS_INPUT_STREAM_CHNL_CONTRACTID].createInstance(Ci.nsIInputStreamChannel);
    isc.setURI(uri);
    isc.contentStream = inputStream;

    var chan  = isc.QueryInterface(Ci.nsIChannel);
    if (contentType && contentType.length) chan.contentType = contentType;
    if (contentCharset && contentCharset.length) chan.contentCharset = contentCharset;

    this.DEBUG_LOG("enigmailCommon.jsm: newStringChannel - done\n");

    return chan;
  },

  /**
    * return an array containing the aliases and the email addresses
    * of groups defined in gpg.conf
    *
    * @return: array of objects with the following properties:
    *  - alias: group name as used by GnuPG
    *  - keylist: list of keys (any form that GnuPG accepts), separated by ";"
    *
    * (see docu for gnupg parameter --group)
    */
  getGpgGroups: function() {
    if (!this.enigmailSvc) return [];

    let exitCodeObj = {};
    let errorMsgObj = {};

    let cfgStr = this.enigmailSvc.getGnupgConfig(exitCodeObj, errorMsgObj);

    if (exitCodeObj.value != 0) {
      this.aelrt(errorMsgObj.value);
      return null;
    }

    let groups = [];
    let cfg = cfgStr.split(/\n/);

    for (let i=0; i < cfg.length;i++) {
      if (cfg[i].indexOf("cfg:group") == 0) {
        let groupArr = cfg[i].split(/:/);
        groups.push({
          alias: groupArr[2],
          keylist: groupArr[3]
        });
      }
    }

    return groups;
  },


  /**
   *  get Proxy for a given hostname as configured in Mozilla
   *
   *  @hostname: String - the host to check if there is a proxy.
   *
   *  @return: String - proxy host URL to provide to GnuPG
   *                    null if no proxy required
   */
  getHttpProxy: function (hostName) {

    function GetPasswdForHost(hostname, userObj, passwdObj) {
      var loginmgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

      // search HTTP password 1st
      var logins = loginmgr.findLogins({}, "http://"+hostname, "", "");
      if (logins.length > 0) {
        userObj.value = logins[0].username;
        passwdObj.value = logins[0].password;
        return true;
      }

      // look for any other password for same host
      logins = loginmgr.getAllLogins({});
      for (var i=0; i < logins.lenth; i++) {
        if (hostname == logins[i].hostname.replace(/^.*:\/\//, "")) {
          userObj.value = logins[i].username;
          passwdObj.value = logins[i].password;
          return true;
        }
      }
      return false;
    }

    var proxyHost = null;
    if (EnigmailCore.getPref("respectHttpProxy")) {
      // determine proxy host
      var prefsSvc = Cc[NS_PREFS_SERVICE_CID].getService(Ci.nsIPrefService);
      var prefRoot = prefsSvc.getBranch(null);
      var useProxy = prefRoot.getIntPref("network.proxy.type");
      if (useProxy==1) {
        var proxyHostName = prefRoot.getCharPref("network.proxy.http");
        var proxyHostPort = prefRoot.getIntPref("network.proxy.http_port");
        var noProxy = prefRoot.getCharPref("network.proxy.no_proxies_on").split(/[ ,]/);
        for (var i=0; i<noProxy.length; i++) {
          var proxySearch=new RegExp(noProxy[i].replace(/\./g, "\\.").replace(/\*/g, ".*")+"$", "i");
          if (noProxy[i] && hostName.search(proxySearch)>=0) {
            i=noProxy.length+1;
            proxyHostName=null;
          }
        }

        if (proxyHostName) {
          var userObj = new Object();
          var passwdObj = new Object();
          if (GetPasswdForHost(proxyHostName, userObj, passwdObj)) {
            proxyHostName = userObj.value+":"+passwdObj.value+"@"+proxyHostName;
          }
        }
        if (proxyHostName && proxyHostPort) {
          proxyHost="http://"+proxyHostName+":"+proxyHostPort;
        }
      }
    }

    return proxyHost;
  },

  /**
   * Get a list of all secret keys
   *
   *  win:     nsIWindow: optional parent window
   *  refresh: Boolean:   optional. true ->  re-load keys from gpg
   *                                false -> use cached values if available
   */
  getSecretKeys: function (win, refresh) {
    // return a sorted array containing objects of (valid, usable) secret keys.
    // @return: [ {name: <userId>, id: 0x1234ABCD, created: YYYY-MM-DD },  { ... } ]
    var enigmailSvc = this.getService(win);
    if (!enigmailSvc) {
      return null;
    }
    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj = new Object();

    if (refresh == null) refresh = false;
    var keyList=enigmailSvc.getUserIdList(true, refresh, exitCodeObj, statusFlagsObj, errorMsgObj);

    if (exitCodeObj.value != 0 && keyList.length == 0) {
      this.alert(win, errorMsgObj.value);
      return null;
    }

    var userList=keyList.split(/\n/);
    var secretKeyList = new Array();
    var secretKeyCreated = new Array();
    var i;

    var keyId = null;
    var keys = [];
    for (i=0; i < userList.length; i++) {
      if (userList[i].substr(0,4) == "sec:") {
        var aLine=userList[i].split(/:/);
        keyId = aLine[4];
        secretKeyCreated[keyId] = this.getDateTime(aLine[5], true, false);
        secretKeyList.push(keyId);
      }
    }

    keyList = enigmailSvc.getKeyDetails(secretKeyList.join(" "), false, false);
    userList=keyList.split(/\n/);

    for (i=0; i < userList.length; i++) {
      var aLine = userList[i].split(/:/);
      switch (aLine[0]) {
      case "pub":
        if (aLine[1].search(/[muf]/) == 0) keyId = aLine[4]; // public key is valid
        break;
      case "uid":
        if ((keyId != null) && (aLine[1].search(/[muf]/) == 0)) {
          // UID is valid
          keys.push({ name: this.convertGpgToUnicode(aLine[9]),
                      id: keyId,
                      created: secretKeyCreated[keyId]});
          keyId = null;
        }
      }
    }

    keys.sort(function(a,b) { return a.name == b.name ? (a.id < b.id ? -1 : 1) : (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1); });
    return keys;
  },

  /**
   * search, download or upload key on, from or to a keyserver
   *
   * @actionFlags: Integer - flags (bitmap) to determine the required action
   *                         (see nsIEnigmail - Keyserver action flags for details)
   * @keyserver:   String  - keyserver URL (optionally incl. protocol)
   * @searchTerms: String  - space-separated list of search terms or key IDs
   * @listener:    Object  - execStart Listener Object. See execStart for details.
   * @errorMsgObj: Object  - object to hold error message in .value
   *
   * @return:      Subprocess object, or null in case process could not be started
   */
  keyserverAccess: function (actionFlags, keyserver, searchTerms, listener, errorMsgObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: keyserverAccess: "+searchTerms+"\n");

    if (! (this.enigmailSvc && this.enigmailSvc.initialized)) {
      this.ERROR_LOG("enigmailCommon.jsm: keyserverAccess: not yet initialized\n");
      errorMsgObj.value = this.getString("notInit");
      return null;
    }

    if (!keyserver) {
      errorMsgObj.value = this.getString("failNoServer");
      return null;
    }

    if (!searchTerms && ! (actionFlags & nsIEnigmail.REFRESH_KEY)) {
      errorMsgObj.value = this.getString("failNoID");
      return null;
    }

    var proxyHost = this.getHttpProxy(keyserver);
    var args = this.getAgentArgs(true);

    if (actionFlags & nsIEnigmail.SEARCH_KEY) {
      args = this.getAgentArgs(false);
      args = args.concat(["--command-fd", "0", "--fixed-list", "--with-colons"]);
    }
    if (proxyHost) {
      args = args.concat(["--keyserver-options", "http-proxy="+proxyHost]);
    }
    args = args.concat(["--keyserver", keyserver]);

//     if (actionFlags & nsIEnigmail.SEARCH_KEY | nsIEnigmail.DOWNLOAD_KEY | nsIEnigmail.REFRESH_KEY) {
//       args = args.concat(["--command-fd", "0", "--fixed-list", "--with-colons"]);
//     }

    var inputData = null;
    var searchTermsList = searchTerms.split(" ");

    if (actionFlags & nsIEnigmail.DOWNLOAD_KEY) {
      args.push("--recv-keys");
      args = args.concat(searchTermsList);
    }
    else if (actionFlags & nsIEnigmail.REFRESH_KEY) {
      args.push("--refresh-keys");
    }
    else if (actionFlags & nsIEnigmail.SEARCH_KEY) {
      args.push("--search-keys");
      args = args.concat(searchTermsList);
      inputData = "quit\n";
    }
    else if (actionFlags & nsIEnigmail.UPLOAD_KEY) {
      args.push("--send-keys");
      args = args.concat(searchTermsList);
    }

    var isDownload = actionFlags & (nsIEnigmail.REFRESH_KEY | nsIEnigmail.DOWNLOAD_KEY);

    this.CONSOLE_LOG("enigmail> "+this.printCmdLine(this.enigmailSvc.agentPath, args)+"\n");

    var proc = null;
    var self = this;

    var exitCode = null;

    try {
      proc = subprocess.call({
        command:     this.enigmailSvc.agentPath,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        stdin: inputData,
        stdout: function(data) {
          listener.stdout(data);
        },
        stderr: function(data) {
          if (data.search(/^\[GNUPG:\] ERROR/m) >= 0) {
            exitCode = 4;
          }
          listener.stderr(data);
        },
        done: function(result) {
          gKeygenProcess = null;
          try {
            if (result.exitCode == 0 && isDownload) {
              self.enigmailSvc.invalidateUserIdList();
            }
            if (exitCode == null) {
              exitCode = result.exitCode;
            }
            listener.done(exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    }
    catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: keyserverAccess: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    if (!proc) {
      this.ERROR_LOG("enigmailCommon.jsm: keyserverAccess: subprocess failed due to unknown reasons\n");
      return null;
    }

    return proc;
  },

  /**
   * Force GnuPG to recalculate the trust db. This is sometimes required after importing keys.
   *
   * no return value
   */

  recalcTrustDb: function() {
    this.DEBUG_LOG("enigmailCommon.jsm: recalcTrustDb:\n");

    let command = this.agentPath;
    let args = this.getAgentArgs(false);
    args = args.concat(["--check-trustdb"]);

    try {
      let proc = subprocess.call({
        command:     this.enigmailSvc.agentPath,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        mergeStderr: false
      });
      proc.wait();
    }
    catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: recalcTrustDb: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }
  },


  /***
    determine if a specific feature is available in the GnuPG version used

    @featureName:  String; one of the following values:
      version-supported    - is the gpg version supported at all (true for gpg >= 2.0.7)
      supports-gpg-agent   - is gpg-agent is usually provided (true for gpg >= 2.0)
      autostart-gpg-agent  - is gpg-agent started automatically by gpg (true for gpg >= 2.0.16)
      keygen-passphrase    - can the passphrase be specified when generating keys (false for gpg 2.1 and 2.1.1)
      windows-photoid-bug  - is there a bug in gpg with the output of photoid on Windows (true for gpg < 2.0.16)

    @return: depending on featureName - Boolean unless specified differently:
      (true if feature is available / false otherwise)
      If the feature cannot be found, undefined is returned
   */

  getGpgFeature: function(featureName) {
    let gpgVersion = this.enigmailSvc.agentVersion;

    if (! gpgVersion || typeof(gpgVersion) != "string" || gpgVersion.length == 0) {
      return undefined;
    }

    gpgVersion = gpgVersion.replace(/\-.*$/, "");
    if (gpgVersion.search(/^\d+\.\d+/) < 0) {
      // not a valid version number
      return undefined;
    }

    var vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);

    switch(featureName) {
    case 'version-supported':
      return (vc.compare(gpgVersion, "2.0.7") >= 0);
    case 'supports-gpg-agent':
      return (vc.compare(gpgVersion, "2.0") >= 0);
    case 'autostart-gpg-agent':
      return (vc.compare(gpgVersion, "2.0.16") >= 0);
    case 'keygen-passphrase':
      return (vc.compare(gpgVersion, "2.1") < 0 || vc.compare(gpgVersion, "2.1.2") >= 0);
    case 'windows-photoid-bug':
      return (vc.compare(gpgVersion, "2.0.16") < 0);
    }

    return undefined;

  },


  //////////////// Passphrase Mangagement /////////

  getMaxIdleMinutes: function () {
    var maxIdleMinutes = 5;
    try {
      maxIdleMinutes = this.getPref("maxIdleMinutes");
    } catch (ex) {}

    return maxIdleMinutes;
  },


  getLocalFileApi: function () {
    return Ci.nsIFile;
  },


  // Extract public key from Status Message
  extractPubkey: function (statusMsg) {
    var keyId = null;
    var matchb = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);

    if (matchb && (matchb.length > 3)) {
      this.DEBUG_LOG("enigmailCommon.jsm:: Enigmail.extractPubkey: NO_PUBKEY 0x"+matchb[3]+"\n");
      keyId = matchb[2]+matchb[3];
    }

    return keyId;
  },


  /**
   * execStart Listener Object
   *
   * The listener object must implement at least the following methods:
   *
   *  stdin(pipe)    - OPTIONAL - write data to subprocess stdin via |pipe| hanlde
   *  stdout(data)   - receive |data| from subprocess stdout
   *  stderr(data)   - receive |data| from subprocess stderr
   *  done(exitCode) - receive signal when subprocess has terminated
   */

  /**
   *  start a subprocess (usually gpg) that gets and/or receives data via stdin/stdout/stderr.
   *
   * @command:        either: String - full path to executable
   *                  or:     nsIFile object referencing executable
   * @args:           Array of Strings: command line parameters for executable
   * @needPassphrase: Boolean - is a passphrase required for the action?
   *                    if true, the password may be promted using a dialog
   *                    (unless alreday cached or gpg-agent is used)
   * @domWindow:      nsIWindow - window on top of which password dialog is shown
   * @listener:       Object - Listener to interact with subprocess; see spec. above
   * @statusflagsObj: Object - .value will hold status Flags
   *
   * @return:         handle to suprocess
   */
  execStart: function (command, args, needPassphrase, domWindow, listener, statusFlagsObj) {
    this.WRITE_LOG("enigmailCommon.jsm: execStart: command = "+this.printCmdLine(command, args)+", needPassphrase="+needPassphrase+", domWindow="+domWindow+", listener="+listener+"\n");

    if (! listener) listener = {};

    statusFlagsObj.value = 0;

    var proc = null;

    listener.command = command;

    this.CONSOLE_LOG("enigmail> "+this.printCmdLine(command, args)+"\n");

    try {
      proc = subprocess.call({
        command:     command,
        arguments:   args,
        environment: this.getEnvList(),
        charset: null,
        bufferedOutput: true,
        stdin: function (pipe) {
          if (listener.stdin) listener.stdin(pipe);
        },
        stdout: function(data) { listener.stdout(data); },
        stderr: function(data) { listener.stderr(data); },
        done: function(result) {
          try {
            listener.done(result.exitCode);
          }
          catch (ex) {
            EnigmailCommon.writeException("enigmailCommon.jsm", ex);
          }
        },
        mergeStderr: false
      });
    } catch (ex) {
      this.ERROR_LOG("enigmailCommon.jsm: execStart: subprocess.call failed with '"+ex.toString()+"'\n");
      this.DEBUG_LOG("  enigmail> DONE with FAILURE\n");
      return null;
    }
    this.DEBUG_LOG("  enigmail> DONE\n");

    return proc;
  },

  /*
     requirements for listener object:
      exitCode
      stderrData
    */
  execEnd: function (listener, statusFlagsObj, statusMsgObj, cmdLineObj, errorMsgObj, blockSeparationObj) {

    this.DEBUG_LOG("enigmailCommon.jsm: execEnd:\n");

    cmdLineObj.value = listener.command;

    var exitCode = listener.exitCode;
    var errOutput = listener.stderrData;


    this.DEBUG_LOG("enigmailCommon.jsm: execEnd: exitCode = "+exitCode+"\n");
    this.DEBUG_LOG("enigmailCommon.jsm: execEnd: errOutput = "+errOutput+"\n");

    var retObj = {};
    errorMsgObj.value = this.parseErrorOutput(errOutput, retObj);
    statusFlagsObj.value = retObj.statusFlags;
    statusMsgObj.value = retObj.statusMsg;
    if (! blockSeparationObj) blockSeparationObj = {};
    blockSeparationObj.value = retObj.blockSeparation;

    if (errOutput.search(/jpeg image of size \d+/)>-1) {
      statusFlagsObj.value |= nsIEnigmail.PHOTO_AVAILABLE;
    }
    if (blockSeparationObj && blockSeparationObj.value.indexOf(" ") > 0) {
      exitCode = 2;
    }

    this.CONSOLE_LOG(this.convertFromUnicode(errorMsgObj.value)+"\n");

    return exitCode;
  },


  /***
   * Start decryption by launching gpg
   * win:               window object for password prompt
   * verifyOnly:        Boolean: true if message is to be verified; false if message is
   *                    decrypted and result is returned
   * listener:          listener object for getting results from process (see execStart)
   * statusFlagsObj:    object for getting status flags in .value property
   * errorMsgObj:       object for getting error message text in .value property
   * mimeSignatureFile: file name for separate signature file
   * maxOutputLength:   maximum output length for GnuPG; 0 for infinite
   */
  decryptMessageStart: function (win, verifyOnly, noOutput, listener,
                                 statusFlagsObj, errorMsgObj, mimeSignatureFile,
                                 maxOutputLength, passphrase) {
      return Decryption.decryptMessageStart(this, win, verifyOnly, noOutput, listener,
                                            statusFlagsObj, errorMsgObj, mimeSignatureFile,
                                            maxOutputLength, passphrase);
  },


  decryptMessageEnd: function (stderrStr, exitCode, outputLen, verifyOnly, noOutput, uiFlags, retStatusObj) {
      return Decryption.decryptMessageEnd(this, stderrStr, exitCode, outputLen, verifyOnly, noOutput, uiFlags, retStatusObj);
  },


  getEncryptCommand: function (fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj) {
      return Encryption.getEncryptCommand(this, fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj);
  },

  determineHashAlgorithm: function (win, uiFlags, fromMailAddr, hashAlgoObj) {
    this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm\n");

    if (! win) {
      var windowManager = Cc[this.APPSHELL_MEDIATOR_CONTRACTID].getService(Ci.nsIWindowMediator);
      win = windowManager.getMostRecentWindow(null);
    }

    this.getService(win);
    if (! (this.enigmailSvc)) {
      this.ERROR_LOG("enigmailCommon.jsm: determineHashAlgorithm: not yet initialized\n");
      errorMsgObj.value = this.getString("notInit");
      return 2;
    }

    var sendFlags = nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED;

    var hashAlgo = gMimeHashAlgorithms[this.getPref("mimeHashAlgorithm")];

    if (typeof(gKeyAlgorithms[fromMailAddr]) != "string") {
      // hash algorithm not yet known

      var testUiFlags = nsIEnigmail.UI_TEST;

      var listener = {
        stdoutData: "",
        stderrData: "",
        exitCode: -1,
        stdin: function(pipe) {
            pipe.write("Dummy Test");
            pipe.close();
        },
        stdout: function(data) {
          this.stdoutData += data;
        },
        stderr: function (data) {
          this.stderrData += data;
        },
        done: function(exitCode) {
          this.exitCode = exitCode;
        }
      };

      var statusFlagsObj = {};
      var errorMsgObj = {};
      var proc = this.encryptMessageStart(win, testUiFlags, fromMailAddr, "",
                              "", hashAlgo, sendFlags,
                              listener, statusFlagsObj, errorMsgObj);

      if (!proc) {
        return 1;
      }

      proc.wait();

      var msgText = listener.stdoutData;
      var exitCode = listener.exitCode;

      var retStatusObj = {};
      exitCode = this.encryptMessageEnd(listener.stderrData, exitCode,
                                        testUiFlags, sendFlags, 10,
                                        retStatusObj);

      if ((exitCode == 0) && !msgText) exitCode = 1;
      // if (exitCode > 0) exitCode = -exitCode;

      if (exitCode != 0) {
        // Abormal return
        if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
          // "Unremember" passphrase on error return
          retStatusObj.errorMsg = this.getString("badPhrase");
        }
        this.alert(win, retStatusObj.errorMsg);
        return exitCode;
      }

      var hashAlgorithm = "sha1"; // default as defined in RFC 4880, section 7 is MD5 -- but that's outdated

      var m = msgText.match(/^(Hash: )(.*)$/m);
      if (m && (m.length > 2) && (m[1] == "Hash: ")) {
        hashAlgorithm = m[2].toLowerCase();
      }
      else
        this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm: no hashAlgorithm specified - using MD5\n");

      for (var i=1; i < gMimeHashAlgorithms.length; i++) {
        if (gMimeHashAlgorithms[i] == hashAlgorithm) {
          this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm: found hashAlgorithm "+hashAlgorithm+"\n");
          gKeyAlgorithms[fromMailAddr] = hashAlgorithm;
          hashAlgoObj.value = hashAlgorithm;
          return 0;
        }
      }

      this.ERROR_LOG("enigmailCommon.jsm: determineHashAlgorithm: no hashAlgorithm found\n");
      return 2;
    }
    else {
      this.DEBUG_LOG("enigmailCommon.jsm: determineHashAlgorithm: hashAlgorithm "+gKeyAlgorithms[fromMailAddr]+" is cached\n");
      hashAlgoObj.value = gKeyAlgorithms[fromMailAddr];
    }

    return 0;
  },

  // returns subprocess object
  encryptMessageStart: function (win, uiFlags, fromMailAddr, toMailAddr, bccMailAddr,
            hashAlgorithm, sendFlags, listener, statusFlagsObj, errorMsgObj, passphrase) {
      return Encryption.encryptMessageStart(this, win, uiFlags, fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, listener, statusFlagsObj, errorMsgObj, passphrase);
  },

  // returns exitCode
  encryptMessageEnd: function (stderrStr, exitCode, uiFlags, sendFlags, outputLen, retStatusObj) {
      return Encryption.encryptMessageEnd(this, stderrStr, exitCode, uiFlags, sendFlags, outputLen, retStatusObj);
  },


  /**
   * simple listener for using with execStart
   *
   * stdinFunc: optional function to write to stdin
   * doneFunc : optional function that is called when the process is terminated
   */
  newSimpleListener: function(stdinFunc, doneFunc) {
    var simpleListener = {
      stdoutData: "",
      stderrData: "",
      exitCode: -1,
      stdin: function(pipe) {
          pipe.close();
      },
      stdout: function(data) {
        this.stdoutData += data;
      },
      stderr: function (data) {
        this.stderrData += data;
      },
      done: function(exitCode) {
        this.exitCode = exitCode;
        if (doneFunc) {
          doneFunc(exitCode);
        }
      }
    };

    if (stdinFunc) simpleListener.stdin = stdinFunc;
    return simpleListener;
  },


  getAttachmentFileName: function (parent, byteData) {
    this.DEBUG_LOG("enigmailCommon.jsm: getAttachmentFileName\n");

    var args = this.getAgentArgs(true);
    args = args.concat(this.passwdCommand());
    args.push("--list-packets");

    var listener = this.newSimpleListener(
      function _stdin (pipe) {
          EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: getAttachmentFileName: _stdin\n");
          pipe.write(byteData);
          pipe.write("\n");
          pipe.close();
      });

    var statusFlagsObj = {};
    var proc = this.execStart(this.enigmailSvc.agentPath, args, false, parent,
                              listener, statusFlagsObj);

    if (!proc) {
      return null;
    }

    proc.wait();

    var matches = listener.stdoutData.match(/:literal data packet:\r?\n.*name="(.*)",/m);
    if (matches && (matches.length > 1)) {
      var filename = escape(matches[1]).replace(/%5Cx/g, "%");
      return this.convertToUnicode(unescape(filename), "utf-8");
    }
    else
      return null;
  },

  getInstallLocation: function() {
    return gEnigInstallLocation;
  },

  /***
   * create a string of random characters suitable to use for a boundary in a
   * MIME message following RFC 2045
   *
   * @return: string of 33 random characters and digits
   */
  createMimeBoundary: function() {
    let b = "";
    let r = 0;
    for (let i=0; i<33; i++) {
      r = Math.floor(Math.random() * 58);
      b += String.fromCharCode((r < 10 ? 48 : (r < 34 ? 55 :  63)) + r);
    }
    return b;
  },



};


////////////////////////////////////////////////////////////////////////
// Local (not exported) functions & objects
////////////////////////////////////////////////////////////////////////
var timerObserver = {

  QueryInterface: XPCOMUtils.generateQI([ Ci.nsIObserver, Ci.nsISupports ]),

  observe: function (aSubject, aTopic, aData) {
    EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: timerObserver.observe: topic='"+aTopic+"' \n");

    if (aTopic == "timer-callback") {
    }
    else {
      EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: timerObserver.observe: no handler for '"+aTopic+"'\n");
    }
  }
};


function upgradeRecipientsSelection () {
  // Upgrade perRecipientRules and recipientsSelectionOption to
  // new recipientsSelection

  var  keySel = EnigmailCommon.getPref("recipientsSelectionOption");
  var  perRecipientRules = EnigmailCommon.getPref("perRecipientRules");

  var setVal = 2;

  /*
  1: rules only
  2: rules & email addresses (normal)
  3: email address only (no rules)
  4: manually (always prompt, no rules)
  5: no rules, no key selection
  */

  switch (perRecipientRules) {
  case 0:
    switch (keySel) {
    case 0:
      setVal = 5;
      break;
    case 1:
      setVal = 3;
      break;
    case 2:
      setVal = 4;
      break;
    default:
      setVal = 2;
    }
    break;
  case 1:
    setVal = 2;
    break;
  case 2:
    setVal = 1;
    break;
  default:
    setVal = 2;
  }

  // set new pref
  EnigmailCommon.setPref("recipientsSelection", setVal);

  // clear old prefs
  EnigmailCore.prefBranch.clearUserPref("perRecipientRules");
  EnigmailCore.prefBranch.clearUserPref("recipientsSelectionOption");
}


function upgradePrefsSending ()
{
  EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending()\n");

  var  cbs = EnigmailCommon.getPref("confirmBeforeSend");
  var  ats = EnigmailCommon.getPref("alwaysTrustSend");
  var  ksfr = EnigmailCommon.getPref("keepSettingsForReply");
  EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending cbs="+cbs+" ats="+ats+" ksfr="+ksfr+"\n");

  // Upgrade confirmBeforeSend (bool) to confirmBeforeSending (int)
  switch (cbs) {
    case false:
      EnigmailCommon.setPref("confirmBeforeSending", 0); // never
      break;
    case true:
      EnigmailCommon.setPref("confirmBeforeSending", 1); // always
      break;
  }

  // Upgrade alwaysTrustSend (bool)   to acceptedKeys (int)
  switch (ats) {
    case false:
      EnigmailCommon.setPref("acceptedKeys", 0); // valid
      break;
    case true:
      EnigmailCommon.setPref("acceptedKeys", 1); // all
      break;
  }

  // if all settings are default settings, use convenient encryption
  if (cbs==false && ats==true && ksfr==true) {
    EnigmailCommon.setPref("encryptionModel", 0); // convenient
    EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending() encryptionModel=0 (convenient)\n");
  }
  else {
    EnigmailCommon.setPref("encryptionModel", 1); // manually
    EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: upgradePrefsSending() encryptionModel=1 (manually)\n");
  }

  // clear old prefs
  EnigmailCore.prefBranch.clearUserPref("confirmBeforeSend");
  EnigmailCore.prefBranch.clearUserPref("alwaysTrustSend");
}


function upgradeHeadersView() {
  // all headers hack removed -> make sure view is correct
  var hdrMode = null;
  try {
    hdrMode = EnigmailCommon.getPref("show_headers");
  }
  catch (ex) {}

  if (hdrMode == null) hdrMode = 1;
  try {
    EnigmailCore.prefBranch.clearUserPref("show_headers");
  }
  catch (ex) {}

  EnigmailCore.prefRoot.setIntPref("mail.show_headers", hdrMode);
}

function upgradeCustomHeaders() {
  try {
    var extraHdrs = " " + EnigmailCore.prefRoot.getCharPref("mailnews.headers.extraExpandedHeaders").toLowerCase() + " ";

    var extraHdrList = [
      "x-enigmail-version",
      "content-transfer-encoding",
      "openpgp",
      "x-mimeole",
      "x-bugzilla-reason",
      "x-php-bug" ];

    for (hdr in extraHdrList) {
      extraHdrs = extraHdrs.replace(" "+extraHdrList[hdr]+" ", " ");
    }

    extraHdrs = extraHdrs.replace(/^ */, "").replace(/ *$/, "");
    EnigmailCore.prefRoot.setCharPref("mailnews.headers.extraExpandedHeaders", extraHdrs);
  }
  catch(ex) {}
}

function upgradePgpMime() {
  var pgpMimeMode = false;
  try {
    pgpMimeMode = (EnigmailCommon.getPref("usePGPMimeOption") == 2);
  }
  catch (ex) {
    return;
  }

  try {
    if (pgpMimeMode) {
      var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
      try {
        // Gecko >= 20
        for (var i=0; i < accountManager.allIdentities.length; i++) {
          var id = accountManager.allIdentities.queryElementAt(i, Ci.nsIMsgIdentity);
          if (id.getBoolAttribute("enablePgp")) {
            id.setBoolAttribute("pgpMimeMode", true);
          }
        }
      }
      catch(ex) {
        // Gecko < 20
        for (var i=0; i < accountManager.allIdentities.Count(); i++) {
          var id = accountManager.allIdentities.QueryElementAt(i, Ci.nsIMsgIdentity);
          if (id.getBoolAttribute("enablePgp")) {
            id.setBoolAttribute("pgpMimeMode", true);
          }
        }
      }
    }
    EnigmailCore.prefBranch.clearUserPref("usePGPMimeOption");
  }
  catch (ex) {}
}

// open the Enigmail Setup Wizard
// (not using EnigmailFuncs, because we can't cross-ref each other)
function launchSetupWizard(win) {
    win.open("chrome://enigmail/content/enigmailSetupWizard.xul",
    "", "chrome,centerscreen,resizable");
}

function ConfigureEnigmail(win, startingPreferences) {
  EnigmailCommon.DEBUG_LOG("enigmailCommon.jsm: ConfigureEnigmail\n");
  var oldVer=EnigmailCommon.getPref("configuredVersion");

  try {
    EnigmailCore.initPrefService();
    var vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
    if (oldVer == "") {
      launchSetupWizard(win);
    }
    else {
      if (oldVer < "0.95") {
        try {
          upgradeHeadersView();
          upgradePgpMime();
          upgradeRecipientsSelection();
        }
        catch (ex) {}
      }
      if (vc.compare(oldVer, "1.0") < 0) {
        upgradeCustomHeaders();
      }
      if (vc.compare(oldVer, "1.7a1pre") < 0) {
        // MISSING:
        // - upgrade extensions.enigmail.recipientsSelection
        //   to      extensions.enigmail.assignKeys*
        // 1: rules only
        //     => assignKeysByRules true; rest false
        // 2: rules & email addresses (normal)
        //     => assignKeysByRules/assignKeysByEmailAddr/assignKeysManuallyIfMissing true
        // 3: email address only (no rules)
        //     => assignKeysByEmailAddr/assignKeysManuallyIfMissing true
        // 4: manually (always prompt, no rules)
        //     => assignKeysManuallyAlways true
        // 5: no rules, no key selection
        //     => assignKeysByRules/assignKeysByEmailAddr true

        upgradePrefsSending();
      }
      if (vc.compare(oldVer, "1.7") < 0) {
        // open a modal dialog. Since this might happen during the opening of another
        // window, we have to do this asynchronously
        EnigmailCommon.setTimeout(
          function _cb() {
            var doIt = EnigmailCommon.confirmDlg(win,
                                   EnigmailCommon.getString("enigmailCommon.versionSignificantlyChanged"),
                                   EnigmailCommon.getString("enigmailCommon.checkPreferences"),
                                   EnigmailCommon.getString("dlg.button.close"));
            if (!startingPreferences && doIt) {
                // same as:
                // - EnigmailFuncs.openPrefWindow(window, true, 'sendingTab');
                // but
                // - without starting the service again because we do that right now
                // - and modal (waiting for its end)
                win.openDialog("chrome://enigmail/content/pref-enigmail.xul",
                                  "_blank", "chrome,resizable=yes,modal",
                                  {'showBasic': true,
                                   'clientType': 'thunderbird',
                                   'selectTab': 'sendingTab'});
            }
          }, 100);

      }
    }
  }
  catch(ex) {};

  EnigmailCommon.setPref("configuredVersion", EnigmailCommon.getVersion());
  EnigmailCommon.savePrefs();
}


function initSubprocess(aFile) {
  var xulRuntime = Cc[XPCOM_APPINFO].getService(Ci.nsIXULRuntime);
  var dllSuffix = xulRuntime.OS == "Darwin" ? ".dylib" : ".so";

  var installLocation = aFile.clone();
  installLocation.append("platform");
  installLocation.append(xulRuntime.OS+"_"+xulRuntime.XPCOMABI);
  installLocation.append("lib");
  installLocation.append("libsubprocess-"+xulRuntime.XPCOMABI+dllSuffix);
}

try {
  AddonManager.getAddonByID(ENIG_EXTENSION_GUID,
    function (addon) {
      gEnigExtensionVersion = addon.version;
      gEnigInstallLocation = addon.getResourceURI("").QueryInterface(Ci.nsIFileURL).file;
      initSubprocess(gEnigInstallLocation);
    }
  );

}
catch (ex) {
  dump("enigmailCommon.jsm: init error: "+ex+"\n");
}
