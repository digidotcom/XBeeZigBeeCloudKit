#!/bin/sh
#echo 'web: python manage.py runserver_socketio "0.0.0.0:$PORT"' > Procfile
DJANGO_LOCAL_DEV=1 DJANGO_DEBUG=1 IS_E2E=1 python manage.py runserver_socketio "0.0.0.0:5859"
