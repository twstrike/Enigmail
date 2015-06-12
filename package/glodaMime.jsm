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

/*
 This module is a shim module to make it easier to load
 the Gloda Mime utilities from the various potential sources
*/

"use strict";

const EXPORTED_SYMBOLS = [ "msgHdrToMimeMessage",
                           "MimeMessage", "MimeContainer",
                           "MimeBody", "MimeUnknown",
                           "MimeMessageAttachment" ];

const Cu = Components.utils;

/*global MsgHdrToMimeMessage: false */
try {
    // TB with omnijar
    Cu.import("resource:///modules/gloda/mimemsg.js");
} catch (ex) {
    // "old style" TB
    Cu.import("resource://app/modules/gloda/mimemsg.js");
}

// The original naming is inconsistent with JS standards for classes vs functions
// Thus we rename it here.
const msgHdrToMimeMessage   = MsgHdrToMimeMessage;

// We don't need to explicitly create the other variables, since they will be
// imported into the current namespace anyway
