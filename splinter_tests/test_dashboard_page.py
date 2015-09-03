#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

from hamcrest import assert_that, ends_with, is_in
from functools import partial
from nose import with_setup
import logging

import splinter_tests
from utils import (delete_all_dashboards, log_in_clean, get_general_page_links,
                   do_check_link, do_sleep)
import requests

browser = None

logger = logging.getLogger("test_dashboard_page")


def setup():
    splinter_tests.start_browser()
    global browser
    browser = splinter_tests.browser

    # Add some descriptions to module-level functions that we yield out of
    # tests.
    funcs = (check_dashboard_is_empty, check_we_are_at_dashboard_page,
             click_add_widget, click_cancel)
    for fn in funcs:
        fn.description = fn.__doc__


def teardown():
    splinter_tests.kill_browser()


def clean_slate():
    # Delete all this user's dashboards
    delete_all_dashboards("test_user", "e2e_password", "login.etherios.com")
    # Log back in
    log_in_clean("test_user", "e2e_password")

    # With no dashboards, logging in should lead to the dashboard creation
    # page.
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

    # Navigate to the dashboard page
    splinter_tests.visit("#/dashboard")


def expand_username_menu():
    # Expand the menu by clicking on the username in the top right.
    link_css = ".navbar a.dropdown-toggle"
    username_link = browser.find_by_css(link_css)

    assert not username_link.is_empty()
    username_link.click()


clean_slate_before = with_setup(clean_slate)
make_dashboard_before = with_setup(make_dashboard)


def check_dashboard_is_empty():
    '''Check there are no widgets on this page.'''
    widgets = browser.find_by_css(".gridster > .widget")
    assert widgets.is_empty()


def check_we_are_at_dashboard_page():
    '''Are we currently on the dashboard page?'''
    assert_that(browser.url, ends_with("/#/dashboard"))


def click_add_widget():
    '''Find and click the "Add Widget" button, if it is present.'''
    # Find the 'Add Widget' button
    btn = browser.find_by_xpath("//button[contains(.,'Add Widget')]")
    assert not btn.is_empty()

    # Click the button, make sure we landed at the Add Widget page
    btn.first.click()
    assert_that(browser.url, ends_with("/#/add_widget"))
    assert browser.is_text_present("Create a new Widget")


def click_cancel():
    '''Find and click the "Cancel" button, if it is present.'''
    btn = browser.find_by_xpath("//button[contains(.,'Cancel')]")
    assert not btn.is_empty()
    btn.first.click()
    check_we_are_at_dashboard_page()



@clean_slate_before
@make_dashboard_before
def test_links_correct():
    # First, make sure we're at the dashboard page.
    yield check_we_are_at_dashboard_page

    # There shouldn't be any widgets in the dashboard, since we created a blank
    # dashboard.
    yield check_dashboard_is_empty

    expand_username_menu()

    # Verify the 'Devices', 'Advanced Options' and 'Manage Account' links
    yield do_check_link("Devices", splinter_tests.SERVER_URL + "/#/devices")
    yield do_check_link("Advanced Options",
                        splinter_tests.SERVER_URL + "/#/advanced")
    yield do_check_link("Manage Account", "https://login.etherios.com/home.do")

    # Verify all the other links that should be on this page.
    for linktext, url in get_general_page_links():
        yield do_check_link(linktext, url)


@clean_slate_before
@make_dashboard_before
def test_add_widget_simple():
    # First, make sure we're at the dashboard page.
    # (Note: We want the first thing we do in this test function to be a yield,
    # so that later asserts which aren't contained in yielded functions are not
    # executed when nose runs this function to acquire the generator.)
    yield check_we_are_at_dashboard_page

    # Click 'Add Widget' (also checks that we end up on the 'Create a new
    # Widget' page)
    yield click_add_widget

    # If we click Cancel, do we end up back on the dashboard page?
    yield click_cancel

    # Return to Add Widget page
    yield click_add_widget

    # Open the username menu, so we can check the links
    expand_username_menu()

    # Verify the 'Devices', 'Advanced Options' and 'Manage Account' links
    yield do_check_link("Devices", splinter_tests.SERVER_URL + "/#/devices")
    yield do_check_link("Advanced Options",
                        splinter_tests.SERVER_URL + "/#/advanced")
    yield do_check_link("Manage Account", "https://login.etherios.com/home.do")

    # 'Cancel' should bring us back to the dashboard
    yield click_cancel

    # 'Add Widget' should bring us back there
    yield click_add_widget

    # Verify all the other links that should be on this page.
    for linktext, url in get_general_page_links():
        yield do_check_link(linktext, url)

    # Wait for Angular to catch up to us (specifically, to allow Angular to
    # fetch the user's devices and populate the selection box)
    do_sleep()

    # Test how selecting a gateway changes the error state on the page
    # TODO Should this go in something like test_add_widget_page?

    gateway_selection_row = browser.find_by_xpath(
        # Find the 'select' with name 'device', get its grandparent
        '//select[@name = "device"]/../..')
    assert not gateway_selection_row.is_empty()
    assert gateway_selection_row.first.has_class('has-error')

    # There should also be some error text near the top of the page
    # Find the list item with a bold "Gateway:" string inside it
    err_item_xpath = ("//div[contains(@class, 'alert alert-danger')]/ul/li"
                      "/strong[.='Gateway:']/..")
    gateway_error = browser.find_by_xpath(err_item_xpath)
    assert not gateway_error.is_empty()
    # Check that this item is visible on the page
    assert gateway_error.first.visible
    # The error should be 'You need to select a gateway'
    assert_that("You need to select a gateway", is_in(gateway_error.text))

    # If we select a gateway, the has-error class should go away
    # test_user has only one device, so select value 0
    browser.select("device", "0")

    assert not gateway_selection_row.first.has_class('has-error')
    # The error should also disappear
    # The 'Gateway:' error item is only hidden when the value becomes valid,
    # and not destroyed, so we can reuse the gateway_error variable from above
    assert not gateway_error.first.visible
