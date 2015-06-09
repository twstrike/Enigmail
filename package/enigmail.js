/*global Components: false, dump: false */
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
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@enigmail.net>
 * Janosch Rux <rux@informatik.uni-luebeck.de>
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
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/pipeConsole.jsm"); /*global EnigmailConsole: false */
Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/encryption.jsm"); /*global Encryption: false */
Cu.import("resource://enigmail/decryption.jsm"); /*global Decryption: false */
Cu.import("resource://enigmail/enigmailProtocolHandler.jsm"); /*global EnigmailProtocolHandler: false */
Cu.import("resource://enigmail/rules.jsm"); /*global Rules: false */
Cu.import("resource://enigmail/filters.jsm"); /*global Filters: false */
Cu.import("resource://enigmail/armor.jsm"); /*global Armor: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/os.jsm"); /*global OS: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/execution.jsm"); /*global Execution: false */
Cu.import("resource://enigmail/app.jsm"); /*global App: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/windows.jsm"); /*global Windows: false */
Cu.import("resource://enigmail/time.jsm"); /*global Time: false */
Cu.import("resource://enigmail/data.jsm"); /*global Data: false */
Cu.import("resource://enigmail/commonFuncs.jsm"); /*global EnigmailFuncs: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */
Cu.import("resource://enigmail/armor.jsm"); /*global Armor: false */
Cu.import("resource://enigmail/commandLine.jsm"); /*global CommandLine: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */

/* Implementations supplied by this module */
const NS_ENIGMAIL_CONTRACTID   = "@mozdev.org/enigmail/enigmail;1";

const NS_ENIGMAIL_CID =
  Components.ID("{847b3a01-7ab1-11d4-8f02-006008948af5}");

const ENIGMAIL_EXTENSION_ID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

// Contract IDs and CIDs used by this module
const NS_OBSERVERSERVICE_CONTRACTID = "@mozilla.org/observer-service;1";

const NS_IOSERVICE_CONTRACTID       = "@mozilla.org/network/io-service;1";
const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1";

const Cc = Components.classes;
const Ci = Components.interfaces;

// Interfaces
const nsISupports            = Ci.nsISupports;
const nsIObserver            = Ci.nsIObserver;
const nsIEnvironment         = Ci.nsIEnvironment;
const nsIEnigmail            = Ci.nsIEnigmail;

const NS_XPCOM_SHUTDOWN_OBSERVER_ID = "xpcom-shutdown";

var Ec = null;
var EC = EnigmailCore;

///////////////////////////////////////////////////////////////////////////////
// File read/write operations

const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const ENC_TYPE_ATTACH_BINARY = 1;
const ENC_TYPE_ATTACH_ASCII = 2;

var gKeyAlgorithms = [];

///////////////////////////////////////////////////////////////////////////////
// Enigmail encryption/decryption service
///////////////////////////////////////////////////////////////////////////////


function Enigmail() {
    Ec = EC.ensuredEnigmailCommon();
    EnigmailGpgAgent.setEnigmailCommon(Ec);
}

Enigmail.prototype = {
  classDescription: "Enigmail",
  classID:  NS_ENIGMAIL_CID,
  contractID: NS_ENIGMAIL_CONTRACTID,

  initialized: false,
  initializationAttempted: false,
  initializationError: "",

  userIdList: null,
  secretKeyList: null,

  _messageIdList: {},
  _xpcom_factory: {
    createInstance: function (aOuter, iid) {
        // Enigmail is a service -> only instanciate once
        return EC.ensuredEnigmailService(function() { return new Enigmail(); });
    },
    lockFactory: function (lock) {}
  },
  QueryInterface: XPCOMUtils.generateQI([ nsIEnigmail, nsIObserver, nsISupports ]),


  observe: function (aSubject, aTopic, aData) {
    Log.DEBUG("enigmail.js: Enigmail.observe: topic='"+aTopic+"' \n");

    if (aTopic == NS_XPCOM_SHUTDOWN_OBSERVER_ID) {
      // XPCOM shutdown
      this.finalize();

    }
    else {
      Log.DEBUG("enigmail.js: Enigmail.observe: no handler for '"+aTopic+"'\n");
    }
  },

  getLogDirectoryPrefix: function () {
    try {
      return Prefs.getPrefBranch().getCharPref("logDirectory") || "";
    } catch (ex) {
      return "";
    }
  },


  finalize: function () {
    Log.DEBUG("enigmail.js: Enigmail.finalize:\n");
    if (!this.initialized) return;

    EnigmailGpgAgent.finalize();
    Log.onShutdown();

    Log.setLogLevel(3);
    this.initializationError = "";
    this.initializationAttempted = false;
    this.initialized = false;
  },


  initialize: function (domWindow, version) {
    this.initializationAttempted = true;

    Log.DEBUG("enigmail.js: Enigmail.initialize: START\n");
    if (this.initialized) return;

    var ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);


    var prefix = this.getLogDirectoryPrefix();
    if (prefix) {
      Log.setLogLevel(5);
      Log.setLogDirectory(prefix);
      Log.DEBUG("enigmail.js: Logging debug output to "+prefix+"/enigdbug.txt\n");
    }

    Ec.initialize(this, Log.getLogLevel());

    var environment;
    try {
      environment = Cc["@mozilla.org/process/environment;1"].getService(nsIEnvironment);

    } catch (ex) {
      this.initializationError = Locale.getString("enigmimeNotAvail");
      Log.ERROR("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      Log.DEBUG("enigmail.js: Enigmail.initialize: exception="+ex.toString()+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    this.environment = environment;

    var nspr_log_modules = environment.get("NSPR_LOG_MODULES");
    var matches = nspr_log_modules.match(/enigmail.js:(\d+)/);

    if (matches && (matches.length > 1)) {
      Log.setLogLevel(Number(matches[1]));
      Log.WARNING("enigmail.js: Enigmail: LogLevel="+matches[1]+"\n");
    }

    subprocess.registerLogHandler(function(txt) { Log.ERROR("subprocess.jsm: "+txt); });

    matches = nspr_log_modules.match(/subprocess:(\d+)/);
    if (matches && (matches.length > 1)) {
      if (matches[1] > 2) subprocess.registerDebugHandler(function(txt) { Log.DEBUG("subprocess.jsm: "+txt); });
    }


    // Initialize global environment variables list
    var passEnv = [ "GNUPGHOME", "GPGDIR", "ETC",
                    "ALLUSERSPROFILE", "APPDATA", "BEGINLIBPATH",
                    "COMMONPROGRAMFILES", "COMSPEC", "DISPLAY",
                    "ENIGMAIL_PASS_ENV", "ENDLIBPATH",
                    "HOME", "HOMEDRIVE", "HOMEPATH",
                    "LANG", "LANGUAGE", "LC_ALL", "LC_COLLATE",  "LC_CTYPE",
                    "LC_MESSAGES",  "LC_MONETARY", "LC_NUMERIC", "LC_TIME",
                    "LOCPATH", "LOGNAME", "LD_LIBRARY_PATH", "MOZILLA_FIVE_HOME",
                    "NLSPATH", "PATH", "PATHEXT", "PROGRAMFILES", "PWD",
                    "SHELL", "SYSTEMDRIVE", "SYSTEMROOT",
                    "TEMP", "TMP", "TMPDIR", "TZ", "TZDIR", "UNIXROOT",
                    "USER", "USERPROFILE", "WINDIR", "XAUTHORITY" ];

    var passList = this.environment.get("ENIGMAIL_PASS_ENV");
    if (passList) {
      var passNames = passList.split(":");
      for (var k=0; k<passNames.length; k++)
        passEnv.push(passNames[k]);
    }

    EnigmailCore.initEnvList();
    for (var j=0; j<passEnv.length; j++) {
      var envName = passEnv[j];
      var envValue = this.environment.get(envName);
      if (envValue) {
          EnigmailCore.addToEnvList(envName+"="+envValue);
      }
    }

    Log.DEBUG("enigmail.js: Enigmail.initialize: Ec.envList = "+EnigmailCore.getEnvList()+"\n");

    try {
      EnigmailConsole.write("Initializing Enigmail service ...\n");

    } catch (ex) {
      this.initializationError = Locale.getString("enigmimeNotAvail");
      Log.ERROR("enigmail.js: Enigmail.initialize: Error - "+this.initializationError+"\n");
      Log.DEBUG("enigmail.js: Enigmail.initialize: exception="+ex.toString()+"\n");
      throw Components.results.NS_ERROR_FAILURE;
    }

    EnigmailGpgAgent.setAgentPath(domWindow, this);
    EnigmailGpgAgent.detectGpgAgent(domWindow, this);

    if (EnigmailGpgAgent.useGpgAgent() && (! OS.isDosLike())) {
      if (!EnigmailGpgAgent.isDummy()) {
          EnigmailCore.addToEnvList("GPG_AGENT_INFO="+EnigmailGpgAgent.gpgAgentInfo.envStr);
      }
    }


    // Register to observe XPCOM shutdown
    var obsServ = Cc[NS_OBSERVERSERVICE_CONTRACTID].getService();
    obsServ = obsServ.QueryInterface(Ci.nsIObserverService);

    obsServ.addObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);

    this.initialized = true;

    Log.DEBUG("enigmail.js: Enigmail.initialize: END\n");
  },

  reinitialize: function () {
    this.initialized = false;
    this.initializationAttempted = true;

    EnigmailConsole.write("Reinitializing Enigmail service ...\n");
    EnigmailGpgAgent.setAgentPath(null, this);
    this.initialized = true;
  },

  encryptMessage: function (parent, uiFlags, plainText, fromMailAddr, toMailAddr, bccMailAddr, sendFlags,
                            exitCodeObj, statusFlagsObj, errorMsgObj) {
      return Encryption.encryptMessage(this, Ec, parent, uiFlags, plainText, fromMailAddr, toMailAddr, bccMailAddr, sendFlags, exitCodeObj, statusFlagsObj, errorMsgObj);
  },

  locateArmoredBlock: function (text, offset, indentStr, beginIndexObj, endIndexObj, indentStrObj) {
      return Armor.locateArmoredBlock(text, offset, indentStr, beginIndexObj, endIndexObj, indentStrObj);
  },

  locateArmoredBlocks: function(text) {
      return Armor.locateArmoredBlocks(text);
  },

  extractSignaturePart: function (signatureBlock, part) {
      return Armor.extractSignaturePart(signatureBlock, part);
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
      return Decryption.decryptMessage(parent, uiFlags, cipherText,
                                       signatureObj, exitCodeObj,
                                       statusFlagsObj, keyIdObj, userIdObj, sigDetailsObj, errorMsgObj,
                                       blockSeparationObj, encToDetailsObj);
  },

  extractKey: function (parent, exportFlags, userId, outputFile, exitCodeObj, errorMsgObj) {
    // TODO: move [keys]
    Log.DEBUG("enigmail.js: Enigmail.extractKey: "+userId+"\n");

    if (!this.initialized) {
      Log.ERROR("enigmail.js: Enigmail.extractKey: not yet initialized\n");
      errorMsgObj.value = Locale.getString("notInit");
      return "";
    }

    var uidList=userId.split(/[ ,\t]+/);

    var args = Gpg.getStandardArgs(true);
    args = args.concat(["-a", "--export"]);
    args = args.concat(uidList);

    var statusFlagsObj = {};
    var statusMsgObj   = {};
    var cmdErrorMsgObj = {};

    var keyBlock = Execution.execCmd(EnigmailGpgAgent.agentPath, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if ((exitCodeObj.value === 0) && !keyBlock)
      exitCodeObj.value = -1;

    if (exitCodeObj.value !== 0) {
      errorMsgObj.value = Locale.getString("failKeyExtract");

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + Files.formatCmdLine(EnigmailGpgAgent.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }

      return "";
    }

    if (exportFlags & nsIEnigmail.EXTRACT_SECRET_KEY) {
      args = Gpg.getStandardArgs(true);
      args = args.concat(["-a", "--export-secret-keys"]);
      args = args.concat(uidList);

      var secKeyBlock = Execution.execCmd(EnigmailGpgAgent.agentPath, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

      if ((exitCodeObj.value === 0) && !secKeyBlock)
        exitCodeObj.value = -1;

      if (exitCodeObj.value !== 0) {
        errorMsgObj.value = Locale.getString("failKeyExtract");

        if (cmdErrorMsgObj.value) {
          errorMsgObj.value += "\n" + Files.formatCmdLine(EnigmailGpgAgent.agentPath, args);
          errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
        }

        return "";
      }

      if (keyBlock.substr(-1,1).search(/[\r\n]/)<0) keyBlock += "\n";
      keyBlock+=secKeyBlock;
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
    // TODO: move [keys]
    Log.DEBUG("enigmail.js: Enigmail.importKey: id="+keyId+", "+uiFlags+"\n");

    if (!this.initialized) {
      Log.ERROR("enigmail.js: Enigmail.importKey: not yet initialized\n");
      errorMsgObj.value = Locale.getString("notInit");
      return 1;
    }

    var beginIndexObj = {};
    var endIndexObj   = {};
    var indentStrObj   = {};
    var blockType = Armor.locateArmoredBlock(msgText, 0, "", beginIndexObj, endIndexObj, indentStrObj);
    if (!blockType) {
      errorMsgObj.value = Locale.getString("noPGPblock");
      return 1;
    }

    if (blockType != "PUBLIC KEY BLOCK") {
      errorMsgObj.value = Locale.getString("notFirstBlock");
      return 1;
    }

    var pgpBlock = msgText.substr(beginIndexObj.value,
                                  endIndexObj.value - beginIndexObj.value + 1);

    var interactive = uiFlags & nsIEnigmail.UI_INTERACTIVE;

    if (interactive) {
      if (!Dialog.confirmDlg(parent, Locale.getString("importKeyConfirm"), Locale.getString("keyMan.button.import"))) {
        errorMsgObj.value = Locale.getString("failCancel");
        return -1;
      }
    }

    var args = Gpg.getStandardArgs(true);
    args.push("--import");

    var exitCodeObj    = {};
    var statusFlagsObj = {};
    var statusMsgObj   = {};

    var output = Execution.execCmd(EnigmailGpgAgent.agentPath, args, pgpBlock, exitCodeObj, statusFlagsObj, statusMsgObj, errorMsgObj);

    var statusMsg = statusMsgObj.value;

    var pubKeyId;

    if (exitCodeObj.value === 0) {
      // Normal return
      this.invalidateUserIdList();
      if (statusMsg && (statusMsg.search("IMPORTED ") > -1)) {
        var matches = statusMsg.match(/(^|\n)IMPORTED (\w{8})(\w{8})/);

        if (matches && (matches.length > 3)) {
          pubKeyId = "0x" + matches[3];
          Log.DEBUG("enigmail.js: Enigmail.importKey: IMPORTED "+pubKeyId+"\n");
        }
      }
    }

    return exitCodeObj.value;
  },

  importKeyFromFile: function (parent, inputFile, errorMsgObj, importedKeysObj) {
    return KeyRing.importKeyFromFile(parent,inputFile,errorMsgObj,importedKeysObj);
  },

  createMessageURI: function (originalUrl, contentType, contentCharset, contentData, persist) {
    Log.DEBUG("enigmail.js: Enigmail.createMessageURI: "+originalUrl+
              ", "+contentType+", "+contentCharset+"\n");

    var messageId = "msg" + Math.floor(Math.random()*1.0e9);

    this._messageIdList[messageId] = {originalUrl:originalUrl,
                                      contentType:contentType,
                                      contentCharset:contentCharset,
                                      contentData:contentData,
                                      persist:persist};

    return "enigmail:message/"+messageId;
  },

  deleteMessageURI: function (uri) {
    Log.DEBUG("enigmail.js: Enigmail.deleteMessageURI: "+uri+"\n");

      var messageId = Data.extractMessageId(uri);

    if (!messageId)
      return false;

    return (delete this._messageIdList[messageId]);
  },

  invalidateUserIdList: function () {
    // TODO: move [uids]
    // clean the userIdList to force reloading the list at next usage
    Log.DEBUG("enigmail.js: Enigmail.invalidateUserIdList\n");
    this.userIdList = null;
    this.secretKeyList = null;
  },

  // returns the output of --with-colons --list[-secret]-keys
  getUserIdList: function  (secretOnly, refresh, exitCodeObj, statusFlagsObj, errorMsgObj) {
    // TODO: move [uids]

    if (refresh ||
        (secretOnly && this.secretKeyList === null) ||
        ((! secretOnly) && this.userIdList === null)) {
      var args = Gpg.getStandardArgs(true);

      if (secretOnly) {
        args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-secret-keys"]);
      }
      else {
        args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-keys"]);
      }

      if (!this.initialized) {
        Log.ERROR("enigmail.js: Enigmail.getUserIdList: not yet initialized\n");
        errorMsgObj.value = Locale.getString("notInit");
        return "";
      }

      statusFlagsObj.value = 0;

      var statusMsgObj   = {};
      var cmdErrorMsgObj = {};

      var listText = Execution.execCmd(EnigmailGpgAgent.agentPath, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

      if (! (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
        // ignore exit code as recommended by GnuPG authors
        exitCodeObj.value = 0;
      }

      if (exitCodeObj.value !== 0) {
        errorMsgObj.value = Locale.getString("badCommand");
        if (cmdErrorMsgObj.value) {
          errorMsgObj.value += "\n" + Files.formatCmdLine(EnigmailGpgAgent.agentPath, args);
          errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
        }

        return "";
      }

      listText=listText.replace(/(\r\n|\r)/g, "\n");
      if (secretOnly) {
        this.secretKeyList = listText;
        return listText;
      }
      this.userIdList = listText;
    }
    else {
      exitCodeObj.value=0;
      statusFlagsObj.value=0;
      errorMsgObj.value="";
    }

    if (secretOnly) {
      return this.secretKeyList;
    }

    return this.userIdList;
  },

  // returns the output of --with-colons --list-sig
  getKeySig: function  (keyId, exitCodeObj, errorMsgObj) {
    // TODO: move [keys]

    var keyIdList = keyId.split(" ");
    var args = Gpg.getStandardArgs(true);
    args=args.concat(["--with-fingerprint", "--fixed-list-mode", "--with-colons", "--list-sig"]);
    args=args.concat(keyIdList);

    if (!this.initialized) {
      Log.ERROR("enigmail.js: Enigmail.getKeySig: not yet initialized\n");
      errorMsgObj.value = Locale.getString("notInit");
      return "";
    }

    var statusFlagsObj = {};
    var statusMsgObj   = {};
    var cmdErrorMsgObj = {};

    var listText = Execution.execCmd(EnigmailGpgAgent.agentPath, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (! (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
      // ignore exit code as recommended by GnuPG authors
      exitCodeObj.value = 0;
    }

    if (exitCodeObj.value !== 0) {
      errorMsgObj.value = Locale.getString("badCommand");
      if (cmdErrorMsgObj.value) {
        errorMsgObj.value += "\n" + Files.formatCmdLine(EnigmailGpgAgent.agentPath, args);
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
  getKeyDetails: function (keyId, uidOnly, withUserAttributes)
  {
    // TODO: move [keys]
    var args = Gpg.getStandardArgs(true);
    var keyIdList = keyId.split(" ");
    args=args.concat([ "--fixed-list-mode", "--with-fingerprint", "--with-colons", "--list-keys"]);
    args=args.concat(keyIdList);

    var statusMsgObj   = {};
    var cmdErrorMsgObj = {};
    var statusFlagsObj = {};
    var exitCodeObj = {};

    var listText = Execution.execCmd(EnigmailGpgAgent.agentPath, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (! (statusFlagsObj.value & nsIEnigmail.BAD_SIGNATURE)) {
      // ignore exit code as recommended by GnuPG authors
      exitCodeObj.value = 0;
    }

    if (exitCodeObj.value !== 0) {
      return "";
    }
    listText=listText.replace(/(\r\n|\r)/g, "\n");

    const TRUSTLEVELS_SORTED = EnigmailFuncs.trustlevelsSorted();
    var maxTrustLevel = -1;

    if (uidOnly) {
      var userList="";
      var hideInvalidUid=true;
      var lineArr=listText.split(/\n/);
      for (var i=0; i<lineArr.length; i++) {
        // process lines such as:
        //  tru::1:1395895453:1442881280:3:1:5
        //  pub:f:4096:1:C1B875ED336XX959:2299509307:1546189300::f:::scaESCA:
        //  fpr:::::::::102A1C8CC524A966849C33D7C8B157EA336XX959:
        //  uid:f::::1388511201::67D5B96DC564598D4D4D9E0E89F5B83C9931A154::Joe Fox <joe@fox.com>:
        //  sig:::1:C8B157EA336XX959:2299509307::::Joe Fox <joe@fox.com>:13x:::::2:
        //  sub:e:2048:1:B214734F0F5C7041:1316219469:1199912694:::::e:
        //  sub:f:2048:1:70E7A471DABE08B0:1316221524:1546189300:::::s:
        var lineTokens = lineArr[i].split(/:/);
        switch (lineTokens[0]) {
          case "pub":
            if (EnigmailFuncs.isInvalid(lineTokens[1])) {
              // pub key not valid (anymore)-> display all UID's
              hideInvalidUid = false;
            }
            break;
          case "uid":
            if (uidOnly && hideInvalidUid) {
              var thisTrust = TRUSTLEVELS_SORTED.indexOf(lineTokens[1]);
              if (thisTrust > maxTrustLevel) {
                userList = lineTokens[9] + "\n";
                maxTrustLevel = thisTrust;
              }
              else if (thisTrust == maxTrustLevel) {
                userList += lineTokens[9] + "\n";
              }
              // else do not add uid
            }
            else if (!EnigmailFuncs.isInvalid(lineTokens[1]) || !hideInvalidUid) {
              // UID valid  OR  key not valid, but invalid keys allowed
              userList += lineTokens[9] + "\n";
            }
            break;
          case "uat":
            if (withUserAttributes) {
              if (!EnigmailFuncs.isInvalid(lineTokens[1]) || !hideInvalidUid) {
                // IF  UID valid  OR  key not valid and invalid keys allowed
                userList += "uat:jpegPhoto:" + lineTokens[4] + "\n";
              }
            }
            break;
        }
      }
      return userList.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n\n+/g, "\n");
    }

    return listText;
  },


  /**
   * Return string with all colon-separated data of key list entry of given key.
   * - key may be pub or sub key.
   *
   * @param  String  keyId of 8 or 16 chars key with optionally leading 0x
   * @return String  entry of first found user IDs with keyId or null if none
   */
  getKeyListEntryOfKey: function (keyId)
  {
    // TODO: move [keys]
    //Log.DEBUG("enigmail.js: Enigmail.getKeyListEntryOfKey() keyId='"+ keyId +"'\n");
    keyId = keyId.replace(/^0x/, "");

    let statusFlags = {};
    let errorMsg = {};
    let exitCodeObj = {};
    let listText = this.getUserIdList(false, false, exitCodeObj, statusFlags, errorMsg);
    //Log.DEBUG("enigmail.js: Enigmail.getKeyListEntryOfKey(): listText "+ listText +"\n");

    // listeText contains lines such as:
    // tru::0:1407688184:1424970931:3:1:5
    // pub:f:1024:17:D581C6F8EBB80E50:1107251639:::-:::scESC:
    // fpr:::::::::492A198AEA5EBE5574A1CE00D581C6F8EBB80E50:
    // uid:f::::1107251639::2D505D1F6E744365B3B35FF11F32A19779E3A417::Giosue Vitaglione <gvi@whitestein.com>:
    // sub:f:2048:16:2223D7E0301A66C6:1107251647::::::e:

    // search for key or subkey
    let regexKey = new RegExp("^(pub|sub):[^:]*:[^:]*:[^:]*:[A-Fa-f0-9]*" + keyId + ":", "m");
    let foundPos = listText.search(regexKey);
    //Log.DEBUG("enigmail.js: Enigmail.getKeyListEntryOfKey(): foundPos="+ foundPos +"\n");
    if (foundPos < 0) {
      return null;
    }

    // find area of key entries in key list
    // note: if subkey matches, key entry starts before
    let regexPub = new RegExp("^pub:", "ym");
    let startPos = -1;
    if (listText[foundPos] == "p") {  // ^pub:
      // KEY matches
      startPos = foundPos;
    }
    else {
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
    let endPos = -1;
    let match = regexPub.exec(listText.substr(startPos+1));
    if (match && match.index) {
      endPos = startPos+1 + match.index;
    }
    else {
      endPos = listText.length;
    }
    return listText.substring(startPos, endPos);
  },


  /**
   * Return first found userId of given key.
   * - key may be pub or sub key.
   * @param  String  keyId key with leading 0x
   * @return String  First found of user IDs or null if none
   */
  getFirstUserIdOfKey: function (keyId)
  {
    // TODO: move [keys]
    Log.DEBUG("enigmail.js: Enigmail.getFirstUserIdOfKey() keyId='"+ keyId +"'\n");

    var entry = this.getKeyListEntryOfKey(keyId);
    if (entry === null) {
      return null;
    }

    var lineArr = entry.split(/\n/);
    //Log.DEBUG("enigmail.js: Enigmail.getFirstUserIdOfKey(): lineArr: "+ lineArr +"\n");
    for (let i=0; i<lineArr.length; ++i) {
      var lineTokens = lineArr[i].split(/:/);
      switch (lineTokens[0]) {
        case "uid":
          {
            let userId = lineTokens[9];
            return userId;
          }
          break;
      }
    }
    return null;
  },


  /**
   * return key ID of public key for subkey
   *
   * @param  String  keyId key with or without leading 0x
   * @return String  public key ID, or null if key not found
   */
  getPubKeyIdForSubkey: function (keyId) {
    // TODO: move [keys]
    var entry = this.getKeyListEntryOfKey(keyId);
    if (entry === null) {
      return null;
    }

    var lineArr = entry.split(/\n/);
    for (let i=0; i<lineArr.length; ++i) {
      var lineTokens = lineArr[i].split(/:/);
      switch (lineTokens[0]) {
        case "pub":
          {
            return lineTokens[4];
          }
          break;
      }
    }
    return null;
  },



  encryptAttachment: function (parent, fromMailAddr, toMailAddr, bccMailAddr, sendFlags, inFile, outFile,
            exitCodeObj, statusFlagsObj, errorMsgObj) {
    // TODO: move [encryption]
    Log.DEBUG("enigmail.js: Enigmail.encryptAttachment infileName="+inFile.path+"\n");

    if (!this.initialized) {
      Log.ERROR("enigmail.js: Enigmail.encryptAttachment: not yet initialized\n");
      errorMsgObj.value = Locale.getString("notInit");
      return "";
    }

    statusFlagsObj.value = 0;
    sendFlags |= nsIEnigmail.SEND_ATTACHMENT;

    var asciiArmor = false;
    try {
      asciiArmor = Prefs.getPrefBranch().getBoolPref("inlineAttachAsciiArmor");
    } catch (ex) {}
    var asciiFlags = (asciiArmor ? ENC_TYPE_ATTACH_ASCII : ENC_TYPE_ATTACH_BINARY);

    var args = Encryption.getEncryptCommand(fromMailAddr, toMailAddr, bccMailAddr, "", sendFlags, asciiFlags, errorMsgObj);

    if (! args)
        return null;

    var signMessage = (sendFlags & nsIEnigmail.SEND_SIGNED);

    if (signMessage ) {
      args = args.concat(Ec.passwdCommand());
    }

      var inFilePath  = Files.getEscapedFilename(Files.getFilePathReadonly(inFile.QueryInterface(Ci.nsIFile)));
    var outFilePath = Files.getEscapedFilename(Files.getFilePathReadonly(outFile.QueryInterface(Ci.nsIFile)));

    args = args.concat(["--yes", "-o", outFilePath, inFilePath ]);

    var statusMsgObj   = {};
    var cmdErrorMsgObj = {};

    var msg = Execution.execCmd(EnigmailGpgAgent.agentPath, args, "", exitCodeObj, statusFlagsObj, statusMsgObj, cmdErrorMsgObj);

    if (exitCodeObj.value !== 0) {

      if (cmdErrorMsgObj.value) {
        errorMsgObj.value = Files.formatCmdLine(EnigmailGpgAgent.agentPath, args);
        errorMsgObj.value += "\n" + cmdErrorMsgObj.value;
      }
      else {
        errorMsgObj.value = "An unknown error has occurred";
      }

      return "";
    }

    return msg;
  },


  verifyAttachment: function (parent, verifyFile, sigFile,
                              statusFlagsObj, errorMsgObj) {
    // TODO: move [verification]
    Log.DEBUG("enigmail.js: Enigmail.verifyAttachment:\n");

    var exitCode        = -1;
    var verifyFilePath  = Files.getEscapedFilename(Files.getFilePathReadonly(verifyFile.QueryInterface(Ci.nsIFile)));
    var sigFilePath     = Files.getEscapedFilename(Files.getFilePathReadonly(sigFile.QueryInterface(Ci.nsIFile)));

    var args = Gpg.getStandardArgs(true);
    args.push("--verify");
    args.push(sigFilePath);
    args.push(verifyFilePath);

    var listener = Execution.newSimpleListener();

    var proc = Execution.execStart(EnigmailGpgAgent.agentPath, args, false, parent,
                                   listener, statusFlagsObj);

    if (!proc) {
      return -1;
    }
    proc.wait();

    var retObj = {};

    Decryption.decryptMessageEnd (listener.stderrData, listener.exitCode, 1, true, true, nsIEnigmail.UI_INTERACTIVE, retObj);

    if (listener.exitCode === 0) {
      var detailArr = retObj.sigDetails.split(/ /);
      var dateTime = Time.getDateTime(detailArr[2], true, true);
      var msg1 = retObj.errorMsg.split(/\n/)[0];

      var msg2 = Locale.getString("keyAndSigDate", ["0x"+retObj.keyId.substr(-8, 8), dateTime ]);
      errorMsgObj.value = msg1 + "\n" + msg2;
    }
    else {
      errorMsgObj.value = retObj.errorMsg;
    }

    return listener.exitCode;
  },


  decryptAttachment: function (parent, outFile, displayName, byteData, exitCodeObj, statusFlagsObj, errorMsgObj) {
      return Decryption.decryptAttachment(parent, outFile, displayName, byteData, exitCodeObj, statusFlagsObj, errorMsgObj);
  },

  showKeyPhoto: function(keyId, photoNumber, exitCodeObj, errorMsgObj) {
    // TODO: move [keys]
    Log.DEBUG("enigmail.js: Enigmail.showKeyPhoto, keyId="+keyId+" photoNumber="+photoNumber+"\n");

    var args = Gpg.getStandardArgs();
    args = args.concat(["--no-secmem-warning", "--no-verbose", "--no-auto-check-trustdb", "--batch", "--no-tty", "--status-fd", "1", "--attribute-fd", "2" ]);
    args = args.concat(["--fixed-list-mode", "--list-keys", keyId]);

    var photoDataObj = {};

    var outputTxt = Execution.simpleExecCmd(EnigmailGpgAgent.agentPath, args, exitCodeObj, photoDataObj);

    if (!outputTxt) {
      exitCodeObj.value = -1;
      return "";
    }

    if (OS.isDosLike() && Gpg.getGpgFeature("windows-photoid-bug")) {
      // workaround for error in gpg
      photoDataObj.value=photoDataObj.value.replace(/\r\n/g, "\n");
    }

  // [GNUPG:] ATTRIBUTE A053069284158FC1E6770BDB57C9EB602B0717E2 2985
    var foundPicture = -1;
    var skipData = 0;
    var imgSize = -1;
    var statusLines = outputTxt.split(/[\n\r+]/);

    for (var i=0; i < statusLines.length; i++) {
      var matches = statusLines[i].match(/\[GNUPG:\] ATTRIBUTE ([A-F\d]+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)/);
      if (matches && matches[3]=="1") {
        // attribute is an image
        ++foundPicture;
        if (foundPicture == photoNumber) {
          imgSize = Number(matches[2]);
          break;
        }
        else {
          skipData += Number(matches[2]);
        }
      }
    }

    if (foundPicture>=0 && foundPicture == photoNumber) {
      var pictureData = photoDataObj.value.substr(16+skipData, imgSize);
      if (! pictureData.length)
        return "";
      try {
        var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

        var ds = Cc[DIR_SERV_CONTRACTID].getService();
        var dsprops = ds.QueryInterface(Ci.nsIProperties);
        var picFile = dsprops.get("TmpD", Ci.nsIFile);

        picFile.append(keyId+".jpg");
        picFile.createUnique(picFile.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);

        var fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
        fileStream.init(picFile, flags, DEFAULT_FILE_PERMS, 0);
        if (fileStream.write(pictureData, pictureData.length) != pictureData.length)
            throw Components.results.NS_ERROR_FAILURE;

        fileStream.flush();
        fileStream.close();
        return picFile.path;

      }
      catch (ex) {
        exitCodeObj.value = -1;
        return "";
      }
    }
    return "";
  },


  // Methods for handling Per-Recipient Rules

  getRulesFile: function () {
      return Rules.getRulesFile();
  },

  loadRulesFile: function () {
      return Rules.loadRulesFile();
  },

  saveRulesFile: function () {
      return Rules.saveRulesFile();
  },

  getRulesData: function (rulesListObj) {
      return Rules.getRulesData(rulesListObj);
  },

  addRule: function (appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags) {
      return Rules.addRule(appendToEnd, toAddress, keyList, sign, encrypt, pgpMime, flags);
  },

  clearRules: function () {
      return Rules.clearRules();
  }
}; // Enigmail.protoypte

// This variable is exported implicitly and should not be refactored or removed
const NSGetFactory = XPCOMUtils.generateNSGetFactory([Enigmail, EnigmailProtocolHandler, CommandLine.Handler]);

Filters.registerAll();

dump("enigmail.js: Registered components\n");
