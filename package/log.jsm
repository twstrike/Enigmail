/*global Components: false, EnigmailConsole: false, dump: false, Files: false, OS: false */
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

Components.utils.import("resource://enigmail/pipeConsole.jsm");
Components.utils.import("resource://enigmail/files.jsm");
Components.utils.import("resource://enigmail/os.jsm");

const EXPORTED_SYMBOLS = [ "Log" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const XPCOM_APPINFO = "@mozilla.org/xre/app-info;1";
const NS_IOSERVICE_CONTRACTID       = "@mozilla.org/network/io-service;1";


const Log = {
    level: 3,
    data: null,
    directory: null,
    fileStream: null,

    setLogLevel: function(newLogLevel) {
        Log.level = newLogLevel;
    },

    getLogLevel: function() {
        return Log.level;
    },

    setLogDirectory: function(newLogDirectory) {
        Log.directory = newLogDirectory + (OS.isDosLike() ? "\\" : "/");
        Log.createLogFiles();
    },

    createLogFiles: function() {
        if(Log.directory && (! Log.fileStream) && Log.level >= 5) {
            Log.fileStream = Files.createFileStream(Log.directory+"enigdbug.txt");
        }
    },

    onShutdown: function() {
        if(Log.fileStream) {
            Log.fileStream.close();
        }
        Log.fileStream = null;
    },

    getLogData: function(version, prefs) {
        let ioServ = Cc[NS_IOSERVICE_CONTRACTID].getService(Ci.nsIIOService);

        let oscpu = "";
        let platform = "";

        try {
            let httpHandler = ioServ.getProtocolHandler("http");
            httpHandler = httpHandler.QueryInterface(Ci.nsIHttpProtocolHandler);
            oscpu = httpHandler.oscpu;
            platform = httpHandler.platform;
        }
        catch (ex) {
        }

        let data = "Enigmail version "+version+"\n" +
                "OS/CPU="+oscpu+"\n" +
                "Platform="+platform+"\n" +
                "Non-default preference values:\n";

        let p = prefs.getPrefBranch().getChildList("");

        for (let i in p) {
            if (prefs.getPrefBranch().prefHasUserValue(p[i])) {
                data += p[i] +": "+ prefs.getPref(p[i])+"\n";
            }
        }

        return data +"\n" + Log.data;
    },

    WRITE: function (str) {
        function withZeroes(val, digits) {
            return ("0000"+val.toString()).substr(-digits);
        }

        var d = new Date();
        var datStr=d.getFullYear()+"-"+withZeroes(d.getMonth()+1, 2)+"-"+withZeroes(d.getDate(),2)+" "+withZeroes(d.getHours(),2)+":"+withZeroes(d.getMinutes(),2)+":"+withZeroes(d.getSeconds(),2)+"."+withZeroes(d.getMilliseconds(),3)+" ";
        if (Log.level >= 4)
            dump(datStr+str);

        if (Log.data === null) {
            Log.data = "";
            let appInfo = Cc[XPCOM_APPINFO].getService(Ci.nsIXULAppInfo);
            Log.WRITE("Mozilla Platform: "+ appInfo.name + " " + appInfo.version + "\n");
        }
        // truncate first part of log data if it grow too much
        if (Log.data.length > 5120000) {
            Log.data = Log.data.substr(-400000);
        }

        Log.data += datStr + str;

        if (Log.fileStream) {
            Log.fileStream.write(datStr, datStr.length);
            Log.fileStream.write(str, str.length);
        }
    },

    DEBUG: function (str) {
        Log.WRITE("[DEBUG] "+str);
    },

    WARNING: function (str) {
        Log.WRITE("[WARN] "+str);
        EnigmailConsole.write(str);
    },

    ERROR: function (str) {
        try {
            var consoleSvc = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
            var scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
            scriptError.init(str, null, null, 0, 0, scriptError.errorFlag, "Enigmail");
            consoleSvc.logMessage(scriptError);
        }
        catch (ex) {}

        Log.WRITE("[ERROR] "+str);
    },

    CONSOLE: function (str) {
        if (Log.level >= 3) {
            Log.WRITE("[CONSOLE] "+str);
        }

        EnigmailConsole.write(str);
    },

    /**
     *  Log an exception including the stack trace
     *
     *  referenceInfo: String - arbitraty text to write before the exception is logged
     *  ex:            exception object
     */
    writeException: function (referenceInfo, ex) {
        Log.ERROR(referenceInfo+": caught exception: " +
                  ex.name+"\n" +
                  "Message: '"+ex.message+"'\n" +
                  "File:    "+ex.fileName+"\n" +
                  "Line:    "+ex.lineNumber+"\n" +
                  "Stack:   "+ex.stack+"\n");
    }
};
