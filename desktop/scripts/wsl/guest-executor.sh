#!/bin/sh
set -eu
exec /usr/bin/python3 -I /usr/local/libexec/inquello-broker.py exec "$@"
