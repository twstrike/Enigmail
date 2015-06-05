/*global Components: false, EnigmailCommon: false, Log: false, Prefs: false, OS: false */
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



/***
 * Enigmail Core:
 * this file serves to be included by other components in Enigmail;
 * it should not import anything from other Enigmail modules, except
 * log!
 */

/*
 * Import into a JS component using
 * 'Components.utils.import("resource://enigmail/enigmailCore.jsm");'
 */

Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/prefs.jsm");
Components.utils.import("resource://enigmail/os.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailCore" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIEnigmail = Ci.nsIEnigmail;

const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const ENIG_EXTENSION_GUID = "{847b3a00-7ab1-11d4-8f02-006008948af5}";

const THUNDERBIRD_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
const SEAMONKEY_ID   = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";


const NS_IOSERVICE_CONTRACTID       = "@mozilla.org/network/io-service;1";
const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1";
const NS_SCRIPTABLEINPUTSTREAM_CONTRACTID = "@mozilla.org/scriptableinputstream;1";

var gEnigmailSvc = null;      // Global Enigmail Service
var gEnigmailCommon = null;      // Global Enigmail Common instance, to avoid circular dependencies

var EnigmailCore = {
  enigStringBundle: null,
  version: "",

  init: function(enigmailVersion) {
    this.version = enigmailVersion;
  },

  getLogData: function() {
      return Log.getLogData(EnigmailCore.version, Prefs);
  },

  // retrieves a localized string from the enigmail.properties stringbundle
  getString: function (aStr, subPhrases)
  {

    if (!this.enigStringBundle) {
      try {
        var strBundleService = Cc["@mozilla.org/intl/stringbundle;1"].getService();
        strBundleService = strBundleService.QueryInterface(Ci.nsIStringBundleService);
        this.enigStringBundle = strBundleService.createBundle("chrome://enigmail/locale/enigmail.properties");
      }
      catch (ex) {
        Log.ERROR("enigmailCore.jsm: Error in instantiating stringBundleService\n");
      }
    }

    if (this.enigStringBundle) {
      try {
        if (subPhrases) {
          if (typeof(subPhrases) == "string") {
            return this.enigStringBundle.formatStringFromName(aStr, [ subPhrases ], 1);
          }
          else
            return this.enigStringBundle.formatStringFromName(aStr, subPhrases, subPhrases.length);
        }
        else {
          return this.enigStringBundle.GetStringFromName(aStr);
        }
      }
      catch (ex) {
        Log.ERROR("enigmailCore.jsm: Error in querying stringBundleService for string '"+aStr+"'\n");
      }
    }
    return aStr;
  },

  printCmdLine: function (command, args) {
      function getQuoted(str) {
          let i = str.indexOf(" ");
          if (i>=0) {
              return '"' + str +'"';
          }
          else
              return str;
      }

    var rStr = getQuoted(this.getFilePathDesc(command)) +" ";

    let i;
    rStr += [getQuoted(args[i]) for (i in args)].join(" ").replace(/\\\\/g, '\\');

    return rStr;
  },

  getFilePathDesc: function (nsFileObj) {
    if (OS.getOS() == "WINNT")
      return nsFileObj.persistentDescriptor;
    else
      return nsFileObj.path;
  },

  /**
   * Plattform application name (e.g. Thunderbird)
   */

  getAppName: function() {
    var xulAppinfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);

    return xulAppinfo.name;
  },

  /**
   * Return the directory holding the current profile as nsIFile object
   */
  getProfileDirectory: function() {
    let ds = Cc[DIR_SERV_CONTRACTID].getService(Ci.nsIProperties);
    return ds.get("ProfD", Ci.nsIFile);
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
        Components.utils.import("resource://enigmail/enigmailCommon.jsm");
        return EnigmailCommon;
    },

    // Read the contents of a file into a string
    readFile: function(filePath) {
        // @filePath: nsIFile
        if (filePath.exists()) {

            var ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);
            if (!ioServ)
                throw Components.results.NS_ERROR_FAILURE;

            var fileURI = ioServ.newFileURI(filePath);
            var fileChannel = ioServ.newChannel(fileURI.asciiSpec, null, null);

            var rawInStream = fileChannel.open();

            var scriptableInStream = Cc[NS_SCRIPTABLEINPUTSTREAM_CONTRACTID].createInstance(Ci.nsIScriptableInputStream);
            scriptableInStream.init(rawInStream);
            var available = scriptableInStream.available();
            var fileContents = scriptableInStream.read(available);
            scriptableInStream.close();
            return fileContents;
        }
        return "";
    }
};
