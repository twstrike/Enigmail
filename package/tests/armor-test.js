/*global do_load_module: false, do_get_file: false, do_get_cwd: false, testing: false, test: false, Assert: false, resetting: false, JSUnit: false, do_test_pending: false, do_test_finished: false, component: false, Cc: false, Ci: false */
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

testing("armor.jsm"); /*global Armor: false */

test(function shouldLocateArmoredBlock() {
    const text = "" +
              "    -----BEGIN PGP SIGNATURE-----\n" +
              "    Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n" +
              "    Comment: GPGTools - https://gpgtools.org\n" +
              "\n" +
              "    iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n" +
              "    6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n" +
              "    R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n" +
              "    95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n" +
              "    xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n" +
              "    9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n" +
              "    4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n" +
              "    yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n" +
              "    j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n" +
              "    kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n" +
              "    P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n" +
              "    o29CFuiGhiz3ISDRKrtH\n" +
              "    =MeaY\n" +
              "    -----END PGP SIGNATURE-----";
    const beginIndexObj = {};
    const endIndexObj = {};
    const indentStrObj = {};
    const indentStr = "";
    const blockType = Armor.locateArmoredBlock(text, 0, indentStr, beginIndexObj, endIndexObj, indentStrObj);
    Assert.equal(0, beginIndexObj.value);
    Assert.equal("    ", indentStrObj.value);
    Assert.equal("SIGNATURE", blockType);
});

test(function shouldExtractSignaturePart() {
    const signature = {
        text: "Hello I'm here.\n please contact me via this email! \n",
        header: "Version: GnuPG/MacGPG2 v2.0.22 (Darwin)\n" +
            "Comment: GPGTools - https://gpgtools.org\n",
        armor: "iQIcBAEBCgAGBQJVSkxrAAoJEFco/AmgID3sm68QALBa6I6r7LLopA8R+S/CpO66\n" +
            "6qQm0zidQ7bhMDNiKPD+/TG/Blvu0n10Cnt5Wk6lD7dwPKAsHVq1fGUva4rkEbi4\n" +
            "R9nx7BQGBiFCpYl3K1bHJ/QrnYms5wpKseqGtW+8wq8wKx68sWi83xsKN2Ml2SGA\n" +
            "95nvbvaQ6yQlynGXhPhGhdT3L2tdPsulnSwnd3NZJ83U73aYIN5jc5+UyWduLqho\n" +
            "xnD127JQYb8X2UjdXyOnA/E/VHvCWt9+Ck9s6VdwUSEBs41vJ/kyrmPE6u9sIQX7\n" +
            "9ZujMzN05+9A1Mtwp4dsDIbLMeX6FS44CqcGiUKzyx5ewiYq9lcAReM52i+4kmBM\n" +
            "4B/yLXDrWWOBiUCUQaOWC8PyBAc2cHLf62m6+oEfEMMCXli/XZuBC442qYuWNgf+\n" +
            "yLLhyaA27rqMxmhdFtKSOzrRaxkTTb1oQFQwHYfeHT7kFpPjq4p1Jv+p8w0pcq0P\n" +
            "j5hiLABLveEcLn4fEpqLROdi/Vz6Mp2nnbhcz+xe/w2KWmGgfl/kg2T/9YVeLox9\n" +
            "kaqVqNezYPfFZ1iQgGKNBXl1SMqHtTRAvHfH1k0E8qg3t222KU2pALp0A/LSvu/T\n" +
            "P3g8OIpqWRI0uBZQ/Gp/S1Fjb3DHfE+Y3IhVf5SkhjIYIvViSrbGqGUmK+jwGMia\n" +
            "o29CFuiGhiz3ISDRKrtH\n" +
            "=MeaY"
    };
    const signature_block = "\n\n" +
            signature.text +
            "-----BEGIN PGP SIGNATURE-----\n" +
            signature.header +
            "\n" +
            signature.armor +
            "\n" +
            "-----END PGP SIGNATURE-----";

    const signature_text = Armor.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_TEXT);
    const signature_headers = Armor.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_HEADERS);
    const signature_armor = Armor.extractSignaturePart(signature_block, Ci.nsIEnigmail.SIGNATURE_ARMOR);
    Assert.equal(signature.text, signature_text);
    Assert.equal(signature.header, signature_headers);
    Assert.equal(signature.armor.replace(/\s*/g, ""), signature_armor);
});
