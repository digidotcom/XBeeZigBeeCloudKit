/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Copyright (c) 2014 Digi International Inc., All Rights Reserved.
 */

// Provides a factory which inspects the browser's User Agent string, returning
// important pieces of information inferred from it, such as what major browser
// is being used (Chrome, Firefox, IE, etc.) and which version.
//
// This code is derived from the Dojo Toolkit core browser-sniffing code.
// https://github.com/dojo/dojo, file sniff.js

'use strict';

angular.module('XBeeGatewayApp')
.factory('BrowserInfo', function ($window) {
    var navigator = $window.navigator,
        document = $window.document,
        ua = navigator.userAgent,
        av = navigator.appVersion,
        tv = parseFloat(av),
        result = {};

    result.khtml = av.indexOf("Konqueror") >= 0 ? tv : undefined;
    result.webkit = parseFloat(ua.split("WebKit/")[1]) || undefined;
    result.chrome = parseFloat(ua.split("Chrome/")[1]) || undefined;

    result.safari = av.indexOf("Safari") >= 0 && !result.chrome ? parseFloat(av.split("Version/")[1]) : undefined;

    if (!result.webkit) {
        // Opera
        if (ua.indexOf("Opera") >= 0) {
            result.opera = (tv >= 9.8 ? parseFloat(ua.split("Version/")[1]) || tv : tv);
        }

        // Mozilla and Firefox
        if (ua.indexOf("Gecko") >= 0 && !result.khtml) {
            result.mozilla = tv;
        }
        if (result.mozilla) {
            result.ff = parseFloat(ua.split("Firefox/")[1] || ua.split("Minefield/")[1] || undefined);
        }

        // IE
        // (In Chrome, when emulating IE user agent, document.all is "defined"
        // but not truthy, so check for its length.)
        var all;
        try {
            all = document.all.length;
        } catch (e) {
            // document.all is not defined
        }
        if (all && !result.opera) {
            var isIE = parseFloat(av.split("MSIE ")[1]) || undefined;

            // Per Dojo code:
            // In cases where the page has an HTTP header or META tag with
            // X-UA-Compatible, then this is in emulation mode.
            // Make sure isIE reflects the desired version.
            // document.documentMode of 5 means quirks mode.
            // Only switch the value if documentMode's major version is
            // different from isIE's major version.
            var mode = document.documentMode;
            if (mode && mode != 5 && Math.floor(isIE) != mode) {
                isIE = mode;
            }

            result.ie = isIE;
        }
    }

    return result;
})
.directive('browserWarnings', function (BrowserInfo) {
    return {
        restrict: 'AE',
        link: function (scope) {
            scope.old_browser = true;
            scope.old_browser_desc = "";
            scope.unsupported = false;

            if (BrowserInfo.chrome && BrowserInfo.chrome < 20) {
                scope.old_browser_desc = "Chrome 19 and lower";
            } else if (BrowserInfo.ff && BrowserInfo.ff < 13) {
                scope.old_browser_desc = "Firefox 12 and lower";
            } else if (BrowserInfo.safari && BrowserInfo.safari < 6) {
                scope.old_browser_desc = "Safari 5 and lower";
            } else if (BrowserInfo.ie && BrowserInfo.ie < 9) {
                // Conditional IE comments in index.html should prevent
                // JavaScript execution if truly running on IE8 or below. This
                // handles user agent emulation and any edge cases where a
                // browser reports to be IE8 or lower.
                scope.old_browser_desc = "Internet Explorer 8 and lower";
            } else if (!(BrowserInfo.ie || BrowserInfo.safari || BrowserInfo.chrome || BrowserInfo.ff)) {
                scope.old_browser = false;
                scope.unsupported = true;
                scope.unsupported_error = "Your browser is not supported. Supported browsers are Chrome 20+, Firefox 13+, Safari 4+ and IE 9+.";
            } else {
                // If none of these cases match, then we can guess we support
                // this browser.
                scope.old_browser = false;
            }
        },
        templateUrl: 'templates/browser_detections.tpl.html'
    }
});
