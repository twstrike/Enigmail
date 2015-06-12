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
 * Copyright (C) 2013 Patrick Brunschwig. All Rights Reserved.
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

const EXPORTED_SYMBOLS = [ "EnigmailGpgAgent" ];

const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm"); /*global ctypes: false */
Cu.import("resource://enigmail/subprocess.jsm"); /*global subprocess: false */
Cu.import("resource://enigmail/enigmailCore.jsm"); /*global EnigmailCore: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */
Cu.import("resource://enigmail/os.jsm"); /*global OS: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/windows.jsm"); /*global Windows: false */
Cu.import("resource://enigmail/app.jsm"); /*global App: false */
Cu.import("resource://enigmail/gpg.jsm"); /*global Gpg: false */
Cu.import("resource://enigmail/execution.jsm"); /*global Execution: false */
Cu.import("resource://enigmail/passwords.jsm"); /*global Passwords: false */

const Cc = Components.classes;
const Ci = Components.interfaces;

const nsIEnigmail = Ci.nsIEnigmail;

const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const DIR_SERV_CONTRACTID  = "@mozilla.org/file/directory_service;1";
const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID = "@mozilla.org/network/file-output-stream;1";

const DEFAULT_FILE_PERMS = 0x180; // equals 0600

// Making this a var makes it possible to test windows things on linux
var nsIWindowsRegKey       = Ci.nsIWindowsRegKey;

var gIsGpgAgent = -1;

const DUMMY_AGENT_INFO = "none";

function cloneOrNull(v) {
    if(v !== null && typeof v.clone === "function") {
        return v.clone();
    } else {
        return v;
    }
}

function extractAgentInfo(fullStr) {
    if (fullStr) {
        return fullStr.
            replace(/[\r\n]/g, "").
            replace(/^.*\=/,"").
            replace(/\;.*$/,"");
    } else {
        return "";
    }
}

const EnigmailGpgAgent = {
    agentType: "",
    agentPath: null,
    connGpgAgentPath: null,
    gpgconfPath: null,
    gpgAgentInfo: {preStarted: false, envStr: ""},
    gpgAgentProcess: null,
    gpgAgentIsOptional: true,

    isDummy: function() {
        return EnigmailGpgAgent.gpgAgentInfo.envStr === DUMMY_AGENT_INFO;
    },

    useGpgAgent: function() {
        let useAgent = false;

        try {
            if (OS.isDosLike() && !Gpg.getGpgFeature("supports-gpg-agent")) {
                useAgent = false;
            } else {
                // gpg version >= 2.0.16 launches gpg-agent automatically
                if (Gpg.getGpgFeature("autostart-gpg-agent")) {
                    useAgent = true;
                    Log.DEBUG("enigmail.js: Setting useAgent to "+useAgent+" for gpg2 >= 2.0.16\n");
                } else {
                    useAgent = (EnigmailGpgAgent.gpgAgentInfo.envStr.length>0 || Prefs.getPrefBranch().getBoolPref("useGpgAgent"));
                }
            }
        } catch (ex) {}
        return useAgent;
    },

    resetGpgAgent: function() {
        Log.DEBUG("enigmailGpgAgent.jsm: resetGpgAgent\n");
        gIsGpgAgent = -1;
    },

    isCmdGpgAgent: function(pid) {
        Log.DEBUG("enigmailGpgAgent.jsm: isCmdGpgAgent:\n");

        const environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
        let ret = false;

        let path = environment.get("PATH");
        if (! path || path.length === 0) {
            path = "/bin:/usr/bin:/usr/local/bin";
        }

        const psCmd = Files.resolvePath("ps", path, false);

        const proc = {
            command:     psCmd,
            arguments:   [ "-o", "comm", "-p", pid ],
            environment: EnigmailCore.getEnvList(),
            charset: null,
            done: function(result) {
                Log.DEBUG("enigmailGpgAgent.jsm: isCmdGpgAgent: got data: '"+result.stdout+"'\n");
                var data = result.stdout.replace(/[\r\n]/g, " ");
                if (data.search(/gpg-agent/) >= 0) {
                    ret = true;
                }
            }
        };

        try {
            subprocess.call(proc).wait();
        } catch (ex) {}

        return ret;

    },

    isAgentTypeGpgAgent: function() {
        // determine if the used agent is a gpg-agent

        Log.DEBUG("enigmailGpgAgent.jsm: isAgentTypeGpgAgent:\n");

        // to my knowledge there is no other agent than gpg-agent on Windows
        if (OS.getOS() == "WINNT") return true;

        if (gIsGpgAgent >= 0) {
            return gIsGpgAgent == 1;
        }

        let pid = -1;
        let exitCode = -1;
        if (! EnigmailCore.getService()) return false;

        const proc = {
            command:     EnigmailGpgAgent.connGpgAgentPath,
            arguments:   [],
            charset: null,
            environment: EnigmailCore.getEnvList(),
            stdin: function(pipe) {
                pipe.write("/subst\n");
                pipe.write("/serverpid\n");
                pipe.write("/echo pid: ${get serverpid}\n");
                pipe.write("/bye\n");
                pipe.close();
            },
            done: function(result) {
                exitCode = result.exitCode;
                const data = result.stdout.replace(/[\r\n]/g, "");
                if (data.search(/^pid: [0-9]+$/) === 0) {
                    pid = data.replace(/^pid: /, "");
                }
            }
        };

        try {
            subprocess.call(proc).wait();
            if (exitCode) pid = -2;
        } catch (ex) {}

        Log.DEBUG("enigmailGpgAgent.jsm: isAgentTypeGpgAgent: pid="+pid+"\n");

        EnigmailGpgAgent.isCmdGpgAgent(pid);
        let isAgent = false;

        try {
            isAgent = EnigmailGpgAgent.isCmdGpgAgent(pid);
            gIsGpgAgent = isAgent ? 1 : 0;
        } catch(ex) {}

        return isAgent;
    },

    getAgentMaxIdle: function() {
        Log.DEBUG("enigmailGpgAgent.jsm: getAgentMaxIdle:\n");
        let maxIdle = -1;

        if (! EnigmailCore.getService()) return maxIdle;

        const DEFAULT = 7;
        const CFGVALUE = 9;

        const proc = {
            command:     EnigmailGpgAgent.gpgconfPath,
            arguments:   [ "--list-options", "gpg-agent" ],
            charset: null,
            environment: EnigmailCore.getEnvList(),
            done: function(result) {
                const lines = result.stdout.split(/[\r\n]/);

                for (let i=0; i < lines.length; i++) {
                    Log.DEBUG("enigmailGpgAgent.jsm: getAgentMaxIdle: line: "+lines[i]+"\n");

                    if (lines[i].search(/^default-cache-ttl:/) === 0) {
                        const m = lines[i].split(/:/);
                        if (m[CFGVALUE].length === 0) {
                            maxIdle = Math.round(m[DEFAULT] / 60);
                        } else {
                            maxIdle = Math.round(m[CFGVALUE] / 60);
                        }

                        break;
                    }
                }
            }
        };

        subprocess.call(proc).wait();
        return maxIdle;
    },

    setAgentMaxIdle: function(idleMinutes) {
        Log.DEBUG("enigmailGpgAgent.jsm: setAgentMaxIdle:\n");
        if (! EnigmailCore.getService()) return;

        const RUNTIME = 8;

        const proc = {
            command:     EnigmailGpgAgent.gpgconfPath,
            arguments:   [ "--runtime", "--change-options", "gpg-agent" ],
            environment: EnigmailCore.getEnvList(),
            charset: null,
            mergeStderr: true,
            stdin: function(pipe) {
                pipe.write("default-cache-ttl:"+ RUNTIME +":" + (idleMinutes * 60) +"\n");
                pipe.write("max-cache-ttl:"+ RUNTIME +":" + (idleMinutes * 600) +"\n");
                pipe.close();
            },
            stdout: function (data) {
                Log.DEBUG("enigmailGpgAgent.jsm: setAgentMaxIdle.stdout: "+data+"\n");
            },
            done: function(result) {
                Log.DEBUG("enigmailGpgAgent.jsm: setAgentMaxIdle.stdout: gpgconf exitCode="+result.exitCode+"\n");
            }
        };

        try {
            subprocess.call(proc);
        } catch (ex) {
            Log.DEBUG("enigmailGpgAgent.jsm: setAgentMaxIdle: exception: "+ex.toString()+"\n");
        }
    },

    getMaxIdlePref: function(win) {
        let maxIdle = Prefs.getPref("maxIdleMinutes");

        try {
            if (EnigmailCore.getService(win)) {
                if (EnigmailGpgAgent.gpgconfPath &&
                    EnigmailGpgAgent.connGpgAgentPath) {

                    if (EnigmailGpgAgent.isAgentTypeGpgAgent()) {
                        const m = EnigmailGpgAgent.getAgentMaxIdle();
                        if (m > -1) maxIdle = m;
                    }

                }
            }
        } catch(ex) {}

        return maxIdle;
    },

    setMaxIdlePref: function(minutes) {
        Prefs.setPref("maxIdleMinutes", minutes);

        if (EnigmailGpgAgent.isAgentTypeGpgAgent()) {
            try {
                EnigmailGpgAgent.setAgentMaxIdle(minutes);
            } catch(ex) {}
        }
    },

    setAgentPath: function (domWindow, esvc) {
        let agentPath = "";
        try {
            agentPath = Prefs.getPrefBranch().getCharPref("agentPath");
        } catch (ex) {}

        var agentType = "gpg";
        var agentName = "";

        EnigmailGpgAgent.resetGpgAgent();

        if (OS.isDosLike()) {
            agentName = "gpg2.exe;gpg.exe;gpg1.exe";
        } else {
            agentName = "gpg2;gpg;gpg1";
        }


        if (agentPath) {
            // Locate GnuPG executable

            // Append default .exe extension for DOS-Like systems, if needed
            if (OS.isDosLike() && (agentPath.search(/\.\w+$/) < 0)) {
                agentPath += ".exe";
            }

            try {
                const pathDir = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);

                if (! Files.isAbsolutePath(agentPath, OS.isDosLike())) {
                    // path relative to Mozilla installation dir
                    const  ds = Cc[DIR_SERV_CONTRACTID].getService();
                    const dsprops = ds.QueryInterface(Ci.nsIProperties);
                    pathDir = dsprops.get("CurProcD", Ci.nsIFile);

                    const dirs=agentPath.split(new RegExp(OS.isDosLike() ? "\\\\" : "/"));
                    for (let i=0; i< dirs.length; i++) {
                        if (dirs[i]!=".") {
                            pathDir.append(dirs[i]);
                        }
                    }
                    pathDir.normalize();
                } else {
                    // absolute path
                    Files.initPath(pathDir, agentPath);
                }
                if (! (pathDir.isFile() /* && pathDir.isExecutable()*/)) {
                    throw Components.results.NS_ERROR_FAILURE;
                }
                agentPath = pathDir.QueryInterface(Ci.nsIFile);

            } catch (ex) {
                esvc.initializationError = Locale.getString("gpgNotFound", [ agentPath ]);
                Log.ERROR("enigmail.js: Enigmail.initialize: Error - "+esvc.initializationError+"\n");
                throw Components.results.NS_ERROR_FAILURE;
            }
        } else {
            // Resolve relative path using PATH environment variable
            const envPath = esvc.environment.get("PATH");
            agentPath = Files.resolvePath(agentName, envPath, OS.isDosLike());

            if (!agentPath && OS.isDosLike()) {
                // DOS-like systems: search for GPG in c:\gnupg, c:\gnupg\bin, d:\gnupg, d:\gnupg\bin
                let gpgPath = "c:\\gnupg;c:\\gnupg\\bin;d:\\gnupg;d:\\gnupg\\bin";
                agentPath = Files.resolvePath(agentName, gpgPath, OS.isDosLike());
            }

            if ((! agentPath) && OS.isWin32) {
                // Look up in Windows Registry
                try {
                    let gpgPath = OS.getWinRegistryString("Software\\GNU\\GNUPG", "Install Directory", nsIWindowsRegKey.ROOT_KEY_LOCAL_MACHINE);
                    agentPath = Files.resolvePath(agentName, gpgPath, OS.isDosLike());
                } catch (ex) {}

                if (! agentPath) {
                    let gpgPath = gpgPath + "\\pub";
                    agentPath = Files.resolvePath(agentName, gpgPath, OS.isDosLike());
                }
            }

            if (!agentPath && !OS.isDosLike()) {
                // Unix-like systems: check /usr/bin and /usr/local/bin
                let gpgPath = "/usr/bin:/usr/local/bin";
                agentPath = Files.resolvePath(agentName, gpgPath, OS.isDosLike());
            }

            if (!agentPath) {
                esvc.initializationError = Locale.getString("gpgNotInPath");
                Log.ERROR("enigmail.js: Enigmail: Error - "+esvc.initializationError+"\n");
                throw Components.results.NS_ERROR_FAILURE;
            }
            agentPath = agentPath.QueryInterface(Ci.nsIFile);
        }

        Log.CONSOLE("EnigmailAgentPath="+Files.getFilePathDesc(agentPath)+"\n\n");

        EnigmailGpgAgent.agentType = agentType;
        EnigmailGpgAgent.agentPath = agentPath;
        Gpg.agentPath = agentPath;
        Execution.agentType = agentType;

        const command = agentPath;
        let args = [];
        if (agentType == "gpg") {
            args = [ "--version", "--version", "--batch", "--no-tty", "--charset", "utf-8", "--display-charset", "utf-8" ];
        }

        let exitCode = -1;
        let outStr = "";
        let errStr = "";
        Log.DEBUG("enigmail.js: Enigmail.setAgentPath: calling subprocess with '"+command.path+"'\n");

        Log.CONSOLE("enigmail> "+Files.formatCmdLine(command, args)+"\n");

        const proc = {
            command:     command,
            arguments:   args,
            environment: EnigmailCore.getEnvList(),
            charset: null,
            done: function(result) {
                exitCode = result.exitCode;
                outStr = result.stdout;
                errStr = result.stderr;
            },
            mergeStderr: false
        };

        try {
            subprocess.call(proc).wait();
        } catch (ex) {
            Log.ERROR("enigmail.js: Enigmail.setAgentPath: subprocess.call failed with '"+ex.toString()+"'\n");
            Log.DEBUG("  enigmail> DONE with FAILURE\n");
            throw ex;
        }
        Log.DEBUG("  enigmail> DONE\n");

        if (exitCode !== 0) {
            Log.ERROR("enigmail.js: Enigmail.setAgentPath: gpg failed with exitCode "+exitCode+" msg='"+outStr+" "+errStr+"'\n");
            throw Components.results.NS_ERROR_FAILURE;
        }

        Log.CONSOLE(outStr+"\n");

        // detection for Gpg4Win wrapper
        if (outStr.search(/^gpgwrap.*;/) === 0) {
            const outLines = outStr.split(/[\n\r]+/);
            const firstLine = outLines[0];
            outLines.splice(0,1);
            outStr = outLines.join("\n");
            agentPath = firstLine.replace(/^.*;[ \t]*/, "");

            Log.CONSOLE("gpg4win-gpgwrapper detected; EnigmailAgentPath="+agentPath+"\n\n");
        }

        const versionParts = outStr.replace(/[\r\n].*/g,"").replace(/ *\(gpg4win.*\)/i, "").split(/ /);
        const gpgVersion = versionParts[versionParts.length-1];

        Log.DEBUG("enigmail.js: detected GnuPG version '"+gpgVersion+"'\n");
        Gpg.agentVersion = gpgVersion;

        if (!Gpg.getGpgFeature("version-supported")) {
            if (! domWindow) {
                domWindow = Windows.getBestParentWin();
            }
            Dialog.alert(domWindow, Locale.getString("oldGpgVersion14", [ gpgVersion ]));
            throw Components.results.NS_ERROR_FAILURE;
        }

        EnigmailGpgAgent.gpgconfPath = EnigmailGpgAgent.resolveToolPath("gpgconf");
        EnigmailGpgAgent.connGpgAgentPath = EnigmailGpgAgent.resolveToolPath("gpg-connect-agent");

        Log.DEBUG("enigmail.js: Enigmail.setAgentPath: gpgconf found: "+ (EnigmailGpgAgent.gpgconfPath ? "yes" : "no") +"\n");
    },

    // resolve the path for GnuPG helper tools
    resolveToolPath: function(fileName) {
        if (OS.isDosLike()) {
            fileName += ".exe";
        }

        let filePath = cloneOrNull(EnigmailGpgAgent.agentPath);

        if (filePath) filePath = filePath.parent;
        if (filePath) {
            filePath.append(fileName);
            if (filePath.exists()) {
                filePath.normalize();
                return filePath;
            }
        }

        const foundPath = Files.resolvePath(fileName, EnigmailCore.getEnigmailService().environment.get("PATH"), OS.isDosLike());
        if (foundPath !== null) { foundPath.normalize(); }
        return foundPath;
    },

    detectGpgAgent: function (domWindow, esvc) {
        Log.DEBUG("enigmail.js: detectGpgAgent\n");

        var gpgAgentInfo = esvc.environment.get("GPG_AGENT_INFO");
        if (gpgAgentInfo && gpgAgentInfo.length>0) {
            Log.DEBUG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO variable available\n");
            // env. variable suggests running gpg-agent
            EnigmailGpgAgent.gpgAgentInfo.preStarted = true;
            EnigmailGpgAgent.gpgAgentInfo.envStr = gpgAgentInfo;
            EnigmailGpgAgent.gpgAgentIsOptional = false;
        }
        else {
            Log.DEBUG("enigmail.js: detectGpgAgent: no GPG_AGENT_INFO variable set\n");
            EnigmailGpgAgent.gpgAgentInfo.preStarted = false;

            var command = null;
            var outStr = "";
            var errorStr = "";
            var exitCode = -1;
            EnigmailGpgAgent.gpgAgentIsOptional = false;
            if (Gpg.getGpgFeature("autostart-gpg-agent")) {
                Log.DEBUG("enigmail.js: detectGpgAgent: gpg 2.0.16 or newer - not starting agent\n");
            }
            else {
                if (EnigmailGpgAgent.connGpgAgentPath && EnigmailGpgAgent.connGpgAgentPath.isExecutable()) {
                    // try to connect to a running gpg-agent

                    Log.DEBUG("enigmail.js: detectGpgAgent: gpg-connect-agent is executable\n");

                    EnigmailGpgAgent.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;

                    command = EnigmailGpgAgent.connGpgAgentPath.QueryInterface(Ci.nsIFile);

                    Log.CONSOLE("enigmail> "+command.path+"\n");

                    try {
                        subprocess.call({
                            command: command,
                            environment: EnigmailCore.getEnvList(),
                            stdin: "/echo OK\n",
                            charset: null,
                            done: function(result) {
                                Log.DEBUG("detectGpgAgent detection terminated with "+result.exitCode+"\n");
                                exitCode = result.exitCode;
                                outStr = result.stdout;
                                errorStr = result.stderr;
                                if (result.stdout.substr(0,2) == "OK") exitCode = 0;
                            },
                            mergeStderr: false
                        }).wait();
                    } catch (ex) {
                        Log.ERROR("enigmail.js: detectGpgAgent: "+command.path+" failed\n");
                        Log.DEBUG("  enigmail> DONE with FAILURE\n");
                        exitCode = -1;
                    }
                    Log.DEBUG("  enigmail> DONE\n");

                    if (exitCode === 0) {
                        Log.DEBUG("enigmail.js: detectGpgAgent: found running gpg-agent\n");
                        return;
                    }
                    else {
                        Log.DEBUG("enigmail.js: detectGpgAgent: no running gpg-agent. Output='"+outStr+"' error text='"+errorStr+"'\n");
                    }

                }

                // and finally try to start gpg-agent
                var commandFile = EnigmailGpgAgent.resolveToolPath("gpg-agent");
                var agentProcess = null;

                if ((! commandFile) || (! commandFile.exists())) {
                    commandFile = EnigmailGpgAgent.resolveToolPath("gpg-agent2");
                }

                if (commandFile  && commandFile.exists()) {
                    command = commandFile.QueryInterface(Ci.nsIFile);
                }

                if (command === null) {
                    Log.ERROR("enigmail.js: detectGpgAgent: gpg-agent not found\n");
                    Dialog.alert(domWindow, Locale.getString("gpgAgentNotStarted", [ Gpg.agentVersion ]));
                    throw Components.results.NS_ERROR_FAILURE;
                }
            }

            if ((! OS.isDosLike()) && (! Gpg.getGpgFeature("autostart-gpg-agent"))) {

                // create unique tmp file
                var ds = Cc[DIR_SERV_CONTRACTID].getService();
                var dsprops = ds.QueryInterface(Ci.nsIProperties);
                var tmpFile = dsprops.get("TmpD", Ci.nsIFile);
                tmpFile.append("gpg-wrapper.tmp");
                tmpFile.createUnique(tmpFile.NORMAL_FILE_TYPE, DEFAULT_FILE_PERMS);
                let args = [ command.path,
                             tmpFile.path,
                             "--sh", "--no-use-standard-socket",
                             "--daemon",
                             "--default-cache-ttl", (Passwords.getMaxIdleMinutes()*60).toString(),
                             "--max-cache-ttl", "999999" ];  // ca. 11 days

                try {
                    var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
                    var exec = App.getInstallLocation().clone();
                    exec.append("wrappers");
                    exec.append("gpg-agent-wrapper.sh");
                    process.init(exec);
                    process.run(true, args, args.length);

                    if (! tmpFile.exists()) {
                        Log.ERROR("enigmail.js: detectGpgAgent no temp file created\n");
                    }
                    else {
                        outStr = Files.readFile(tmpFile);
                        tmpFile.remove(false);
                        exitCode = 0;
                    }
                } catch (ex) {
                    Log.ERROR("enigmail.js: detectGpgAgent: failed with '"+ex+"'\n");
                    exitCode = -1;
                }

                if (exitCode === 0) {
                    EnigmailGpgAgent.gpgAgentInfo.envStr = extractAgentInfo(outStr);
                    Log.DEBUG("enigmail.js: detectGpgAgent: started -> "+EnigmailGpgAgent.gpgAgentInfo.envStr+"\n");
                    EnigmailGpgAgent.gpgAgentProcess = EnigmailGpgAgent.gpgAgentInfo.envStr.split(":")[1];
                }
                else {
                    Log.ERROR("enigmail.js: detectGpgAgent: gpg-agent output: "+outStr+"\n");
                    Dialog.alert(domWindow, Locale.getString("gpgAgentNotStarted", [ Gpg.agentVersion ]));
                    throw Components.results.NS_ERROR_FAILURE;
                }
            }
            else {
                EnigmailGpgAgent.gpgAgentInfo.envStr = DUMMY_AGENT_INFO;
                var envFile = Components.classes[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
                Files.initPath(envFile, EnigmailGpgAgent.determineGpgHomeDir(esvc));
                envFile.append("gpg-agent.conf");

                var data="default-cache-ttl " + (Passwords.getMaxIdleMinutes()*60)+"\n";
                data += "max-cache-ttl 999999";
                if (! envFile.exists()) {
                    try {
                        var flags = 0x02 | 0x08 | 0x20;
                        var fileOutStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);
                        fileOutStream.init(envFile, flags, 384, 0); // 0600
                        fileOutStream.write(data, data.length);
                        fileOutStream.flush();
                        fileOutStream.close();
                    }
                    catch (ex) {} // ignore file write errors
                }
            }
        }
        Log.DEBUG("enigmail.js: detectGpgAgent: GPG_AGENT_INFO='"+EnigmailGpgAgent.gpgAgentInfo.envStr+"'\n");
    },

    determineGpgHomeDir: function (esvc) {
        let homeDir = esvc.environment.get("GNUPGHOME");

        if (! homeDir && OS.isWin32) {
            homeDir=OS.getWinRegistryString("Software\\GNU\\GNUPG", "HomeDir", nsIWindowsRegKey.ROOT_KEY_CURRENT_USER);

            if (! homeDir) {
                homeDir = esvc.environment.get("USERPROFILE") || esvc.environment.get("SystemRoot");

                if (homeDir) homeDir += "\\Application Data\\GnuPG";
            }

            if (! homeDir) homeDir = "C:\\gnupg";
        }

        if (! homeDir) homeDir = esvc.environment.get("HOME")+"/.gnupg";

        return homeDir;
    },

    finalize: function() {
        if (EnigmailGpgAgent.gpgAgentProcess !== null) {
            Log.DEBUG("enigmailGpgAgent.jsm: EnigmailGpgAgent.finalize: stopping gpg-agent PID="+EnigmailGpgAgent.gpgAgentProcess+"\n");
            try {
                const libc = ctypes.open(subprocess.getPlatformValue(0));

                //int kill(pid_t pid, int sig);
                const kill = libc.declare("kill",
                                          ctypes.default_abi,
                                          ctypes.int,
                                          ctypes.int32_t,
                                          ctypes.int);

                kill(parseInt(EnigmailGpgAgent.gpgAgentProcess), 15);
            } catch (ex) {
                Log.ERROR("enigmailGpgAgent.jsm: EnigmailGpgAgent.finalize ERROR: "+ex+"\n");
            }
        }
    }
};
