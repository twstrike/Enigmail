/*global Components: false, Log: false */
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

var EXPORTED_SYMBOLS = [ "Files" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const NS_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const NS_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID =
                              "@mozilla.org/network/file-output-stream;1";

const NS_RDONLY      = 0x01;
const NS_WRONLY      = 0x02;
const NS_CREATE_FILE = 0x08;
const NS_TRUNCATE    = 0x20;
const DEFAULT_FILE_PERMS = 0x180; // equals 0600

const Files = {
    lazyLog: function() {
        if(!Files.log) {
            Components.utils.import("resource://enigmail/log.jsm");
            Files.log = Log;
        }
        return Files.log;
    },

    isAbsolutePath: function (filePath, isDosLike) {
        // Check if absolute path
        if (isDosLike) {
            return ((filePath.search(/^\w+:\\/) === 0) || (filePath.search(/^\\\\/) === 0) ||
                    (filePath.search(/^\/\//) === 0));
        } else {
            return (filePath.search(/^\//) === 0);
        }
    },

    resolvePath: function (filePath, envPath, isDosLike) {
        Files.lazyLog().DEBUG("gpgAgentHandler.jsm: resolvePath: filePath="+filePath+"\n");

        if (Files.isAbsolutePath(filePath, isDosLike))
            return filePath;

        if (!envPath)
            return null;

        var fileNames = filePath.split(";");

        var pathDirs = envPath.split(isDosLike ? ";" : ":");

        for (var i=0; i < fileNames.length; i++) {
            for (var j=0; j<pathDirs.length; j++) {
                try {
                    var pathDir = Cc[NS_FILE_CONTRACTID].createInstance(Ci.nsIFile);

                    Files.lazyLog().DEBUG("gpgAgentHandler.jsm: resolvePath: checking for "+pathDirs[j]+"/"+fileNames[i]+"\n");

                    Files.initPath(pathDir, pathDirs[j]);

                    try {
                        if (pathDir.exists() && pathDir.isDirectory()) {
                            pathDir.appendRelativePath(fileNames[i]);

                            if (pathDir.exists() && !pathDir.isDirectory()) {
                                return pathDir;
                            }
                        }
                    }
                    catch (ex) {}
                }
                catch (ex) {}
            }
        }
        return null;
    },

    createFileStream: function(filePath, permissions) {
        try {
            var localFile;
            if (typeof filePath == "string") {
                localFile = Cc[NS_LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);
                Files.initPath(localFile, filePath);
            }
            else {
                localFile = filePath.QueryInterface(Ci.nsIFile);
            }

            if (localFile.exists()) {

                if (localFile.isDirectory() || !localFile.isWritable())
                    throw Components.results.NS_ERROR_FAILURE;

                if (!permissions)
                    permissions = localFile.permissions;
            }

            if (!permissions)
                permissions = DEFAULT_FILE_PERMS;

            var flags = NS_WRONLY | NS_CREATE_FILE | NS_TRUNCATE;

            var fileStream = Cc[NS_LOCALFILEOUTPUTSTREAM_CONTRACTID].createInstance(Ci.nsIFileOutputStream);

            fileStream.init(localFile, flags, permissions, 0);

            return fileStream;

        } catch (ex) {
            Files.lazyLog().ERROR("enigmailCore.jsm: createFileStream: Failed to create "+filePath+"\n");
            return null;
        }
    },

    // path initialization function
    // uses persistentDescriptor in case that initWithPath fails
    // (seems to happen frequently with UTF-8 characters in path names)
    initPath: function(localFileObj, pathStr) {
        localFileObj.initWithPath(pathStr);

        if (! localFileObj.exists()) {
            localFileObj.persistentDescriptor = pathStr;
        }
    }
};
