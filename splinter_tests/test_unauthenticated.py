#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

import splinter_tests
import splinter_tests.utils
from nose.tools import with_setup
from hamcrest import assert_that, ends_with


def _do_test_redirect(visited_uri):
    def fn():
        # Attempt to go to the given page
        splinter_tests.visit(visited_uri)

        # Sleep the test runner for a moment, to allow the browser to catch up.
        splinter_tests.utils.do_sleep()

        # Check that we ended up on the login page
        assert_that(splinter_tests.browser.url, ends_with("/#/login"))

    fn.description = ("Is user redirected to login if they visit %s?" %
                      visited_uri)
    return fn


# Setup method, called once for the whole module.
def setup():
    splinter_tests.start_browser()

    # First, logout to ensure that we are in fact logged out.
    splinter_tests.visit("/logout")

    # Wait a few seconds for redirect.
    splinter_tests.utils.do_sleep()

    assert_that(splinter_tests.browser.url, ends_with("/#/login"))


# Teardown method, called once for the whole module.
def teardown():
    splinter_tests.kill_browser()


def test_all_other_pages_redirect_to_login():
    yield _do_test_redirect("/#/setup")
    yield _do_test_redirect("/#/devices")
    yield _do_test_redirect("/#/dashboard")
    yield _do_test_redirect("/#/add_widget")
    # /widget_settings is invalid, but should still redirect
    yield _do_test_redirect("/#/widget_settings")
    # Practically guaranteed to be invalid.
    yield _do_test_redirect("/#/widget_settings/foobar")
    # /view_code is invalid, but should still redirect
    yield _do_test_redirect("/#/view_code")
    # Practically guaranteed to be invalid
    yield _do_test_redirect("/#/view_code/foobar")
    yield _do_test_redirect("/#/advanced")
