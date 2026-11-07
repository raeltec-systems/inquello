#!/bin/sh
set -eu
ls -l /etc/resolv.conf
readlink /etc/resolv.conf || true
cat /etc/resolv.conf || true
cat /proc/net/route
