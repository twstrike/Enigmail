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
 *  Ramalingam Saravanan <svn@xmlterm.org>
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

const EXPORTED_SYMBOLS = [ "HttpProxy" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */

const NS_PREFS_SERVICE_CID = "@mozilla.org/preferences-service;1";

function getPasswdForHost(hostname, userObj, passwdObj) {
    var loginmgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

    // search HTTP password 1st
    var logins = loginmgr.findLogins({}, "http://"+hostname, "", "");
    if (logins.length > 0) {
        userObj.value = logins[0].username;
        passwdObj.value = logins[0].password;
        return true;
    }

    // look for any other password for same host
    logins = loginmgr.getAllLogins({});
    for (var i=0; i < logins.lenth; i++) {
        if (hostname == logins[i].hostname.replace(/^.*:\/\//, "")) {
            userObj.value = logins[i].username;
            passwdObj.value = logins[i].password;
            return true;
        }
    }
    return false;
}

const HttpProxy = {
  /**
   *  get Proxy for a given hostname as configured in Mozilla
   *
   *  @hostname: String - the host to check if there is a proxy.
   *
   *  @return: String - proxy host URL to provide to GnuPG
   *                    null if no proxy required
   */
  getHttpProxy: function (hostName) {
      var proxyHost = null;
      if (Prefs.getPref("respectHttpProxy")) {
          // determine proxy host
          var prefsSvc = Cc[NS_PREFS_SERVICE_CID].getService(Ci.nsIPrefService);
          var prefRoot = prefsSvc.getBranch(null);
          var useProxy = prefRoot.getIntPref("network.proxy.type");
          if (useProxy==1) {
              var proxyHostName = prefRoot.getCharPref("network.proxy.http");
              var proxyHostPort = prefRoot.getIntPref("network.proxy.http_port");
              var noProxy = prefRoot.getCharPref("network.proxy.no_proxies_on").split(/[ ,]/);
              for (var i=0; i<noProxy.length; i++) {
                  var proxySearch=new RegExp(noProxy[i].replace(/\./g, "\\.").replace(/\*/g, ".*")+"$", "i");
                  if (noProxy[i] && hostName.search(proxySearch)>=0) {
                      i=noProxy.length+1;
                      proxyHostName=null;
                  }
              }

              if (proxyHostName) {
                  var userObj = {};
                  var passwdObj = {};
                  if (getPasswdForHost(proxyHostName, userObj, passwdObj)) {
                      proxyHostName = userObj.value+":"+passwdObj.value+"@"+proxyHostName;
                  }
              }
              if (proxyHostName && proxyHostPort) {
                  proxyHost="http://"+proxyHostName+":"+proxyHostPort;
              }
          }
      }

      return proxyHost;
  }
};
