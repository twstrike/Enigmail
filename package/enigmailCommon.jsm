/*global Components: false, escape: false, unescape: false */
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

"use strict";

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm"); /*global XPCOMUtils: false */
Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/enigmailErrorHandling.jsm"); /*global EnigmailErrorHandling: false */
Cu.import("resource://enigmail/encryption.jsm"); /*global Encryption: false */
Cu.import("resource://enigmail/decryption.jsm"); /*global Decryption: false */
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */
Cu.import("resource://enigmail/os.jsm"); /*global OS: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/data.jsm"); /*global Data: false */
Cu.import("resource://enigmail/execution.jsm"); /*global Execution: false */
Cu.import("resource://enigmail/app.jsm"); /*global App: false */
Cu.import("resource://enigmail/timer.jsm"); /*global Timer: false */
Cu.import("resource://enigmail/time.jsm"); /*global Time: false */
Cu.import("resource://enigmail/windows.jsm"); /*global Windows: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/configure.jsm"); /*global Configure: false */
Cu.import("resource://enigmail/httpProxy.jsm"); /*global HttpProxy: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */

const EXPORTED_SYMBOLS = [ "EnigmailCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const ENIGMAIL_CONTRACTID = "@mozdev.org/enigmail/enigmail;1";

const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

var gEncryptedUris = [];

var gKeyAlgorithms = [];

const gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5" ];

// various global variables
var gKeygenProcess = null;

const EnigmailCommon = {
  POSSIBLE_PGPMIME: -2081,

  IOSERVICE_CONTRACTID: "@mozilla.org/network/io-service;1",
  LOCAL_FILE_CONTRACTID: "@mozilla.org/file/local;1",
  MIME_CONTRACTID: "@mozilla.org/mime;1",

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
      this.enigmailSvc = Cc[ENIGMAIL_CONTRACTID].createInstance(Ci.nsIEnigmail);
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
        this.enigmailSvc.initialize(win, App.getVersion());

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
          EnigmailGpgAgent.agentType === "pgp") {
        Dialog.alert(win, Locale.getString("pgpNotSupported"));
      }

      if (this.enigmailSvc.initialized && (App.getVersion() != configuredVersion)) {
        Configure.configureEnigmail(win, startingPreferences);
      }
    }

    return this.enigmailSvc.initialized ? this.enigmailSvc : null;
  },


  /**
   * initialize this module
   */
  initialize: function (enigmailSvc) {
    this.enigmailSvc = enigmailSvc;
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

    if (EnigmailGpgAgent.useGpgAgent()) {
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
    // TODO: move [keys]
    Log.WRITE("enigmailCommon.jsm: generateKey:\n");

    if (gKeygenProcess) {
      // key generation already ongoing
      throw Components.results.NS_ERROR_FAILURE;
    }

    var args = Gpg.getStandardArgs(true);
    args.push("--gen-key");

    Log.CONSOLE(Files.formatCmdLine(EnigmailGpgAgent.agentPath, args));

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
        command:     EnigmailGpgAgent.agentPath,
        arguments:   args,
        environment: EnigmailCore.getEnvList(),
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
              KeyRing.invalidateUserIdList();
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
    return Cc[this.IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
  },

  /**
   * Get a list of all secret keys
   *
   *  win:     nsIWindow: optional parent window
   *  refresh: Boolean:   optional. true ->  re-load keys from gpg
   *                                false -> use cached values if available
   */
  getSecretKeys: function (win, refresh) {
    // TODO: move [keys]
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
    var keyList=KeyRing.getUserIdList(true, refresh, exitCodeObj, statusFlagsObj, errorMsgObj);

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
        secretKeyCreated[keyId] = Time.getDateTime(aLine[5], true, false);
        secretKeyList.push(keyId);
      }
    }

    keyList = KeyRing.getKeyDetails(secretKeyList.join(" "), false, false);
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
    // TODO: move [keyservers]
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

    var proxyHost = HttpProxy.getHttpProxy(keyserver);
    var args = Gpg.getStandardArgs(true);

    if (actionFlags & nsIEnigmail.SEARCH_KEY) {
      args = Gpg.getStandardArgs(false);
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

    Log.CONSOLE("enigmail> "+Files.formatCmdLine(EnigmailGpgAgent.agentPath, args)+"\n");

    var proc = null;
    var self = this;

    var exitCode = null;

    try {
      proc = subprocess.call({
        command:     EnigmailGpgAgent.agentPath,
        arguments:   args,
        environment: EnigmailCore.getEnvList(),
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
              KeyRing.invalidateUserIdList();
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
    // TODO: move [keys]
    var keyId = null;
    var matchb = statusMsg.match(/(^|\n)NO_PUBKEY (\w{8})(\w{8})/);

    if (matchb && (matchb.length > 3)) {
      Log.DEBUG("enigmailCommon.jsm:: Enigmail.extractPubkey: NO_PUBKEY 0x"+matchb[3]+"\n");
      keyId = matchb[2]+matchb[3];
    }

    return keyId;
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
      var proc = Encryption.encryptMessageStart(win, testUiFlags, fromMailAddr, "",
                                                "", hashAlgo, sendFlags,
                                                listener, statusFlagsObj, errorMsgObj);

      if (!proc) {
        return 1;
      }

      proc.wait();

      var msgText = listener.stdoutData;
      var exitCode = listener.exitCode;

      var retStatusObj = {};
      exitCode = Encryption.encryptMessageEnd(listener.stderrData, exitCode,
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

  getAttachmentFileName: function (parent, byteData) {
    Log.DEBUG("enigmailCommon.jsm: getAttachmentFileName\n");

    var args = Gpg.getStandardArgs(true);
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
    var proc = Execution.execStart(EnigmailGpgAgent.agentPath, args, false, parent,
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
