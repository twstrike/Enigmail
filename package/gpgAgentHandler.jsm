/*global Components: false, EnigmailCore: false, subprocess: false, Files: false, Log: false, Prefs: false */
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
 * Copyright (C) 2013 Patrick Brunschwig. All Rights Reserved.
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

Components.utils.import("resource://enigmail/subprocess.jsm");
Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/files.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/prefs.jsm");

var EXPORTED_SYMBOLS = [ "EnigmailGpgAgent" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

var gIsGpgAgent = -1;

var Ec = null;
const EC = EnigmailCore;

var EnigmailGpgAgent = {
    setEnigmailCommon: function(enigCommon) {
        Ec = enigCommon;
    },

    useGpgAgent: function(ecom) {
        var useAgent = false;

        try {
            if (EC.isDosLike() && !Ec.getGpgFeature("supports-gpg-agent")) {
                useAgent = false;
            } else {
                // gpg version >= 2.0.16 launches gpg-agent automatically
                if (Ec.getGpgFeature("autostart-gpg-agent")) {
                    useAgent = true;
                    Log.DEBUG("enigmail.js: Setting useAgent to "+useAgent+" for gpg2 >= 2.0.16\n");
                }
                else {
                    useAgent = (ecom.gpgAgentInfo.envStr.length>0 || ecom.prefBranch.getBoolPref("useGpgAgent"));
                }
            }
        }
        catch (ex) {}
        return useAgent;
    },


  resetGpgAgent: function() {
    Log.DEBUG("gpgAgentHandler.jsm: resetGpgAgent\n");
    gIsGpgAgent = -1;
  },

  readString: function(data, length) {
    var r = '';
    for(var i = 0; i < length; i++) {
      r += String.fromCharCode(data[i]);
    }

    return r;
  },

  isCmdGpgAgent: function(pid) {
    Log.DEBUG("gpgAgentHandler.jsm: isCmdGpgAgent:\n");

    var environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    var ret = false;

    var path = environment.get("PATH");
    if (! path || path.length === 0) {
      path = "/bin:/usr/bin:/usr/local/bin";
    }

    var psCmd = Files.resolvePath("ps", path, false);

    var proc = {
      command:     psCmd,
      arguments:   [ "-o", "comm", "-p", pid ],
      environment: Ec.envList,
      charset: null,
      done: function(result) {
        Log.DEBUG("gpgAgentHandler.jsm: isCmdGpgAgent: got data: '"+result.stdout+"'\n");
        var data = result.stdout.replace(/[\r\n]/g, " ");
        if (data.search(/gpg-agent/) >= 0)
          ret = true;
      }
    };

    try {
      subprocess.call(proc).wait();
    }
    catch (ex) {}

    return ret;

  },

  isAgentTypeGpgAgent: function() {
    // determine if the used agent is a gpg-agent

    Log.DEBUG("gpgAgentHandler.jsm: isAgentTypeGpgAgent:\n");

    // to my knowledge there is no other agent than gpg-agent on Windows
    if (Ec.getOS() == "WINNT") return true;

    if (gIsGpgAgent >= 0)
      return gIsGpgAgent == 1;

    var pid = -1;
    var exitCode = -1;
    var svc = Ec.getService();
    if (! svc) return false;

    var proc = {
      command:     svc.connGpgAgentPath,
      arguments:   [],
      charset: null,
      environment: Ec.envList,
      stdin: function(pipe) {
        pipe.write("/subst\n");
        pipe.write("/serverpid\n");
        pipe.write("/echo pid: ${get serverpid}\n");
        pipe.write("/bye\n");
        pipe.close();
      },
      done: function(result) {
        exitCode = result.exitCode;
        var data = result.stdout.replace(/[\r\n]/g, "");
        if (data.search(/^pid: [0-9]+$/) === 0) {
          pid = data.replace(/^pid: /, "");
        }
      }
    };

    try {
      subprocess.call(proc).wait();
      if (exitCode) pid = -2;
    }
    catch (ex) {}

    Log.DEBUG("gpgAgentHandler.jsm: isAgentTypeGpgAgent: pid="+pid+"\n");

    this.isCmdGpgAgent(pid);
    var isAgent = false;

    try {
      isAgent = this.isCmdGpgAgent(pid);
      gIsGpgAgent = isAgent ? 1 : 0;
    }
    catch(ex) {}

    return isAgent;
  },

  getAgentMaxIdle: function() {
    Log.DEBUG("gpgAgentHandler.jsm: getAgentMaxIdle:\n");
    var svc = Ec.getService();
    var maxIdle = -1;

    if (! svc) return maxIdle;

    const DEFAULT = 7;
    const CFGVALUE = 9;

    var proc = {
      command:     svc.gpgconfPath,
      arguments:   [ "--list-options", "gpg-agent" ],
      charset: null,
      environment: Ec.envList,
      done: function(result) {
        var lines = result.stdout.split(/[\r\n]/);
        var i;

        for (i=0; i < lines.length; i++) {
          Log.DEBUG("gpgAgentHandler.jsm: getAgentMaxIdle: line: "+lines[i]+"\n");

          if (lines[i].search(/^default-cache-ttl:/) === 0) {
            var m = lines[i].split(/:/);
            if (m[CFGVALUE].length === 0) {
              maxIdle = Math.round(m[DEFAULT] / 60);
            }
            else
              maxIdle = Math.round(m[CFGVALUE] / 60);

            break;
          }
        }
      }
    };

    subprocess.call(proc).wait();

    return maxIdle;
  },

  setAgentMaxIdle: function(idleMinutes) {
    Log.DEBUG("gpgAgentHandler.jsm: setAgentMaxIdle:\n");
    var svc = Ec.getService();

    if (! svc) return;

    const RUNTIME = 8;

    var proc = {
      command:     svc.gpgconfPath,
      arguments:   [ "--runtime", "--change-options", "gpg-agent" ],
      environment: Ec.envList,
      charset: null,
      mergeStderr: true,
      stdin: function(pipe) {
        pipe.write("default-cache-ttl:"+ RUNTIME +":" + (idleMinutes * 60) +"\n");
        pipe.write("max-cache-ttl:"+ RUNTIME +":" + (idleMinutes * 600) +"\n");
        pipe.close();
      },
      stdout: function (data) {
        Log.DEBUG("gpgAgentHandler.jsm: setAgentMaxIdle.stdout: "+data+"\n");
      },
      done: function(result) {
        Log.DEBUG("gpgAgentHandler.jsm: setAgentMaxIdle.stdout: gpgconf exitCode="+result.exitCode+"\n");
      }
    };

    try {
      subprocess.call(proc);
    }
    catch (ex) {
      Log.DEBUG("gpgAgentHandler.jsm: setAgentMaxIdle: exception: "+ex.toString()+"\n");
    }
  },

  getMaxIdlePref: function(win) {
    let maxIdle = Prefs.getPref("maxIdleMinutes");

    try {
      var svc = Ec.getService(win);
      if (svc) {
        if (svc.gpgconfPath &&
           svc.connGpgAgentPath) {

          if (this.isAgentTypeGpgAgent()) {
            let m = this.getAgentMaxIdle();
            if (m > -1) maxIdle = m;
          }

        }
      }
    }
    catch(ex) {}

    return maxIdle;
  },

  setMaxIdlePref: function(minutes) {
    Prefs.setPref("maxIdleMinutes", minutes);

    if (this.isAgentTypeGpgAgent()) {
      try {
        this.setAgentMaxIdle(minutes);
      }
      catch(ex) {}
    }
  }
};
