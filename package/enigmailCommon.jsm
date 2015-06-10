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

Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/encryption.jsm"); /*global Encryption: false */
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/data.jsm"); /*global Data: false */
Cu.import("resource://enigmail/execution.jsm"); /*global Execution: false */
Cu.import("resource://enigmail/app.jsm"); /*global App: false */
Cu.import("resource://enigmail/windows.jsm"); /*global Windows: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/configure.jsm"); /*global Configure: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/passwords.jsm"); /*global Passwords: false */

const EXPORTED_SYMBOLS = [ "EnigmailCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const ENIGMAIL_CONTRACTID = "@mozdev.org/enigmail/enigmail;1";

const gKeyAlgorithms = [];

const gMimeHashAlgorithms = [null, "sha1", "ripemd160", "sha256", "sha384", "sha512", "sha224", "md5" ];

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

  /**
   * get nsIIOService object
   */
  getIoService: function() {
    return Cc[this.IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
  },

  getLocalFileApi: function () {
    return Ci.nsIFile;
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
  }
};

App.initAddon();
