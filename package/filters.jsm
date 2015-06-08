/*global Components: false, enigmailDecryptPermanently: false, EnigmailCore: false, Log: false, Locale: false, Dialog: false */
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

var EXPORTED_SYMBOLS = [ "Filters" ];

Components.utils.import("resource://enigmail/enigmailCore.jsm");
Components.utils.import("resource://enigmail/enigmailConvert.jsm");
Components.utils.import("resource://enigmail/log.jsm");
Components.utils.import("resource://enigmail/locale.jsm");
Components.utils.import("resource://enigmail/dialog.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

/********************************************************************************
 Filter actions for decrypting messages permanently
 ********************************************************************************/

/***
 *  dispatchMessages
 *
 *  Because thunderbird throws all messages at once at us thus we have to rate limit the dispatching
 *  of the message processing. Because there is only a negligible performance gain when dispatching
 *  several message at once we serialize to not overwhelm low power devices.
 *
 *  The function is implemented such that the 1st call (requireSync == true) is a synchronous function,
 *  while any other call is asynchronous. This is required to make the filters work correctly in case
 *  there are other filters that work on the message. (see bug 374).
 *
 *  Parameters
 *   aMsgHdrs:     Array of nsIMsgDBHdr
 *   targetFolder: String; target folder URI
 *   move:         Boolean: type of action; true = "move" / false = "copy"
 *   requireSync:  Boolean: true = require  function to behave synchronously
 *                          false = async function (no useful return value)
 *
 **/

function dispatchMessages(aMsgHdrs, targetFolder, move, requireSync) {
    var inspector = Cc["@mozilla.org/jsinspector;1"].getService(Ci.nsIJSInspector);

    var promise = enigmailDecryptPermanently(aMsgHdrs[0], targetFolder, move);
    var done = false;

    var processNext = function (data) {
        aMsgHdrs.splice(0,1);
        if (aMsgHdrs.length > 0) {
            dispatchMessages(aMsgHdrs, targetFolder, move, false);
        }
        else {
            // last message was finished processing
            done = true;
            Log.DEBUG("enigmail.js: dispatchMessage: exit nested loop\n");
            inspector.exitNestedEventLoop();
        }
    };

    promise.then(processNext);

    promise.catch(function(err) {
        Log.ERROR("enigmail.js: dispatchMessage: caught error: "+err+"\n");
        processNext(null);
    });

    if (requireSync && ! done) {
        // wait here until all messages processed, such that the function returns
        // synchronously
        Log.DEBUG("enigmail.js: dispatchMessage: enter nested loop\n");
        inspector.enterNestedEventLoop({value : 0});
    }
}

/**
 * filter action for creating a decrypted version of the mail and
 * deleting the original mail at the same time
 */

const filterActionMoveDecrypt = {
    id: "enigmail@enigmail.net#filterActionMoveDecrypt",
    name: Locale.getString("filter.decryptMove.label"),
    value: "movemessage",
    apply: function (aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {

        Log.DEBUG("enigmail.js: filterActionMoveDecrypt: Move to: " + aActionValue + "\n");

        var msgHdrs = [];

        for(var i=0; i < aMsgHdrs.length; i++) {
            msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }

        dispatchMessages(msgHdrs, aActionValue, true, true);

        return;
    },

    isValidForType: function (type, scope) {
        return true;
    },

    validateActionValue: function (value, folder, type) {
        Dialog.alert(null, Locale.getString("filter.decryptMove.warnExperimental"));

        if (value === "") {
            return Locale.getString("filter.folderRequired");
        }

        return null;
    },

    allowDuplicates: false,
    isAsync: false,
    needsBody: true
};

/**
 * filter action for creating a decrypted copy of the mail, leaving the original
 * message untouched
 */
const filterActionCopyDecrypt = {
    id: "enigmail@enigmail.net#filterActionCopyDecrypt",
    name: Locale.getString("filter.decryptCopy.label"),
    value: "copymessage",
    apply: function (aMsgHdrs, aActionValue, aListener, aType, aMsgWindow) {
        Log.DEBUG("enigmail.js: filterActionCopyDecrypt: Copy to: " + aActionValue + "\n");

        var msgHdrs = [];

        for(var i=0; i < aMsgHdrs.length; i++) {
            msgHdrs.push(aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr));
        }

        dispatchMessages(msgHdrs, aActionValue, false, true);
        return;
    },

    isValidForType: function (type, scope) {
        return true;
    },

    validateActionValue: function (value, folder, type) {
        if( value === "") {
            return Locale.getString("filter.folderRequired");
        }

        return null;
    },

    allowDuplicates: false,
    isAsync: false,
    needsBody: true
};

const Filters = {
    registerAll: function() {
        var filterService = Cc["@mozilla.org/messenger/services/filters;1"].getService(Ci.nsIMsgFilterService);
        filterService.addCustomAction(filterActionMoveDecrypt);
        filterService.addCustomAction(filterActionCopyDecrypt);
    }
};
