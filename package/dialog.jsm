/*global Components: false, Locale: false, Log: false, Windows: false, Prefs: false */
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

const EXPORTED_SYMBOLS = [ "Dialog" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://enigmail/locale.jsm");
Cu.import("resource://enigmail/log.jsm");
Cu.import("resource://enigmail/windows.jsm");
Cu.import("resource://enigmail/prefs.jsm");

const BUTTON_POS_0           = 1;
const BUTTON_POS_1           = 1 << 8;
const BUTTON_POS_2           = 1 << 16;

const gPromptSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);

const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

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
    },

    /**
     * Displays an alert dialog.
     *
     * @win:         nsIWindow - parent window to display modal dialog; can be null
     * @mesg:        String    - message text
     *
     * no return value
     */
    alert: function (win, mesg) {
        if (mesg.length > 1000) {
            Dialog.longAlert(win, mesg, null, Locale.getString("dlg.button.close"));
        } else {
            try {
                gPromptSvc.alert(win, Locale.getString("enigAlert"), mesg);
            }
            catch(ex) {
                Log.writeException("alert" , ex);
            }
        }
    },

    /**
     * Displays an alert dialog with 1-3 optional buttons.
     *
     * @win:           nsIWindow - parent window to display modal dialog; can be null
     * @mesg:          String    - message text
     * @checkBoxLabel: String    - if not null, display checkbox with text; the
     *                             checkbox state is returned in checkedObj.value
     * @button-Labels: String    - use "&" to indicate access key
     *     use "buttonType:label" or ":buttonType" to indicate special button types
     *        (buttonType is one of cancel, help, extra1, extra2)
     * @checkedObj:    Object    - holding the checkbox value
     *
     * @return: 0-2: button Number pressed
     *          -1: ESC or close window button pressed
     *
     */
    longAlert: function (win, mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj) {
        var result = {
            value: -1,
            checked: false
        };

        if (! win) {
            win = Windows.getBestParentWin();
        }

        win.openDialog("chrome://enigmail/content/enigmailAlertDlg.xul", "",
                       "chrome,dialog,modal,centerscreen",
                       {
                           msgtext: mesg,
                           checkboxLabel: checkBoxLabel,
                           button1: okLabel,
                           button2: labelButton2,
                           button3: labelButton3
                       },
                       result);

        if (checkBoxLabel) {
            checkedObj.value=result.checked;
        }
        return result.value;
    },

    /**
     * Display a dialog with a message and a text entry field
     *
     * @win:      nsIWindow - parent window to display modal dialog; can be null
     * @mesg:     String    - message text
     * @valueObj: Object    - object to hold the entered text in .value
     *
     * @return:   Boolean - true if OK was pressed / false otherwise
     */
    promptValue: function (win, mesg, valueObj) {
        return gPromptSvc.prompt(win, Locale.getString("enigPrompt"),
                                 mesg, valueObj, "", {});
    },

    /**
     * Display an alert message with an OK button and a checkbox to hide
     * the message in the future.
     * In case the checkbox was pressed in the past, the dialog is skipped
     *
     * @win:      nsIWindow - the parent window to hold the modal dialog
     * @mesg:     String    - the localized message to display
     * @prefText: String    - the name of the Enigmail preference to read/store the
     *                        the future display status
     */
    alertPref: function (win, mesg, prefText) {
        const display = true;
        const dontDisplay = false;

        let prefValue = Prefs.getPref(prefText);
        if(prefValue === display) {
            let checkBoxObj = { value: false } ;
            let buttonPressed = gPromptSvc.confirmEx(win,
                                                     Locale.getString("enigAlert"),
                                                     mesg,
                                                     (gPromptSvc.BUTTON_TITLE_OK * BUTTON_POS_0),
                                                     null, null, null,
                                                     Locale.getString("dlgNoPrompt"), checkBoxObj);
            if (checkBoxObj.value && buttonPressed === 0) {
                Prefs.setPref(prefText, dontDisplay);
            }
        }
    },

    /**
     * Display an alert dialog together with the message "this dialog will be
     * displayed |counter| more times".
     * If |counter| is 0, the dialog is not displayed.
     *
     * @win:           nsIWindow - the parent window to hold the modal dialog
     * @countPrefName: String    - the name of the Enigmail preference to read/store the
     *                             the |counter| value
     * @mesg:          String    - the localized message to display
     *
     */
    alertCount: function (win, countPrefName, mesg) {
        let alertCount = Prefs.getPref(countPrefName);

        if (alertCount <= 0)
            return;

        alertCount--;
        Prefs.setPref(countPrefName, alertCount);

        if (alertCount > 0) {
            mesg += Locale.getString("repeatPrefix", [ alertCount ]) + " ";
            mesg += (alertCount == 1) ? Locale.getString("repeatSuffixSingular") : Locale.getString("repeatSuffixPlural");
        } else {
            mesg += Locale.getString("noRepeat");
        }

        Dialog.alert(win, mesg);
    },

    /**
     * Display a confirmation dialog with OK / Cancel buttons (both customizable) and
     * a checkbox to remember the selected choice.
     *
     *
     * @win:         nsIWindow - parent window to display modal dialog; can be null
     * @mesg:        String    - message text
     * @prefText     String    - the name of the Enigmail preference to read/store the
     *                           the future display status.
     *                           the default action is chosen
     * @okLabel:     String    - OPTIONAL label for OK button
     * @cancelLabel: String    - OPTIONAL label for cancel button
     *
     * @return:      Boolean   - true: 1 pressed / 0: Cancel pressed / -1: ESC pressed
     *
     * If the dialog is not displayed:
     *  - if @prefText is type Boolean: return 1
     *  - if @prefText is type Number:  return the last choice of the user
     */
    confirmPref: function (win, mesg, prefText, okLabel, cancelLabel) {
        const notSet = 0;
        const yes = 1;
        const no = 2;
        const display = true;
        const dontDisplay = false;

        var buttonTitles = 0;
        if (okLabel === null && cancelLabel === null) {
            buttonTitles = (gPromptSvc.BUTTON_TITLE_YES * BUTTON_POS_0) +
                (gPromptSvc.BUTTON_TITLE_NO * BUTTON_POS_1);
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

        var prefValue = Prefs.getPref(prefText);

        if (typeof(prefValue) != "boolean") {
            // number: remember user's choice
            switch (prefValue) {
            case notSet:
                let checkBoxObj = { value: false} ;
                let buttonPressed = gPromptSvc.confirmEx(win,
                                                         Locale.getString("enigConfirm"),
                                                         mesg,
                                                         buttonTitles,
                                                         okLabel, cancelLabel, null,
                                                         Locale.getString("dlgKeepSetting"), checkBoxObj);
                if (checkBoxObj.value) {
                    Prefs.setPref(prefText, (buttonPressed===0 ? yes : no));
                }
                return (buttonPressed===0 ? 1 : 0);
            case yes:
                return 1;
            case no:
                return 0;
            default:
                return -1;
            }
        } else {
            // boolean: "do not show this dialog anymore" (and return default)
            switch (prefValue) {
            case display:
                let checkBoxObj = { value: false} ;
                let buttonPressed = gPromptSvc.confirmEx(win,
                                                         Locale.getString("enigConfirm"),
                                                         mesg,
                                                         buttonTitles,
                                                         okLabel, cancelLabel, null,
                                                         Locale.getString("dlgNoPrompt"), checkBoxObj);
                if (checkBoxObj.value) {
                    Prefs.setPref(prefText, false);
                }
                return (buttonPressed===0 ? 1 : 0);
            case dontDisplay:
                return 1;
            default:
                return -1;
            }
        }
    },

    /**
     *  Display a "open file" or "save file" dialog
     *
     *  win:              nsIWindow - parent window
     *  title:            String    - window title
     *  displayDir:       String    - optional: directory to be displayed
     *  save:             Boolean   - true = Save file / false = Open file
     *  defaultExtension: String    - optional: extension for the type of files to work with, e.g. "asc"
     *  defaultName:      String    - optional: filename, incl. extension, that should be suggested to
     *                                the user as default, e.g. "keys.asc"
     *  filterPairs:      Array     - optional: [title, extension], e.g. ["Pictures", "*.jpg; *.png"]
     *
     *  return value:     nsIFile object representing the file to load or save
     */
    filePicker: function (win, title, displayDir, save, defaultExtension, defaultName, filterPairs) {
        Log.DEBUG("enigmailCommon.jsm: filePicker: "+save+"\n");

        let filePicker = Cc["@mozilla.org/filepicker;1"].createInstance();
        filePicker = filePicker.QueryInterface(Ci.nsIFilePicker);

        let mode = save ? Ci.nsIFilePicker.modeSave : Ci.nsIFilePicker.modeOpen;

        filePicker.init(win, title, mode);

        if (displayDir) {
            var localFile = Cc[LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);

            try {
                localFile.initWithPath(displayDir);
                filePicker.displayDirectory = localFile;
            } catch (ex) {
            }
        }

        if (defaultExtension) {
            filePicker.defaultExtension = defaultExtension;
        }

        if (defaultName) {
            filePicker.defaultString=defaultName;
        }

        let nfilters = 0;
        if (filterPairs && filterPairs.length) {
            nfilters = filterPairs.length / 2;
        }

        for (let index=0; index < nfilters; index++) {
            filePicker.appendFilter(filterPairs[2*index], filterPairs[2*index+1]);
        }

        filePicker.appendFilters(Ci.nsIFilePicker.filterAll);

        if (filePicker.show() == Ci.nsIFilePicker.returnCancel) {
            return null;
        }

        return filePicker.file.QueryInterface(Ci.nsIFile);
    },

    /**
     * return a pre-initialized prompt service
     */
    getPromptSvc: function() {
        return gPromptSvc;
    }
};

Windows.alert = Dialog.alert;
