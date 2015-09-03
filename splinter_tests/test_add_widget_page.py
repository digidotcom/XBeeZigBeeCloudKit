#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2015 Digi International Inc., All Rights Reserved.
#

from hamcrest import assert_that, ends_with, is_, contains_string
from nose import with_setup

import splinter_tests
from utils import (delete_all_dashboards, log_in_clean, add_empty_dashboard,
                   screenshot_on_exception, do_sleep)

browser = None


def setup():
    splinter_tests.start_browser()
    global browser
    browser = splinter_tests.browser


def teardown():
    splinter_tests.kill_browser()


def log_in(*auth):
    delete_all_dashboards(*auth)
    add_empty_dashboard(*auth)

    log_in_clean(*auth)

    splinter_tests.visit("/#/add_widget")

    # Wait a moment for everything to settle
    do_sleep()

    with screenshot_on_exception("log_in_not_add_widget"):
        assert_that(browser.url, ends_with('/#/add_widget'))


log_in_before = with_setup(lambda: log_in("e2e_user", "e2e_password",
                                          "e2e_fqdn"))
log_in_test_before = with_setup(lambda: log_in("test_user", "e2e_password",
                                               "login.etherios.com"))


def is_error_message_present(key, message):
    xpath = ("//div[contains(@class, 'alert alert-danger')]/ul/li"
             "/strong[contains(., '{}')]/..").format(key)
    match = browser.find_by_xpath(xpath)

    # Check that we found a matching error message
    with screenshot_on_exception("find_error_%s" % key):
        assert not match.is_empty(), "No error message for %s" % key

        assert_that(match.first.text, contains_string(message))


@log_in_before
def test_initial_errors():
    # We should start out with 4 errors, related to Widget Type, Label,
    # Gateway, and XBee Module
    errors = [
        ("Type", "Invalid widget type selection."),
        ("Label", "This field is required."),
        ("Gateway", "You need to select a gateway."),
        ("XBee Module", "You need to select an XBee module.")
    ]
    for key, message in errors:
        fn = lambda: is_error_message_present(key, message)
        fn.description = "Error message '{}: {}' present?".format(key, message)

        yield fn

    # Select serial data widget - now the Type error goes away?
    options = browser.find_by_css("select#type option")
    assert not options.is_empty()

    def check_gone():
        # Select Serial Data Widget
        splinter_tests.select_by_text("type", "Serial Data Widget")

        with screenshot_on_exception("type_error_still_present"):
            assert not browser.is_text_present(
                "Invalid widget type selection.")

    check_gone.description = ("Error message about widget type is gone after "
                              "picking serial widget?")

    yield check_gone

    for key, message in ((k,m) for k,m in errors if k != "Type"):
        fn = lambda: is_error_message_present(key, message)
        fn.description = "Error message '{}: {}' still present?".format(key, message)
        yield fn


@log_in_test_before
def test_check_configuration():
    '''The 'Check Radio Configuration' button should appear when expected.'''
    # Locate the button by xpath, and not using its name, because we only
    # expect to see the one button, and finding it by its text is more flexible
    # (and closer to what the user would do).
    button_xpath = '//button[contains(., "Check Radio Configuration")]'

    def button_missing(missing=True):
        with screenshot_on_exception("button_missing_assert_%s" % missing):
            buttons = browser.find_by_xpath(button_xpath)

            assert_that(buttons.is_empty(), is_(missing))

    # The button should not be present.
    button_missing()

    # Get the list of widget types, and their associated value in the select
    # tag.
    options = browser.find_by_css("select#type option")
    assert not options.is_empty()

    optmap = {}
    for opt in options:
        optmap[opt.text] = opt.value

    # Select switch widget
    browser.select("type", optmap['On/Off Switch Widget'])
    # The button should not be present.
    button_missing()

    # Select the first gateway in the list
    browser.select("device", '0')
    # The button should not be present.
    button_missing()

    # Wait for the discovery to complete. For the e2e server this should only
    # take a second or two
    do_sleep(multiplier=2)

    # Pick the first XBee in the list
    browser.select('xbeenode', '0')
    # The button should not be present.
    button_missing()

    # Pick the first stream option (DIO0)
    xpath = '//select[@id="sets"]//option[.="DIO0"]'
    # Copied from splinter browser.select implementation
    browser.find_by_xpath(xpath).first._element.click()

    # The button should be present now.
    button_missing(False)


# Execute a basic test of the configuration modal.
# Check that it can be brought up using the 'Check Radio Configuration' button,
# and that it disappears if the user clicks the 'Cancel' button.
@log_in_test_before
def test_configuration_modal_basic():
    '''The configuration modal should appear when the button is clicked.'''
    with screenshot_on_exception("config_modal_basic"):
        # Get the list of widget types, and their associated value in the
        # select tag.
        options = browser.find_by_css("select#type option")
        assert not options.is_empty()

        optmap = {}
        for opt in options:
            optmap[opt.text] = opt.value

        # Select switch widget
        browser.select("type", optmap['On/Off Switch Widget'])

        # Select the first gateway in the list
        browser.select("device", '0')

        # Wait for the discovery to complete. For the e2e server this should
        # only take a second or two
        do_sleep()

        # Pick the first XBee in the list
        browser.select('xbeenode', '0')

        # Pick the first stream option (DIO0)
        xpath = '//select[@id="sets"]//option[.="DIO0"]'
        # Copied from splinter browser.select implementation
        browser.find_by_xpath(xpath).first._element.click()

        # The button should be present now. But first, make sure the modal is
        # not present currently, to be safe.
        assert not browser.is_text_present("Device IO Configuration")

        button = browser.find_by_name("checkRadioConfig")
        assert not button.is_empty()
        button.first.click()

        # Check the modal appears
        assert browser.is_text_present("Device IO Configuration", wait_time=1)

        # Check that there is a close button
        xpath = '//div[@class="modal-footer"]/button[.="Close"]'
        btn = browser.find_by_xpath(xpath)
        assert not btn.is_empty()

        # Click the close button - does the modal go away?
        btn.first.click()
        # Wait a moment
        do_sleep()
        assert not browser.is_text_present("Device IO Configuration")
        assert browser.find_by_xpath(xpath).is_empty()
