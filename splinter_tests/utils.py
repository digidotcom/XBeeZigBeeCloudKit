#
# This Source Code Form is subject to the terms of the Mozilla Public License,
# v. 2.0. If a copy of the MPL was not distributed with this file, You can
# obtain one at http://mozilla.org/MPL/2.0/.
#
# Copyright (c) 2014 Digi International Inc., All Rights Reserved.
#

import json
import os
import requests
import time
from contextlib import contextmanager

from hamcrest import assert_that, is_, equal_to

import splinter_tests
from splinter_tests import SERVER_URL

from xbgw_dashboard.e2e_settings import e2e_users

from logging import getLogger
logger = getLogger("splinter_tests.utils")


DEFAULT_SLEEP_TIME = 5 if 'CI_BUILD' in os.environ else 1


def delete_all_dashboards(username, password, fqdn):
    """Delete any and all dashboards in the given user's account."""
    sess = requests.Session()

    # Set up authentication
    sess.auth = ('{}#{}'.format(username, fqdn), password)
    # Ask for JSON responses
    sess.headers.update({'accept': 'application/json'})

    current_dashboards = sess.get(SERVER_URL + "/api/dashboards")
    # Raise an exception if the request failed.
    current_dashboards.raise_for_status()

    resp = current_dashboards.json()

    logger.debug("User %s#%s has %d dashboards", username, fqdn, len(resp))

    if len(resp):
        # There's at least one dashboard to delete.
        for dashboard in resp:
            if 'url' in dashboard:
                deletion = sess.delete(dashboard['url'])
                deletion.raise_for_status()
        # Pause for a moment, to allow any deletions to fully take effect.
        do_sleep()


def add_empty_dashboard(username, password, fqdn):
    """Add an empty dashboard to the given user's account."""
    data = json.dumps({"widgets": []})
    headers = {'content-type': 'application/json'}
    auth = ('{}#{}'.format(username, fqdn), password)

    url = SERVER_URL + '/api/dashboards'

    r = requests.post(url, data=data, headers=headers, auth=auth)

    r.raise_for_status()


def log_in_clean(username, password, fqdn=""):
    browser = splinter_tests.browser

    # Sign out.
    splinter_tests.visit("/logout")

    # Navigate to login page, targeting FQDN if provided
    if fqdn:
        fqdn = "/{}".format(fqdn)
    splinter_tests.visit("/#/login" + fqdn)

    do_sleep()

    # Check that no error div is present
    with screenshot_on_exception("log_in_clean"):
        # Wait up to 15 seconds for the page to load up (detected by seeing the
        # 'Log in' text
        header_xpath = '//h1[contains(@class, "title") and contains(., "Log in")]'
        assert browser.is_element_present_by_xpath(header_xpath, wait_time=15)

    # Log in with the given credentials
    browser.fill("username", username)
    browser.fill("password", password)
    browser.find_by_css('.btn.login-button').click()

    # Wait for a moment
    do_sleep()

    # Check that the login was successful
    assert not browser.is_text_present("Username or password was incorrect.")


def get_general_page_links():
    """Generator of the links that appear on every page."""
    # Check that each link is present, and links to the correct URL.
    yield "Documentation", "http://www.digi.com/xbgatewayzb"
    yield "Digi International Inc.", "https://www.digi.com/"
    yield "Contact us", "http://www.digi.com/contactus/"
    yield "Privacy policy", "https://www.digi.com/legal/privacy"
    yield "Terms & conditions", "https://www.digi.com/legal/index"


def do_check_link(link_text, expected_href):
    def fn():
        browser = splinter_tests.browser
        # Use by_partial_text because some of the links have
        # whitespace/newlines around their text.
        link = browser.find_link_by_partial_text(link_text)
        assert not link.is_empty()
        assert_that(link['href'], is_(equal_to(expected_href)))
    desc = "Check the link containing '{}' points to '{}'"
    fn.description = desc.format(link_text, expected_href)
    return fn


def get_e2e_user(username="e2e_user"):
    return next((user for user in e2e_users if user.username == username),
                None)


@contextmanager
def screenshot_on_exception(filename):
    try:
        yield
    except Exception:
        splinter_tests.screenshot(filename)
        raise


def do_sleep(multiplier=1):
    time.sleep(DEFAULT_SLEEP_TIME * multiplier)


def screenshot_on_exception_decorator(filename):
    def wrap_fn(function):
        def wrapper(*args, **kwargs):
            try:
                function(*args, **kwargs)
            except Exception:
                splinter_tests.screenshot(filename)
                raise
        return wrapper
    return wrap_fn
