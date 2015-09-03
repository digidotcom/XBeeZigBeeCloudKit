#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

from hamcrest import assert_that, ends_with, is_
from nose import with_setup

import splinter_tests
from utils import delete_all_dashboards, log_in_clean, do_sleep
import requests

browser = None


def setup():
    splinter_tests.start_browser()
    global browser
    browser = splinter_tests.browser


def teardown():
    splinter_tests.kill_browser()


def clean_slate():
    # Delete all the dashboards
    delete_all_dashboards("test_user", "e2e_password", "login.etherios.com")
    # Log back in
    log_in_clean("test_user", "e2e_password", "login.etherios.com")

    # With no dashboards, logging in should lead to the dashboard setup page.
    assert_that(browser.url, ends_with("#/setup"))


def make_dashboard():
    # Create a blank dashboard.
    req = requests.post(splinter_tests.SERVER_URL + '/api/dashboards',
                        data='{"widgets": []}',
                        headers={'content-type': 'application/json'},
                        auth=('test_user#login.etherios.com', 'e2e_password'))
    req.raise_for_status()

    # Pause for a moment.
    do_sleep(multiplier=0.5)


def find_delete_button():
    """Look up the button under 'Delete current dashboard'."""
    button = browser.find_by_id('deleteDash')
    assert not button.is_empty()
    assert_that(len(button), is_(1))

    return button


@with_setup(clean_slate)
def test_delete_disabled_without_dashboards():
    """Without a dashboard, Advanced Options does not enable the delete button."""
    splinter_tests.visit("#/advanced")

    do_sleep()

    button = find_delete_button()
    assert button.first['disabled']
    assert_that(button.first.text, is_("No dashboards in your account"))


@with_setup(clean_slate)
@with_setup(make_dashboard)
def test_delete_enabled_with_dashboard():
    """With a dashboard, Advanced Options enables the delete button."""
    splinter_tests.visit("#/advanced")

    do_sleep()

    button = find_delete_button()
    assert not button.first['disabled']
    assert_that(button.first.text, is_("Delete dashboard"))


@with_setup(clean_slate)
@with_setup(make_dashboard)
def test_delete_works_and_moves_user_to_setup():
    """'Delete dashboard' button works and redirects user to setup page."""
    splinter_tests.visit("#/advanced")

    do_sleep()

    button = find_delete_button()
    assert not button.first['disabled']

    # Click the delete button
    button.click()

    # Wait a moment while the deletion happens
    do_sleep()

    # Are we at the setup page now?
    assert_that(browser.url, ends_with("#/setup"))

    # If we go back to Advanced Options, is the button disabled?
    splinter_tests.visit("#/advanced")

    do_sleep()

    button = find_delete_button()
    assert button.first['disabled']
