/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global TestHelper: false, EnigmailGPG: false, withEnvironment: false, nsIWindowsRegKey: true */
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

do_load_module("file://" + do_get_cwd().path + "/testHelper.js");

testing("enigmailGpg.jsm");

// testing: determineGpgHomeDir
//   environment: GNUPGHOME
//   isWin32:
//     registry Software\GNU\GNUPG\HomeDir
//     environment: USERPROFILE + \Application Data\GnuPG
//     environment: SystemRoot + \Application Data\GnuPG
//     c:\gnupg
//   environment: HOME + .gnupg

test(function determineGpgHomeDirReturnsGNUPGHOMEIfExists() {
    withEnvironment({"GNUPGHOME": "stuffResult1"}, function(e) {
        var enigmail = {environment: e};
        Assert.equal("stuffResult1", EnigmailGPG.determineGpgHomeDir(enigmail));
    });
});

test(function determineGpgHomeDirReturnsHomePlusGnupgForNonWindowsIfNoGNUPGHOMESpecificed() {
    withEnvironment({"HOME": "/my/little/home"}, function(e) {
        var enigmail = {environment: e};
        Assert.equal("/my/little/home/.gnupg", EnigmailGPG.determineGpgHomeDir(enigmail));
    });
});

test(function determineGpgHomeDirReturnsRegistryValueForWindowsIfExists() {
    withEnvironment({}, function(e) {
        resetting(EnigmailGPG, 'getWinRegistryString', function(a, b, c) {
            if(a === "Software\\GNU\\GNUPG" && b === "HomeDir" && c === "foo bar") {
                return "\\foo\\bar\\gnupg";
            } else {
                return "\\somewhere\\else";
            }
        }, function() {
            var enigmail = {environment: e, isWin32: true};
            nsIWindowsRegKey = {ROOT_KEY_CURRENT_USER: "foo bar"};
            Assert.equal("\\foo\\bar\\gnupg", EnigmailGPG.determineGpgHomeDir(enigmail));
        });
    });
});

test(function determineGpgHomeDirReturnsUserprofileIfItExists() {
    withEnvironment({"USERPROFILE": "\\bahamas"}, function(e) {
        resetting(EnigmailGPG, 'getWinRegistryString', function(a, b, c) {}, function() {
            var enigmail = {environment: e, isWin32: true};
            nsIWindowsRegKey = {ROOT_KEY_CURRENT_USER: "foo bar"};
            Assert.equal("\\bahamas\\Application Data\\GnuPG", EnigmailGPG.determineGpgHomeDir(enigmail));
        });
    });
});

test(function determineGpgHomeDirReturnsSystemrootIfItExists() {
    withEnvironment({"SystemRoot": "\\tahiti"}, function(e) {
        resetting(EnigmailGPG, 'getWinRegistryString', function(a, b, c) {}, function() {
            var enigmail = {environment: e, isWin32: true};
            nsIWindowsRegKey = {ROOT_KEY_CURRENT_USER: "foo bar"};
            Assert.equal("\\tahiti\\Application Data\\GnuPG", EnigmailGPG.determineGpgHomeDir(enigmail));
        });
    });
});

test(function determineGpgHomeDirReturnsDefaultForWin32() {
    withEnvironment({}, function(e) {
        resetting(EnigmailGPG, 'getWinRegistryString', function(a, b, c) {}, function() {
            var enigmail = {environment: e, isWin32: true};
            nsIWindowsRegKey = {ROOT_KEY_CURRENT_USER: "foo bar"};
            Assert.equal("C:\\gnupg", EnigmailGPG.determineGpgHomeDir(enigmail));
        });
    });
});
