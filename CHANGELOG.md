<a name="xbeezigbee-1.1"></a>
# 1.1.0.0 - released September 2015

## Changes

- Updated various Python dependencies (such as Django) to bring in security
  fixes.
- Re-enabled CSRF validation. (Security fix.)

## Bug Fixes

- The initial 1.0 release of the application was not compatible with Heroku's
  [cedar-14][cedar-14] stack. Version 1.1 includes updated Python dependencies
  which are compatible with cedar-14.
- The initial 1.0 release of the application was missing the `vendor/`
  subdirectory, which contained some third-party dependencies needed for the
  app to function properly. This directory has been properly checked in now.


[cedar-14]: https://devcenter.heroku.com/articles/cedar-14-migration


<a name="xbeezigbee-1.0"></a>
# 1.0.0.0 - released August 2014

Initial open-source release of the XBee ZigBee Cloud Kit application.
