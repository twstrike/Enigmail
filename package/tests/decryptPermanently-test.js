/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false */
/*global Cc: false, Ci: false */
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
 *  Iván Pazmiño <iapazmino@thoughtworks.com>
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

do_load_module("file://" + do_get_cwd().path + "/testHelper.js"); /*global TestHelper: false, component: false, withTestGpgHome: false, withEnigmail: false */
TestHelper.loadDirectly("tests/mailHelper.js"); /*global MailHelper: false */

testing("decryptPermanently.jsm"); /*global DecryptPermanently: false */
component("enigmail/keyRing.jsm"); /*global KeyRing: false */
/*global msgHdrToMimeMessage: false, MimeMessage: false, MimeContainer: false */
component("enigmail/glodaMime.jsm");
component("enigmail/streams.jsm"); /*global Streams: false */

test(withTestGpgHome(withEnigmail(function messageIsCopiedToNewDir() {
    loadSecretKey();
    MailHelper.cleanMailFolder(MailHelper.getRootFolder());
    const sourceFolder = MailHelper.createMailFolder("source-box");
    MailHelper.loadEmailToMailFolder("resources/encrypted-email.eml", sourceFolder);

    const header = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
    const targetFolder = MailHelper.createMailFolder("target-box");
    const move = false;
    const reqSync = true;
    DecryptPermanently.dispatchMessages([header], targetFolder.URI, move, reqSync);

    Assert.equal(targetFolder.getTotalMessages(false), 1);
    Assert.equal(sourceFolder.getTotalMessages(false), 1);
})));

test(withTestGpgHome(withEnigmail(function messageIsMovedToNewDir() {
    loadSecretKey();
    MailHelper.cleanMailFolder(MailHelper.rootFolder);
    const sourceFolder = MailHelper.createMailFolder("source-box");
    MailHelper.loadEmailToMailFolder("resources/encrypted-email.eml", sourceFolder);

    const header = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
    const targetFolder = MailHelper.createMailFolder("target-box");
    const move = true;
    const reqSync = true;
    DecryptPermanently.dispatchMessages([header], targetFolder.URI, move, reqSync);

    Assert.equal(targetFolder.getTotalMessages(false), 1);
    Assert.equal(sourceFolder.getTotalMessages(false), 0);
})));

test(withTestGpgHome(withEnigmail(function messageIsMovedAndDecrypted() {
    loadSecretKey();
    MailHelper.cleanMailFolder(MailHelper.rootFolder);
    const sourceFolder = MailHelper.createMailFolder("source-box");
    MailHelper.loadEmailToMailFolder("resources/encrypted-email.eml", sourceFolder);

    const header = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
    const targetFolder = MailHelper.createMailFolder("target-box");
    const move = true;
    const reqSync = true;
    DecryptPermanently.dispatchMessages([header], targetFolder.URI, move, reqSync);

    const dispatchedHeader = MailHelper.fetchFirstMessageHeaderIn(targetFolder);
    do_test_pending();
    msgHdrToMimeMessage(
        dispatchedHeader,
        null,
        function(header, mime) {
            Assert.ok(!mime.isEncrypted);
            Assert.assertContains(mime.parts[0].body, "This is encrypted");
            do_test_finished();
        },
        false
    );
})));

test(withTestGpgHome(withEnigmail(function messageWithAttachemntIsMovedAndDecrypted() {
    loadSecretKey();
    loadPublicKey();
    MailHelper.cleanMailFolder(MailHelper.getRootFolder());
    const sourceFolder = MailHelper.createMailFolder("source-box");
    MailHelper.loadEmailToMailFolder("resources/encrypted-email-with-attachment.eml", sourceFolder);

    const header = MailHelper.fetchFirstMessageHeaderIn(sourceFolder);
    const targetFolder = MailHelper.createMailFolder("target-box");
    const move = true;
    const reqSync = true;
    DecryptPermanently.dispatchMessages([header], targetFolder.URI, move, reqSync);

    const dispatchedHeader = MailHelper.fetchFirstMessageHeaderIn(targetFolder);
    do_test_pending();
    msgHdrToMimeMessage(
        dispatchedHeader,
        null,
        function(header, mime) {
            Assert.ok(!mime.isEncrypted);
            Assert.assertContains(mime.parts[0].parts[0].body, "This is encrypted");
            const atts = extractAttachments(mime);
            Assert.ok(!atts[0].isEncrypted);
            Assert.assertContains(atts[0].body, "This is an attachment.");
            do_test_finished();
        },
        false
    );
})));

var loadSecretKey = function() {
    const secretKey = do_get_file("resources/dev-strike.sec", false);
    KeyRing.importKeyFromFile(null, secretKey, [], {});
};

var loadPublicKey = function() {
     const publicKey = do_get_file("resources/dev-strike.asc", false);
     KeyRing.importKeyFromFile(null, publicKey, [], {});
};

function stringFromUrl(url) {
    const inspector = Cc["@mozilla.org/jsinspector;1"].getService(Ci.nsIJSInspector);
    let result = null;
    const p = new Promise(function(resolve, reject) {
        const iOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        const uri = iOService.newURI(url, null, null);
        const attChannel = iOService.newChannelFromURI(uri);
        const listener = Streams.newStringStreamListener(function(data) {
        result = data;
        inspector.exitNestedEventLoop();
        resolve();
        });
        attChannel.asyncOpen(listener, uri);
    });

    if(!result) {
        inspector.enterNestedEventLoop({value : 0});
    }
    return result;
}

function extractAttachment(att) {
    const name = att.name;
    const body = stringFromUrl(att.url);
    const isEncrypted = att.isEncrypted;
    return {
        name: name,
        body: body,
        isEncrypted: isEncrypted
    };
}

function extractAttachments(msg) {
    const result = [];
    for(let i=0; i < msg.allAttachments.length; i++){
        result.push(extractAttachment(msg.allAttachments[i]));
    }
    return result;
}
