/*global Components: false, Log: false, OS: false, AddonManager: false, dump: false */
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

var EXPORTED_SYMBOLS = [ "App" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/AddonManager.jsm");

const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";
const SEAMONKEY_ID   = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";

const App = {
    /**
     * Plattform application name (e.g. Thunderbird)
     */
    getName: function() {
        return Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo).name;
    },

    /**
     * Return the directory holding the current profile as nsIFile object
     */
    getProfileDirectory: function() {
        let ds = Cc[DIR_SERV_CONTRACTID].getService(Ci.nsIProperties);
        return ds.get("ProfD", Ci.nsIFile);
    },

    isSuite: function () {
        // return true if Seamonkey, false otherwise
        return Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo).ID == SEAMONKEY_ID;
    },

    getVersion: function() {
        Log.DEBUG("app.jsm: getVersion\n");
        Log.DEBUG("app.jsm: installed version: "+App.version+"\n");
        return App.version;
    },

    getInstallLocation: function() {
        return App.installLocation;
    },

    setVersion: function(version) {
        App.version = version;
    },

    setInstallLocation: function(location) {
        App.installLocation = location;
    },

    registerAddon: function(addon) {
        App.setVersion(addon.version);
        App.setInstallLocation(addon.getResourceURI("").QueryInterface(Ci.nsIFileURL).file);
    },

    initAddon: function() {
        try {
            AddonManager.getAddonByID(ENIG_EXTENSION_GUID, App.registerAddon);
        } catch (ex) {
            dump("enigmailCommon.jsm: init error: "+ex+"\n");
        }
    }
};
