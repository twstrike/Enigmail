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
 * Copyright (C) 2014 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
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

var gEnigmailSvc = null;      // Global Enigmail Service
var gEnigmailCommon = null;   // Global Enigmail Common instance, to avoid circular dependencies
var envList = null;           // currently filled from enigmail.js

const EnigmailCore = {
    version: "",

    init: function(enigmailVersion) {
        this.version = enigmailVersion;
    },

    getEnigmailService: function() {
        return gEnigmailSvc;
    },

    setEnigmailService: function(v) {
        gEnigmailSvc = v;
    },

    ensuredEnigmailService: function(f) {
        if(gEnigmailSvc === null) {
            EnigmailCore.setEnigmailService(f());
        }
        return gEnigmailSvc;
    },

    getEnigmailCommon: function() {
        return gEnigmailCommon;
    },

    ensuredEnigmailCommon: function(f) {
        if(!f) {
            f = EnigmailCore.defaultEnigmailCommonCreation;
        }
        if(!gEnigmailCommon) {
            gEnigmailCommon = f();
        }
        return gEnigmailCommon;
    },

    defaultEnigmailCommonCreation: function() {
        Components.utils.import("resource://enigmail/enigmailCommon.jsm"); /*global EnigmailCommon: false */
        return EnigmailCommon;
    },

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
        envList.push(str);
    },

    initEnvList: function() {
        envList = [];
    }
};
