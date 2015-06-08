/*global Components: false, EnigmailCore: false, Prefs: false, OS: false, Files: false, Locale: false, Data: false, Log: false, Execution: false, App: false */
/*global XPCOMUtils: false, Timer: false, Windows: false, Dialog: false, Configure: false */
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
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/subprocess.jsm");
Components.utils.import("resource://enigmail/pipeConsole.jsm");
Components.utils.import("resource://enigmail/enigmailErrorHandling.jsm");
Components.utils.import("resource://enigmail/encryption.jsm");
Components.utils.import("resource://enigmail/decryption.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/prefs.jsm");
Components.utils.import("resource://enigmail/os.jsm");
Components.utils.import("resource://enigmail/files.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/data.jsm");
Components.utils.import("resource://enigmail/execution.jsm");
Components.utils.import("resource://enigmail/app.jsm");
Components.utils.import("resource://enigmail/timer.jsm");
Components.utils.import("resource://enigmail/windows.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");
Components.utils.import("resource://enigmail/configure.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";
const LOCALE_SVC_CONTRACTID = "@mozilla.org/intl/nslocaleservice;1";
const NS_PREFS_SERVICE_CID = "@mozilla.org/preferences-service;1";
const NS_STRING_INPUT_STREAM_CONTRACTID = "@mozilla.org/io/string-input-stream;1";
const NS_INPUT_STREAM_CHNL_CONTRACTID = "@mozilla.org/network/input-stream-channel;1";
const NS_TIMER_CONTRACTID       = "@mozilla.org/timer;1";

const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const GPG_BATCH_OPT_LIST = [ "--batch", "--no-tty", "--status-fd", "2" ];

const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

var gPromptSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
var gDispatchThread = null;

var gCachedPassphrase = null;

var gEncryptedUris = [];

var gKeyAlgorithms = [];

const gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5" ];


// various global variables
var gKeygenProcess = null;

const EC = EnigmailCore;

var EnigmailCommon = {

  // "constants"
  POSSIBLE_PGPMIME: -2081,
  PGP_DESKTOP_ATT : -2082,

  MSG_BUFFER_SIZE:  96000,
  MSG_HEADER_SIZE:  16000,

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
      Log.ERROR("enigmailCommon.jsm: Error in instantiating EnigmailService: "+ex+"\n");
      return null;
    }

    if (! win) {
      win = Windows.getBestParentWin();
    }

    Log.DEBUG("enigmailCommon.jsm: this.enigmailSvc = "+this.enigmailSvc+"\n");

    if (!this.enigmailSvc.initialized) {
      // Initialize enigmail

      var firstInitialization = !this.enigmailSvc.initializationAttempted;

      try {
        // Initialize enigmail
        EnigmailCore.init(App.getVersion());
        this.enigmailSvc.initialize(win, App.getVersion(), Prefs.getPrefBranch());

        try {
          // Reset alert count to default value
          Prefs.getPrefBranch().clearUserPref("initAlert");
        }
        catch(ex) { }

      }
      catch (ex) {

        if (firstInitialization) {
          // Display initialization error alert
          var errMsg = this.enigmailSvc.initializationError ? this.enigmailSvc.initializationError : Locale.getString("accessError");

          errMsg += "\n\n"+Locale.getString("initErr.howToFixIt");

          var checkedObj = {value: false};
          if (Prefs.getPref("initAlert")) {
            var r = Dialog.longAlert(win, "Enigmail: "+errMsg,
                                     Locale.getString("dlgNoPrompt"),
                                     null, Locale.getString("initErr.setupWizard.button"),
                                     null, checkedObj);
            if (r >= 0 && checkedObj.value) {
              Prefs.setPref("initAlert", false);
            }
            if (r == 1) {
              // start setup wizard
              Windows.openSetupWizard(win, false);
              return this.getService(win);
            }
          }
          if (Prefs.getPref("initAlert")) {
            this.enigmailSvc.initializationAttempted = false;
            this.enigmailSvc = null;
          }
        }

        return null;
      }

      var configuredVersion = Prefs.getPref("configuredVersion");

      Log.DEBUG("enigmailCommon.jsm: getService: "+configuredVersion+"\n");

      if (firstInitialization && this.enigmailSvc.initialized &&
          this.enigmailSvc.agentType && this.enigmailSvc.agentType == "pgp") {
        Dialog.alert(win, Locale.getString("pgpNotSupported"));
      }

      if (this.enigmailSvc.initialized && (App.getVersion() != configuredVersion)) {
        Configure.configureEnigmail(win, startingPreferences);
      }
    }

    return this.enigmailSvc.initialized ? this.enigmailSvc : null;
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
    if (dateNum && dateNum !== 0) {
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
   * create an nsIStreamListener object to read String data from an nsIInputStream
   *
   * @onStopCallback: Function - function(data) that is called when the stream has stopped
   *                             string data is passed as |data|
   *
   * @return: the nsIStreamListener to pass to the stream
   */
  newStringStreamListener: function (onStopCallback)
  {
    Log.DEBUG("enigmailCommon.jsm: newStreamListener\n");

    var simpleStreamListener = {
      data: "",
      inStream: Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream),
      _onStopCallback: onStopCallback,
      QueryInterface: XPCOMUtils.generateQI([ Ci.nsIStreamListener, Ci.nsIRequestObserver ]),

      onStartRequest: function (channel, ctxt)
      {
        // Log.DEBUG("enigmailCommon.jsm: stringListener.onStartRequest\n");
      },

      onStopRequest: function (channel, ctxt, status)
      {
        // Log.DEBUG("enigmailCommon.jsm: stringListener.onStopRequest: "+ctxt+"\n");
        this.inStream = null;
        var cbFunc = this._onStopCallback;
        var cbData = this.data;

        Timer.setTimeout(function _cb() {
          cbFunc(cbData);
        });
      },

      onDataAvailable: function(req, sup, stream, offset, count)
      {
        // get data from stream
        // Log.DEBUG("enigmailCommon.jsm: stringListener.onDataAvailable: "+count+"\n");
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
        Log.DEBUG("enigmailCommon.jsm: requestObserver.onStartRequest\n");
      },

      onStopRequest: function (channel, ctxt, status)
      {
        Log.DEBUG("enigmailCommon.jsm: requestObserver.onStopRequest: "+ctxt+"\n");
        EnigmailCommon.dispatchEvent(this._terminateFunc, 0, [ this._terminateArg ]);
      }
    };

    return new requestObserver(terminateFunc, terminateArg);
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
  parseErrorOutput: function (errOutput, retStatusObj) {
    return EnigmailErrorHandling.parseErrorOutput(errOutput, retStatusObj);
  },

  /**
   * initialize this module
   */
  initialize: function (enigmailSvc)
  {
    this.enigmailSvc = enigmailSvc;
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
    Log.DEBUG("enigmailCommon.jsm: dispatchEvent f="+callbackFunction.name+"\n");

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
        Log.DEBUG("enigmailCommon.jsm: dispatchEvent running mainEvent\n");
        this.cbFunc(this.args);
      },

      notify: function()
      {
        Log.DEBUG("enigmailCommon.jsm: dispatchEvent got notified\n");
        this.cbFunc(this.args);
      }

    };

    var event = new mainEvent(callbackFunction, arrayOfArgs);
    if (sleepTimeMs > 0) {
      return Timer.setTimeout(event, sleepTimeMs);
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
    Log.DEBUG("enigmailCommon.jsm: rememberEncryptedUri: uri="+uri+"\n");
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
    Log.DEBUG("enigmailCommon.jsm: forgetEncryptedUri: uri="+uri+"\n");
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
    Log.DEBUG("enigmailCommon.jsm: isEncryptedUri: uri="+uri+"\n");
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
      if (! Prefs.getPref("noPassphrase")) {
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
      p = Prefs.getPref("agentAdditionalParam").replace(/\\\\/g, "\\");

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

  /**
   * Fix the exit code of GnuPG (which may be wrong in some circumstances)
   *
   * @exitCode:    Number - the exitCode obtained from GnuPG
   * @statusFlags: Numebr - the statusFlags as calculated by parseErrorOutput()
   *
   * @return: Number - fixed exit code
   */
  fixExitCode: function (exitCode, statusFlags) {
    if (exitCode !== 0) {
      if ((statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
          (statusFlags & nsIEnigmail.DECRYPTION_OKAY )) {
        Log.DEBUG("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode for decrypted msg "+exitCode+"->0\n");
        exitCode = 0;
      }
    }

    if ((this.enigmailSvc.agentType == "gpg") && (exitCode == 256) && (OS.getOS() == "WINNT")) {
      Log.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Using gpg and exit code is 256. You seem to use cygwin-gpg, activating countermeasures.\n");
      if (statusFlags & (nsIEnigmail.BAD_PASSPHRASE | nsIEnigmail.UNVERIFIED_SIGNATURE)) {
        Log.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->2\n");
        exitCode = 2;
      } else {
        Log.WARNING("enigmailCommon.jsm: Enigmail.fixExitCode: Changing exitCode 256->0\n");
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
    Log.WRITE("enigmailCommon.jsm: generateKey:\n");

    if (gKeygenProcess) {
      // key generation already ongoing
      throw Components.results.NS_ERROR_FAILURE;
    }

    var args = this.getAgentArgs(true);
    args.push("--gen-key");

    Log.CONSOLE(Files.formatCmdLine(this.enigmailSvc.agentPath, args));

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

    Log.CONSOLE(inputData+" \n");

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
            if (result.exitCode === 0) {
              self.enigmailSvc.invalidateUserIdList();
            }
            listener.onStopRequest(result.exitCode);
          }
          catch (ex) {}
        },
        mergeStderr: false
      });
    } catch (ex) {
      Log.ERROR("enigmailCommon.jsm: generateKey: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    gKeygenProcess = proc;

    Log.DEBUG("enigmailCommon.jsm: generateKey: subprocess = "+proc+"\n");

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
    Log.DEBUG("enigmailCommon.jsm: newStringChannel\n");

    var inputStream = Cc[NS_STRING_INPUT_STREAM_CONTRACTID].createInstance(Ci.nsIStringInputStream);
    inputStream.setData(data, -1);

    if (! contentCharset || contentCharset.length===0) {
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

    Log.DEBUG("enigmailCommon.jsm: newStringChannel - done\n");

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

    if (exitCodeObj.value !== 0) {
      this.aelrt(errorMsgObj.value);
      return null;
    }

    let groups = [];
    let cfg = cfgStr.split(/\n/);

    for (let i=0; i < cfg.length;i++) {
      if (cfg[i].indexOf("cfg:group") === 0) {
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
    if (Prefs.getPref("respectHttpProxy")) {
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
          var userObj = {};
          var passwdObj = {};
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
    var exitCodeObj = {};
    var statusFlagsObj = {};
    var errorMsgObj = {};

    if (refresh === null) refresh = false;
    var keyList=enigmailSvc.getUserIdList(true, refresh, exitCodeObj, statusFlagsObj, errorMsgObj);

    if (exitCodeObj.value !== 0 && keyList.length === 0) {
      Dialog.alert(win, errorMsgObj.value);
      return null;
    }

    var userList=keyList.split(/\n/);
    var secretKeyList = [];
    var secretKeyCreated = [];
    var i;

    var keyId = null;
    var keys = [];
    for (i=0; i < userList.length; i++) {
      if (userList[i].substr(0,4) == "sec:") {
        let aLine=userList[i].split(/:/);
        keyId = aLine[4];
        secretKeyCreated[keyId] = this.getDateTime(aLine[5], true, false);
        secretKeyList.push(keyId);
      }
    }

    keyList = enigmailSvc.getKeyDetails(secretKeyList.join(" "), false, false);
    userList=keyList.split(/\n/);

    for (i=0; i < userList.length; i++) {
      let aLine = userList[i].split(/:/);
      switch (aLine[0]) {
      case "pub":
        if (aLine[1].search(/[muf]/) === 0) keyId = aLine[4]; // public key is valid
        break;
      case "uid":
        if ((keyId !== null) && (aLine[1].search(/[muf]/) === 0)) {
          // UID is valid
          keys.push({ name: Data.convertGpgToUnicode(aLine[9]),
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
    Log.DEBUG("enigmailCommon.jsm: keyserverAccess: "+searchTerms+"\n");

    if (! (this.enigmailSvc && this.enigmailSvc.initialized)) {
      Log.ERROR("enigmailCommon.jsm: keyserverAccess: not yet initialized\n");
      errorMsgObj.value = Locale.getString("notInit");
      return null;
    }

    if (!keyserver) {
      errorMsgObj.value = Locale.getString("failNoServer");
      return null;
    }

    if (!searchTerms && ! (actionFlags & nsIEnigmail.REFRESH_KEY)) {
      errorMsgObj.value = Locale.getString("failNoID");
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

    Log.CONSOLE("enigmail> "+Files.formatCmdLine(this.enigmailSvc.agentPath, args)+"\n");

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
            if (result.exitCode === 0 && isDownload) {
              self.enigmailSvc.invalidateUserIdList();
            }
            if (exitCode === null) {
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
      Log.ERROR("enigmailCommon.jsm: keyserverAccess: subprocess.call failed with '"+ex.toString()+"'\n");
      throw ex;
    }

    if (!proc) {
      Log.ERROR("enigmailCommon.jsm: keyserverAccess: subprocess failed due to unknown reasons\n");
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
    Log.DEBUG("enigmailCommon.jsm: recalcTrustDb:\n");

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
      Log.ERROR("enigmailCommon.jsm: recalcTrustDb: subprocess.call failed with '"+ex.toString()+"'\n");
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

    if (! gpgVersion || typeof(gpgVersion) != "string" || gpgVersion.length === 0) {
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
      maxIdleMinutes = Prefs.getPref("maxIdleMinutes");
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
      Log.DEBUG("enigmailCommon.jsm:: Enigmail.extractPubkey: NO_PUBKEY 0x"+matchb[3]+"\n");
      keyId = matchb[2]+matchb[3];
    }

    return keyId;
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
                                 maxOutputLength) {
      return Decryption.decryptMessageStart(this, win, verifyOnly, noOutput, listener,
                                            statusFlagsObj, errorMsgObj, mimeSignatureFile,
                                            maxOutputLength);
  },


  decryptMessageEnd: function (stderrStr, exitCode, outputLen, verifyOnly, noOutput, uiFlags, retStatusObj) {
      return Decryption.decryptMessageEnd(this, stderrStr, exitCode, outputLen, verifyOnly, noOutput, uiFlags, retStatusObj);
  },


  getEncryptCommand: function (fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj) {
      return Encryption.getEncryptCommand(this, fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, isAscii, errorMsgObj);
  },

  determineHashAlgorithm: function (win, uiFlags, fromMailAddr, hashAlgoObj) {
    Log.DEBUG("enigmailCommon.jsm: determineHashAlgorithm\n");

    if (! win) {
      win = Windows.getMostRecentWindow();
    }

    this.getService(win);
    if (! (this.enigmailSvc)) {
      Log.ERROR("enigmailCommon.jsm: determineHashAlgorithm: not yet initialized\n");
      errorMsgObj.value = Locale.getString("notInit");
      return 2;
    }

    var sendFlags = nsIEnigmail.SEND_TEST | nsIEnigmail.SEND_SIGNED;

    var hashAlgo = gMimeHashAlgorithms[Prefs.getPref("mimeHashAlgorithm")];

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

      if ((exitCode === 0) && !msgText) exitCode = 1;
      // if (exitCode > 0) exitCode = -exitCode;

      if (exitCode !== 0) {
        // Abormal return
        if (retStatusObj.statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
          // "Unremember" passphrase on error return
          retStatusObj.errorMsg = Locale.getString("badPhrase");
        }
        Dialog.alert(win, retStatusObj.errorMsg);
        return exitCode;
      }

      var hashAlgorithm = "sha1"; // default as defined in RFC 4880, section 7 is MD5 -- but that's outdated

      var m = msgText.match(/^(Hash: )(.*)$/m);
      if (m && (m.length > 2) && (m[1] == "Hash: ")) {
        hashAlgorithm = m[2].toLowerCase();
      }
      else
        Log.DEBUG("enigmailCommon.jsm: determineHashAlgorithm: no hashAlgorithm specified - using MD5\n");

      for (var i=1; i < gMimeHashAlgorithms.length; i++) {
        if (gMimeHashAlgorithms[i] == hashAlgorithm) {
          Log.DEBUG("enigmailCommon.jsm: determineHashAlgorithm: found hashAlgorithm "+hashAlgorithm+"\n");
          gKeyAlgorithms[fromMailAddr] = hashAlgorithm;
          hashAlgoObj.value = hashAlgorithm;
          return 0;
        }
      }

      Log.ERROR("enigmailCommon.jsm: determineHashAlgorithm: no hashAlgorithm found\n");
      return 2;
    }
    else {
      Log.DEBUG("enigmailCommon.jsm: determineHashAlgorithm: hashAlgorithm "+gKeyAlgorithms[fromMailAddr]+" is cached\n");
      hashAlgoObj.value = gKeyAlgorithms[fromMailAddr];
    }

    return 0;
  },

  // returns subprocess object
  encryptMessageStart: function (win, uiFlags, fromMailAddr, toMailAddr, bccMailAddr,
            hashAlgorithm, sendFlags, listener, statusFlagsObj, errorMsgObj) {
      return Encryption.encryptMessageStart(this, win, uiFlags, fromMailAddr, toMailAddr, bccMailAddr, hashAlgorithm, sendFlags, listener, statusFlagsObj, errorMsgObj);
  },

  // returns exitCode
  encryptMessageEnd: function (stderrStr, exitCode, uiFlags, sendFlags, outputLen, retStatusObj) {
      return Encryption.encryptMessageEnd(this, stderrStr, exitCode, uiFlags, sendFlags, outputLen, retStatusObj);
  },




  getAttachmentFileName: function (parent, byteData) {
    Log.DEBUG("enigmailCommon.jsm: getAttachmentFileName\n");

    var args = this.getAgentArgs(true);
    args = args.concat(this.passwdCommand());
    args.push("--list-packets");


    var listener = Execution.newSimpleListener(
      function _stdin (pipe) {
          Log.DEBUG("enigmailCommon.jsm: getAttachmentFileName: _stdin\n");
          pipe.write(byteData);
          pipe.write("\n");
          pipe.close();
      });

    var statusFlagsObj = {};
    var proc = Execution.execStart(this.enigmailSvc.agentPath, args, false, parent,
                                   listener, statusFlagsObj);

    if (!proc) {
      return null;
    }

    proc.wait();

    var matches = listener.stdoutData.match(/:literal data packet:\r?\n.*name="(.*)",/m);
    if (matches && (matches.length > 1)) {
      var filename = escape(matches[1]).replace(/%5Cx/g, "%");
      return Data.convertToUnicode(unescape(filename), "utf-8");
    }
    else
      return null;
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
  }
};

App.initAddon();
