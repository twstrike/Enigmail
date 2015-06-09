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

const EXPORTED_SYMBOLS = [ "Gpg" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const Gpg = {
    agentVersion: "",

    /***
     determine if a specific feature is available in the GnuPG version used

     @featureName:  String; one of the following values:
     version-supported    - is the gpg version supported at all (true for gpg >= 2.0.7)
     supports-gpg-agent   - is gpg-agent is usually provided (true for gpg >= 2.0)
     autostart-gpg-agent  - is gpg-agent started automatically by gpg (true for gpg >= 2.0.16)
     keygen-passphrase    - can the passphrase be specified when generating keys (false for gpg 2.1 and 2.1.1)
     windows-photoid-bug  - is there a bug in gpg with the output of photoid on Windows (true for gpg < 2.0.16)

     @return: depending on featureName - Boolean unless specified differently:
     (true if feature is available / false otherwise)
     If the feature cannot be found, undefined is returned
     */
    getGpgFeature: function(featureName) {
        let gpgVersion = Gpg.agentVersion;

        if (! gpgVersion || typeof(gpgVersion) != "string" || gpgVersion.length === 0) {
            return undefined;
        }

        gpgVersion = gpgVersion.replace(/\-.*$/, "");
        if (gpgVersion.search(/^\d+\.\d+/) < 0) {
            // not a valid version number
            return undefined;
        }

        const vc = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);

        switch(featureName) {
        case 'version-supported':
            return vc.compare(gpgVersion, "2.0.7") >= 0;
        case 'supports-gpg-agent':
            return vc.compare(gpgVersion, "2.0") >= 0;
        case 'autostart-gpg-agent':
            return vc.compare(gpgVersion, "2.0.16") >= 0;
        case 'keygen-passphrase':
            return vc.compare(gpgVersion, "2.1") < 0 || vc.compare(gpgVersion, "2.1.2") >= 0;
        case 'windows-photoid-bug':
            return vc.compare(gpgVersion, "2.0.16") < 0;
        }

        return undefined;
    }
};
