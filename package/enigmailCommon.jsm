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
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/app.jsm"); /*global App: false */
Cu.import("resource://enigmail/windows.jsm"); /*global Windows: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/configure.jsm"); /*global Configure: false */
Cu.import("resource://enigmail/enigmailGpgAgent.jsm"); /*global EnigmailGpgAgent: false */

const EXPORTED_SYMBOLS = [ "EnigmailCommon" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const EnigmailCommon = {
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
            this.enigmailSvc = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
        } catch (ex) {
            Log.ERROR("enigmailCommon.jsm: Error in instantiating EnigmailService: "+ex+"\n");
            return null;
        }

        if (! win) {
            win = Windows.getBestParentWin();
        }

        Log.DEBUG("enigmailCommon.jsm: this.enigmailSvc = "+this.enigmailSvc+"\n");

        if (!this.enigmailSvc.initialized) {
            // Initialize enigmail

            const firstInitialization = !this.enigmailSvc.initializationAttempted;

            try {
                // Initialize enigmail
                EnigmailCore.init(App.getVersion());
                this.enigmailSvc.initialize(win, App.getVersion());

                try {
                    // Reset alert count to default value
                    Prefs.getPrefBranch().clearUserPref("initAlert");
                } catch(ex) { }

            } catch (ex) {
                if (firstInitialization) {
                    // Display initialization error alert
                    const errMsg = (this.enigmailSvc.initializationError ? this.enigmailSvc.initializationError : Locale.getString("accessError")) +
                              "\n\n"+Locale.getString("initErr.howToFixIt");

                    const checkedObj = {value: false};
                    if (Prefs.getPref("initAlert")) {
                        const r = Dialog.longAlert(win, "Enigmail: "+errMsg,
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

            const configuredVersion = Prefs.getPref("configuredVersion");

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
    }
};

App.initAddon();
