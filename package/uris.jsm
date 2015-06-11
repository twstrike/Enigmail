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
 *  Patrick Brunschwig <patrick@enigmail.net>
 *  Janosch Rux <rux@informatik.uni-luebeck.de>
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

const EXPORTED_SYMBOLS = [ "URIs" ];

const Cu = Components.utils;

Cu.import("resource://enigmail/log.jsm"); /*global Log: false */
Cu.import("resource://enigmail/data.jsm"); /*global Data: false */

const messageIdList = {};
const encryptedUris = [];

const URIs = {
    createMessageURI: function (originalUrl, contentType, contentCharset, contentData, persist) {
        Log.DEBUG("enigmail.js: Enigmail.createMessageURI: "+originalUrl+
                  ", "+contentType+", "+contentCharset+"\n");

        const messageId = "msg" + Math.floor(Math.random()*1.0e9);

        messageIdList[messageId] = {originalUrl:originalUrl,
                                    contentType:contentType,
                                    contentCharset:contentCharset,
                                    contentData:contentData,
                                    persist:persist};

        return "enigmail:message/"+messageId;
    },

    deleteMessageURI: function (uri) {
        Log.DEBUG("enigmail.js: Enigmail.deleteMessageURI: "+uri+"\n");

        const messageId = Data.extractMessageId(uri);

        if (!messageId) {
            return false;
        } else {
            return (delete messageIdList[messageId]);
        }
    },

    getMessageURI: function(messageId) {
        return messageIdList[messageId];
    },

    /*
     * remember the fact a URI is encrypted
     *
     * @param String msgUri
     *
     * @return null
     */
    rememberEncryptedUri: function (uri) {
        Log.DEBUG("uris.jsm: rememberEncryptedUri: uri="+uri+"\n");
        if (encryptedUris.indexOf(uri) < 0) {
            encryptedUris.push(uri);
        }
    },

    /*
     * unremember the fact a URI is encrypted
     *
     * @param String msgUri
     *
     * @return null
     */
    forgetEncryptedUri: function (uri) {
        Log.DEBUG("uris.jsm: forgetEncryptedUri: uri="+uri+"\n");
        const pos = encryptedUris.indexOf(uri);
        if (pos >= 0) {
            encryptedUris.splice(pos, 1);
        }
    },

    /*
     * determine if a URI was remebered as encrypted
     *
     * @param String msgUri
     *
     * @return: Boolean true if yes, false otherwise
     */
    isEncryptedUri: function (uri) {
        Log.DEBUG("uris.jsm: isEncryptedUri: uri="+uri+"\n");
        return encryptedUris.indexOf(uri) >= 0;
    },

    registerOn: function(target) {
        target.createMessageURI = URIs.createMessageURI;
        target.deleteMessageURI = URIs.deleteMessageURI;
    }
};
