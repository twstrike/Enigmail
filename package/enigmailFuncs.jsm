/*global Components: false, escape: false */
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
 * Copyright (C) 2011 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
 *  Marius Stübs <marius.stuebs@riseup.net>
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

/*
 * Common Enigmail crypto-related GUI functionality
 *
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/enigmailCommon.jsm"); /*global EnigmailCommon: false */
Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/files.jsm"); /*global Files: false */
Cu.import("resource://enigmail/locale.jsm"); /*global Locale: false */
Cu.import("resource://enigmail/data.jsm"); /*global Data: false */
Cu.import("resource://enigmail/dialog.jsm"); /*global Dialog: false */
Cu.import("resource://enigmail/windows.jsm"); /*global Windows: false */
Cu.import("resource://enigmail/time.jsm"); /*global Time: false */
Cu.import("resource://enigmail/prefs.jsm"); /*global Prefs: false */
Cu.import("resource://enigmail/trust.jsm"); /*global Trust: false */
Cu.import("resource://enigmail/keyRing.jsm"); /*global KeyRing: false */

const EXPORTED_SYMBOLS = [ "EnigmailFuncs" ];

const IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const KEY_TRUST_ID=1;
const KEY_ID = 4;
const CREATED_ID = 5;
const EXPIRY_ID = 6;
const UID_ID = 7;
const OWNERTRUST_ID = 8;
const USERID_ID = 9;
const SIG_TYPE_ID = 10;
const KEY_USE_FOR_ID = 11;

var gTxtConverter = null;

const EnigmailFuncs = {
  /**
   * get a list of plain email addresses without name or surrounding <>
   * @mailAddrs |string| - address-list as specified in RFC 2822, 3.4
   *                       separated by ","
   *
   * @return |string|    - list of pure email addresses separated by ","
   */
  stripEmail: function (mailAddrs)
  {

    var qStart, qEnd;
    while ((qStart = mailAddrs.indexOf('"')) != -1) {
       qEnd = mailAddrs.indexOf('"', qStart+1);
       if (qEnd == -1) {
         Log.ERROR("enigmailFuncs.jsm: stripEmail: Unmatched quote in mail address: "+mailAddrs+"\n");
         throw Components.results.NS_ERROR_FAILURE;
       }

       mailAddrs = mailAddrs.substring(0,qStart) + mailAddrs.substring(qEnd+1);
    }

    // Eliminate all whitespace, just to be safe
    mailAddrs = mailAddrs.replace(/\s+/g,"");

    // Extract pure e-mail address list (stripping out angle brackets)
    mailAddrs = mailAddrs.replace(/(^|,)[^,]*<([^>]+)>[^,]*/g,"$1$2");

    return mailAddrs;
  },

  /**
   * Hide all menu entries and other XUL elements that are considered for
   * advanced users. The XUL items must contain 'advanced="true"' or
   * 'advanced="reverse"'.
   *
   * @obj:       |object| - XUL tree element
   * @attribute: |string| - attribute to set or remove (i.e. "hidden" or "collapsed")
   * @dummy:     |object| - anything
   *
   * no return value
   */


  collapseAdvanced: function (obj, attribute, dummy)
  {
    Log.DEBUG("enigmailFuncs.jsm: collapseAdvanced:\n");

    var advancedUser = Prefs.getPref("advancedUser");

    obj = obj.firstChild;
    while (obj) {
      if (obj.getAttribute("advanced") == "true") {
        if (advancedUser) {
          obj.removeAttribute(attribute);
        }
        else {
          obj.setAttribute(attribute, "true");
        }
      }
      else if (obj.getAttribute("advanced") == "reverse") {
        if (advancedUser) {
          obj.setAttribute(attribute, "true");
        }
        else {
          obj.removeAttribute(attribute);
        }
      }

      obj = obj.nextSibling;
    }
  },


  /**
   * Return fingerprint for a given key ID
   *
   * @keyId:  String of 8 or 16 chars key with optionally leading 0x
   *
   * @return: String containing the fingerprint or null if key not found
   */
  getFingerprintForKey: function(keyId) {
    // TODO: move [keys]

    let enigmailSvc = EnigmailCommon.getService();
    let keyList = KeyRing.getKeyListEntryOfKey(keyId);
    let keyListObj = {};
    this.createKeyObjects(keyList.replace(/(\r\n|\r)/g, "\n").split(/\n/), keyListObj);

    if (keyListObj.keySortList.length > 0) {
      return keyListObj.keyList[keyListObj.keySortList[0].keyId].fpr;
    }
    else {
      return null;
    }

  },

  /**
   * Create a list of objects representing the keys in a key list
   *
   * @keyListString: array of |string| formatted output from GnuPG for key listing
   * @keyListObj:    |object| holding the resulting key list:
   *                     obj.keyList:     Array holding key objects
   *                     obj.keySortList: Array holding values to make sorting easier
   *
   * no return value
   */
  createKeyObjects: function (keyListString, keyListObj) {
    // TODO: move [keys]

    keyListObj.keyList = [];
    keyListObj.keySortList = [];

    var keyObj = {};
    var i;
    var uatNum=0; // counter for photos (counts per key)

    const TRUSTLEVELS_SORTED = Trust.trustLevelsSorted();

    for (i=0; i<keyListString.length; i++) {
      var listRow=keyListString[i].split(/:/);
      if (listRow.length>=0) {
        switch (listRow[0]) {
        case "pub":
          keyObj = {};
          uatNum = 0;
          keyObj.expiry=Time.getDateTime(listRow[EXPIRY_ID], true, false);
          keyObj.expiryTime = Number(listRow[EXPIRY_ID]);
          keyObj.created=Time.getDateTime(listRow[CREATED_ID], true, false);
          keyObj.keyId=listRow[KEY_ID];
          keyObj.keyTrust=listRow[KEY_TRUST_ID];
          keyObj.keyUseFor=listRow[KEY_USE_FOR_ID];
          keyObj.ownerTrust=listRow[OWNERTRUST_ID];
          keyObj.SubUserIds=[];
          keyObj.subKeys=[];
          keyObj.fpr="";
          keyObj.photoAvailable=false;
          keyObj.secretAvailable=false;
          keyListObj.keyList[listRow[KEY_ID]] = keyObj;
          break;
        case "fpr":
          // only take first fpr line, this is the fingerprint of the primary key and what we want
          if (keyObj.fpr==="") {
            keyObj.fpr=listRow[USERID_ID];
          }
          break;
        case "uid":
          if (listRow[USERID_ID].length === 0) {
            listRow[USERID_ID] = "-";
          }
          if (typeof(keyObj.userId) != "string") {
            keyObj.userId=Data.convertGpgToUnicode(listRow[USERID_ID]);
            keyListObj.keySortList.push({
              userId: keyObj.userId.toLowerCase(),
              keyId: keyObj.keyId
            });
            if (TRUSTLEVELS_SORTED.indexOf(listRow[KEY_TRUST_ID]) < TRUSTLEVELS_SORTED.indexOf(keyObj.keyTrust)) {
              // reduce key trust if primary UID is less trusted than public key
              keyObj.keyTrust = listRow[KEY_TRUST_ID];
            }
          }
          else {
            var subUserId = {
              userId: Data.convertGpgToUnicode(listRow[USERID_ID]),
              keyTrust: listRow[KEY_TRUST_ID],
              type: "uid"
            };
            keyObj.SubUserIds.push(subUserId);
          }
          break;
        case "sub":
          {
            var subKey = {
              keyId: listRow[KEY_ID],
              type: "sub"
            };
            keyObj.subKeys.push(subKey);
          }
          break;
        case "uat":
          if (listRow[USERID_ID].indexOf("1 ")===0) {
            var userId=Locale.getString("userAtt.photo");
            keyObj.SubUserIds.push({userId: userId,
                                    keyTrust:listRow[KEY_TRUST_ID],
                                    type: "uat",
                                    uatNum: uatNum});
            keyObj.photoAvailable=true;
            ++uatNum;
          }
        }
      }
    }
  },

  /**
   * Load the key list into memory and return it sorted by a specified column
   *
   * @win        - |object|  holding the parent window for displaying error messages
   * @refresh    - |boolean| if true, cache is cleared and all keys are loaded from GnuPG
   * @keyListObj - |object|  holding the resulting key list
   * @sortColumn - |string|  containing the column name for sorting. One of:
   *                         userid, keyid, keyidshort, fpr, keytype, validity, trust, expiry
   * @sortDirection - |number| 1 = ascending / -1 = descending
   *
   * no return value
   */
  loadKeyList: function (win, refresh, keyListObj, sortColumn, sortDirection)
  {
    // TODO: move [keys]
    Log.DEBUG("enigmailFuncs.jsm: loadKeyList\n");

    if (! sortColumn) sortColumn = "userid";
    if (! sortDirection) sortDirection = 1;

    const TRUSTLEVELS_SORTED = Trust.trustLevelsSorted();

    var sortByKeyId = function (a, b) {
      return (a.keyId < b.keyId) ? -sortDirection : sortDirection;
    };

    var sortByKeyIdShort = function (a, b) {
      return (a.keyId.substr(-8,8) < b.keyId.substr(-8 ,8)) ? -sortDirection : sortDirection;
    };

    var sortByUserId = function (a, b) {
      return (a.userId < b.userId) ? -sortDirection : sortDirection;
    };

    var sortByFpr = function (a, b) {
      return (keyListObj.keyList[a.keyId].fpr < keyListObj.keyList[b.keyId].fpr) ? -sortDirection : sortDirection;
    };

    var sortByKeyType = function (a, b) {
      return (keyListObj.keyList[a.keyId].secretAvailable < keyListObj.keyList[b.keyId].secretAvailable) ? -sortDirection : sortDirection;
    };


    var sortByValidity = function (a, b) {
      return (TRUSTLEVELS_SORTED.indexOf(Trust.getTrustCode(keyListObj.keyList[a.keyId])) < TRUSTLEVELS_SORTED.indexOf(Trust.getTrustCode(keyListObj.keyList[b.keyId]))) ? -sortDirection : sortDirection;
    };

    var sortByTrust = function (a, b) {
      return (TRUSTLEVELS_SORTED.indexOf(keyListObj.keyList[a.keyId].ownerTrust) < TRUSTLEVELS_SORTED.indexOf(keyListObj.keyList[b.keyId].ownerTrust)) ? -sortDirection : sortDirection;
    };

    var sortByExpiry = function (a, b) {
      return (keyListObj.keyList[a.keyId].expiryTime < keyListObj.keyList[b.keyId].expiryTime) ? -sortDirection : sortDirection;
    };

    var aGpgUserList = this.obtainKeyList(win, false, refresh);
    if (!aGpgUserList) return;

    var aGpgSecretsList = this.obtainKeyList(win, true, refresh);
    if (!aGpgSecretsList && !refresh) {
      if (Dialog.confirmDlg(Locale.getString("noSecretKeys"),
            Locale.getString("keyMan.button.generateKey"),
            Locale.getString("keyMan.button.skip"))) {
        Windows.openKeyGen();
        this.loadKeyList(win, true, keyListObj);
      }
    }

    this.createKeyObjects(aGpgUserList, keyListObj);

    // search and mark keys that have secret keys
    for (let i=0; i<aGpgSecretsList.length; i++) {
       let listRow=aGpgSecretsList[i].split(/:/);
       if (listRow.length>=0) {
         if (listRow[0] == "sec") {
           if (typeof(keyListObj.keyList[listRow[KEY_ID]]) == "object") {
             keyListObj.keyList[listRow[KEY_ID]].secretAvailable=true;
           }
         }
       }
    }

    switch (sortColumn.toLowerCase()) {
    case "keyid":
      keyListObj.keySortList.sort(sortByKeyId);
      break;
    case "keyidshort":
      keyListObj.keySortList.sort(sortByKeyIdShort);
      break;
    case "fpr":
      keyListObj.keySortList.sort(sortByFpr);
      break;
    case "keytype":
      keyListObj.keySortList.sort(sortByKeyType);
      break;
    case "validity":
      keyListObj.keySortList.sort(sortByValidity);
      break;
    case "trust":
      keyListObj.keySortList.sort(sortByTrust);
      break;
    case "expiry":
      keyListObj.keySortList.sort(sortByExpiry);
      break;
    default:
      keyListObj.keySortList.sort(sortByUserId);
    }
  },

  /**
   * Get key list from GnuPG. If the keys may be pre-cached already
   *
   * @win        - |object| parent window for displaying error messages
   * @secretOnly - |boolean| true: get secret keys / false: get public keys
   * @refresh    - |boolean| if true, cache is cleared and all keys are loaded from GnuPG
   *
   * @return - |array| of : separated key list entries as specified in GnuPG doc/DETAILS
   */
  obtainKeyList: function (win, secretOnly, refresh)
  {
    // TODO: move [keys]
    Log.DEBUG("enigmailFuncs.jsm: obtainKeyList\n");

    var userList = null;
    try {
      var exitCodeObj = {};
      var statusFlagsObj = {};
      var errorMsgObj = {};

      var enigmailSvc = EnigmailCommon.getService(win);
      if (! enigmailSvc) return null;

      userList = KeyRing.getUserIdList(secretOnly,
                                           refresh,
                                           exitCodeObj,
                                           statusFlagsObj,
                                           errorMsgObj);
      if (exitCodeObj.value !== 0) {
        Dialog.alert(win, errorMsgObj.value);
        return null;
      }
    } catch (ex) {
      Log.ERROR("ERROR in enigmailFuncs: obtainKeyList"+ex.toString()+"\n");
    }

    if (typeof(userList) == "string") {
      return userList.split(/\n/);
    }
    else {
      return [];
    }
  },

  /**
   * determine default values for signing and encryption.
   * Translates "old-style" defaults (pre-Enigmail v1.0) to "current" defaults
   *
   * @identiy - nsIMsgIdentity object
   *
   * no return values
   */
  getSignMsg: function (identity)
  {
    Log.DEBUG("enigmailFuncs.jsm: getSignMsg: identity.key="+identity.key+"\n");
    var sign = null;

    Prefs.getPref("configuredVersion"); // dummy call to getPref to ensure initialization

    var prefRoot = Prefs.getPrefRoot();

    if (prefRoot.getPrefType("mail.identity."+identity.key+".pgpSignPlain")===0) {
      if (prefRoot.getPrefType("mail.identity."+identity.key+".pgpSignMsg")===0) {
        sign=identity.getBoolAttribute("pgpAlwaysSign");
        identity.setBoolAttribute("pgpSignEncrypted", sign);
        identity.setBoolAttribute("pgpSignPlain", sign);
      }
      else {
        sign = identity.getIntAttribute("pgpSignMsg");
        identity.setBoolAttribute("pgpSignEncrypted", sign==1);
        identity.setBoolAttribute("pgpSignPlain", sign>0);
      }
      prefRoot.deleteBranch("mail.identity."+identity.key+".pgpSignMsg");
      prefRoot.deleteBranch("mail.identity."+identity.key+".pgpAlwaysSign");
    }
  },


  /**
   * this function tries to mimic the Thunderbird plaintext viewer
   *
   * @plainTxt - |string| containing the plain text data
   *
   * @ return HTML markup to display mssage
   */

  formatPlaintextMsg: function (plainTxt)
  {
    if (! gTxtConverter)
      gTxtConverter = Cc["@mozilla.org/txttohtmlconv;1"].createInstance(Ci.mozITXTToHTMLConv);

    var prefRoot = Prefs.getPrefRoot();
    var fontStyle = "";

    // set the style stuff according to perferences

    switch (prefRoot.getIntPref("mail.quoted_style")) {
      case 1:
        fontStyle="font-weight: bold; "; break;
      case 2:
        fontStyle="font-style: italic; "; break;
      case 3:
        fontStyle="font-weight: bold; font-style: italic; "; break;
    }

    switch (prefRoot.getIntPref("mail.quoted_size")) {
    case 1:
      fontStyle += "font-size: large; "; break;
    case 2:
      fontStyle += "font-size: small; "; break;
    }

    fontStyle += "color: "+prefRoot.getCharPref("mail.citation_color")+";";

    var convFlags = Ci.mozITXTToHTMLConv.kURLs;
    if (prefRoot.getBoolPref("mail.display_glyph"))
        convFlags |= Ci.mozITXTToHTMLConv.kGlyphSubstitution;
    if (prefRoot.getBoolPref("mail.display_struct"))
        convFlags |= Ci.mozITXTToHTMLConv.kStructPhrase;

    // start processing the message

    plainTxt = plainTxt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = plainTxt.split(/\n/);
    var oldCiteLevel = 0;
    var citeLevel = 0;
    var preface = "";
    var logLineStart = { value: 0 };
    var isSignature = false;

    for (var i=0; i < lines.length; i++) {
      preface = "";
      oldCiteLevel = citeLevel;
      if (lines[i].search(/^[\> \t]*\>$/) === 0)
        lines[i]+=" ";

      citeLevel = gTxtConverter.citeLevelTXT(lines[i], logLineStart);

      if (citeLevel > oldCiteLevel) {

        preface='</pre>';
        for (let j=0; j < citeLevel - oldCiteLevel; j++) {
          preface += '<blockquote type="cite" style="'+fontStyle+'">';
        }
        preface += '<pre wrap="">\n';
      }
      else if (citeLevel < oldCiteLevel) {
        preface='</pre>';
        for (let j = 0; j < oldCiteLevel - citeLevel; j++)
          preface += "</blockquote>";

        preface += '<pre wrap="">\n';
      }

      if (logLineStart.value > 0) {
        preface += '<span class="moz-txt-citetags">' +
            gTxtConverter.scanTXT(lines[i].substr(0, logLineStart.value), convFlags) +
            '</span>';
      }
      else if (lines[i] == "-- ") {
        preface+='<div class=\"moz-txt-sig\">';
        isSignature = true;
      }
      lines[i] = preface + gTxtConverter.scanTXT(lines[i].substr(logLineStart.value), convFlags);

    }

    var r='<pre wrap="">' + lines.join("\n") + (isSignature ? '</div>': '') + '</pre>';
    //Log.DEBUG("enigmailFuncs.jsm: r='"+r+"'\n");
    return r;
  },


  /**
   * extract the data fields following a header.
   * e.g. ContentType: xyz; Aa=b; cc=d
   * @data: |string| containing a single header
   *
   * @return |array| of |arrays| containing pairs of aa/b and cc/d
   */
  getHeaderData: function (data) {
    Log.DEBUG("enigmailFuncs.jsm: getHeaderData: "+data.substr(0, 100)+"\n");
    var a = data.split(/\n/);
    var res = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i].length === 0) break;
      let b = a[i].split(/;/);

      // extract "abc = xyz" tuples
      for (let j=0; j < b.length; j++) {
        let m = b[j].match(/^(\s*)([^=\s;]+)(\s*)(=)(\s*)(.*)(\s*)$/);
        if (m) {
          // m[2]: identifier / m[6]: data
          res[m[2].toLowerCase()] = m[6].replace(/\s*$/, "");
          Log.DEBUG("enigmailFuncs.jsm: getHeaderData: "+m[2].toLowerCase()+" = "+res[m[2].toLowerCase()] +"\n");
        }
      }
      if (i === 0 && a[i].indexOf(";") < 0) break;
      if (i > 0 && a[i].search(/^\s/) < 0) break;
    }
    return res;
  }
};
