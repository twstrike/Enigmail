/*global Components: false, Enigmail: false */
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
 * Copyright (C) 2014 Patrick Brunschwig. All Rights Reserved.
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

const EXPORTED_SYMBOLS = [ "EnigmailCore" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const enigmailHolder = {
    svc: null
};      // Global Enigmail Service
let envList = null;           // currently filled from enigmail.js

function lazy(importName, name) {
    let holder = null;
    return function(f) {
        if(holder === null) {
            if(f) {
                holder = f();
            } else {
                const result = {};
                Components.utils.import("resource://enigmail/" + importName, result);
                holder = result[name];
            }
        }
        return holder;
    };
}

const EnigmailCore = {
    version: "",

    init: function(enigmailVersion) {
        this.version = enigmailVersion;
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

        if (enigmailHolder.svc) {
            return enigmailHolder.svc.initialized ? enigmailHolder.svc : null;
        }

        try {
            enigmailHolder.svc = Cc["@mozdev.org/enigmail/enigmail;1"].createInstance(Ci.nsIEnigmail);
        } catch (ex) {
            return null;
        }

        return Enigmail.getService(enigmailHolder, win, startingPreferences);
    },

    getEnigmailService: function() {
        return enigmailHolder.svc;
    },

    setEnigmailService: function(v) {
        enigmailHolder.svc = v;
    },

    ensuredEnigmailService: function(f) {
        if(enigmailHolder.svc === null) {
            EnigmailCore.setEnigmailService(f());
        }
        return enigmailHolder.svc;
    },

    getKeyRing:        lazy("keyRing.jsm", "KeyRing"),

    /**
     * obtain a list of all environment variables
     *
     * @return: Array of Strings with the following structrue
     *          variable_name=variable_content
     */
    getEnvList: function() {
        return envList;
    },

    addToEnvList: function(str) {
        EnigmailCore.getEnvList().push(str);
    },

    initEnvList: function() {
        envList = [];
    }
};
