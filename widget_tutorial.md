<style>
pre, code { background-color: #f8f8f8; border: 1px solid #ddd; border-radius: 3px }
pre { margin-left: 1em; padding: 1em; }
code { font-size: 10pt; font-family: Monaco, Consolas, Monospace; }
pre > code { background: none; border: 0; }
body {color:#333333; margin: 0 auto; width: 960px; font-family: Helvetica, Arial, Serif; }
</style>

Creating a custom widget
========================

The XBee ZigBee Cloud Kit makes it easy to create your own widgets from scratch.
To start, open a command line and run `grunt widget`. You will be prompted for
a widget type string, and a description. (For example, if you are making a
widget to report if the front door is open, you might enter "front-door" as the
widget type and "Front Door Widget" as the description.)

The `grunt widget` command will then generate new widget code based on your
input, and place that code in a new directory under `src/common/widgets`. In
this directory, there will be three files initially: a JavaScript file (file
extension `.js`), which contains an AngularJS
[directive](http://docs.angularjs.org/guide/directive) for the new widget; an
AngularJS HTML template (file name ending in `.tpl.html`) defining the basic
HTML for this widget; and a unit test file (file name ending in `.spec.js`)
which you can use to write [Jasmine](http://pivotal.github.io/jasmine/) unit
tests for your widget, if you wish.


# Hands-on example

Let's dive in with an example of creating a custom widget. For this example, we
will create a widget to indicate if a door is open or closed. We will assume
that you have wired a digital sensor into pin DIO8 (originally allocated to a
slide switch) on your Cloud Kit board, and that a value of 1 corresponds to the
door being open while a value of 0 means the door is closed.

## Step 1: Check out the source code

First, you must obtain a local copy of the application source code. Do this by
cloning the GitHub repository.

    $ git clone https://github.com/digidotcom/XBeeZigBeeCloudKit


## Step 2: Create the widget code

1.  Open a command prompt, and `cd` to the root directory of the Cloud Kit web
    app code.

        $ cd XBeeZigBeeCloudKit
        $ ls
        bower.json      changelog.tpl   LICENSE.TXT ...

1.  Run the Grunt command to generate a new widget, and answer the prompts.

    <pre>
    $ grunt widget
    <u>Running "widget" task</u>
    Widget type (e.g. led): <i>door</i>
    Type description (e.g. LED Widget): <i>Door Widget</i>
    Created new widget definition in /home/foo/XBeeZigBeeCloudKit/src/common/widgets/doorCustomWidget
    The widget type key is: door-custom
    The description of the widget is: Door Widget
    </pre>

You will find the newly-created widget code under the directory
`src/common/widgets/doorCustomWidget`.

## Step 3: Edit the widget template

Change directories to where the newly-created widget code resides.

    $ cd src/common/widgets/doorCustomWidget

In this directory, you will find three files:

  * `doorCustomWidget.js`: Contains this widget's directive code, as well as
                           code to tie it into the Cloud Kit widget framework
  * `doorCustomWidget.spec.js`: Jasmine unit test file for the widget
  * `doorCustomWidget.tpl.html`: AngularJS template for this widget

First, we will edit the widget HTML template. Suppose we just want to render
some text to indicate whether the door is open or closed. As mentioned before,
we assume a value of 1 from the sensor means the door is open, and a value of 0
means it is shut.

##### Option 1: Use ng-if
One way to create this widget would be to use the
[ng-if](http://docs.angularjs.org/api/ng.directive:ngIf) directive, which
modifies the DOM based on an expression. In this case, we want to show "Door is
closed" if the value indicates the door is closed, and "Door is open"
otherwise.

Edit `doorCustomWidget.tpl.html` to have the following contents:

    <div class="widget-door-custom">
        <div style="text-align: center; width: 100%">
            <p ng-if="value == 0">Door is closed</p>
            <p ng-if="value != 0">Door is open</p>
        </div>
    </div>

##### Option 2: Use ng-show
Another way to create this widget, very similar to option 1, is to use the
[ng-show](http://docs.angularjs.org/api/ng.directive:ngShow) directive, which
makes the given HTML element visible or hidden, depending on the value of the
given expression.

Edit `doorCustomWidget.tpl.html` to have the following contents:

    <div class="widget-door-custom">
        <div style="text-align: center; width: 100%">
            <p ng-show="value == 0">Door is closed</p>
            <p ng-show="value != 0">Door is open</p>
        </div>
    </div>

(This method will be slightly more efficient than option 1, because it does not
need to destroy and recreate the DOM element each time "value" is updated, but
the difference in this case will be negligible.)

##### Option 3: Use ng-switch
Yet another option is to use the
[ng-switch](http://docs.angularjs.org/api/ng.directive:ngswitch) directive,
which can be used to conditionally swap DOM structure depending on the value of
an expression.

Edit `doorCustomWidget.tpl.html` to have the following contents:

    <div class="widget-door-custom">
        <div style="text-align: center; width: 100%" ng-switch="value">
            <p ng-switch-when="0">Door is closed</p>
            <p ng-switch-default>Door is open</p>
        </div>
    </div>

##### Option 4: Use AngularJS data binding markup and a scope function
Finally, you might choose to define a function on the widget scope which
returns different text depending on the value reported by the sensor. The first
step is to edit `doorCustomWidget.tpl.html`:


    <div class="widget-door-custom">
        <div style="text-align: center; width: 100%">
            <p>{{ get_text(value) }}</p>
        </div>
    </div>

Now the contents of the `<p>` tag will be automatically updated to reflect the
return value of the function `get_text` when it is called with `value` as an
argument.

You will need to remember to add the `get_text` function in the next step if
you chose this option.


## Step 5: Editing the widget code

The next step is to modify the widget's code to function as we need.
Edit `doorCustomWidget.js` as follows:

1.  Since we need this widget to receive data updates from Device Cloud, you
    will need to change the line `has_input: false,` to `has_input: true,`.
    This line can be found near the bottom of the file, inside the
    `widget_spec` object.

    (If you don't change `has_input` to true, then you will not see an option
    to specify the input stream for this widget, and the widget will not
    receive updates from Device Cloud.)

2.  You can delete the contents of the `options` array; this array specifies
    any custom widget settings you might want to define. (You can change it to
    `options: [ ]`)

3.  If you went with option #4 above (using a scope function to decide what
    text to display), you will need to add a `get_text` function to the
    widget's scope. Somewhere within the `linker` function defined near the top
    of `doorCustomWidget.js` (perhaps just below the `utils.postlinkWidget`
    call), add the following code:

        scope.get_text = function (value) {
            if (value == 0) {
                return "Door is closed.";
            } else {
                return "Door is open.";
            }
        };

    The logic in this function can be as complicated as you wish.

## Step 6: Testing the widget

Now that you have designed your first widget, it's time to check that it works.

Run `grunt build-notest` to "compile" the front-end application code into the
`build/static/` directory. (If you wish to run the front-end unit tests, you
can run `grunt build` instead.)

    # Change directories back to the root directory of the code
    $ cd /home/foo/cloudkitapp

    $ grunt build-notest

Next, run `foreman start` to launch the application server, and navigate to
http://localhost:5000. (This is assuming that you followed the installation
instructions in the README document, to be able to run the application server
in a local environment.)

    $ foreman start

Having opened the Cloud Kit application in your browser, log in to the
application, and if necessary, create a new dashboard.

On the dashboard page, click the "Add Widget" button.

On the "Create a new Widget" page,

  1. Select "Door Widget" in the Widget Type dropdown. (If you do not see this
    option, check that you have followed the previous steps correctly, and that
    the `grunt build` or `grunt build-notest` command was successful.)

  1. Add a label to this new widget. ("My First Widget", perhaps.)

  1. Select your XBee Gateway in the Gateway dropdown.

  1. Select your XBee radio in the XBee Node dropdown.

  1. Select DIO8 in the Input Stream dropdown.

     * You can press the "Check Radio Configuration" button beside the
        dropdown to check that the XBee radio is configured to use DIO8 as a
        digital input.

  1. Press "Save" to add this widget to your dashboard.

You will be redirected to the dashboard page, where your widget should now be
visible. (It will likely appear toward the bottom of the page.)

Test that the widget code works by opening and closing the door, refreshing the
dashboard page each time. You should see the widget change between reading
"Door is open" and "Door is closed". (You need to refresh the page because
Device Cloud does not allow HTTP push monitors to be sent to local addresses,
and by refreshing the page, the application fetches the most recent data from
Device Cloud.)

If the widget is working, then it's time to push your new code to Heroku!

## Step 7: Updating the Heroku application

(You will need to have followed the instructions under "Heroku setup" in the
"App setup for Heroku" section of the README before this step will work. You
need a Heroku app to push code to.)

Commit the new widget code to Git:

    $ git add src/common/widgets/doorCustomWidget

    $ git commit -m "Add new door widget."

Push the updated code to Heroku:

    $ git push heroku master

Once the `git push` command completes successfully, you can open the Heroku app
in the browser, log in, and you will be able to add a door widget to your
dashboard, just like you did in step 4 above.

# Congratulations!

You just created your first XBee ZigBee Cloud Kit dashboard widget.

# Next steps

You can make widgets to do practically anything you want. You could...

## Show a different image depending on the stream value

    <div class="widget-reactor-monitor">
        <div style="text-align: center; width: 100%">
            <img ng-src="/static/assets/mywidget/{{get_image(value)}}">
        </div>
    </div>

<!-- separate these two code blocks -->

    # Add this function to the widget JS file
    scope.get_image = function (value) {
        if (value < 500) {
            return "reactor_cool.jpg";
        } else if (value < 1000) {
            return "reactor_warm.jpg";
        } else {
            return "reactor_overheating.jpg";
        }
    };

Suppose you have three images, `reactor_cool.jpg`, `reactor_warm.jpg`, and
`reactor_overheating.jpg`, that you want to use to represent the state of the
nuclear reactor in your backyard. If you create a new directory under
`src/assets` named `mywidget` (you could name it anything you want - just be
sure to update the widget template accordingly) and place those three images in
that directory, then this template and corresponding widget scope function will
let you visualize how hot your nuclear reactor is.

(Note: If your images are larger than the widget, you can easily change the
dimensions of the widget by modifying the `size` attribute in the `widget_spec`
object. This is the same object where you modified `has_input`)

(P.S.: Digi does not recommend using the XBee ZigBee Cloud Kit to monitor your
backyard nuclear reactor.)

## Build a widget composed of other, smaller pieces

In this example, we'll build a widget that has three sliders in it. (Maybe
you're controlling a sound mixer.) This example is going to assume that you
can control the sound mixer by sending serial messages like the following to
the XBee:

    channel1,100\rchannel2,200\r

(This would change the channel #1 value to 100, and channel #2 to 200.)

Start by using the `grunt widget` command to start a new widget:

<pre>
$ grunt widget
<u>Running "widget" task</u>
Widget type (e.g. led): <i>mixer</i>
Type description (e.g. LED Widget): <i>My Mixer Widget</i>
Created new widget definition in /home/foo/XBeeZigBeeCloudKit/src/common/widgets/mixerCustomWidget
The widget type key is: mixer-custom
The description of the widget is: My Mixer Widget
</pre>

Now you need to edit the widget template file,
`src/common/widgets/mixerCustomWidget/mixerCustomWidget.tpl.html`,
to include the three sliders.

    <div class="widget-sliders-galore">
        <div ui-slider in-value="in_value[0]" out-value="value[0]"
            min="widget.low" max="widget.high" step="1"></div>
        <div ui-slider in-value="in_value[1]" out-value="value[1]"
            min="widget.low" max="widget.high" step="1"></div>
        <div ui-slider in-value="in_value[2]" out-value="value[2]"
            min="widget.low" max="widget.high" step="1"></div>
    </div>

Now you can start writing the custom logic behind your mixer widget. You will
need to edit
`src/common/widgets/mixerCustomWidget/mixerCustomWidget.js`.

First, let's add a dependency on the `notificationService` service. This will
give your widget the ability to create new notifications within the dashboard
application. Near the top of the file, edit the following line:

    .directive('mixerCustomWidget', function (widgetRegistry, utils, $log)) {

to this:

    .directive('mixerCustomWidget', function (widgetRegistry, utils, $log, notificationService)) {

Next, let's add the custom widget settings you'll need. Toward the bottom of
the file, find the widget_spec object, and make the following changes:

  * Change the `size` value to `[3, 3]`. This will make the widget take up 3
    grid cells in the dashboard, in either direction.
  * Change the `options` value to the following:

        options: [
            {key: "low", type: "number", label: "Low value", required: false,
             minimum: 0, maximum: 1000, "default": 0},
            {key: "high", type: "number", label: "High value", required: false,
             minimum: 0, maximum: 1000, "default": 1023,
             dependencies: "low", conform: function (val, obj) {
                return obj.low < val;
             }, messages: {
                conform: "High value must be greater than low value"
             }
            }
        ]

    This specifies two new widget settings for the mixer widget: a low value,
    and a high value. These are used to set the minimum and maximum values of
    the sliders.

For convenience, add these lines underneath the `utils.postlinkWidget` call.
This will make it easier to reference the "Gateway" and "XBee Module"
selections from the widget settings.

    var device_id = scope.widget.device,
        ext_addr = scope.widget.radio;

Now, let's declare the variables used by the sliders to represent the slider
state.

    scope.in_value = [0, 0, 0];
    scope.value = [undefined, undefined, undefined];

(`in_value` is the initial value loaded into the sliders. For simplicity, we'll
hard code this to 0. Later, you'll learn how to pre-fetch stream values.)

At this point, we've created the three sliders, and declared their backing
models in our Angular code, but now we need to write the code to send the new
values back down to the XBee. Let's do this by using [scope.$watch][watch]
and the dashboard app's APIs.

[watch]: https://code.angularjs.org/1.2.0-rc.2/docs/api/ng.$rootScope.Scope#$watch 

    function send_values(values) {
        var to_send = "channel1," + values[0] + "\r";
        to_send += "channel2," + values[1] + "\r";
        to_send += "channel3," + values[2] + "\r";

        $log.info("Serial text to send: " + to_send);

        dashboardApi.send_serial(device_id, ext_addr, to_send).then(function () {
            $log.info("Successfully updated mixer values");
            notificationService.success(undefined, "Updated mixer values.");
        }, function (response) {
            $log.error("Error updating mixer values.", response.data);
            notificationService.error(response.data, "Failed to update mixer values");
        });
    }

    scope.$watch('value', _.debounce(send_values, 2000), true);

This will make AngularJS automatically watch the values in `scope.value` for
any changes. By wrapping the `send_values` function in a call to
[_.debounce](http://lodash.com/docs#debounce), we make it so that `send_values`
is only called once the values have not changed for two seconds. This will let
you drag the sliders around, without worrying about the value being sent each
and every time a value is updated.

<br />
### Loading current values

Now, imagine that you have your XBee set up so that channels 1, 2 and 3 are
reported via analog lines 0, 1 and 2, respectively. (That is, channel 1 is
reported on AD0, 2 on AD1, etc.) It's easy to add some "pre-fetch" logic to the
widget, so that Device Cloud's most recent value for those streams is loaded
into the widget.

First, you'll need the widget to depend on the `dataStreams` service:

    .directive('mixerCustomWidget', function (widgetRegistry, utils, $log, notificationService, dataStreams)) {

Now, you must "listen" for values on these data streams. We will also set up
the code to automatically remove these listeners once a value has been captured
or if the widget is destroyed first.

    var rm_listeners = [];
    for (var i = 0; i < 3; i++) {
        var stream = "xbee.analog/[" + ext_addr + "]!/AD" + i;
        function listener (val) {
            scope.values[i] = val;
            // Unregister the listener.
            rm_listeners[i]();
            // Make sure that doesn't get called again.
            rm_listeners[i] = angular.noop;
        }

        rm_listeners.push(dataStreams.listen(device_id, stream));
        dataStreams.get_initial_data(device_id, stream);
    }

    scope.$on('$destroy', function () {
        for (var i in rm_listeners) {
            rm_listeners[i]();
        }
    });
