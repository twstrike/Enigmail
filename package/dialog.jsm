/*global Components: false, Locale: false */
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

const EXPORTED_SYMBOLS = [ "Dialog" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/locale.jsm");

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const gPromptSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);

const Dialog = {
    /***
     * Confirmation dialog with OK / Cancel buttons (both customizable)
     *
     * @win:         nsIWindow - parent window to display modal dialog; can be null
     * @mesg:        String    - message text
     * @okLabel:     String    - OPTIONAL label for OK button
     * @cancelLabel: String    - OPTIONAL label for cancel button
     *
     * @return:      Boolean   - true: OK pressed / false: Cancel or ESC pressed
     */
    confirmDlg: function (win, mesg, okLabel, cancelLabel) {
        var buttonTitles = 0;
        if (okLabel === null && cancelLabel === null) {
            buttonTitles = (gPromptSvc.BUTTON_TITLE_YES * BUTTON_POS_0) +
                           (gPromptSvc.BUTTON_TITLE_NO  * BUTTON_POS_1);
        } else {
            if (okLabel !== null) {
                buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_0);
            } else {
                buttonTitles += gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0;
            }

            if (cancelLabel !== null) {
                buttonTitles += (gPromptSvc.BUTTON_TITLE_IS_STRING * gPromptSvc.BUTTON_POS_1);
            } else {
                buttonTitles += gPromptSvc.BUTTON_TITLE_CANCEL * BUTTON_POS_1;
            }
        }

        let buttonPressed = gPromptSvc.confirmEx(win,
                                                 Locale.getString("enigConfirm"),
                                                 mesg,
                                                 buttonTitles,
                                                 okLabel, cancelLabel, null,
                                                 null, {});

        return (buttonPressed === 0);
    }
};
